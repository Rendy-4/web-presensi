/* ==================================================================
   config/upload.js
   ------------------------------------------------------------------
   Konfigurasi multer untuk menyimpan foto bukti presensi ke folder
   lokal /uploads, dengan nama file unik berbasis timestamp supaya
   tidak saling menimpa (overwrite) antar-user/antar-absen.
   Contoh nama file hasil: absen_1_1719702400000.jpg
   ================================================================== */

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

// Pastikan folder /uploads sudah ada; kalau belum, buat otomatis
// supaya server tidak crash saat menerima upload pertama kali.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // TODO: pada implementasi login sungguhan, ganti angka "1" di bawah
    // dengan req.user.id (user yang sedang login), bukan hardcode.
    const userId = req.body.user_id || 1;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || ".jpg"; // fallback .jpg jika tidak ada ekstensi
    const filename = `absen_${userId}_${timestamp}${ext}`;
    cb(null, filename);
  },
});

// Filter agar hanya file gambar yang diterima (jaga-jaga dari file berbahaya)
function fileFilter(req, file, cb) {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP."));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // maksimal 5 MB per foto
  },
});

module.exports = upload;
