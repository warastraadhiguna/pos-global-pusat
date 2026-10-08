// STUB — belum diimplementasi, menunggu konfirmasi struktur Bagian A.
//
// Script admin MANUAL — mendaftarkan/memperbarui identitas 1 cabang
// (branch_code + token rahasia) di tabel `branches`. BUKAN endpoint HTTP —
// pendaftaran cabang baru/rotasi token SENGAJA tidak lewat API tanpa
// pengawasan, cuma lewat akses langsung ke mesin pusat.
//
// RENCANA:
//   Usage: node src/db/register-branch.js <branch_code> <branch_name?>
//   1. Generate token rahasia ACAK (mis. crypto.randomBytes(32).toString('hex'))
//      — BUKAN diminta sbg argumen, supaya tidak ada token lemah/tebakan
//      manusia yang kepilih, dan tidak ketinggalan jejak di shell history.
//   2. Hash token (SHA-256) -> token_hash.
//   3. INSERT INTO branches (id, branch_code, branch_name, token_hash)
//      VALUES (...) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),
//      branch_name=VALUES(branch_name), is_active=1
//      (idempotent — menjalankan ulang utk branch_code yang sama = rotate token-nya)
//   4. CETAK token ASLI (plaintext) ke console SEKALI INI SAJA — tidak
//      pernah disimpan plaintext di mana pun setelahnya. Admin menyalin
//      token ini ke .env cabang terkait (SYNC_BRANCH_TOKEN).

require('dotenv').config();

async function run() {
  throw new Error('register-branch belum diimplementasi — menunggu konfirmasi struktur Bagian A');
}

run().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
