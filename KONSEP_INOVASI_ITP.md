# Dokumentasi Komprehensif: Asisten Pemeriksa Kelengkapan Dokumen & Matriks Tanda Tangan Proyek ITP (NMB 2026)

Dokumen ini disusun sebagai panduan teknis dan konseptual mendalam bagi tim pengembang (*engineer*), rekan kerja, maupun pembimbing magang/tim ITP Bank BTN untuk memahami latar belakang masalah, arsitektur sistem, keputusan rekayasa (*engineering decisions*), serta alur kerja aplikasi secara menyeluruh.

---

## 1. Konteks Bisnis & Latar Belakang Masalah

### 1.1 Kondisi Riil Lapangan (As-Is)
Di lingkungan **IT Planning (ITP) Bank BTN**, setiap proyek pengadaan dan pengembangan teknologi informasi melewati siklus hidup proyek (*Project Lifecycle*) yang panjang. Seluruh dokumen pertanggungjawaban proyek saat ini diarsipkan ke dalam repositori SharePoint internal dengan nama induk folder tahunan, seperti **NMB 2026**.

Di dalam satu tahun anggaran, terdapat puluhan proyek IT aktif. Setiap proyek memiliki folder masing-masing yang diwajibkan memuat dokumen formal dari tahap inisiasi sampai rilis, antara lain:
* Dokumen Pengadaan & Kontrak
* Dokumen Analisis Kebutuhan (AKS, BRD, FSD, TSD, Security Assessment)
* Dokumen Pengujian (BA UT, BA SIT, Compatibility, Performance, Regression, BA UAT)
* Dokumen Deployment (Form Promote & Memo, Hasil Promote, POK Aplikasi/Promote/Rollback, Test Operation)

### 1.2 Masalah Operasional yang Terjadi
Sebelum dokumen dapat diaudit atau proyek dinyatakan selesai (*closed*), staf ITP harus memverifikasi kepatuhan dokumen. Proses manual ini menimbulkan hambatan besar:
1. **Pemeriksaan Keberadaan Berkas yang Memakan Waktu**: Staf harus mengecek folder satu per satu secara manual. File sering kali tercecer, belum diunggah oleh vendor/tim pengembang, atau folder dibiarkan kosong.
2. **Pemeriksaan Tanda Tangan (Approval Matrix) yang Rentan Terlewat**: Membuka PDF puluhan hingga ratusan lembar hanya untuk melihat lembar paling belakang (*Approval Sheet*). Dokumen yang ada sering kali belum ditandatangani lengkap oleh pejabat terkait (misal: baru ditandatangani Business User, tetapi belum oleh Division Head atau IT Planning).
3. **Penyisiran Manual Membosankan & Rawan Human Error**: Menghabiskan 4–6 jam kerja per proyek hanya untuk pekerjaan administratif repetitive.

---

## 2. Solusi: 1 Aplikasi dengan 2 Layer Pemeriksaan

Sistem dirancang sebagai aplikasi web terintegrasi yang menjalankan dua pilar pemeriksaan sekaligus:

```text
               +-------------------------------------------------------+
               |                    INPUT PENGGUNA                     |
               |         (Arsip ZIP Proyek NMB 2026 / 300+ MB)         |
               +---------------------------+---------------------------+
                                           |
                                           v
+--------------------------------------------------------------------------------------+
| LAYER 1: AUDIT KELENGKAPAN BERKAS (Document Existence & Tree Hierarchy Check)        |
| - Mengekstrak struktur ZIP & memetakan jalur folder                                  |
| - Mencocokkan dengan master checklist NMB 2026 (26 subfolder wajib)                   |
| - Output: Kategori status "Ditemukan" (+ nama file) vs "Belum ditemukan"            |
+------------------------------------------+-------------------------------------------+
                                           |
                  (Hanya untuk file yang butuh persetujuan: BRD, PCR, BA SIT, dll.)
                                           |
                                           v
+--------------------------------------------------------------------------------------+
| LAYER 2: AUDIT MATRIKS TANDA TANGAN (Signature Matrix via Dynamic Slot Matching)     |
| - OCR (Tesseract): Mencari tabel approval sheet & membaca peran yang TERCETAK        |
| - Computer Vision / YOLO: Memeriksa keberadaan tinta tanda tangan di atas kotak peran |
| - Dynamic Calculation: Evaluasi hanya pada slot peran yang benar-benar ada di berkas |
+------------------------------------------+-------------------------------------------+
                                           |
                                           v
+--------------------------------------------------------------------------------------+
| OUTPUT AKHIR & TINDAK LANJUT                                                         |
| - Dashboard Status Kelengkapan Proyek (% ketercapaian berkas)                        |
| - Rekap peran yang belum paraf                                                       |
| - Alerting System: Notifikasi draft email otomatis ke PIC Proyek terkait             |
+--------------------------------------------------------------------------------------+
```

