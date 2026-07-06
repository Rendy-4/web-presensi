-- ============================================================
-- SKEMA DATABASE: db_presensi
-- Jalankan file ini di phpMyAdmin (Laragon) atau lewat CLI:
--   mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_presensi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_presensi;

-- ------------------------------------------------------------
-- TABEL: users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,   -- simpan HASH (bcrypt), jangan plaintext
  nama_lengkap  VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL: lokasi_kantor
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lokasi_kantor (
  id              INT PRIMARY KEY,
  nama_lokasi     VARCHAR(100) NOT NULL,
  latitude_pusat  DOUBLE NOT NULL,
  longitude_pusat DOUBLE NOT NULL,
  radius_meter    INT NOT NULL DEFAULT 100
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL: presensi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presensi (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  waktu_absen     DATETIME NOT NULL,
  latitude_user   DOUBLE NOT NULL,
  longitude_user  DOUBLE NOT NULL,
  foto_bukti      VARCHAR(255) NOT NULL,
  alamat_lengkap  TEXT,
  status          ENUM('Hadir', 'Terlambat', 'Di Luar Radius') NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_presensi_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- DATA AWAL (SEED) — untuk keperluan testing
-- ------------------------------------------------------------

-- User dummy (id = 1). Password di bawah adalah HASH bcrypt dari "password123"
-- (dibuat dengan bcrypt.hashSync("password123", 10)) — ganti sesuai kebutuhan.
INSERT INTO users (id, username, password, nama_lengkap)
VALUES (1, 'admin', '$2b$10$CwTycUXWue0Thq9StjUM0uJ8i8bIe.LzGQ3lYceb.5CG5N7XtsBWa', 'Admin Testing')
ON DUPLICATE KEY UPDATE username = username;

-- Lokasi kantor dummy (id = 1) — SILAKAN GANTI koordinat sesuai lokasi kantor asli.
INSERT INTO lokasi_kantor (id, nama_lokasi, latitude_pusat, longitude_pusat, radius_meter)
VALUES (1, 'Kantor Pusat', -6.200000, 106.816666, 100)
ON DUPLICATE KEY UPDATE nama_lokasi = nama_lokasi;
