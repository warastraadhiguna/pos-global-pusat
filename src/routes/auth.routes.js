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

// GET /api/auth/me — cek token & ambil identitas user saat ini
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
