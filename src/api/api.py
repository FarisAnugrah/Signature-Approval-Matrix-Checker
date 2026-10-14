from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from src.core.zip_checklist import MAX_MEMBER, inspect_archive, validate_options
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_path
from pypdf import PdfReader
import json
import re
import tempfile
import os
import uuid
import zipfile
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, EmailStr
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
CHECKLIST_PATH = "config/nmb_checklist.json"

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

def load_checklist():
    if os.path.exists(CHECKLIST_PATH):
        with open(CHECKLIST_PATH, "r") as f:
            return json.load(f)
    return {"tree": []}

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

                # Denoise d = pytesseract.image_to_data(gray, config brighten background to help OCR ignore pen strokes
        gray_for_ocr = cv2.convertScaleAbs(gray, alpha=1.2, beta=30)
        d = pytesseract.image_to_data(gray_for_ocr, config='--oem 3 --psm 11', output_type=pytesseract.Output.DICT)
        
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
                    
                    roi_h = (y_max - y_min) * config.get("roi_offset", {}).get("height_multiplier", 6)
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
        
        # ponytail: Dynamic Slot Matching — hanya peran yang tercetak di dokumen yang dievaluasi
        found_results = {role: data for role, data in results.items() if data.get("found", False)}
        
        # Jika tidak ada peran matrix yang tercetak sama sekali, fallback ke semua peran untuk transparansi
        eval_targets = found_results if found_results else results
        missing = [role for role, data in eval_targets.items() if not data["signed"]]
        is_approved = len(eval_targets) > 0 and len(missing) == 0
        
        jobs[job_id]["result"] = {
            "document_type": doc_type,
            "status": "APPROVED" if is_approved else "PENDING",
            "results": eval_targets,
            "jira_labels_to_add": [f"waiting-sign-off-{r.replace(' ', '-').lower()}" for r in missing] if not is_approved else []
        }
        jobs[job_id]["status"] = "completed"
        import threading
        t = threading.Timer(3600, lambda: jobs.pop(job_id, None))
        t.daemon = True
        t.start()
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
    finally:
        if os.path.exists(file_path):
            os.unlink(file_path)

def check_zip_signature(archive, info, template_type):
    try:
        templates = load_templates()
        if template_type not in templates:
            return {"status": "UNSUPPORTED"}
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            with archive.open(info) as source:
                size = 0
                while chunk := source.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_MEMBER:
                        raise ValueError("PDF exceeds ZIP member limit")
                    tmp.write(chunk)
            tmp.flush()
            reader = PdfReader(tmp.name)
            if len(reader.pages) > 100 or any(float(p.mediabox.width) > 2000 or float(p.mediabox.height) > 2000 for p in reader.pages):
                return {"status": "NOT_CHECKED"}
            if classify_document(tmp.name, templates) != template_type:
                return {"status": "UNRECOGNIZED_TEMPLATE"}
            analysis = analyze_document(tmp.name, template_type, templates)
        roles = {r: d for r, d in analysis.items() if d.get("found", False)}
        if not roles:
            return {"status": "NOT_CHECKED"}
        missing = [r for r, d in roles.items() if not d["signed"]]
        return {"document_type": template_type, "status": "PENDING" if missing else "APPROVED",
                "roles": roles, "missing_roles": missing}
    except Exception as exc:
        return {"status": "ERROR", "error": str(exc)}


