const Decimal = require('decimal.js');
const pool = require('../config/db');

// Omzet bersih per cabang = SUM(sales.grand_total WHERE status='completed')
// - SUM(sales_returns.grand_total), dalam rentang tanggal yang sama.
// Transaksi voided TIDAK pernah ikut dihitung sama sekali (bukan "ditambah
// lalu dikurangi" — cukup tidak masuk SUM completed sejak awal, status
// lain selain 'completed' otomatis nol kontribusinya lewat CASE di bawah).
//
// branches jadi tabel DASAR (LEFT JOIN, bukan di-drive dari sales) supaya
// cabang aktif yang KEBETULAN nol transaksi di rentang ini tetap muncul
// eksplisit dengan angka 0 — bukan hilang diam-diam dari laporan (beda
// makna bagi owner: "nol transaksi" vs "cabang ini tidak dilaporkan").
//
// SEMUA hasil SUM/COUNT dari mysql2 WAJIB dibungkus Decimal SEBELUM operasi
// matematis apa pun — driver ini sudah 2x jadi sumber bug nyata di proyek
// (ShiftService.calculateExpectedCash, overflow krn string concatenation
// alih-alih penjumlahan). Jangan percaya asumsi "ini pasti Number".
async function getConsolidatedReport({ startDate, endDate }) {
  const [rows] = await pool.query(
    `SELECT
       b.branch_code,
       COALESCE(s.transaction_count, 0) AS transaction_count,
       COALESCE(s.voided_count, 0) AS voided_count,
       COALESCE(s.gross_sales, 0) AS gross_sales,
       COALESCE(r.return_count, 0) AS return_count,
       COALESCE(r.total_returns, 0) AS total_returns
     FROM branches b
     LEFT JOIN (
       SELECT
         branch_code,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS transaction_count,
         SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END) AS voided_count,
         SUM(CASE WHEN status = 'completed' THEN grand_total ELSE 0 END) AS gross_sales
       FROM sales
       WHERE branch_created_at >= ? AND branch_created_at < ?
       GROUP BY branch_code
     ) s ON s.branch_code = b.branch_code
     LEFT JOIN (
       SELECT branch_code, COUNT(*) AS return_count, SUM(grand_total) AS total_returns
       FROM sales_returns
       WHERE branch_created_at >= ? AND branch_created_at < ?
       GROUP BY branch_code
     ) r ON r.branch_code = b.branch_code
     WHERE b.is_active = 1
     ORDER BY b.branch_code`,
    [startDate, endDate, startDate, endDate]
  );

  let grandNetOmzet = new Decimal(0);
  let grandTransactionCount = 0;

  const branches = rows.map((row) => {
    const grossSales = new Decimal(row.gross_sales || 0);
    const totalReturns = new Decimal(row.total_returns || 0);
    const netOmzet = grossSales.minus(totalReturns);
    const transactionCount = Number(row.transaction_count) || 0;

    grandNetOmzet = grandNetOmzet.plus(netOmzet);
    grandTransactionCount += transactionCount;

    return {
      branchCode: row.branch_code,
      transactionCount,
      voidedCount: Number(row.voided_count) || 0,
      returnCount: Number(row.return_count) || 0,
      grossSales: grossSales.toFixed(0),
      totalReturns: totalReturns.toFixed(0),
      netOmzet: netOmzet.toFixed(0),
    };
  });

  return {
    branches,
    total: {
      netOmzet: grandNetOmzet.toFixed(0),
      transactionCount: grandTransactionCount,
    },
  };
}

module.exports = { getConsolidatedReport };
