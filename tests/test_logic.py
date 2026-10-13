import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
import json
import re

with open("config/templates.json") as f:
    templates = json.load(f)

def normalize_text(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def analyze_document(pdf_path, doc_type):
    config = templates[doc_type]
    roles_to_find = config["roles"]
    results = {role: {"found": False, "signed": False, "ink": 0.0} for role in roles_to_find}
    
    target_pages = [38, 39] if doc_type == "BRD" else [13]

    for page_num in target_pages:
        try:
            images = convert_from_path(pdf_path, first_page=page_num+1, last_page=page_num+1)
            img = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
        except Exception as e: 
            print("Error loading page:", e)
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 5)
        
        d = pytesseract.image_to_data(gray, config='--oem 3 --psm 11', output_type=pytesseract.Output.DICT)
        
        words = [{"text": d['text'][i].strip(), "norm": normalize_text(d['text'][i].strip()), 
                  "x": d['left'][i], "y": d['top'][i], "w": d['width'][i], "h": d['height'][i]} 
                 for i in range(len(d['level'])) if d['text'][i].strip()]

        for role in roles_to_find:
            if results[role]["found"]: continue
            
            role_words_norm = [normalize_text(w) for w in role.split()]
            window_size = len(role_words_norm)
            
            for i in range(len(words) - window_size + 1):
                window = words[i:i+window_size]
                match_count = sum(1 for j in range(window_size) if role_words_norm[j] in window[j]["norm"] or window[j]["norm"] in role_words_norm[j])
                
                required_matches = window_size - 1 if window_size > 2 else window_size
                if match_count >= required_matches:
                    results[role]["found"] = True
                    y_min, y_max = min(w["y"] for w in window), max(w["y"] + w["h"] for w in window)
                    x_min, x_max = min(w["x"] for w in window), max(w["x"] + w["w"] for w in window)
                    
                    roi_h = (y_max - y_min) * config.get("roi_offset", {}).get("height_multiplier", 4)
                    
                    roi_y = max(0, int(y_min - roi_h))
                    roi_x = max(0, x_min - 20)
                    roi_w = (x_max - x_min) + 40
                    
                    # Cek area yang bener-bener kosong dari teks role nya (kasih padding 5px)
                    roi_ink = thresh[roi_y:max(0, y_min - 5), roi_x:roi_x+roi_w]
                    
                    if roi_ink.size > 0:
                        ink_ratio = cv2.countNonZero(roi_ink) / roi_ink.size
                        results[role]["ink"] = ink_ratio
                        # Signatures
                        if ink_ratio > 0.01: results[role]["signed"] = True
                    break
    
    for r, d in results.items():
        print(f"{r:30} | Found: {d['found']} | Signed: {d['signed']} | Ink: {d['ink']:.3f}")

print("=== BRD ===")
analyze_document("data/samples/BRD Aplikasi SPRINT (Sistem Pengelolaan Rekening Terintegrasi).pdf", "BRD")
print("\n=== PCR ===")
analyze_document("data/samples/PCR - 2605022022A - SPRINT Full Sign (1) (1).pdf", "PCR")
