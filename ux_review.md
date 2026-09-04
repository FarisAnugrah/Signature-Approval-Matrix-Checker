# UX Audit & Recommendations

Secara visual, landing page dan dashboard lu udah berasa kayak SaaS enterprise mahal. Efek glassmorphism, animasi scanner YOLO-style, dan auto-webhook terminal UI itu udah *Top Tier*.

Tapi dari sisi **Flow & Human-Computer Interaction (UX)**, ada beberapa kelemahan yang kalau lu benerin, bakal bikin aplikasi ini bener-bener *production-ready*:

### 1. Nggak Ada "Eye-Tracking" buat User
- **Problem**: Pas user liat status "Pending" atau "Not Found" buat role System Analyst, user pasti bingung *"Masa sih kosong? Perasaan dokumennya udah full sign."*
- **UX Fix**: Sistem harus ngasih bukti visual! Di samping hasil checklist, harusnya ada tombol 👁️ *View Document* yang pas diklik bakal buka **PDF Viewer + Highlight Kotak Merah/Hijau** di mana API nemuin (atau gagal nemuin) tanda tangannya. Kalau YOLO udah nyala, bounding box YOLO harus digambar di atas PDF-nya.

### 2. Missing "Manual Override"
- **Problem**: AI itu bodoh di kasus edge-case. Kalau API lu bilang 3/4 Signed (padahal 4/4 Signed), terus otomatis nembak Jira kasih label `waiting-sign-off`, manager lu bakal emosi karena tiketnya nyangkut.
- **UX Fix**: Tambahin **Human-in-the-Loop**. Jangan biarin webhook Jira nembak otomatis dulu. Kasih tombol "Approve Results" atau "Edit Results" di bawah Card Result. Jadi kalau sistem salah deteksi, si Admin (user) bisa ngubah "Pending" jadi "Verified" secara manual sebelum dipush ke Jira.

### 3. State "Uploading" vs "Scanning" yang Rancu
- **Problem**: Kalo batch upload 10 PDF gede, proses upload ke server vs proses OCR/YOLO scanning itu waktunya beda. User bisa mikir aplikasinya hang.
- **UX Fix**: Pecah progress bar-nya. Bikin state 1: *Uploading to server (100%)* -> state 2: *Queued (Posisi 2 dari 10)* -> state 3: *AI Scanning...*

### 4. Admin Panel yang Bahaya (No Validation)
- **Problem**: Halaman `/admin` tempat edit *Approval Matrix* JSON gampang banget diubah sembarang orang. Kalo dikosongin identifier-nya, routing dokumen bakal jebol.
- **UX Fix**: Tambahin sistem *Draft vs Publish*, tombol Undo, dan validasi "Role Name cannot be empty". Harusnya juga ada proteksi otentikasi sederhana (misal input PIN).

### 5. Hasil Batch Upload Kurang "Glanceable"
- **Problem**: Kalo upload 20 PDF, user harus *scroll* ke bawah panjang banget buat ngecek mana yang bermasalah.
- **UX Fix**: Di bagian paling atas hasil batch, kasih **Summary Dashboard**:
  - 🟢 15 Documents Approved
  - 🔴 5 Documents Need Attention
  Terus kasih filter toggle buat cuma nampilin yang bermasalah (*Show Pending Only*).
