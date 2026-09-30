import pytest
from fastapi.testclient import TestClient
from src.api.api import app

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Signature Approval Matrix Checker API is running"}

def test_get_templates():
    response = client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert "BRD" in data
    assert "PCR" in data
    assert "roles" in data["BRD"]
