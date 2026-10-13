import io
import zipfile
import json
import os
import tempfile
import asyncio
from src.api.api import (
    load_checklist, 
    process_zip_inspection, 
    jobs, 
    send_alert_notification, 
    SendAlertRequest
)

def test_checklist_loaded():
    checklist = load_checklist()
    assert "tree" in checklist
    paths = [item["path"] for item in checklist["tree"]]
    assert "development/ut/BA UT" in paths
    assert "development/ut/android" in paths
    assert "development/ut/ios" in paths
    assert "brd" in paths
    assert "pengadaan" in paths
    print("✓ Checklist loaded and verified")

def test_zip_verification_pipeline_logic():
    job_id = "test_job_123"
    jobs[job_id] = {"status": "pending", "result": None, "error": None}

    # Buat file zip sementara
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp_zip:
        zip_path = tmp_zip.name

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("NMB 2026/Project_Alpha/pengadaan/spk.docx", "sample")
        zf.writestr("NMB 2026/Project_Alpha/aks/aks_v1.pdf", "sample")
        zf.writestr("NMB 2026/Project_Alpha/development/ut/BA UT/ba_ut_signed.pdf", "sample")

    try:
        process_zip_inspection(job_id, zip_path)
        job_data = jobs.get(job_id)
        assert job_data["status"] == "completed"
        res = job_data["result"]
        assert res["total_projects"] == 1
        assert "Project_Alpha" in res["projects"]
        
        proj = res["projects"]["Project_Alpha"]
        status_map = {item["path"]: item["status"] for item in proj["items"]}
        
        assert status_map["pengadaan"] == "Ditemukan"
        assert status_map["aks"] == "Ditemukan"
        assert status_map["development/ut/BA UT"] == "Ditemukan"
        assert status_map["brd"] == "Belum ditemukan"
        
        print("✓ ZIP inspection pipeline passed")
    finally:
        jobs.pop(job_id, None)

def test_alert_email():
    req = SendAlertRequest(
        recipient_email="pic-itp@btn.co.id",
        project_name="Project_Alpha",
        missing_items=["brd", "requirement gathering/pcr"],
        missing_signatures=[
            {"path": "brd", "missing_roles": ["ITPD Division Head", "Business User"]}
        ]
    )
    res = asyncio.run(send_alert_notification(req))
    assert res["status"] == "success"
    assert "pic-itp@btn.co.id" in res["preview"]
    assert "ITPD Division Head" in res["preview"]
    print("✓ Alert email generation passed")

if __name__ == "__main__":
    test_checklist_loaded()
    test_zip_verification_pipeline_logic()
    test_alert_email()
    print("\nALL IN-HOUSE TESTS PASSED SUCCESSFULLY!")
