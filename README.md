# Signature Approval Matrix Checker & Project Compliance Inspector

An automated auditing system designed to verify document completeness, folder structure standards, and signature matrices across project delivery archives (ZIP & direct folder uploads) as well as standalone PDF approval matrices using OpenCV, OCR, and Deep Learning (YOLOv8).

---

## Key Features

- **Automated Project Structure & Checklist Audit**:
  - Automatically identifies project roots within archives (ZIP or direct folder picker).
  - Matches folders and documents against compliance checklists (ITP standards, custom categories, or pure inventories).
  - Tolerant fuzzy matching: ignores numbering prefixes (e.g. `00.`, `02.`), typos (`assesement` / `compability`), and merged categories (e.g. `FSD TSD`).
  - Supports specific document discovery like Berita Acara (`BA SIT`, `BA UAT`, `BA ST`, `BA UT`) and deployment forms (`Form Promote`, `Form SRM`, `Memo`).
  - Non-mobile project auto-detection (conditionally relaxes mobile OS folder requirements for Web/Core banking projects).
- **Wet Signature Verification**:
  - Computer vision & OCR signature analysis verifying signature existence against role matrices (BRD, PCR, etc.).
- **Interactive Web Dashboard**:
  - Crisp list/accordion view with collapsible details per checklist item.
  - Quick action toolbar: *Buka Semua* / *Tutup Semua*, filter status (*Berkas Belum Lengkap*, *Folder Kosong*, *TTD Pending*), and report exports (*CSV* & *JSON*).
  - In-browser reminder email draft simulator for PIC/signatories without sending real emails.

---

## Tech Stack

- **Backend**: Python 3.9+, FastAPI, PyMuPDF, PyPDF, OpenCV, Ultralytics YOLOv8 (optional fallback to CV density).
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion.

---

## Setup & Running Locally

### 1. Backend Service

```bash
# Setup virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start backend server on port 8001
uvicorn src.api.api:app --reload --port 8001
```

### 2. Frontend Web Interface

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000 in your browser
```

---

## Core API Endpoints

- `POST /verify/zip`: Async archive audit endpoint with background job processing.
- `POST /verify/folder`: Direct folder upload & extraction pipeline.
- `GET /verify/{job_id}`: Polling endpoint for archive inspection status and results.
- `POST /verify/async`: Single/batch PDF document signature matrix verification.
- `GET /api/checklist`: Returns current active checklist rules.
- `POST /api/alert/email`: Generates preview draft email for missing items and pending signatures.

---

## Testing & Quality Assurance

Run test suites locally:

```bash
# Backend unit & pipeline tests
PYTHONPATH=. .venv/bin/python tests/test_zip_checklist.py
PYTHONPATH=. .venv/bin/python tests/test_nmb_pipeline.py

# Frontend linting & type checks
cd frontend
npm run lint
npx tsc --noEmit
