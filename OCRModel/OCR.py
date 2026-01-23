import cv2
import os
import re
from paddleocr import PaddleOCR
from difflib import get_close_matches
from collections import defaultdict
import csv

real_menus = [
    "เป๊ปซี่",
    "ชาเขียวร้อน",
    "หมูคารูบิ&คุโรบูตะ 2",
    "คารูบิเซต 200กรัม",
    "เซตหมูคารูบิ 100กรัม",
    "เซตหมู&กุ้งลายเสื้อ2",
    "น้ำแข็ง",
    "ผักสลัด",
    "เซตหมูคารูบิ 300กรัม",
    "ซุปสาหร่ายวากาเมะ"
]

# Initialize PaddleOCR
print("Initializing PaddleOCR with 'th' model...")
try:
    ocr = PaddleOCR(lang='th') 
except Exception as e:
    print(f"Fatal error during initialization: {e}")
    exit()

# Define file paths
img_path = 'test_image/sample_bad_image1.jpg'
output_img_file = 'output_image/layout_detection_v5.jpg'
output_csv_file = 'output_csv/sales_table_v2.csv'

# Define Regex Filters
price_regex = re.compile(r'^\d+\.\d{2}$') 
total_keywords = ['total qty', 'ยอดรวม', 'vat', 'credit card']

# Regex to find explicit QTY-Name structure (starts with QTY + separator)
explicit_qty_name_regex = re.compile(r'^\s*([\d\s×x]+)\s*[:.]\s*(.*)')

# Regex to check if a line is just a quantity or separator
standalone_qty_regex = re.compile(r'^\s*([\d\s×x]+)\s*$') 

# Run OCR & layout Detection
print(f"Processing image: {img_path}")
try:
    result = ocr.predict(input=img_path)
    if not result[0]:
        print("No text detected.")
        exit()

    result_data = result[0]
    
    # Layout Detection
    y_start_pixel = 99999
    y_end_pixel = 99999
    for poly, text, score in zip(result_data['rec_polys'], result_data['rec_texts'], result_data['rec_scores']):
        text_clean = text.strip().lower()
        current_y_top = poly[:, 1].min()
        if price_regex.match(text_clean):
            if current_y_top < y_start_pixel: y_start_pixel = current_y_top
        if any(keyword in text_clean for keyword in total_keywords):
            if current_y_top < y_end_pixel: y_end_pixel = current_y_top
    Y_START = y_start_pixel - 10
    Y_END = y_end_pixel - 10
    if Y_START > 9000: Y_START = 0 
    if Y_END > 9000: Y_END = 2000 
    print(f"Boundaries set: {Y_START:.0f} to {Y_END:.0f}")

    # Clear unecessary data
    image = cv2.imread(img_path)
    raw_item_list = [] 
    for poly, text, score in zip(result_data['rec_polys'], result_data['rec_texts'], result_data['rec_scores']):
        text = text.strip()
        avg_y = poly[:, 1].mean()
        if not (Y_START < avg_y < Y_END): continue 
        if price_regex.match(text): continue 
        if 'total qty' in text.lower(): continue
        if re.fullmatch(r'^[x×:.]+$', text): continue 
        if not re.search(r'[ก-ฮa-zA-Z\d]', text): continue
            
        raw_item_list.append({'text': text, 'poly': poly})

    print("--- Detected Item ---")
    for item in raw_item_list:
        print(f"{item['text']}")
    
    # Pair Qty and Name, then Fuzzy match and correct
    aggregated_items = defaultdict(int) 
    boxes_to_draw = []
    
    print("\n--- Before name correction ---")
    i = 0
    while i < len(raw_item_list):
        current_item = raw_item_list[i]
        text = current_item['text']
        poly = current_item['poly']
        
        # Start a list to hold boxes for this specific menu item
        # If it's just one line, this list will have 1 box.
        # If we find a qty on the next line, we will add that box to this list.
        current_polys = [poly] 
        
        qty = 1 
        name_to_check = text
        
        # Check for explicit QTY-NAME (1 :เป็ปชี่)
        explicit_match = explicit_qty_name_regex.match(text)
        if explicit_match:
            raw_qty_part = explicit_match.group(1).strip()
            name_to_check = explicit_match.group(2).strip()
            
            qty_numbers = re.findall(r'\d+', raw_qty_part)
            if qty_numbers:
                qty = int(qty_numbers[0])
            
        # Check for name only structure ('หมูคารูบิคุโรบตะ 2' followed by '1')
        elif ':' not in text and '×' not in text:
            
            # 1. Check embedded trailing quantity
            trailing_qty_match = re.search(r'\s(\d+)$', text)
            if trailing_qty_match:
                qty = int(trailing_qty_match.group(1))
                name_to_check = text[:trailing_qty_match.start()].strip()
            else:
                name_to_check = text
                qty = 1
                
            # 2. Check the next line for a standalone quantity
            if i + 1 < len(raw_item_list):
                next_item = raw_item_list[i + 1]
                next_item_text = next_item['text']
                standalone_match = standalone_qty_regex.match(next_item_text)
                
                if standalone_match:
                    qty_numbers = re.findall(r'\d+', standalone_match.group(1))
                    if qty_numbers:
                        qty = int(qty_numbers[0]) 
                    
                    # --- CHANGE: Don't merge. Just add the separate box to our list ---
                    current_polys.append(next_item['poly'])
                    
                    i += 1 # Skip the next line since we used it as quantity
        

        # Fuzzy matching and name correction
        name_to_check = re.sub(r'[\d\s×x]+$', '', name_to_check).strip()
        
        print(f"{qty} : {name_to_check}")

        matches = get_close_matches(name_to_check, real_menus, n=1, cutoff=0.6) 
        
        corrected_name = None
        if matches:
            corrected_name = matches[0]

        if corrected_name and len(name_to_check) > 2:
            aggregated_items[corrected_name] += qty
            
            # --- CHANGE: Add ALL collected boxes (1 or 2) to the main drawing list
            boxes_to_draw.extend(current_polys)
        
        i += 1

    # Save results 
    
    # Format the aggregated data for output
    final_structured_data = [f"{qty} : {name}" for name, qty in aggregated_items.items()]
    
    # Save Text Table
    print("\n--- After name correction and aggregation ---")
    for item in final_structured_data:
        print(item)

    os.makedirs(os.path.dirname(output_csv_file), exist_ok=True)
    with open(output_csv_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['Quantity', 'Menu Name'])
        for name, qty in aggregated_items.items():
            writer.writerow([qty, name])
            
    print(f"Successfully saved CSV table to: {output_csv_file}")

    # Draw Boxes
    os.makedirs(os.path.dirname(output_img_file), exist_ok=True)
    for poly in boxes_to_draw:
        cv2.polylines(image, [poly.astype(int)], True, (0, 255, 0), 2)

    cv2.imwrite(output_img_file, image)
    print(f"Successfully saved boxed image to: {output_img_file}")

except Exception as e:
    print(f"An error occurred during processing: {e}")
