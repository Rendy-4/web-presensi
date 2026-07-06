/* ==================================================================
   PRESENSI GEOLOKASI & KAMERA — script.js
   ------------------------------------------------------------------
   CATATAN KEAMANAN (WAJIB DIBACA):
   getUserMedia() (kamera) dan navigator.geolocation (GPS) HANYA bisa
   dipanggil di "secure context":
     - https://namadomainanda.com   (saat sudah online / production)
     - http://localhost:PORT        (saat development di komputer)
   Jika dibuka via file:// atau http://ip-lokal-biasa di HP, browser
   akan menolak permintaan izin ini secara diam-diam / error.
   ================================================================== */

// ------------------------------------------------------------------
// 1. KONFIGURASI GLOBAL
// ------------------------------------------------------------------
const API_ENDPOINT = "https://real-trees-exist.loca.lt"; // ganti sesuai backend asli

// Menyimpan "state" aplikasi supaya mudah dilacak di satu tempat
const state = {
  stream: null,        // objek MediaStream dari kamera (WebRTC)
  latitude: null,       // koordinat lintang terakhir
  longitude: null,      // koordinat bujur terakhir
  accuracy: null,       // radius akurasi GPS (meter)
  photoBlob: null,      // hasil jepretan foto dalam bentuk Blob (JPEG)
  map: null,             // instance peta Leaflet
  marker: null,          // marker Leaflet di peta
  stage: "idle",         // idle -> permitting -> ready -> sending -> done
};

// ------------------------------------------------------------------
// 2. AMBIL REFERENSI ELEMEN DOM
// ------------------------------------------------------------------
const el = {
  mainBtn: document.getElementById("mainBtn"),
  btnLabel: document.getElementById("btnLabel"),
  btnSpinner: document.getElementById("btnSpinner"),
  resetBtn: document.getElementById("resetBtn"),
  video: document.getElementById("cameraVideo"),
  cameraPlaceholder: document.getElementById("cameraPlaceholder"),
  liveBadge: document.getElementById("liveBadge"),
  canvas: document.getElementById("snapshotCanvas"),
  mapPlaceholder: document.getElementById("mapPlaceholder"),
  leafletMapDiv: document.getElementById("leafletMap"),
  latVal: document.getElementById("latVal"),
  lngVal: document.getElementById("lngVal"),
  accVal: document.getElementById("accVal"),
  alertBox: document.getElementById("alertBox"),
  stamp: document.getElementById("successStamp"),
  stampTime: document.getElementById("stampTime"),
  stepper: document.getElementById("stepper"),
  addressVal: document.getElementById("addressVal"),
  timestampVal: document.getElementById("timestampVal"),
};

// ------------------------------------------------------------------
// 3. FUNGSI BANTUAN UI (tampilkan pesan, ubah tombol, ubah stepper)
// ------------------------------------------------------------------

// Menampilkan kotak pesan (error berwarna merah / info berwarna amber)
function showAlert(message, type = "error") {
  el.alertBox.textContent = message;
  el.alertBox.classList.remove("hidden", "alert-info");
  if (type === "info") el.alertBox.classList.add("alert-info");
}
function clearAlert() {
  el.alertBox.classList.add("hidden");
  el.alertBox.textContent = "";
}

// Menyalakan / mematikan mode "loading" pada tombol utama
function setLoading(isLoading, labelWhileLoading) {
  el.mainBtn.disabled = isLoading;
  el.btnSpinner.classList.toggle("hidden", !isLoading);
  if (isLoading && labelWhileLoading) el.btnLabel.textContent = labelWhileLoading;
}

// Memperbarui tampilan stepper (langkah 1-4) sesuai progres saat ini
function setStep(stepNumber) {
  const steps = el.stepper.querySelectorAll(".step");
  steps.forEach((stepEl) => {
    const n = Number(stepEl.dataset.step);
    stepEl.classList.remove("is-active", "is-done");
    if (n < stepNumber) stepEl.classList.add("is-done");
    if (n === stepNumber) stepEl.classList.add("is-active");
  });
}

