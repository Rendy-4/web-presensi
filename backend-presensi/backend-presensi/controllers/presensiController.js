/* ==================================================================
   controllers/presensiController.js
   ------------------------------------------------------------------
   Logika utama endpoint POST /api/presensi:
   1. Ambil lokasi kantor (untuk testing: id = 1) dari tabel lokasi_kantor.
   2. Hitung jarak user ke kantor pakai rumus Haversine.
   3. Jika jarak <= radius kantor  -> simpan status 'Hadir'.
      Jika jarak >  radius kantor  -> tolak (400), foto yang sudah
      terlanjur di-upload dihapus lagi supaya tidak menumpuk sampah.
   ================================================================== */

const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { hitungJarakMeter } = require("../utils/haversine");

// Hardcode dulu untuk testing awal, sesuai instruksi.
// TODO: setelah ada sistem login/JWT, ganti dengan ID user yang sedang login.
const HARDCODED_USER_ID = 1;
const ID_LOKASI_KANTOR_TESTING = 1;

async function createPresensi(req, res) {
  // Helper untuk menghapus file foto yang sudah terlanjur di-upload
  // oleh multer, dipakai saat validasi gagal setelah file tersimpan.
  function hapusFileUpload() {
    if (req.file) {
      const filePath = path.join(__dirname, "..", "uploads", req.file.filename);
      fs.unlink(filePath, () => {}); // abaikan error penghapusan, tidak kritikal
    }
  }

  try {
    const { latitude, longitude, alamat_lengkap } = req.body;

    // ------------------------------------------------------------
    // VALIDASI INPUT DASAR
    // ------------------------------------------------------------
    if (!latitude || !longitude) {
      hapusFileUpload();
      return res.status(400).json({
        success: false,
        message: "Data latitude dan longitude wajib dikirim.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Foto bukti presensi wajib diunggah.",
      });
    }

    const latUser = parseFloat(latitude);
    const lngUser = parseFloat(longitude);

    if (Number.isNaN(latUser) || Number.isNaN(lngUser)) {
      hapusFileUpload();
      return res.status(400).json({
        success: false,
        message: "Format latitude/longitude tidak valid.",
      });
    }

    // ------------------------------------------------------------
    // 1. AMBIL DATA LOKASI KANTOR (hardcode id=1 untuk testing)
    // ------------------------------------------------------------
    const [rows] = await db.query(
      "SELECT * FROM lokasi_kantor WHERE id = ? LIMIT 1",
      [ID_LOKASI_KANTOR_TESTING]
    );

    if (rows.length === 0) {
      hapusFileUpload();
      return res.status(500).json({
        success: false,
        message: "Data lokasi kantor (id=1) tidak ditemukan. Cek tabel lokasi_kantor.",
      });
    }

    const lokasiKantor = rows[0];

    // ------------------------------------------------------------
    // 2. HITUNG JARAK DENGAN RUMUS HAVERSINE
    // ------------------------------------------------------------
    const jarakMeter = hitungJarakMeter(
      latUser,
      lngUser,
      lokasiKantor.latitude_pusat,
      lokasiKantor.longitude_pusat
    );

    const radiusDiizinkan = lokasiKantor.radius_meter;

    // ------------------------------------------------------------
    // 3. VALIDASI RADIUS
    // ------------------------------------------------------------
    if (jarakMeter > radiusDiizinkan) {
      // Di luar radius kantor -> TOLAK, jangan simpan ke database.
      // (Jika Anda ingin tetap MENYIMPAN record dengan status
      //  'Di Luar Radius' alih-alih menolaknya, lihat blok kode
      //  alternatif yang dikomentari di bagian bawah file ini.)
      hapusFileUpload();
      return res.status(400).json({
        success: false,
        message: `Anda berada di luar radius kantor (jarak: ${Math.round(jarakMeter)} m, radius diizinkan: ${radiusDiizinkan} m).`,
        jarak_meter: Math.round(jarakMeter),
        radius_meter: radiusDiizinkan,
      });
    }

    const status = "Hadir";

    // ------------------------------------------------------------
    // 4. SIMPAN KE TABEL presensi
    // ------------------------------------------------------------
    const waktuAbsen = new Date(); // waktu server saat ini
    const fotoBukti = req.file.filename;

    const [result] = await db.query(
      `INSERT INTO presensi
        (user_id, waktu_absen, latitude_user, longitude_user, foto_bukti, alamat_lengkap, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        HARDCODED_USER_ID,
        waktuAbsen,
        latUser,
        lngUser,
        fotoBukti,
        alamat_lengkap || null,
        status,
      ]
    );

    // URL publik foto (karena folder /uploads sudah dijadikan static)
    const fotoUrl = `${req.protocol}://${req.get("host")}/uploads/${fotoBukti}`;

    return res.status(201).json({
      success: true,
      message: "Presensi berhasil dicatat.",
      data: {
        id: result.insertId,
        user_id: HARDCODED_USER_ID,
        waktu_absen: waktuAbsen,
        latitude_user: latUser,
        longitude_user: lngUser,
        alamat_lengkap: alamat_lengkap || null,
        foto_bukti: fotoBukti,
        foto_url: fotoUrl,
        status,
        jarak_meter: Math.round(jarakMeter),
      },
    });
  } catch (err) {
    console.error("Error saat memproses presensi:", err);
    hapusFileUpload();
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server saat memproses presensi.",
    });
  }
}

module.exports = { createPresensi };

/* ==================================================================
   ALTERNATIF: jika Anda ingin tetap MENYIMPAN presensi yang di luar
   radius (statusnya "Di Luar Radius") alih-alih menolaknya dengan
   400, ganti blok "VALIDASI RADIUS" di atas dengan kode berikut:

   const status = jarakMeter <= radiusDiizinkan ? "Hadir" : "Di Luar Radius";
   // lalu lanjut langsung ke proses INSERT seperti biasa (tanpa return 400),
   // dan sesuaikan response API untuk tetap mengirim `success: true`
   // beserta info status & jarak, supaya Frontend bisa menampilkan
   // peringatan "Presensi tercatat, namun di luar radius kantor".
   ================================================================== */
