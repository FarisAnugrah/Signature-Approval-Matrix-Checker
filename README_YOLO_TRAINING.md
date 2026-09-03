# 🚀 Panduan Training YOLOv8 untuk Signature Detection

Karena OpenCV dan OCR tradisional memiliki limitasi dalam membaca dokumen hasil scan yang kotor atau tertutup tinta, kita harus melatih model **YOLOv8** khusus untuk mendeteksi letak tanda tangan dan stempel secara akurat.

Ikuti 3 langkah mudah ini tanpa perlu coding ribet!

---

## 1️⃣ Siapkan Dataset (Kumpulin Gambar)
1. Kumpulkan sekitar **50 - 100 halaman** PDF/Scan yang ada tanda tangan atau stempelnya.
2. Convert halaman-halaman itu jadi gambar (`.jpg` atau `.png`).
3. Buka **[Roboflow.com](https://roboflow.com/)** (Bikin akun gratis).
4. Buat Project Baru:
   - Project Type: **Object Detection**
   - What are you detecting: `signature`
5. Upload gambar-gambar tadi ke Roboflow.
6. **Mulai Anotasi (Kotakin):**
   - Tarik kotak (bounding box) paskan di setiap tanda tangan atau stempel basah.
   - Beri nama class (label) kotak tersebut: `signature`
   - Lakukan untuk semua gambar sampai selesai.
7. Klik **Generate Dataset**.
8. Klik **Export Dataset** -> Pilih Format: **YOLOv8**.
9. Lu bakal dikasih link download atau snippet kode untuk mendownload dataset `.zip` (Di dalamnya ada folder `images`, `labels`, dan file `data.yaml`).

---

## 2️⃣ Proses Training (Di Google Colab)
Biar laptop Mac lu nggak meledak dan cepet beres, kita numpang GPU gratisnya Google.

1. Buka **[Google Colab](https://colab.research.google.com/)**.
2. Bikin Notebook baru.
3. Di menu atas, klik **Runtime** -> **Change runtime type** -> Pilih Hardware Accelerator: **T4 GPU** -> Save.
4. Di cell pertama, ketik ini dan jalankan (Play):
   ```python
   !pip install ultralytics
   ```
5. Upload file `.zip` dataset dari Roboflow tadi ke Colab (drag n drop ke icon folder di kiri).
6. Ekstrak zip-nya di cell kedua:
   ```python
   !unzip nama_file_dataset_lu.zip -d dataset
   ```
7. Mulai proses Training! Di cell ketiga jalankan ini:
   ```python
   !yolo task=detect mode=train model=yolov8n.pt data=dataset/data.yaml epochs=50 imgsz=640
   ```
   *(Tungguin sekitar 10-20 menit sampai selesai).*

---

## 3️⃣ Pasang Model ke Project Ini
1. Setelah training di Colab selesai, cari file hasil otak AI-nya di panel sebelah kiri Colab. 
2. Masuk ke folder: `runs/detect/train/weights/`.
3. Di situ ada file bernama **`best.pt`**. Download file itu ke laptop lu.
4. Rename file tersebut jadi **`signature_best.pt`**.
5. Pindahkan file tersebut ke dalam folder `models/` di project Signature Checker lu ini.
   ```text
   Signature Approval Matrix Checker/
   ├── config/
   ├── models/
   │   └── signature_best.pt    <-- Taruh di sini!
   ├── src/
   ```
6. Restart backend lu:
   ```bash
   uvicorn src.api.api:app --host 0.0.0.0 --port 8001 --reload
   ```
7. Lihat terminal! Kalau muncul tulisan `Successfully loaded YOLO model from models/signature_best.pt`, berarti AI lu udah nyala.

Selesai! Sekarang semua PDF lu bakal diproses pakai ketajaman mata AI!
