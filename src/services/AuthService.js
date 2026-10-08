const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const HttpError = require('../utils/HttpError');

// Lockout percobaan gagal — pola & nama env identik dgn server/src/services/
// AuthService.js, disesuaikan lewat .env tanpa ubah kode.
const MAX_FAILED_ATTEMPTS = Number(process.env.AUTH_MAX_FAILED_ATTEMPTS) || 5;
const LOCKOUT_MINUTES = Number(process.env.AUTH_LOCKOUT_MINUTES) || 15;

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, fullName: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

function assertNotLocked(user) {
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new HttpError(
      423,
      'account_locked',
      `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.`
    );
  }
}

async function registerFailedAttempt(user) {
  const attempts = user.failed_login_attempts + 1;
  const willLock = attempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = willLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null;

  await pool.query(
    `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`,
    [willLock ? 0 : attempts, lockedUntil, user.id]
  );
}

async function resetFailedAttempts(userId) {
  await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`, [userId]);
}

// Pesan error SENGAJA SAMA utk "username tidak ada" dan "password salah" —
// tidak membocorkan username mana yang valid ke penyerang.
async function login(username, password) {
  const [[user]] = await pool.query(
    `SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1`,
    [username]
  );
  if (!user) {
    throw new HttpError(401, 'invalid_credentials', 'Username atau password salah');
  }

  assertNotLocked(user);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await registerFailedAttempt(user);
    throw new HttpError(401, 'invalid_credentials', 'Username atau password salah');
  }

  await resetFailedAttempts(user.id);

  const authUser = { id: user.id, username: user.username, full_name: user.full_name };
  return { token: signToken(authUser), user: authUser };
}

module.exports = { login, signToken };
