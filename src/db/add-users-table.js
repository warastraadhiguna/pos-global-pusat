// Migrasi INKREMENTAL, AMAN dijalankan di database yang sudah berisi data
// sungguhan — cuma CREATE TABLE IF NOT EXISTS, tidak ada DROP/TRUNCATE/
// DELETE apa pun. Idempotent — aman dijalankan berkali-kali. VPS sudah
// punya data sales/sales_returns sungguhan dari Tahap 3, jadi migrasi ini
// (bukan re-run schema.sql yang destruktif) yang dipakai saat deploy nanti.
//
// Fitur: login dashboard pusat (Tahap 4) — lihat catatan panjang di
// schema.sql pada definisi tabel `users` ini.
//
// Usage: node src/db/add-users-table.js
require('dotenv').config();
const pool = require('../config/db');

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('Membuat tabel users (kalau belum ada)...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                     CHAR(36)     NOT NULL PRIMARY KEY,
        username               VARCHAR(50)  NOT NULL UNIQUE,
        password_hash          VARCHAR(255) NOT NULL,
        full_name              VARCHAR(100) NOT NULL,
        is_active              TINYINT(1)   NOT NULL DEFAULT 1,
        failed_login_attempts  INT          NOT NULL DEFAULT 0,
        locked_until           DATETIME     NULL,
        created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

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
