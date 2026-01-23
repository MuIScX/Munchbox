# Receipt sales data Extractor (OCR)

This project is a Python-based tool that extracts menu items and quantities from restaurant receipt images. It uses **PaddleOCR** for text recognition, **Regular Expressions** for parsing structure, and **Fuzzy Matching** to correct OCR errors against a known menu database.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

* **Python:** Version **3.11.9** (Strictly recommended)
* **Pip:** Python package installer

## 📂 Project Structure

Ensure your project folder is organized as follows before running the script:

```text
project_root/
│
├── main.py                # The main Python script provided
├── requirements.txt       # List of dependencies
├── README.md              # This documentation
│
├── test_image/            # Place your input images here
│   └── sample_bad_image1.jpg
│
├── output_image/          # Generated images with bounding boxes
│   └── (Auto-generated content)
│
└── output_csv/            # Generated CSV sales reports
    └── (Auto-generated content)
```

# ⚙️ Installation
1. Create a Virtual Environment (Recommended) It is best practice to use a virtual environment to manage dependencies.

```
# Create the environment
python -m venv venv

# Activate the environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

2. Install Dependencies Install the required libraries using the provided text file.
```
pip install -r requirements.txt
```

# 🚀 How to Run
1. Prepare your Input Place your receipt image (e.g., sample_bad_image1.jpg) inside the test_image/ folder.

2. Run the Script Execute the Python file from your terminal:
```
python OCR.py
```
3. First Run Note On the very first run, PaddleOCR will automatically download the Thai (th) language model files (~15MB). Ensure you have an internet connection.

# 📊 Output
After the script finishes, check the following folders:

CSV Report (output_csv/sales_table_v2.csv): A clean table showing the total quantity and corrected name for each menu item found.

Debug Image (output_image/layout_detection_v5.jpg): A copy of the original image with green bounding boxes drawn around the text that was detected and used for the final count. This is useful for debugging which text the OCR is actually reading.
