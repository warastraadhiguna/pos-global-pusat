const crypto = require('crypto');

// SHA-256 — lihat catatan di schema.sql soal kenapa bukan bcrypt (token
// acak panjang, bukan password manusia). Dipakai branchAuth.js (verifikasi
// saat request masuk) & register-branch.js (saat token baru dibuat) — satu
// fungsi, supaya keduanya tidak pernah diam-diam beda cara hash.
function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

module.exports = { hashToken };
