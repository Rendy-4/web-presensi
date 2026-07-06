/* ==================================================================
   server.js
   ------------------------------------------------------------------
   BACKEND PRESENSI GEOLOKASI & KAMERA
   Stack: Node.js + Express.js + MySQL (mysql2) + Multer + CORS

   Cara menjalankan (lihat juga README.md):
     1. Pastikan Laragon (Apache/MySQL) sudah START.
     2. Import schema.sql ke MySQL (bikin database db_presensi).
     3. npm install
     4. npm start   (atau: node server.js)
     5. Server berjalan di http://localhost:5000
   ================================================================== */

const express = require("express");
const cors = require("cors");
const path = require("path");

// Inisialisasi koneksi database sekali di awal (lihat config/db.js).
// File ini juga langsung mengetes koneksi & mencetak log ke terminal.
require("./config/db");

const presensiRoutes = require("./routes/presensiRoutes");

const app = express();
const PORT = 5000;

// ------------------------------------------------------------------
// MIDDLEWARE GLOBAL
// ------------------------------------------------------------------

// Mengizinkan request lintas origin (misal Frontend di file:// atau
// port berbeda seperti 5500/3000) supaya tidak diblokir CORS browser.
app.use(cors());

// Parsing body request berformat JSON (untuk endpoint selain upload file)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menjadikan folder /uploads sebagai STATIC FOLDER, sehingga foto bisa
// diakses langsung lewat browser, contoh:
//   http://localhost:5000/uploads/absen_1_1719702400000.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ------------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------------

// Endpoint sederhana untuk mengecek server hidup atau tidak
app.get("/", (req, res) => {
  res.json({ message: "Server Presensi aktif 🚀", status: "OK" });
});

app.use("/api/presensi", presensiRoutes);

// ------------------------------------------------------------------
// PENANGANAN ERROR MULTER (misal file terlalu besar / tipe salah)
// Middleware error HARUS diletakkan setelah semua route, dengan
// 4 parameter (err, req, res, next) — ini format khusus Express agar
// dikenali sebagai error handler.
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err && err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: `Upload gagal: ${err.message}`,
    });
  }
  if (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: err.message || "Terjadi kesalahan pada request.",
    });
  }
  next();
});

// Handler untuk endpoint yang tidak ditemukan (404)
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint tidak ditemukan." });
});

// ------------------------------------------------------------------
// JALANKAN SERVER
// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
