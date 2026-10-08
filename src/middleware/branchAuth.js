// STUB — belum diimplementasi, menunggu konfirmasi struktur Bagian A.
//
// Middleware: validasi Bearer token dari header Authorization terhadap
// tabel `branches` (cocokkan ke token_hash, SHA-256 — lihat catatan di
// schema.sql soal kenapa SHA-256, bukan bcrypt). Kalau cocok & is_active=1,
// resolve branch_code dari TOKEN itu sendiri (BUKAN dari body payload —
// ini keputusan keamanan yang dikunci: pusat tidak pernah mempercayai
// klaim branch dari body) dan taruh di req.branch. Kalau token tidak
// dikenal/tidak aktif -> 401.
//
// RENCANA:
//   1. Ambil header Authorization, pastikan format "Bearer <token>" — kalau
//      tidak ada/salah format -> 401 'unauthorized'.
//   2. Hash token mentah pakai crypto.createHash('sha256') (bawaan Node,
//      tanpa dependency baru).
//   3. SELECT id, branch_code FROM branches WHERE token_hash = ? AND is_active = 1.
//   4. Tidak ketemu -> next(new HttpError(401, 'unauthorized', 'Token cabang tidak dikenal')).
//   5. Ketemu -> req.branch = { id: row.id, branchCode: row.branch_code }, next().
//
// async function requireBranchToken(req, res, next) { ... }

async function requireBranchToken(req, res, next) {
  throw new Error('requireBranchToken belum diimplementasi — menunggu konfirmasi struktur Bagian A');
}

module.exports = { requireBranchToken };
