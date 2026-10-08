// Script admin MANUAL — mendaftarkan/memperbarui identitas 1 cabang
// (branch_code + token rahasia) di tabel branches. BUKAN endpoint HTTP.
// Idempotent terhadap branch_code: menjalankan ulang utk branch_code yang
// sama = merotasi token-nya (token lama langsung tidak berlaku lagi,
// karena token_hash baru menimpa yang lama).
//
// Usage: node src/db/register-branch.js <branch_code> [branch_name]
require('dotenv').config();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { hashToken } = require('../utils/tokenHash');

async function run() {
  const [branchCodeRaw, branchName] = process.argv.slice(2);
  if (!branchCodeRaw) {
    console.error('Usage: node src/db/register-branch.js <branch_code> [branch_name]');
    process.exit(1);
  }
  const branchCode = branchCodeRaw.trim().toUpperCase();

  // Token di-generate di sini (bukan diminta sbg argumen) — supaya tidak
  // ada token lemah/tebakan manusia yang kepilih, dan tidak tertinggal di
  // shell history.
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  await pool.query(
    `INSERT INTO branches (id, branch_code, branch_name, token_hash, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       token_hash = VALUES(token_hash),
       branch_name = VALUES(branch_name),
       is_active = 1`,
    [uuidv4(), branchCode, branchName || null, tokenHash]
  );

  console.log(`Cabang '${branchCode}' terdaftar/diperbarui.`);
  console.log('');
  console.log('TOKEN (salin SEKARANG — tidak akan ditampilkan lagi, cuma hash-nya yang disimpan):');
  console.log(token);
  console.log('');
  console.log(`Taruh di .env server cabang '${branchCode}' sbg SYNC_BRANCH_TOKEN.`);

  await pool.end();
}

run().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
