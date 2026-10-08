const pool = require('../config/db');
const HttpError = require('../utils/HttpError');
const { hashToken } = require('../utils/tokenHash');

// Validasi Bearer token terhadap tabel branches. branch_code diresolve DARI
// TOKEN di sini — req.branch.branchCode inilah satu-satunya sumber
// kebenaran identitas cabang di seluruh request berikutnya (route/service
// TIDAK PERNAH membaca branch_code dari body payload).
async function requireBranchToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new HttpError(401, 'unauthorized', 'Token cabang tidak ditemukan'));
    }

    const [[branch]] = await pool.query(
      `SELECT id, branch_code FROM branches WHERE token_hash = ? AND is_active = 1`,
      [hashToken(token)]
    );
    if (!branch) {
      return next(new HttpError(401, 'unauthorized', 'Token cabang tidak dikenal atau sudah dinonaktifkan'));
    }

    req.branch = { id: branch.id, branchCode: branch.branch_code };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireBranchToken };
