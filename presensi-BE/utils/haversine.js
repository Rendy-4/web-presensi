/* ==================================================================
   utils/haversine.js
   ------------------------------------------------------------------
   Rumus Haversine: menghitung jarak garis lurus (great-circle
   distance) antara dua titik koordinat (lat/lng) di permukaan bumi,
   dengan asumsi bumi berbentuk bola sempurna. Hasilnya dalam meter.
   ================================================================== */

const EARTH_RADIUS_METERS = 6371000; // rata-rata jari-jari bumi (meter)

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Menghitung jarak antara dua koordinat menggunakan rumus Haversine.
 * @param {number} lat1 - latitude titik 1 (derajat)
 * @param {number} lon1 - longitude titik 1 (derajat)
 * @param {number} lat2 - latitude titik 2 (derajat)
 * @param {number} lon2 - longitude titik 2 (derajat)
 * @returns {number} jarak dalam meter
 */
function hitungJarakMeter(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

module.exports = { hitungJarakMeter };
