// Script admin MANUAL — mendaftarkan/memperbarui akun login dashboard
// pusat (owner/admin pusat). BUKAN endpoint HTTP — tidak boleh ada akun
// admin pusat yang bisa dibuat dari luar, sama alasan dgn register-branch.js.
// Idempotent terhadap username: menjalankan ulang utk username yang sama =
// mereset password-nya (mis. lupa password, atau rotasi berkala).
//
// Password SENGAJA TIDAK diminta sbg argumen command-line (tertinggal di
// shell history) — di-generate acak di sini, dicetak SEKALI, lalu cuma
// hash bcrypt-nya yang tersimpan.
//
// Usage: node src/db/register-user.js <username> [full_name]
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

async function run() {
  const [usernameRaw, fullNameRaw] = process.argv.slice(2);
  if (!usernameRaw) {
    console.error('Usage: node src/db/register-user.js <username> [full_name]');
    process.exit(1);
  }
  const username = usernameRaw.trim().toLowerCase();
  const fullName = (fullNameRaw || username).trim();

  const password = crypto.randomBytes(12).toString('base64url'); // ~16 karakter, acak
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (id, username, password_hash, full_name, is_active, failed_login_attempts, locked_until)
     VALUES (?, ?, ?, ?, 1, 0, NULL)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       full_name = VALUES(full_name),
       is_active = 1,
       failed_login_attempts = 0,
       locked_until = NULL`,
    [uuidv4(), username, passwordHash, fullName]
  );

  console.log(`User '${username}' (${fullName}) terdaftar/direset.`);
  console.log('');
  console.log('PASSWORD (salin SEKARANG — tidak akan ditampilkan lagi, cuma hash-nya yang disimpan):');
  console.log(password);

  await pool.end();
}

run().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
