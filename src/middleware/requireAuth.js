const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const HttpError = require('../utils/HttpError');

// Pola identik dgn server/src/middleware/auth.js requireAuth — verifikasi
// tanda tangan JWT SAJA tidak cukup: token yang sah tapi user-nya sudah
// dinonaktifkan (is_active=0) setelah token terbit tetap lolos verifikasi
// tanda tangan. Query ulang ke DB di SETIAP request menutup celah itu —
// pencabutan akses berlaku seketika, tidak perlu menunggu token lama
// kedaluwarsa.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'unauthorized', 'Token tidak ditemukan'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new HttpError(401, 'unauthorized', 'Token tidak valid atau kedaluwarsa'));
  }

  try {
    const [[user]] = await pool.query(`SELECT id FROM users WHERE id = ? AND is_active = 1`, [payload.id]);
    if (!user) {
      return next(new HttpError(401, 'session_invalid', 'Sesi tidak valid — akun tidak ditemukan atau sudah dinonaktifkan, silakan login ulang'));
    }
  } catch (err) {
    return next(err);
  }

  req.user = payload; // { id, username, fullName }
  next();
}

module.exports = { requireAuth };
