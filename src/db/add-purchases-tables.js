// Migrasi INKREMENTAL, AMAN dijalankan di database yang sudah berisi data
// sungguhan — cuma CREATE TABLE IF NOT EXISTS, tidak ada DROP/TRUNCATE/
// DELETE apa pun. Idempotent — aman dijalankan berkali-kali. Pola identik
// add-users-table.js.
//
// Fitur: sync Lapis 2 — pembelian (purchases + purchase_returns) dari
// cabang, berdampingan Pembelian Bersih dgn Omzet di dashboard. Lihat
// catatan panjang di schema.sql pada definisi kedua tabel ini.
//
// Usage: node src/db/add-purchases-tables.js
require('dotenv').config();
const pool = require('../config/db');

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('Membuat tabel purchases (kalau belum ada)...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id                 CHAR(36)      NOT NULL PRIMARY KEY,
        branch_code        VARCHAR(20)   NOT NULL,
        purchase_number    VARCHAR(30)   NOT NULL,
        supplier_name      VARCHAR(100)  NULL,
        subtotal           INT           NOT NULL DEFAULT 0,
        discount_total     INT           NOT NULL DEFAULT 0,
        dpp                INT           NOT NULL DEFAULT 0,
        ppn_rate           DECIMAL(8,4)  NULL,
        ppn_mode           VARCHAR(10)   NULL,
        ppn_amount         INT           NOT NULL DEFAULT 0,
        grand_total        INT           NOT NULL,
        status             VARCHAR(20)   NOT NULL,
        void_reason        TEXT          NULL,
        voided_at          DATETIME      NULL,
        branch_created_at  DATETIME      NOT NULL,
        received_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    await conn.query(`CREATE INDEX idx_purchases_branch ON purchases(branch_code)`).catch((err) => {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
    });
    await conn.query(`CREATE INDEX idx_purchases_status ON purchases(status)`).catch((err) => {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
    });

    console.log('Membuat tabel purchase_returns (kalau belum ada)...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id                 CHAR(36)     NOT NULL PRIMARY KEY,
        branch_code        VARCHAR(20)  NOT NULL,
        return_number      VARCHAR(30)  NOT NULL,
        supplier_name      VARCHAR(100) NULL,
        return_date        DATE         NOT NULL,
        payment_type       VARCHAR(10)  NOT NULL,
        reason             TEXT         NULL,
        grand_total        INT          NOT NULL,
        processed_by_name  VARCHAR(100) NULL,
        branch_created_at  DATETIME     NOT NULL,
        received_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    await conn.query(`CREATE INDEX idx_purchase_returns_branch ON purchase_returns(branch_code)`).catch((err) => {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
    });

    await conn.commit();
    console.log('\nSelesai — tidak ada data lain yang tersentuh/terhapus.');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migrasi gagal:', err);
  process.exit(1);
});
