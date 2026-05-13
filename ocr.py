from pathlib import Path
from typing import List, Union
import cv2
import re
from paddleocr import PaddleOCR
from difflib import get_close_matches
from collections import defaultdict
import config

print(f"Initializing PaddleOCR with '{config.OCR_LANG}' model...")
try:
    ocr = PaddleOCR(lang=config.OCR_LANG) 
except Exception as e:
    print(f"Fatal error during initialization: {e}")
    raise


def process_ocr(image: Union[str, Path], recipes_name: List[str]):
    """
    returns:
    0: OCR failure or processing error
    1: OCR success and CSV saved
    2: no text detected
    """
    # Define Regex Filters
    price_regex = re.compile(r'^\d+\.\d{2}$')
    total_keywords = ['Items', 'total qty', 'ยอดรวม', 'vat', 'credit card']
    standalone_qty_regex = re.compile(r'^\s*([\d\s×x]+)\s*$')

    try:
        result = ocr.predict(input=str(image))
        if not result[0]:
            return 2, ['','']

        result_data = result[0]

        # Layout Detection — Pass 1: find Y_START from first price line
        y_start_pixel = 99999
        for poly, text, score in zip(result_data['rec_polys'], result_data['rec_texts'], result_data['rec_scores']):
            text_clean = text.strip().lower()
            current_y_top = poly[:, 1].min()
            if price_regex.match(text_clean):
                if current_y_top < y_start_pixel: y_start_pixel = current_y_top
        Y_START = y_start_pixel - 10
        if Y_START > 9000: Y_START = 0

        # Pass 2: find Y_END from total keywords only BELOW Y_START
        y_end_pixel = 99999
        for poly, text, score in zip(result_data['rec_polys'], result_data['rec_texts'], result_data['rec_scores']):
            text_clean = text.strip().lower()
            current_y_top = poly[:, 1].min()
            if current_y_top > Y_START and any(keyword.lower() in text_clean for keyword in total_keywords):
                if current_y_top < y_end_pixel: y_end_pixel = current_y_top
        Y_END = y_end_pixel - 10
        if Y_END > 9000: Y_END = 2000

        # Filter to items within boundaries
        image_cv = cv2.imread(str(image))
        if image_cv is None:
            print(f"Error: Could not decode image {image}")
            return 0, ['','']

        raw_item_list = []
        for poly, text, score in zip(result_data['rec_polys'], result_data['rec_texts'], result_data['rec_scores']):
            text = text.strip()
            avg_y = poly[:, 1].mean()
            if not (Y_START < avg_y < Y_END): continue
            if score < 0.6: continue
            if price_regex.match(text): continue
            if 'total qty' in text.lower(): continue
            if re.fullmatch(r'^[x×:.]+$', text): continue
            if not re.search(r'[ก-ฮa-zA-Z\d]', text): continue

            raw_item_list.append({'text': text, 'poly': poly})

        # Attach x/y coords, group into rows by y-proximity, sort each row left-to-right by x
        for item in raw_item_list:
            item['avg_y'] = item['poly'][:, 1].mean()
            item['avg_x'] = item['poly'][:, 0].mean()

        Y_ROW_THRESHOLD = 25
        rows = []
        if raw_item_list:
            items_sorted = sorted(raw_item_list, key=lambda x: x['avg_y'])
            current_row = [items_sorted[0]]
            for item in items_sorted[1:]:
                if abs(item['avg_y'] - current_row[0]['avg_y']) <= Y_ROW_THRESHOLD:
                    current_row.append(item)
                else:
                    rows.append(sorted(current_row, key=lambda x: x['avg_x']))
                    current_row = [item]
            rows.append(sorted(current_row, key=lambda x: x['avg_x']))

        # Pair Qty and Name, then Fuzzy match and correct
        aggregated_items = defaultdict(int)

        i = 0
        while i < len(rows):
            row = rows[i]
            qty = 1

            # If leftmost token is a pure number and row has more items → it's the qty column
            first_text = row[0]['text']
            if standalone_qty_regex.match(first_text) and len(row) > 1:
                qty_numbers = re.findall(r'\d+', first_text)
                if qty_numbers:
                    qty = int(qty_numbers[0])
                name_parts = [item['text'] for item in row[1:]]
            else:
                name_parts = [item['text'] for item in row]
                # Check for embedded trailing quantity (e.g. "หมูคารูบิคุโรบตะ 2")
                trailing_match = re.search(r'\s(\d+)$', name_parts[-1]) if name_parts else None
                if trailing_match:
                    qty = int(trailing_match.group(1))
                    name_parts[-1] = name_parts[-1][:trailing_match.start()].strip()

            name_to_check = re.sub(r'[\d\s×x]+$', '', ' '.join(name_parts)).strip()

            # Try to fuzzy-match; if it fails, try merging with the next row
            # (handles multi-line names like "Seabass Yuzu" + "Hollandaise Sauce")
            matches = get_close_matches(name_to_check, recipes_name, n=1, cutoff=config.FUZZY_MATCH_CUTOFF)
            if not matches and i + 1 < len(rows):
                next_row = rows[i + 1]
                next_name_parts = [item['text'] for item in next_row
                                   if not standalone_qty_regex.match(item['text'])]
                combined = (name_to_check + ' ' + ' '.join(next_name_parts)).strip()
                combined_matches = get_close_matches(combined, recipes_name, n=1, cutoff=config.FUZZY_MATCH_CUTOFF)
                if combined_matches:
                    name_to_check = combined
                    matches = combined_matches
                    i += 1  # skip next row since it was merged

            corrected_name = matches[0] if matches else None
            if corrected_name and len(name_to_check) > 2:
                aggregated_items[corrected_name] += qty

            i += 1

        # Save results 
        # send out the result as a list qty and name
        # output_dir = os.path.dirname(output_csv_file)
        # if output_dir:
        #     os.makedirs(output_dir, exist_ok=True)

        # with open(output_csv_file, 'w', newline='', encoding='utf-8-sig') as f:
        #     writer = csv.writer(f)
        #     writer.writerow(['Quantity', 'Menu Name'])
        #     for name, qty in aggregated_items.items():
        #         writer.writerow([str(qty), name])
        
        result = []
        for name, qty in aggregated_items.items():
            result.append([str(qty), name])
        return 1, result

    except Exception as e:
        print(f"An error occurred during processing: {e}")
        return 0, ['','']