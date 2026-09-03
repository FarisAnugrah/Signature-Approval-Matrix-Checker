# Signature Approval Matrix Checker

Backend service to verify wet signatures on scanned documents (BRD, PCR, etc) against predefined Approval Matrices using OpenCV and Tesseract OCR.

## Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running the API
```bash
source .venv/bin/activate
uvicorn src.api.api:app --reload
```

## Technical Roadmap
- **Phase 1 (Completed)**: Document Classification, Hybrid OCR + OpenCV Wet Signature Detection, UI Dashboard.
- **Phase 2**: 
  - **Template Builder UI**: Web-based admin panel to edit `templates.json` and map Approval Matrices without touching code.
  - **Asynchronous Processing**: Implement Celery/Redis for background OCR processing on massive 100+ page PDFs.
- **Phase 3**:
  - **Jira Integration**: Direct REST API syncing to automatically add `waiting-sign-off-<role>` labels.
  - **Vision Model Upgrades**: Finetune a YOLOv8 model for stamp/signature detection to handle low-quality/skewed scans better than standard OCR.
