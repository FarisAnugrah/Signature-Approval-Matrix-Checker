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