// ------------------------------------------------------------------
// 4. CEK DUKUNGAN BROWSER (Kamera & Geolocation)
//    Dilakukan di awal agar user langsung tahu jika perangkatnya
//    tidak mendukung, daripada menunggu tombol diklik dulu.
// ------------------------------------------------------------------
function checkBrowserSupport() {
  const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasGeo = "geolocation" in navigator;

  if (!hasCamera && !hasGeo) {
    showAlert("Browser Anda tidak mendukung akses Kamera maupun Lokasi (GPS). Silakan gunakan browser modern seperti Chrome/Safari versi terbaru.");
    el.mainBtn.disabled = true;
    return false;
  }
  if (!hasCamera) {
    showAlert("Browser Anda tidak mendukung akses Kamera (getUserMedia). Presensi tidak dapat dilanjutkan.");
    el.mainBtn.disabled = true;
    return false;
  }
  if (!hasGeo) {
    showAlert("Browser Anda tidak mendukung Geolocation (GPS). Presensi tidak dapat dilanjutkan.");
    el.mainBtn.disabled = true;
    return false;
  }

  // Peringatan tambahan bila halaman TIDAK dibuka via HTTPS / localhost
  const isSecure = window.isSecureContext; // true untuk https:// dan http://localhost
  if (!isSecure) {
    showAlert("Halaman ini tidak berjalan pada koneksi aman (HTTPS/localhost). Kamera & GPS kemungkinan akan diblokir oleh browser.", "info");
  }
  return true;
}

// ------------------------------------------------------------------
// 5. MEMINTA IZIN & MENYALAKAN KAMERA (WebRTC — getUserMedia)
// ------------------------------------------------------------------
// getUserMedia() adalah bagian dari API WebRTC yang meminta akses ke
// perangkat media (kamera/mikrofon) milik pengguna. Fungsi ini
// mengembalikan sebuah Promise yang resolve dengan objek MediaStream
// jika izin diberikan.
async function startCamera() {
  // constraints = "syarat" kamera yang kita minta ke browser.
  // facingMode "user" = kamera depan (selfie), cocok untuk presensi wajah.
  const constraints = {
    video: {
      facingMode: "user",
      width: { ideal: 720 },
      height: { ideal: 540 },
    },
    audio: false, // kita tidak butuh suara, jadi audio dimatikan
  };

  // Baris ini akan memicu munculnya pop-up izin kamera dari browser.
  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  state.stream = stream;              // simpan stream supaya bisa dimatikan nanti
  el.video.srcObject = stream;        // hubungkan stream ke elemen <video> agar tampil live

  // Tampilkan elemen video, sembunyikan placeholder
  el.cameraPlaceholder.classList.add("hidden");
  el.video.classList.remove("hidden");
  el.liveBadge.classList.remove("hidden");

  return stream;
}

// Mematikan semua "track" (jalur video) dari kamera agar lampu
// indikator kamera di perangkat ikut mati (praktik yang baik/wajib).
function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
}

// ------------------------------------------------------------------
// 6. MEMINTA IZIN & MENGAMBIL LOKASI (Geolocation API)
// ------------------------------------------------------------------
// navigator.geolocation.getCurrentPosition() aslinya menggunakan
// callback (success, error), bukan Promise. Kita bungkus (wrap)
// menjadi Promise agar bisa dipakai dengan async/await bersamaan
// dengan proses kamera.
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),   // izin diberikan & lokasi didapat
      (error) => reject(error),          // izin ditolak / gagal / timeout
      {
        enableHighAccuracy: true, // minta GPS presisi tinggi (bukan hanya dari IP/WiFi)
        timeout: 15000,           // batas waktu tunggu 15 detik
        maximumAge: 0,            // jangan pakai cache lokasi lama, ambil yang baru
      }
    );
  });
}

// Menerjemahkan kode error Geolocation menjadi pesan yang mudah dipahami
function describeGeoError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Izin akses lokasi ditolak. Aktifkan izin Lokasi untuk situs ini di pengaturan browser.";
    case error.POSITION_UNAVAILABLE:
      return "Lokasi tidak dapat dideteksi. Pastikan GPS/Location Service perangkat Anda aktif.";
    case error.TIMEOUT:
      return "Waktu tunggu pencarian lokasi habis. Coba lagi di area dengan sinyal GPS lebih baik.";
    default:
      return "Terjadi kesalahan saat mengambil lokasi.";
  }
}

// ------------------------------------------------------------------
// 7. MENAMPILKAN PETA & MARKER (Leaflet.js)
// ------------------------------------------------------------------
function renderMap(lat, lng) {
  el.mapPlaceholder.classList.add("hidden");
  el.leafletMapDiv.classList.remove("hidden");

  if (!state.map) {
    // Inisialisasi peta hanya sekali, saat pertama kali lokasi didapat
    state.map = L.map(el.leafletMapDiv, {
      zoomControl: false,
      attributionControl: false,
    }).setView([lat, lng], 17);

    // Tile layer citra satelit gratis dari Esri World Imagery
    // (mengganti tile OpenStreetMap default agar peta tampil seperti foto satelit)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }).addTo(state.map);

    // Marker (pin) di titik koordinat pengguna
    state.marker = L.marker([lat, lng]).addTo(state.map);

    // Leaflet butuh "dipaksa" menghitung ulang ukurannya karena
    // container-nya baru saja berubah dari hidden -> tampil
    setTimeout(() => state.map.invalidateSize(), 200);
  } else {
    // Jika peta sudah ada (misal user mengulang presensi), cukup update posisinya
    state.map.setView([lat, lng], 17);
    state.marker.setLatLng([lat, lng]);
  }
}