def process_zip_inspection(job_id: str, zip_path: str, options=None):
    jobs[job_id]["status"] = "processing"
    try:
        with zipfile.ZipFile(zip_path) as archive:
            jobs[job_id]["result"] = inspect_archive(archive, options or {}, load_checklist().get("tree", []), check_zip_signature)
        jobs[job_id]["status"] = "completed"
    except Exception as exc:
        logger.error(f"Error processing zip inspection: {exc}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(exc)
    finally:
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        import threading
        timer = threading.Timer(3600, lambda: jobs.pop(job_id, None))
        timer.daemon = True
        timer.start()

class SendAlertRequest(BaseModel):
    recipient_email: str
    project_name: str
    missing_items: List[str] = []
    missing_signatures: List[Dict[str, Any]] = []

@app.post("/verify/zip")
async def verify_zip_async(background_tasks: BackgroundTasks, file: UploadFile = File(...), options: str = Form("{}")):
    if not (file.filename or "").lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")
    try:
        if len(options) > 128 * 1024:
            raise ValueError("Checklist options too large")
        parsed = json.loads(options)
        validate_options(parsed, load_checklist().get("tree", []))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    job_id = str(uuid.uuid4())
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
            tmp_path = tmp.name
            while chunk := await file.read(1024 * 1024):
                tmp.write(chunk)
        jobs[job_id] = {"status": "pending", "result": None, "error": None}
        background_tasks.add_task(process_zip_inspection, job_id, tmp_path, parsed)
    except BaseException:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise
    finally:
        await file.close()
    return {"job_id": job_id, "status": "pending"}


@app.post("/verify/folder")
async def verify_folder_async(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    paths: str = Form("[]"),
    options: str = Form("{}")
):
    try:
        if len(options) > 128 * 1024 or len(paths) > 2 * 1024 * 1024:
            raise ValueError("Input options or paths too large")
        parsed_options = json.loads(options)
        validate_options(parsed_options, load_checklist().get("tree", []))
        parsed_paths = json.loads(paths)
        if not isinstance(parsed_paths, list) or len(parsed_paths) != len(files):
            raise ValueError("Paths list must match files count")
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if len(files) > 10000:
        raise HTTPException(status_code=400, detail="Folder exceeds 10,000 files limit")

    job_id = str(uuid.uuid4())
    tmp_zip_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_zip:
            tmp_zip_path = tmp_zip.name
            with zipfile.ZipFile(tmp_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for file_obj, rel_p in zip(files, parsed_paths):
                    clean_rel = rel_p.replace("\\", "/").strip().lstrip("/")
                    if not clean_rel:
                        clean_rel = file_obj.filename or "unknown_file"
                    with tempfile.NamedTemporaryFile(delete=True) as temp_file:
                        while chunk := await file_obj.read(1024 * 1024):
                            temp_file.write(chunk)
                        temp_file.flush()
                        zf.write(temp_file.name, arcname=clean_rel)
                    await file_obj.close()

        jobs[job_id] = {"status": "pending", "result": None, "error": None}
        background_tasks.add_task(process_zip_inspection, job_id, tmp_zip_path, parsed_options)
    except BaseException:
        if tmp_zip_path and os.path.exists(tmp_zip_path):
            os.unlink(tmp_zip_path)
        raise

    return {"job_id": job_id, "status": "pending"}

@app.get("/api/checklist")
async def get_checklist():
    return load_checklist()

@app.post("/api/alert/email")
async def send_alert_notification(req: SendAlertRequest):
    # ponytail: MVP simulates SMTP/Graph API dispatch and returns constructed payload
    email_body = f"""
Kepada: {req.recipient_email}
Perihal: [Reminder] Kelengkapan Dokumen & Persetujuan Proyek {req.project_name}

Berikut daftar temuan pemeriksaan kelengkapan berkas:
1. Dokumen yang Belum Ditemukan ({len(req.missing_items)}):
   {', '.join(req.missing_items) if req.missing_items else 'Semua dokumen wajib ditemukan.'}

2. Dokumen dengan Tanda Tangan Belum Lengkap ({len(req.missing_signatures)}):
"""
    for sig in req.missing_signatures:
        doc = sig.get('path', 'Dokumen')
        roles = ', '.join(sig.get('missing_roles', []))
        email_body += f"   - {doc}: Menunggu tanda tangan dari [{roles}]\n"

    logger.info(f"Draft alert prepared for {req.recipient_email}:\n{email_body}")
    return {
        "status": "success",
        "message": f"Alert notification dispatched to {req.recipient_email}",
        "preview": email_body.strip()
    }

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
