# Backend Presensi Geolokasi & Kamera

Backend Node.js (Express) + MySQL (via Laragon) + Multer untuk endpoint presensi berbasis lokasi.

## Struktur Folder

```
backend-presensi/
├── config/
│   ├── db.js          # koneksi MySQL (mysql2)
│   └── upload.js       # konfigurasi multer (upload foto)
├── controllers/
│   └── presensiController.js   # logika Haversine & validasi radius
├── routes/
│   └── presensiRoutes.js
├── uploads/             # folder penyimpanan foto (auto-dibuat)
├── schema.sql            # query CREATE TABLE + data testing
├── server.js             # entry point
└── package.json
```

## 1. Siapkan Database (Laragon)

1. Buka **Laragon** → klik **Start All** (pastikan Apache & MySQL menyala, ikon hijau).
2. Buka **HeidiSQL** (bawaan Laragon, klik menu Laragon → Database) atau phpMyAdmin.
3. Jalankan seluruh isi file `schema.sql` yang sudah disediakan. File ini akan:
   - Membuat database `db_presensi`
   - Membuat tabel `users`, `lokasi_kantor`, `presensi`
   - Mengisi 1 baris data testing di `users` (id=1) dan `lokasi_kantor` (id=1)

   Lewat CLI (opsional), dari folder project:
   ```bash
   mysql -u root -p < schema.sql
   ```
   (Tekan Enter saja saat diminta password, karena default Laragon passwordnya kosong.)

4. **PENTING:** buka tabel `lokasi_kantor`, lalu ubah `latitude_pusat` dan `longitude_pusat`
   pada baris id=1 sesuai koordinat kantor/lokasi Anda yang sebenarnya (bisa didapat dari
   Google Maps: klik kanan pada lokasi → koordinat akan muncul). Kalau tidak diubah, sistem
   akan memakai koordinat contoh (Jakarta) dan kemungkinan besar presensi Anda akan selalu
   dianggap "di luar radius".

## 2. Install & Jalankan Server

Dari dalam folder `backend-presensi/`:

```bash
npm install
npm start
```

Jika berhasil, akan muncul log seperti ini di terminal:
```
✅ Berhasil terhubung ke database MySQL (db_presensi)
✅ Server berjalan di http://localhost:5000
```

Untuk mode development dengan auto-restart saat ada perubahan kode:
```bash
npm run dev
```
(memerlukan `nodemon`, sudah termasuk di `devDependencies`)

## 3. Uji Coba Endpoint

**Cek server hidup:**
```
GET http://localhost:5000/
```

**Kirim presensi (dari Frontend, atau uji manual pakai Postman/Insomnia):**
```
POST http://localhost:5000/api/presensi
Content-Type: multipart/form-data

Fields (FormData):
  - latitude        (text)   contoh: -6.200123
  - longitude       (text)   contoh: 106.816456
  - alamat_lengkap  (text)   contoh: "Jl. Contoh No. 1, Jakarta"
  - foto            (file)   file gambar JPG/PNG
```

**Respons sukses (201) — dalam radius:**
```json
{
  "success": true,
  "message": "Presensi berhasil dicatat.",
  "data": {
    "id": 1,
    "user_id": 1,
    "waktu_absen": "2026-07-05T13:20:00.000Z",
    "status": "Hadir",
    "jarak_meter": 42,
    "foto_url": "http://localhost:5000/uploads/absen_1_1719702400000.jpg",
    ...
  }
}
```

**Respons gagal (400) — di luar radius:**
```json
{
  "success": false,
  "message": "Anda berada di luar radius kantor (jarak: 350 m, radius diizinkan: 100 m).",
  "jarak_meter": 350,
  "radius_meter": 100
}
```

Foto yang berhasil diunggah bisa langsung dibuka lewat browser di:
```
http://localhost:5000/uploads/NAMA_FILE.jpg
```

## 4. Menghubungkan ke Frontend

Frontend (`script.js`) sudah dikonfigurasi mengirim `FormData` (latitude, longitude, foto)
ke `API_ENDPOINT = "http://localhost:5000/api/presensi"`. Tambahkan field `alamat_lengkap`
ke `FormData` di fungsi `sendPresensiToServer()` pada Frontend agar alamat hasil reverse
geocoding ikut terkirim dan tersimpan ke kolom `alamat_lengkap`:

```js
formData.append("alamat_lengkap", document.getElementById("addressVal").textContent);
```

## Catatan & Batasan (Untuk Pengembangan Lanjutan)

- `user_id` dan `id` lokasi kantor (=1) masih **hardcode** sesuai permintaan awal untuk
  testing. Setelah ada sistem login, ganti dengan data user yang sedang login (misalnya
  lewat JWT/session) dan lokasi kantor sesuai kebutuhan (mendukung banyak cabang).
- Kolom status `'Terlambat'` sudah tersedia di tabel, tetapi logika penentuannya (misalnya
  berdasarkan jam masuk kerja) belum diimplementasikan — bisa ditambahkan dengan
  membandingkan `waktu_absen` terhadap jam kerja yang disimpan di tabel konfigurasi.
- Password di tabel `users` harus di-hash (misalnya dengan `bcrypt`) — jangan simpan
  plaintext. Endpoint login/register belum dibuat di sini karena belum diminta.
- Nominatim (reverse geocoding di Frontend) punya rate limit; untuk produksi sebaiknya
  pertimbangkan proxy sendiri atau layanan berbayar.