---

## 3. Spesifikasi Pohon Folder Standar (Master Checklist NMB 2026)

Sistem merujuk pada skema konfigurasi JSON baku (`config/nmb_checklist.json`) yang mencakup 26 titik pemeriksaan hierarkis per proyek:

```text
NMB 2026/
└── [Nama Project]/
    ├── pengadaan/                                                      [Wajib]
    ├── aks/                                                            [Wajib]
    ├── brd/                                                            [Wajib | Butuh TTD]
    ├── requirement gathering/
    │   ├── pcr/                                                        [Wajib | Butuh TTD]
    │   ├── fsd/                                                        [Wajib]
    │   ├── tsd/                                                        [Wajib]
    │   └── security asessement/                                        [Wajib]
    ├── development/
    │   └── ut/
    │       ├── android/                                                [Wajib]
    │       ├── ios/                                                    [Wajib]
    │       └── BA UT/                                                  [Wajib | Butuh TTD]
    ├── functional testing & non functional testing/
    │   ├── qa checklist/                                               [Wajib]
    │   ├── sit/
    │   │   ├── ba sit/                                                 [Wajib | Butuh TTD]
    │   │   ├── android/                                                [Wajib]
    │   │   └── ios/                                                    [Wajib]
    │   ├── system tesing/
    │   │   ├── compability test/                                       [Wajib]
    │   │   ├── performance test/                                       [Wajib]
    │   │   └── regression test/                                        [Wajib]
    │   └── uat/
    │       ├── android/                                                [Wajib]
    │       ├── ios/                                                    [Wajib]
    │       └── ba uat/                                                 [Wajib | Butuh TTD]
    └── deployment/
        ├── form promote & memo/                                        [Wajib | Butuh TTD]
        ├── hasil promote/                                              [Wajib]
        ├── pok/
        │   ├── pok aplikasi/                                           [Wajib]
        │   ├── pok promote/                                            [Wajib]
        │   └── pok rollback/                                           [Wajib]
        └── test operation/                                             [Wajib]
```

---

## 4. Keputusan Rekayasa Penting (*Key Engineering Decisions*)

### 4.1 Mengapa Upload ZIP Dulu (Bukan Langsung SharePoint)?
* **Alasan Pragmatis MVP**: Integrasi langsung ke SharePoint BTN via Microsoft Graph API memerlukan proses pengajuan izin hak akses (*Application Registration* & persetujuan izin Admin Azure AD/Entra ID) yang membutuhkan waktu birokrasi IT Security.
* **Solusi**: Menggunakan fitur unggah arsip folder ZIP sebagai basis MVP. Logika pemrosesan dokumen di backend dibangun modular sehingga ketika jalur integrasi SharePoint dibuka, endpoint sumber datanya tinggal dialihkan tanpa merombak logika audit.
* **Penanganan File Besar (300+ MB)**: Endpoint backend `POST /verify/zip` mengimplementasikan teknik **Stream Chunking (8 MB buffer per pembacaan)**. File tidak ditampung di memori RAM server melainkan dialirkan langsung ke disk penyimpanan sementara (`tempfile`), lalu folder ekstraksi sementara segera dimusnahkan (`shutil.rmtree`) setelah verifikasi selesai demi efisiensi dan keamanan data.

