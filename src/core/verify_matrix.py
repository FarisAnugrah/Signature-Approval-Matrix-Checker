import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
import os
import re

# Approval Matrix - roles we are looking for
APPROVAL_MATRIX = [
    "Business Relationship Manager",
    "IT Planning",
    "ITPD Division Head",
    "System Analyst",
    "Project Owner",
    "Head Of Development"
]

def extract_cells_from_page(pdf_path, page_num):
    try:
        images = convert_from_path(pdf_path, first_page=page_num+1, last_page=page_num+1)
        if not images: return []
        img = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
    except:
        return []

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 5)

    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    detect_horizontal = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
    
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
    detect_vertical = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)

    table_mask = cv2.addWeighted(detect_horizontal, 0.5, detect_vertical, 0.5, 0.0)
    _, table_mask = cv2.threshold(table_mask, 50, 255, cv2.THRESH_BINARY)

    contours, _ = cv2.findContours(table_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    cells = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if 50 < w < 800 and 30 < h < 500:
            cells.append((x, y, w, h))

    cells.sort(key=lambda b: (b[1] // 20, b[0]))
    unique_cells = []
    for cell in cells:
        if not any(abs(cell[0]-uc[0])<10 and abs(cell[1]-uc[1])<10 for uc in unique_cells):
            unique_cells.append(cell)

    ink_thresh = thresh - detect_horizontal - detect_vertical
    ink_thresh[ink_thresh < 0] = 0
    
    extracted = []
    for x, y, w, h in unique_cells:
        margin = 5
        roi_img = img[y+margin:y+h-margin, x+margin:x+w-margin]
        roi_ink = ink_thresh[y+margin:y+h-margin, x+margin:x+w-margin]
        
        if roi_img.size == 0: continue
            
        ink_ratio = cv2.countNonZero(roi_ink) / roi_ink.size

        gray_roi = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY)
        gray_roi = cv2.resize(gray_roi, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        text = pytesseract.image_to_string(gray_roi, config=r'--oem 3 --psm 6').strip()
        text = " ".join(text.split()).lower() # lowercase for easier matching
        
        extracted.append({
            "text": text,
            "ink_ratio": ink_ratio
        })
    return extracted

def normalize_text(text):
    return re.sub(r'[^a-z0-9\s]', '', text.lower())

def verify_document(pdf_path, target_pages):
    print(f"\n========== Verifying Document: {os.path.basename(pdf_path)} ==========")
    
    all_cells = []
    for page in target_pages:
        all_cells.extend(extract_cells_from_page(pdf_path, page))

    results = {}
    
    for role in APPROVAL_MATRIX:
        role_norm = normalize_text(role)
        role_found = False
        is_signed = False
        ink_val = 0
        
        for cell in all_cells:
            cell_text_norm = normalize_text(cell["text"])
            
            # Fuzzy check: if all words of the role exist in the cell text
            role_words = role_norm.split()
            if all(word in cell_text_norm for word in role_words):
                role_found = True
                ink_val = cell["ink_ratio"]
                # Heuristic: Normal printed text has ink ratio ~1.5 - 2%. 
                # If there is a signature/stamp overlapping it, it jumps > 2.5%
                if ink_val > 0.025:
                    is_signed = True
                break
                
        if role_found:
            status = "✅ SIGNED" if is_signed else "❌ PENDING"
            print(f"Role: {role.ljust(30)} | Found: Yes | {status} (Ink: {ink_val:.3f})")
            results[role] = is_signed
        else:
            # Not printing roles that aren't expected in this specific doc type
            # (Though in reality you'd map doc type to expected roles first)
            pass

verify_document("BRD Aplikasi SPRINT (Sistem Pengelolaan Rekening Terintegrasi).pdf", [38, 39])
verify_document("PCR - 2605022022A - SPRINT Full Sign (1) (1).pdf", [13])
