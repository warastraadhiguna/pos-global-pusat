const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthService = require('../services/AuthService');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// Rate limit per-IP di level jaringan, terpisah dari lockout per-akun di
// AuthService (yang menghitung percobaan gagal per user) — pola identik
// dgn server/src/routes/auth.routes.js. Menahan brute force yang mencoba
// banyak username berbeda dari satu sumber (lockout per-akun saja tidak
// menahan itu).
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Terlalu banyak percobaan login, coba lagi sebentar lagi.' },
});

// POST /api/auth/login — { username, password }
router.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new HttpError(400, 'bad_request', 'username dan password wajib diisi');
    }
    const result = await AuthService.login(username, password);
    res.json(result);
  })
);

// GET /api/auth/me — cek token & ambil identitas user saat ini. Bentuk
// respons disamakan dgn user di respons POST /login (full_name snake_case,
// bukan fullName mentah dari payload token) — dashboard pakai /me ini
// buat isi ulang info user setelah refresh halaman.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, full_name: req.user.fullName } });
});

// PUT /api/auth/change-password — user ganti password MILIKNYA SENDIRI
// (dropdown profil dashboard). userId selalu dari token, bukan body.
router.put(
  '/change-password',
  requireAuth,
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new HttpError(400, 'bad_request', 'currentPassword dan newPassword wajib diisi');
    }
    await AuthService.changeOwnPassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true });
  })
);

module.exports = router;