// Menampilkan angka koordinat di kotak readout
function renderCoords(lat, lng, accuracy) {
  el.latVal.textContent = lat.toFixed(6);
  el.lngVal.textContent = lng.toFixed(6);
  el.accVal.textContent = `±${Math.round(accuracy)} m`;
}

// ------------------------------------------------------------------
// 7B. REVERSE GEOCODING — mengubah lat/lng menjadi alamat lengkap
//     menggunakan API GRATIS Nominatim (OpenStreetMap).
//     CATATAN: Nominatim membatasi penggunaan (± 1 request/detik) dan
//     tidak cocok untuk trafik tinggi/produksi skala besar. Untuk
//     kebutuhan produksi, pertimbangkan menyiapkan server proxy sendiri
//     atau memakai layanan berbayar (Google/Mapbox Geocoding).
// ------------------------------------------------------------------
async function reverseGeocode(lat, lng) {
  el.addressVal.textContent = "Mencari alamat...";

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        // Meminta hasil dalam Bahasa Indonesia jika tersedia
        "Accept-Language": "id",
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal menghubungi layanan alamat (status ${response.status}).`);
    }

    const data = await response.json();

    if (data && data.address) {
      // Susun alamat dari bagian-bagian yang tersedia, dari yang paling
      // spesifik (jalan) ke yang paling umum (kode pos), lalu gabungkan
      // dengan koma — mirip format alamat pada aplikasi GPS Map Camera.
      const a = data.address;
      const bagianAlamat = [
        a.road || a.pedestrian || a.footway || a.residential,
        a.village || a.suburb || a.hamlet || a.neighbourhood,
        a.city_district,
        a.county || a.city || a.town || a.municipality,
        a.state,
        a.postcode,
        a.country,
      ].filter(Boolean); // buang bagian yang kosong/undefined

      el.addressVal.textContent =
        bagianAlamat.length > 0 ? bagianAlamat.join(", ") : (data.display_name || "Alamat tidak ditemukan.");
    } else {
      el.addressVal.textContent = data.display_name || "Alamat tidak ditemukan.";
    }
  } catch (err) {
    el.addressVal.textContent = "Gagal memuat alamat. Periksa koneksi internet Anda.";
  }
}

// ------------------------------------------------------------------
// 7C. FORMAT WAKTU PRESENSI LENGKAP
//     Contoh hasil: "Minggu, 05/07/2026 20:29 PM GMT +07:00"
// ------------------------------------------------------------------
function formatPresensiTimestamp(date = new Date()) {
  const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const pad = (n) => String(n).padStart(2, "0");

  const hari = namaHari[date.getDay()];
  const tanggal = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

  const jam24 = date.getHours();
  const jamStr = pad(jam24);
  const menitStr = pad(date.getMinutes());
  const ampm = jam24 >= 12 ? "PM" : "AM";

  // Offset zona waktu perangkat, contoh WIB = +07:00
  const offsetMenit = -date.getTimezoneOffset(); // positif jika di sebelah timur UTC
  const tandaOffset = offsetMenit >= 0 ? "+" : "-";
  const offsetJamStr = pad(Math.floor(Math.abs(offsetMenit) / 60));
  const offsetMenitStr = pad(Math.abs(offsetMenit) % 60);

  return `${hari}, ${tanggal} ${jamStr}:${menitStr} ${ampm} GMT ${tandaOffset}${offsetJamStr}:${offsetMenitStr}`;
}

// ------------------------------------------------------------------
// 8. MENGAMBIL SNAPSHOT FOTO DARI VIDEO (Canvas API)
// ------------------------------------------------------------------
// Trik dasarnya: gambar frame video yang sedang berjalan ke sebuah
// <canvas> tersembunyi, lalu ubah isi canvas tersebut menjadi file
// gambar (Blob) berformat JPEG.
function captureSnapshot() {
  return new Promise((resolve, reject) => {
    const video = el.video;
    const canvas = el.canvas;

    // Samakan ukuran canvas dengan resolusi asli video agar foto tidak pecah
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    // Karena preview video di-mirror (scaleX(-1)) secara visual di CSS,
    // kita mirror balik saat menggambar ke canvas supaya hasil foto
    // tidak terbalik/kebalik teks saat dilihat orang lain.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // canvas.toBlob() mengubah gambar di canvas menjadi Blob biner
    // (bukan base64/text), format JPEG, kualitas 90%.
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Gagal membuat file foto dari kamera."));
      },
      "image/jpeg",
      0.9
    );
  });
}

// ------------------------------------------------------------------
// 9. MENGIRIM DATA KE BACKEND (fetch + FormData)
// ------------------------------------------------------------------
// FormData dipakai (bukan JSON.stringify biasa) karena kita mengirim
// FILE gambar (Blob) sekaligus data teks dalam satu request, mirip
// seperti mengisi <form> HTML dengan input file + input text.
async function sendPresensiToServer({ latitude, longitude, alamatLengkap, photoBlob }) {
  const formData = new FormData();

  // .append(key, value) menambahkan satu field ke dalam form.
  // Angka koordinat otomatis dikonversi jadi string teks oleh FormData.
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);

  // Alamat lengkap hasil reverse geocoding (Nominatim) ikut dikirim
  // supaya backend bisa menyimpannya langsung ke kolom alamat_lengkap.
  formData.append("alamat_lengkap", alamatLengkap || "");

  // Untuk file/Blob, parameter ketiga adalah nama file yang akan
  // diterima backend lewat field "foto" (sesuai konfigurasi multer di BE).
  formData.append("foto", photoBlob, `presensi-${Date.now()}.jpg`);

  // ----------------------------------------------------------------
  // TAHAP 1 — Kirim request. Kalau fetch() sendiri melempar error
  // (server mati/tidak menyala, tidak ada koneksi internet, domain
  // salah, diblokir CORS, dsb), tangkap di sini dan ubah jadi pesan
  // yang mudah dipahami pengguna, BUKAN "Failed to fetch" mentah.
  // ----------------------------------------------------------------
  let response;
  try {
    // PENTING: saat mengirim FormData dengan fetch, JANGAN set header
    // 'Content-Type' secara manual. Browser akan otomatis menentukan
    // header Content-Type: multipart/form-data beserta "boundary"-nya.
    response = await fetch(API_ENDPOINT, {
      method: "POST",
      body: formData,
    });
  } catch (networkErr) {
    throw new Error(
      "Tidak dapat terhubung ke server. Pastikan server backend sudah menyala (npm start) dan periksa koneksi internet/URL API Anda."
    );
  }

  // ----------------------------------------------------------------
  // TAHAP 2 — Server merespons (statusnya bisa apa saja: 201/400/500/dll).
  // Coba baca body sebagai JSON; jika gagal (server error tanpa body
  // JSON valid), jangan sampai ikut menyebabkan crash di sini.
  // ----------------------------------------------------------------
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  const pesanDariServer = payload && (payload.message || payload.error);

  // ----------------------------------------------------------------
  // TAHAP 3 — Cek status HTTP dan tentukan sukses/gagal.
  // ----------------------------------------------------------------
  if (response.status === 201) {
    // Sukses: backend berhasil menyimpan presensi
    return payload;
  }

  if (response.status === 400) {
    // Permintaan ditolak backend (misal: di luar radius kantor,
    // data tidak lengkap, atau format tidak valid)
    throw new Error(pesanDariServer || "Presensi ditolak oleh server (400). Periksa kembali data/lokasi Anda.");
  }

  if (response.status >= 500) {
    // Server mengalami error internal (misal: MySQL/Laragon mati,
    // query gagal, dsb)
    throw new Error(pesanDariServer || "Terjadi kesalahan pada server (500). Silakan coba lagi beberapa saat lagi.");
  }

  // Status lain yang tidak terduga (401, 403, 404, dsb)
  throw new Error(pesanDariServer || `Server mengembalikan status tidak terduga (${response.status}).`);
}

// ------------------------------------------------------------------
// 10. ORKESTRASI UTAMA: KLIK TOMBOL "LAKUKAN PRESENSI"
// ------------------------------------------------------------------
async function handlePrimaryClick() {
  clearAlert();

  // TAHAP A — Kamera & lokasi belum siap: minta izin keduanya sekaligus
  if (state.stage === "idle") {
    state.stage = "permitting";
    setLoading(true, "Meminta izin kamera & lokasi...");
    setStep(1);

    try {
      // Promise.all menjalankan permintaan kamera & lokasi SECARA BERSAMAAN,
      // sesuai spesifikasi ("meminta izin kamera dan lokasi secara bersamaan").
      const [, position] = await Promise.all([
        startCamera(),
        getCurrentLocation(),
      ]);

      // Simpan hasil koordinat ke state
      state.latitude = position.coords.latitude;
      state.longitude = position.coords.longitude;
      state.accuracy = position.coords.accuracy;

      renderCoords(state.latitude, state.longitude, state.accuracy);
      renderMap(state.latitude, state.longitude);

      // Tampilkan waktu presensi lengkap segera (tidak perlu menunggu network)
      el.timestampVal.textContent = formatPresensiTimestamp();

      // Reverse geocoding berjalan di background (async, tidak diawait/
      // tidak memblokir alur utama) supaya UI tetap responsif meski
      // request ke Nominatim lambat/gagal.
      reverseGeocode(state.latitude, state.longitude);

      setStep(3); // kamera + lokasi sama-sama sudah didapat
      state.stage = "ready";
      el.btnLabel.textContent = "Ambil Foto & Absen";
      setLoading(false);
    } catch (err) {
      // Jika salah satu (kamera ATAU lokasi) gagal/ditolak, hentikan proses
      stopCamera();
      state.stage = "idle";
      setLoading(false);
      el.btnLabel.textContent = "Lakukan Presensi";
      setStep(1);

      if (err && err.code && typeof err.code === "number" && "PERMISSION_DENIED" in err) {
        // Ini adalah error dari Geolocation API
        showAlert(describeGeoError(err));
      } else if (err && err.name === "NotAllowedError") {
        showAlert("Izin akses kamera ditolak. Aktifkan izin Kamera untuk situs ini di pengaturan browser.");
      } else if (err && err.name === "NotFoundError") {
        showAlert("Kamera tidak ditemukan pada perangkat ini.");
      } else {
        showAlert(err.message || "Gagal mengaktifkan kamera/lokasi. Silakan coba lagi.");
      }
    }
    return;
  }

  // TAHAP B — Kamera & lokasi sudah siap: ambil foto lalu kirim ke server
  if (state.stage === "ready") {
    state.stage = "sending";
    setLoading(true, "Mengambil foto...");

    try {
      state.photoBlob = await captureSnapshot();

      setLoading(true, "Mengirim data presensi...");
      const result = await sendPresensiToServer({
        latitude: state.latitude,
        longitude: state.longitude,
        alamatLengkap: el.addressVal.textContent,
        photoBlob: state.photoBlob,
      });

      // Sukses (status 201 dari backend): tampilkan stempel & hentikan kamera
      setStep(4);
      stopCamera();
      el.video.classList.add("hidden");
      el.liveBadge.classList.add("hidden");

      el.stampTime.textContent = formatPresensiTimestamp();
      el.stamp.classList.remove("hidden");
      el.mainBtn.classList.add("hidden");
      el.resetBtn.classList.remove("hidden");

      // Tampilkan alert penanda sukses (pesan bisa dari server jika ada)
      showAlert(result?.message || "Presensi berhasil dicatat!", "info");

      state.stage = "done";
    } catch (err) {
      // Gagal (fetch gagal karena server mati, atau backend membalas
      // status 400/500/lainnya) — err.message sudah berisi pesan yang
      // jelas dari sendPresensiToServer(), tinggal ditampilkan.
      state.stage = "ready";
      setLoading(false);
      el.btnLabel.textContent = "Ambil Foto & Absen";
      showAlert(err.message || "Gagal mengirim data presensi ke server.");
    }
  }
}

// ------------------------------------------------------------------
// 11. RESET — memulai ulang seluruh proses presensi
// ------------------------------------------------------------------
function resetFlow() {
  stopCamera();
  state.latitude = null;
  state.longitude = null;
  state.photoBlob = null;
  state.stage = "idle";

  clearAlert();
  el.stamp.classList.add("hidden");
  el.resetBtn.classList.add("hidden");
  el.mainBtn.classList.remove("hidden");
  el.btnLabel.textContent = "Lakukan Presensi";
  el.cameraPlaceholder.classList.remove("hidden");
  el.video.classList.add("hidden");

  el.latVal.textContent = "—";
  el.lngVal.textContent = "—";
  el.accVal.textContent = "—";
  el.addressVal.textContent = "—";
  el.timestampVal.textContent = "—";

  setStep(1);
}

// ------------------------------------------------------------------
// 12. PASANG EVENT LISTENER & JALANKAN PENGECEKAN AWAL
// ------------------------------------------------------------------
el.mainBtn.addEventListener("click", handlePrimaryClick);
el.resetBtn.addEventListener("click", resetFlow);

checkBrowserSupport();