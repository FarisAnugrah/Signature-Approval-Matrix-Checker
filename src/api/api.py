from fastapi import FastAPI, UploadFile, File, HTTPException
import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
import json
import re
import tempfile
import os
from pypdf import PdfReader

app = FastAPI(title="Signature Checker API")

with open("config/templates.json") as f:
    templates = json.load(f)

def normalize_text(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def classify_document(pdf_path):
    try:
        images = convert_from_path(pdf_path, first_page=1, last_page=1)
        img = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        text = pytesseract.image_to_string(gray).lower()
        
        for doc_type, config in templates.items():
            for identifier in config["identifiers"]:
                if identifier in text:
                    return doc_type
    except: pass
    return None

def analyze_document(pdf_path, doc_type):
    config = templates[doc_type]
    roles_to_find = config["roles"]
    results = {role: {"found": False, "signed": False, "ink": 0.0} for role in roles_to_find}
    
    try:
        total_pages = len(PdfReader(pdf_path).pages)
        pages_to_check = config.get("approval_pages_from_end", 2)
        start_page = max(1, total_pages - pages_to_check + 1)
        target_pages = list(range(start_page, total_pages + 1))
    except:
        target_pages = [1, 2]

    for page_num in target_pages:
        try:
            images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num)
            img = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
        except: continue
            
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
                    roi_y, roi_x, roi_w = max(0, int(y_min - roi_h)), max(0, x_min - 20), (x_max - x_min) + 40
                    
                    roi_ink = thresh[roi_y:y_max+20, roi_x:roi_x+roi_w]
                    if roi_ink.size > 0:
                        ink_ratio = cv2.countNonZero(roi_ink) / roi_ink.size
                        results[role]["ink"] = ink_ratio
                        if ink_ratio > 0.025: results[role]["signed"] = True
                    break
    return results

@app.post("/verify")
async def verify_signature(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
        
    try:
        doc_type = classify_document(tmp_path)
        if not doc_type:
            return {"error": "Could not classify document type (not BRD/PCR)"}
            
        results = analyze_document(tmp_path, doc_type)
        
        missing = [role for role, data in results.items() if not data["signed"]]
        is_approved = len(missing) == 0
        
        return {
            "document_type": doc_type,
            "status": "APPROVED" if is_approved else "PENDING",
            "results": results,
            "jira_labels_to_add": [f"waiting-sign-off-{r.replace(' ', '-').lower()}" for r in missing] if not is_approved else []
        }
    finally:
        os.unlink(tmp_path)

@app.get("/")
async def home():
    return {"message": "Signature Approval Matrix Checker API is running"}
