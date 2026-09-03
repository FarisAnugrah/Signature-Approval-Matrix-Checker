import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
import os
import re

APPROVAL_MATRIX = [
    "Business Relationship Manager",
    "IT Planning",
    "ITPD Division Head",
    "Head Of Planning Performance",
    "Business User Division Head",
    "System Analyst",
    "Project Owner",
    "Head Of Development"
]

def normalize_text(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def hybrid_verify(pdf_path, target_pages):
    print(f"\n========== Hybrid Verifying: {os.path.basename(pdf_path)} ==========")
    
    results = {role: {"found": False, "signed": False, "ink": 0} for role in APPROVAL_MATRIX}
    
    for page_num in target_pages:
        try:
            images = convert_from_path(pdf_path, first_page=page_num+1, last_page=page_num+1)
            img = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
        except:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 5)
        
        # Get word-level bounding boxes
        d = pytesseract.image_to_data(gray, config='--oem 3 --psm 11', output_type=pytesseract.Output.DICT)
        
        n_boxes = len(d['level'])
        words = []
        for i in range(n_boxes):
            text = d['text'][i].strip()
            if text:
                words.append({
                    "text": text,
                    "norm": normalize_text(text),
                    "x": d['left'][i],
                    "y": d['top'][i],
                    "w": d['width'][i],
                    "h": d['height'][i]
                })

        # Match roles
        for role in APPROVAL_MATRIX:
            if results[role]["found"]: continue # Already found in previous pages
            
            role_words = role.split()
            role_words_norm = [normalize_text(w) for w in role_words]
            
            # Simple window search for consecutive words matching the role
            window_size = len(role_words_norm)
            
            for i in range(len(words) - window_size + 1):
                window = words[i:i+window_size]
                match_count = sum(1 for j in range(window_size) if role_words_norm[j] in window[j]["norm"] or window[j]["norm"] in role_words_norm[j])
                
                # If we matched enough words (allow 1 word miss for long roles to handle OCR errors)
                required_matches = window_size - 1 if window_size > 2 else window_size
                
                if match_count >= required_matches:
                    results[role]["found"] = True
                    
                    # Calculate bounding box for the entire role text
                    x_min = min(w["x"] for w in window)
                    y_min = min(w["y"] for w in window)
                    x_max = max(w["x"] + w["w"] for w in window)
                    y_max = max(w["y"] + w["h"] for w in window)
                    
                    # Define ROI: Check the area ABOVE the text (usually where signatures go)
                    # We check an area 3x the height of the text above it
                    roi_h = (y_max - y_min) * 5
                    roi_y = max(0, y_min - roi_h)
                    roi_x = max(0, x_min - 20)
                    roi_w = (x_max - x_min) + 40
                    
                    roi_ink = thresh[roi_y:y_max+20, roi_x:roi_x+roi_w]
                    
                    if roi_ink.size > 0:
                        ink_ratio = cv2.countNonZero(roi_ink) / roi_ink.size
                        results[role]["ink"] = ink_ratio
                        
                        # Hybrid Threshold: > 2.5% ink in the signature zone means signed
                        if ink_ratio > 0.025:
                            results[role]["signed"] = True
                    break

    for role in APPROVAL_MATRIX:
        # Only print roles relevant to this document (if found)
        if results[role]["found"]:
            status = "✅ SIGNED" if results[role]["signed"] else "❌ PENDING"
            print(f"Role: {role.ljust(30)} | {status} (Ink: {results[role]['ink']:.3f})")

hybrid_verify("BRD Aplikasi SPRINT (Sistem Pengelolaan Rekening Terintegrasi).pdf", [38, 39])
hybrid_verify("PCR - 2605022022A - SPRINT Full Sign (1) (1).pdf", [13])
