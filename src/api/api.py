from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
import json
import re
import tempfile
import os
import uuid
from typing import Dict, Any
from pypdf import PdfReader
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Signature Checker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_PATH = "config/templates.json"

# --- YOLO MODEL SETUP ---
YOLO_MODEL_PATH = "models/signature_best.pt"
yolo_model = None

try:
    from ultralytics import YOLO
    if os.path.exists(YOLO_MODEL_PATH):
        yolo_model = YOLO(YOLO_MODEL_PATH)
        logger.info(f"Successfully loaded YOLO model from {YOLO_MODEL_PATH}")
    else:
        logger.warning(f"YOLO model not found at {YOLO_MODEL_PATH}. Falling back to OpenCV density check.")
except ImportError:
    logger.warning("ultralytics package not installed. Falling back to OpenCV density check.")
except Exception as e:
    logger.error(f"Error loading YOLO model: {e}")

def detect_signature_with_ai(roi_img):
    """
    Pass the cropped image here. If YOLO finds a bounding box with high confidence, return True.
    """
    if yolo_model is None or roi_img.size == 0:
        return False
        
    try:
        # Run inference
        results = yolo_model(roi_img, conf=0.5, verbose=False)
        # If any bounding box is detected, consider it signed
        return len(results[0].boxes) > 0
    except Exception as e:
        logger.error(f"YOLO inference error: {e}")
        return False

# --- END YOLO SETUP ---

def load_templates():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def save_templates(data):
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)

jobs: Dict[str, Any] = {}

def normalize_text(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def classify_document(pdf_path, templates):
    try:
        images = convert_from_path(pdf_path, first_page=1, last_page=1)
        img = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Gunakan PSM 3 untuk halaman utuh
        text = pytesseract.image_to_string(gray, config="--psm 3").lower()
        text_clean = re.sub(r"[^a-z0-9\s]", "", text)
        
        for doc_type, config in templates.items():
            # Cek dari identifier yang lebih panjang/spesifik duluan
            sorted_identifiers = sorted(config["identifiers"], key=len, reverse=True)
            for identifier in sorted_identifiers:
                if identifier.lower() in text_clean:
                    return doc_type
    except: pass
    return None

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

def analyze_document(pdf_path, doc_type, templates):
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
        
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        detect_horizontal = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        detect_vertical = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        ink_thresh = thresh - detect_horizontal - detect_vertical
        ink_thresh[ink_thresh < 0] = 0

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
                
                required_matches = max(1, window_size - 1)
                if match_count >= required_matches:
                    results[role]["found"] = True
                    y_min, y_max = min(w["y"] for w in window), max(w["y"] + w["h"] for w in window)
                    x_min, x_max = min(w["x"] for w in window), max(w["x"] + w["w"] for w in window)
                    
                    roi_h = (y_max - y_min) * config.get("roi_offset", {}).get("height_multiplier", 4)
                    roi_y, roi_x, roi_w = max(0, int(y_min - roi_h)), max(0, x_min - 20), (x_max - x_min) + 40
                    
                    # Original crop for OpenCV
                    roi_ink = ink_thresh[roi_y:max(0, y_min - 5), roi_x:roi_x+roi_w]
                    
                    # Image crop for YOLO (Original BGR color, no thresholding)
                    roi_color = img[roi_y:max(0, y_min - 5), roi_x:roi_x+roi_w]
                    
                    if roi_ink.size > 0:
                        ink_ratio = cv2.countNonZero(roi_ink) / roi_ink.size
                        results[role]["ink"] = ink_ratio
                        
                        # ENSEMBLE: Try YOLO on color image, fallback to OpenCV ink density
                        yolo_detected = detect_signature_with_ai(roi_color)
                        
                        if yolo_detected or ink_ratio > 0.005:
                            results[role]["signed"] = True
                            if yolo_detected:
                                logger.info(f"Role {role}: Verified via YOLO AI Model")
                            else:
                                logger.info(f"Role {role}: Verified via OpenCV Density ({ink_ratio:.3f})")
                                
                    break
    return results


def process_document_job(job_id: str, file_path: str):
    jobs[job_id]["status"] = "processing"
    try:
        templates = load_templates()
        doc_type = classify_document(file_path, templates)
        
        if not doc_type:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = "Could not classify document type (not BRD/PCR)"
            return
            
        results = analyze_document(file_path, doc_type, templates)
        
        missing = [role for role, data in results.items() if not data["signed"]]
        is_approved = len(missing) == 0
        
        jobs[job_id]["result"] = {
            "document_type": doc_type,
            "status": "APPROVED" if is_approved else "PENDING",
            "results": results,
            "jira_labels_to_add": [f"waiting-sign-off-{r.replace(' ', '-').lower()}" for r in missing] if not is_approved else []
        }
        jobs[job_id]["status"] = "completed"
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
    finally:
        if os.path.exists(file_path):
            os.unlink(file_path)

@app.get("/")
async def home():
    return {"message": "Signature Approval Matrix Checker API is running"}

@app.post("/verify/async")
async def verify_signature_async(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    job_id = str(uuid.uuid4())
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
        
    jobs[job_id] = {"status": "pending", "result": None, "error": None}
    background_tasks.add_task(process_document_job, job_id, tmp_path)
    return {"job_id": job_id, "status": "pending"}

@app.get("/verify/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/api/templates")
async def get_templates():
    return load_templates()

@app.post("/api/templates")
async def update_templates(data: dict):
    try:
        save_templates(data)
        return {"message": "Templates updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
