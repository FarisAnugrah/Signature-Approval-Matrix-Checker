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
    assert "development/ut" in paths
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
        zf.writestr("NMB 2026/Project_Alpha/development/ut/ut_result.pdf", "sample")
        zf.writestr("NMB 2026/Project_Alpha/development/ut/BA UT/ba_ut_signed.pdf", "sample")

    try:
        process_zip_inspection(job_id, zip_path)
        job_data = jobs.get(job_id)
        assert job_data["status"] == "completed"
        res = job_data["result"]
        assert res["total_projects"] == 1
        assert "NMB 2026/Project_Alpha" in res["projects"]
        
        proj = res["projects"]["NMB 2026/Project_Alpha"]
        status_map = {item["path"]: item["status"] for item in proj["items"]}
        
        assert status_map["pengadaan"] == "Ditemukan"
        assert status_map["aks"] == "Ditemukan"
        assert status_map["development/ut"] == "Ditemukan"
        assert status_map["brd"] == "Perlu pemetaan"
        
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

def test_zip_modes_api():
    from fastapi import BackgroundTasks, HTTPException, UploadFile
    from src.api.api import verify_zip_async

    async def run():
        for mode in ("itp", "custom", "inventory"):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as output:
                output.writestr("Archive 2039/Project/contracts/a.txt", "sample")
                output.writestr("Archive 2039/Project/empty/", "")
            buffer.seek(0)
            tasks = BackgroundTasks()
            response = await verify_zip_async(tasks, UploadFile(filename="PROJECT.ZIP", file=buffer), json.dumps({"mode": mode, "categories": ["contracts"]}))
            await tasks()
            job = jobs.pop(response["job_id"])
            assert job["status"] == "completed", job
            assert job["result"]["mode"] == mode
            assert any(node["path"].endswith("/empty") and node["empty"] for node in job["result"]["tree"])
        for options in ('{"mode":"invalid"}', '{"mode":"custom","categories":["../bad"]}'):
            upload = UploadFile(filename="test.zip", file=io.BytesIO())
            try:
                await verify_zip_async(BackgroundTasks(), upload, options)
                raise AssertionError("Invalid options accepted")
            except HTTPException as exc:
                assert exc.status_code == 400
            finally:
                await upload.close()

    asyncio.run(run())


def test_uploads_over_100_mib():
    from fastapi import BackgroundTasks, UploadFile
    from src.api.api import verify_folder_async, verify_zip_async

    class ChunkedUpload(UploadFile):
        async def read(self, size=-1):
            assert 0 < size <= 1024 * 1024
            return await super().read(size)

    async def run():
        chunk = os.urandom(1024 * 1024)
        with tempfile.TemporaryDirectory() as directory:
            paths = [f"file-{i}.bin" for i in range(6)]
            for path in paths:
                with open(os.path.join(directory, path), "wb") as output:
                    for _ in range(17):
                        output.write(chunk)
            zip_path = os.path.join(directory, "large.zip")
            with zipfile.ZipFile(zip_path, "w") as output:
                for path in paths:
                    output.write(os.path.join(directory, path), path)
            assert os.path.getsize(zip_path) > 100 * 1024 * 1024
            for mode in ("zip", "folder"):
                tasks = BackgroundTasks()
                uploads = []
                response = None
                try:
                    if mode == "zip":
                        uploads = [ChunkedUpload(filename="large.zip", file=open(zip_path, "rb"))]
                        response = await verify_zip_async(tasks, uploads[0], '{"mode":"inventory"}')
                    else:
                        uploads = [ChunkedUpload(filename=p, file=open(os.path.join(directory, p), "rb")) for p in paths]
                        response = await verify_folder_async(tasks, uploads, json.dumps(paths), '{"mode":"inventory"}')
                    await tasks()
                    job = jobs[response["job_id"]]
                    assert job["status"] == "completed", job
                    assert sum(n.get("size", 0) for n in job["result"]["tree"]) == 102 * 1024 * 1024
                finally:
                    for upload in uploads:
                        await upload.close()
                    if response:
                        jobs.pop(response["job_id"], None)

    asyncio.run(run())


if __name__ == "__main__":
    test_uploads_over_100_mib()
    test_zip_modes_api()
    test_checklist_loaded()
    test_zip_verification_pipeline_logic()
    test_alert_email()
    print("\nALL IN-HOUSE TESTS PASSED SUCCESSFULLY!")
