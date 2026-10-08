const pool = require('../config/db');

// Payload datang lewat JSON — Date di sisi pengirim jadi STRING ISO 8601
// ("2026-10-08T06:00:39.000Z") saat JSON.stringify, bukan objek Date lagi.
// MySQL (strict mode) MENOLAK string berformat itu utk kolom DATETIME/DATE
// ("Incorrect datetime value") — ditemukan saat uji transport sungguhan ke
// VPS (Tahap 3), tidak pernah ketahuan di uji localhost krn kebetulan tidak
// pernah ada baris voided yg dikirim di uji sebelumnya. Parse balik ke objek
// Date di sini SEBELUM masuk query — mysql2 tahu cara serialize objek Date
// dgn benar ke format yang MySQL terima, beda dari string ISO mentah.
function toMysqlDateTime(value) {
  if (!value) return null;
  return new Date(value);
}

// UPSERT satu batch (sales + sales_returns) dalam SATU transaksi. branchCode
// datang dari req.branch (hasil resolve token di branchAuth.js) — dipakai
// APA ADANYA di setiap baris, TIDAK PERNAH dibaca dari field apa pun di
// dalam `row` itu sendiri walau payload membawanya.
//
// Idempotent: `id` tiap baris adalah UUID ASLI dari cabang (PK di sini
// juga) — ON DUPLICATE KEY UPDATE berarti kiriman ulang (retry) MENIMPA
// baris yang sama persis, tidak pernah menggandakan.
async function receiveBatch({ branchCode, sales = [], salesReturns = [] }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const row of sales) {
      await conn.query(
        `INSERT INTO sales (
          id, branch_code, sale_number, cashier_name, customer_name,
          subtotal, discount_total, dpp, ppn_rate, ppn_mode, ppn_amount,
          grand_total, total_cost, gross_profit, status, void_reason,
          voided_at, branch_created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          sale_number = VALUES(sale_number),
          cashier_name = VALUES(cashier_name),
          customer_name = VALUES(customer_name),
          subtotal = VALUES(subtotal),
          discount_total = VALUES(discount_total),
          dpp = VALUES(dpp),
          ppn_rate = VALUES(ppn_rate),
          ppn_mode = VALUES(ppn_mode),
          ppn_amount = VALUES(ppn_amount),
          grand_total = VALUES(grand_total),
          total_cost = VALUES(total_cost),
          gross_profit = VALUES(gross_profit),
          status = VALUES(status),
          void_reason = VALUES(void_reason),
          voided_at = VALUES(voided_at)`,
        [
          row.id, branchCode, row.saleNumber, row.cashierName || null, row.customerName || null,
          row.subtotal, row.discountTotal || 0, row.dpp || 0, row.ppnRate ?? null, row.ppnMode || null,
          row.ppnAmount || 0, row.grandTotal, row.totalCost || 0, row.grossProfit || 0, row.status,
          row.voidReason || null, toMysqlDateTime(row.voidedAt), toMysqlDateTime(row.createdAt),
        ]
      );
    }

    for (const row of salesReturns) {
      await conn.query(
        `INSERT INTO sales_returns (
          id, branch_code, return_number, sale_id, return_date, is_cash_refund,
          reason, grand_total, total_cost, processed_by_name, branch_created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          return_number = VALUES(return_number),
          sale_id = VALUES(sale_id),
          return_date = VALUES(return_date),
          is_cash_refund = VALUES(is_cash_refund),
          reason = VALUES(reason),
          grand_total = VALUES(grand_total),
          total_cost = VALUES(total_cost),
          processed_by_name = VALUES(processed_by_name)`,
        [
          row.id, branchCode, row.returnNumber, row.saleId, toMysqlDateTime(row.returnDate),
          row.isCashRefund ? 1 : 0, row.reason || null, row.grandTotal, row.totalCost,
          row.processedByName || null, toMysqlDateTime(row.createdAt),
        ]
      );
    }

    await conn.query(`UPDATE branches SET last_sync_at = NOW() WHERE branch_code = ?`, [branchCode]);

    await conn.commit();
    return { sales: sales.length, salesReturns: salesReturns.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { receiveBatch };
