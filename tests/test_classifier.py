import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
import json

with open("config/templates.json") as f:
    templates = json.load(f)

def test_classify(pdf_path):
    print(f"\nTesting: {pdf_path}")
    try:
        images = convert_from_path(pdf_path, first_page=1, last_page=1)
        img = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Test 1: Full raw text
        text = pytesseract.image_to_string(gray).lower()
        print("Raw text snippet:", text[:100].replace('\n', ' '))
        
        # Test 2: Clean text mapping
        import re
        text_clean = re.sub(r'[^a-z0-9\s]', '', text)
        print("Clean text snippet:", text_clean[:100].replace('\n', ' '))

        for doc_type, config in templates.items():
            print(f"Checking against {doc_type} identifiers: {config['identifiers']}")
            for identifier in config["identifiers"]:
                # Pake regex untuk cari whole word atau partial match dengan aman
                if identifier.lower() in text_clean:
                    print(f"✅ Matched identifier '{identifier}' -> Type: {doc_type}")
                    return doc_type
        print("❌ No match found.")
    except Exception as e:
        print("Error:", e)
    return None

test_classify("data/samples/PCR - 2605022022A - SPRINT Full Sign (1) (1).pdf")
test_classify("data/samples/BRD Aplikasi SPRINT (Sistem Pengelolaan Rekening Terintegrasi).pdf")
