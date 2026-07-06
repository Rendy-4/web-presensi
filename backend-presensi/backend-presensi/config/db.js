/* ==================================================================
   config/db.js
   ------------------------------------------------------------------
   Konfigurasi koneksi ke database MySQL (Laragon) menggunakan
   library mysql2. Kita pakai "connection pool" (bukan koneksi
   tunggal) supaya server bisa menangani banyak request bersamaan
   tanpa membuat koneksi baru setiap kali ada query.
   ================================================================== */

const mysql = require("mysql2");

// Sesuaikan nilai-nilai ini jika konfigurasi MySQL di Laragon Anda berbeda
// (misalnya jika Anda mengganti port MySQL bawaan Laragon).
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",           // default Laragon: password root kosong
  database: "db_presensi",
  port: 3306,              // port default MySQL di Laragon
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,       // agar kolom DATETIME dikembalikan sebagai string, bukan objek Date UTC
});

// Gunakan versi Promise dari pool agar bisa memakai async/await
// (mysql2/promise), alih-alih callback (err, results) yang lama.
const db = pool.promise();

// Tes koneksi sekali saat server pertama kali start, supaya kalau
// MySQL di Laragon belum jalan, kita langsung tahu dari log terminal.
(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ Berhasil terhubung ke database MySQL (db_presensi)");
    connection.release();
  } catch (err) {
    console.error("❌ Gagal terhubung ke database MySQL:", err.message);
    console.error("   Pastikan service MySQL di Laragon sudah menyala dan database 'db_presensi' sudah dibuat (lihat schema.sql).");
  }
})();

module.exports = db;
