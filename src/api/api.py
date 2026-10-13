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
import zipfile
import shutil
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

def normalize_path(p: str) -> str:
    return "/".join([part.strip().lower() for part in p.replace("\\", "/").split("/") if part.strip()])

def process_zip_inspection(job_id: str, zip_path: str):
    jobs[job_id]["status"] = "processing"
    temp_extract_dir = tempfile.mkdtemp(prefix="nmb_extract_")
    try:
        checklist_config = load_checklist()
        tree_rules = checklist_config.get("tree", [])
        templates = load_templates()

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_extract_dir)

        # Temukan root folder proyek
        # Format umum: NMB 2026/<Project_Name>/... atau langsung <Project_Name>/...
        # Kumpulkan semua file yang bukan direktori
        all_files = []
        for root, _, files in os.walk(temp_extract_dir):
            for f in files:
                if f.startswith(".") or f.startswith("__MACOSX"):
                    continue
                rel_path = os.path.relpath(os.path.join(root, f), temp_extract_dir)
                all_files.append((rel_path, os.path.join(root, f)))

        # Deteksi proyek
        # Pisahkan path untuk mendapatkan nama proyek
        # Jika ada folder 'NMB 2026', proyek adalah subfolder di bawahnya. Jika tidak, folder level-1.
        projects_data: Dict[str, Any] = {}
        
        for rel_path, full_path in all_files:
            parts = [p.strip() for p in rel_path.replace("\\", "/").split("/") if p.strip()]
            if not parts:
                continue
            
            if parts[0].lower() == "nmb 2026":
                if len(parts) > 1:
                    project_name = parts[1]
                    sub_parts = parts[2:]
                else:
                    project_name = "Default Project"
                    sub_parts = parts[1:]
            else:
                project_name = parts[0]
                sub_parts = parts[1:]

            if project_name not in projects_data:
                projects_data[project_name] = []

            projects_data[project_name].append({
                "sub_path": "/".join(sub_parts[:-1]),
                "filename": sub_parts[-1] if sub_parts else parts[-1],
                "full_path": full_path
            })

        # Jika tidak ada file
        if not projects_data:
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["result"] = {
                "total_projects": 0,
                "projects": {}
            }
            return

        inspection_results = {}

        for proj_name, file_records in projects_data.items():
            folder_map = {}
            for rec in file_records:
                norm_sub = normalize_path(rec["sub_path"])
                if norm_sub not in folder_map:
                    folder_map[norm_sub] = []
                folder_map[norm_sub].append(rec)

            items_status = []
            signature_jobs = []

            for rule in tree_rules:
                target_rule_path = normalize_path(rule["path"])
                matched_files = folder_map.get(target_rule_path, [])

                # Toleransi partial match jika ada variasi nama folder
                if not matched_files:
                    for f_path, f_list in folder_map.items():
                        if f_path.endswith(target_rule_path) or target_rule_path in f_path:
                            matched_files = f_list
                            break

                found = len(matched_files) > 0
                file_names = [f["filename"] for f in matched_files]
                
                sig_result = None
                # Jika butuh signature check dan ada file PDF
                if found and rule.get("requires_signature"):
                    pdf_candidates = [f for f in matched_files if f["filename"].lower().endswith(".pdf")]
                    if pdf_candidates:
                        target_pdf = pdf_candidates[0]["full_path"]
                        detected_type = rule.get("template_type") or classify_document(target_pdf, templates)
                        if detected_type and detected_type in templates:
                            try:
                                analysis = analyze_document(target_pdf, detected_type, templates)
                                # ponytail: Dynamic Slot Matching — hanya peran yang tercetak di lembar persetujuan yang dievaluasi
                                printed_roles = {r: d for r, d in analysis.items() if d.get("found", False)}
                                eval_roles = printed_roles if printed_roles else analysis
                                missing_roles = [r for r, d in eval_roles.items() if not d["signed"]]
                                sig_result = {
                                    "document_type": detected_type,
                                    "status": "APPROVED" if (len(eval_roles) > 0 and len(missing_roles) == 0) else "PENDING",
                                    "roles": eval_roles,
                                    "missing_roles": missing_roles
                                }
                            except Exception as ex:
                                sig_result = {"status": "ERROR", "error": str(ex)}
                        else:
                            sig_result = {"status": "UNRECOGNIZED_TEMPLATE"}

                items_status.append({
                    "path": rule["path"],
                    "required": rule.get("required", True),
                    "status": "Ditemukan" if found else "Belum ditemukan",
                    "files": file_names,
                    "requires_signature": rule.get("requires_signature", False),
                    "signature_analysis": sig_result
                })

            total_req = sum(1 for i in items_status if i["required"])
            total_found = sum(1 for i in items_status if i["required"] and i["status"] == "Ditemukan")
            
            # Hitung missing signatures
            missing_sig_count = 0
            for item in items_status:
                if item.get("signature_analysis") and item["signature_analysis"].get("status") == "PENDING":
                    missing_sig_count += 1

            inspection_results[proj_name] = {
                "project_name": proj_name,
                "completeness_score": f"{total_found}/{total_req}",
                "percent": round((total_found / total_req * 100) if total_req > 0 else 0, 1),
                "items": items_status,
                "missing_signatures_count": missing_sig_count
            }

        jobs[job_id]["result"] = {
            "total_projects": len(inspection_results),
            "projects": inspection_results
        }
        jobs[job_id]["status"] = "completed"
        import threading
        t = threading.Timer(3600, lambda: jobs.pop(job_id, None))
        t.daemon = True
        t.start()

    except Exception as e:
        logger.error(f"Error processing zip inspection: {e}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
    finally:
        shutil.rmtree(temp_extract_dir, ignore_errors=True)
        if os.path.exists(zip_path):
            os.unlink(zip_path)

class SendAlertRequest(BaseModel):
    recipient_email: str
    project_name: str
    missing_items: List[str] = []
    missing_signatures: List[Dict[str, Any]] = []

@app.post("/verify/zip")
async def verify_zip_async(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")
        
    job_id = str(uuid.uuid4())
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        # Stream chunks to prevent high RAM consumption on 300MB+ files
        while chunk := await file.read(1024 * 1024 * 8):  # 8MB chunk
            tmp.write(chunk)
        tmp_path = tmp.name
        
    jobs[job_id] = {"status": "pending", "result": None, "error": None}
    background_tasks.add_task(process_zip_inspection, job_id, tmp_path)
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