### 4.2 Logika *Dynamic Slot Matching* (Mengapa Tidak Mengunci 7 Peran Tetap?)
* **Kenyataan di Lapangan**: Pada dokumen BRD, template ideal mencantumkan hingga 7 peran (*BRM, IT Planning, ITPD Division Head, Head of Planning Performance, Business User Division Head, Business User Department Head, Business User*). Namun untuk proyek skala menengah atau kecil, lembar persetujuan yang dicetak di dokumen sering kali hanya memuat **3 atau 4 peran saja**.
* **Masalah Jika Memakai Template Statis**: Sistem akan memberikan *false negative* (menganggap 3 peran lainnya "hilang/belum tanda tangan"), padahal memang peran tersebut tidak dibutuhkan untuk proyek itu.
* **Implementasi Sistem**:
  1. OCR Tesseract memindai lembar persetujuan (*approval page*) dan mendeteksi peran mana saja yang **benar-benar tercetak** di halaman tersebut (`found: True`).
  2. Sistem menetapkan target penilaian hanya pada slot peran yang ditemukan di halaman itu.
  3. Jika hanya tercetak 4 peran, skor kelengkapan dinilai dari rasio `4/4`.

### 4.3 Kolaborasi OCR dan Computer Vision (YOLO / OpenCV)
Tugas deteksi tanda tangan dibagi menjadi dua peran spesifik:
1. **OCR (Optical Character Recognition)**:
   - Bertugas membaca teks ketikan nama peran/jabatan (misal: *"Head of Development"*, *"Business Relationship Manager"*).
   - Mengambil koordinat batas kotak teks tersebut di halaman PDF.
2. **Computer Vision (YOLO / OpenCV Density)**:
   - Membuat area pemotongan (*Region of Interest / ROI*) tepat di atas kotak teks nama jabatan tersebut.
   - Memeriksa goresan tinta tanda tangan/paraf fisik.
   - **Ensemble Hook**: Sistem secara default menjalankan algoritma *Adaptive Ink Density OpenCV* (bebas dependensi eksternal), dan otomatis beralih memprioritaskan model AI **YOLO** jika file bobot terlatih `models/signature_best.pt` ditaruh di folder proyek.

### 4.4 Strategi Lisensi Perangkat Lunak & Audit Enterprise BTN
Sebagai Badan Usaha Milik Negara (BUMN) di industri perbankan yang diatur ketat oleh regulasi OJK dan audit internal:
* **Larangan Lisensi AGPL**: Model YOLOv8 komersial memiliki lisensi AGPL-3.0 yang berpotensi memicu temuan audit kepatuhan lisensi perangkat lunak.
* **Strategi Aman Enterprise (Rp 0,- Biaya)**:
  - Menggunakan algoritma **OpenCV Native** yang berlisensi **Apache 2.0** (100% legal, gratis untuk penggunaan enterprise internal).
  - Untuk model deteksi objek tingkat lanjut, diarahkan menggunakan arsitektur **YOLOv10** yang berlisensi **Apache 2.0** (dikembangkan Tsinghua University) yang tidak membebankan royalti maupun kewajiban membuka source code perusahaan.

### 4.5 Desain Sistem Alerting Email
* Pengguna tidak perlu menginput ratusan email karyawan bank.
* Sistem menyediakan form input email PIC/Project Manager untuk proyek yang sedang diperiksa.
* Sekali klik, sistem menyusun draf notifikasi otomatis berisi daftar dokumen yang belum diunggah dan daftar peran yang belum menandatangani dokumen.

---

## 5. Roadmap & Pengembangan Selanjutnya (*Enhancement*)

1. **Integrasi Langsung SharePoint / Power Automate**:
   Menghubungkan flow terjadwal Power Automate untuk mengambil berkas dari folder SharePoint BTN secara otomatis tanpa perlu pengguna mengekspor ke file ZIP.
2. **Penyimpanan Database Persisten**:
   Memindahkan antrean memori sementara (`jobs = {}`) ke database PostgreSQL internal agar riwayat audit tiap proyek tersimpan permanen.
3. **Sinkronisasi Tiket Jira**:
   Menghubungkan hasil temuan pending sign-off langsung ke tiket task backlog tim di Jira BTN.
