/* ==================================================================
   routes/presensiRoutes.js
   ------------------------------------------------------------------
   Mendefinisikan endpoint-endpoint yang berhubungan dengan presensi.
   upload.single("foto") artinya multer akan mencari SATU file dari
   field FormData bernama "foto" (harus sama persis dengan field yang
   dikirim Frontend).
   ================================================================== */

const express = require("express");
const router = express.Router();

const upload = require("../config/upload");
const { createPresensi } = require("../controllers/presensiController");

// POST /api/presensi
router.post("/", upload.single("foto"), createPresensi);

module.exports = router;
