// STUB — belum diimplementasi, menunggu konfirmasi struktur Bagian A.
//
// UPSERT batch `sales` + `sales_returns` dalam SATU transaksi DB.
// Idempotent by design: UUID dari cabang dipakai APA ADANYA sbg PK di
// pusat, `INSERT ... ON DUPLICATE KEY UPDATE` -> kiriman ulang (retry
// krn koneksi putus, dll) MENIMPA baris yang sama, tidak pernah
// menggandakan — lihat SYNC_DESIGN_TAHAP1.md Bagian 2 di repo `server`.
//
// RENCANA:
//   async function receiveBatch({ branchCode, sales = [], salesReturns = [] }) {
//     const conn = await pool.getConnection();
//     try {
//       await conn.beginTransaction();
//       for (const row of sales) {
//         INSERT INTO sales (id, branch_code, sale_number, cashier_name, ...)
//         VALUES (?, ?, ...)            -- branch_code SELALU dari parameter
//         ON DUPLICATE KEY UPDATE       -- param fungsi, BUKAN dari `row`
//           sale_number=VALUES(sale_number), status=VALUES(status), ...
//       }
//       for (const row of salesReturns) {
//         -- pola sama, ke tabel sales_returns
//       }
//       UPDATE branches SET last_sync_at = NOW() WHERE branch_code = ?;
//       await conn.commit();
//       return { sales: sales.length, salesReturns: salesReturns.length };
//     } catch (err) {
//       await conn.rollback();
//       throw err;
//     } finally {
//       conn.release();
//     }
//   }
//
// Catatan desain yang perlu diperhatikan saat diisi:
//   - branch_code di setiap row INSERT WAJIB nilai dari parameter
//     `branchCode` (hasil resolve token di branchAuth.js), BUKAN dibaca
//     dari field apa pun di dalam `row` itu sendiri walau payload
//     mengirimkannya — mencegah cabang (atau token bocor) menyamar
//     sebagai cabang lain.
//   - Satu transaksi utk SELURUH batch (semua tabel) — sukses/gagal
//     bersama, tidak ada "sukses sebagian" (keputusan dari
//     SYNC_DESIGN_TAHAP1.md, dihindari krn belum perlu di skala ini).

async function receiveBatch({ branchCode, sales, salesReturns }) {
  throw new Error('receiveBatch belum diimplementasi — menunggu konfirmasi struktur Bagian A');
}

module.exports = { receiveBatch };
