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
// Pembelian Bersih per cabang = SUM(purchases.grand_total WHERE
// status='completed') - SUM(purchase_returns.grand_total) — pola IDENTIK
// Omzet bersih di atas. grand_total pembelian = DPP + PPN Masukan (jumlah
// kas/utang sungguhan keluar), BUKAN dpp/subtotal — lihat audit Lapis 2.
// Ditampilkan BERDAMPINGAN Omzet, bukan dicampur/dikurangkan satu sama lain
// (dua metrik independen: uang masuk dari jualan vs uang keluar buat beli).
async function getConsolidatedReport({ startDate, endDate }) {
  const [rows] = await pool.query(
    `SELECT
       b.branch_code,
       b.branch_name,
       COALESCE(s.transaction_count, 0) AS transaction_count,
       COALESCE(s.voided_count, 0) AS voided_count,
       COALESCE(s.gross_sales, 0) AS gross_sales,
       COALESCE(r.return_count, 0) AS return_count,
       COALESCE(r.total_returns, 0) AS total_returns,
       COALESCE(p.purchase_count, 0) AS purchase_count,
       COALESCE(p.voided_purchase_count, 0) AS voided_purchase_count,
       COALESCE(p.gross_purchases, 0) AS gross_purchases,
       COALESCE(pr.purchase_return_count, 0) AS purchase_return_count,
       COALESCE(pr.total_purchase_returns, 0) AS total_purchase_returns
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
     LEFT JOIN (
       SELECT
         branch_code,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS purchase_count,
         SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END) AS voided_purchase_count,
         SUM(CASE WHEN status = 'completed' THEN grand_total ELSE 0 END) AS gross_purchases
       FROM purchases
       WHERE branch_created_at >= ? AND branch_created_at < ?
       GROUP BY branch_code
     ) p ON p.branch_code = b.branch_code
     LEFT JOIN (
       SELECT branch_code, COUNT(*) AS purchase_return_count, SUM(grand_total) AS total_purchase_returns
       FROM purchase_returns
       WHERE branch_created_at >= ? AND branch_created_at < ?
       GROUP BY branch_code
     ) pr ON pr.branch_code = b.branch_code
     WHERE b.is_active = 1
     ORDER BY b.branch_code`,
    [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]
  );

  let grandNetOmzet = new Decimal(0);
  let grandTransactionCount = 0;
  let grandNetPurchases = new Decimal(0);

  const branches = rows.map((row) => {
    const grossSales = new Decimal(row.gross_sales || 0);
    const totalReturns = new Decimal(row.total_returns || 0);
    const netOmzet = grossSales.minus(totalReturns);
    const transactionCount = Number(row.transaction_count) || 0;

    const grossPurchases = new Decimal(row.gross_purchases || 0);
    const totalPurchaseReturns = new Decimal(row.total_purchase_returns || 0);
    const netPurchases = grossPurchases.minus(totalPurchaseReturns);

    grandNetOmzet = grandNetOmzet.plus(netOmzet);
    grandTransactionCount += transactionCount;
    grandNetPurchases = grandNetPurchases.plus(netPurchases);

    return {
      branchCode: row.branch_code,
      branchName: row.branch_name || null,
      transactionCount,
      voidedCount: Number(row.voided_count) || 0,
      returnCount: Number(row.return_count) || 0,
      grossSales: grossSales.toFixed(0),
      totalReturns: totalReturns.toFixed(0),
      netOmzet: netOmzet.toFixed(0),
      purchaseCount: Number(row.purchase_count) || 0,
      voidedPurchaseCount: Number(row.voided_purchase_count) || 0,
      purchaseReturnCount: Number(row.purchase_return_count) || 0,
      grossPurchases: grossPurchases.toFixed(0),
      totalPurchaseReturns: totalPurchaseReturns.toFixed(0),
      netPurchases: netPurchases.toFixed(0),
    };
  });

  return {
    branches,
    total: {
      netOmzet: grandNetOmzet.toFixed(0),
      transactionCount: grandTransactionCount,
      netPurchases: grandNetPurchases.toFixed(0),
    },
  };
}

module.exports = { getConsolidatedReport };
