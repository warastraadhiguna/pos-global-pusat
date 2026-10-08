// Identik pola dgn server/src/db/migrate.js — menjalankan schema.sql
// (DESTRUKTIF, DROP TABLE IF EXISTS di tiap tabel) terhadap MySQL yang
// dikonfigurasi di .env. Cuma untuk DB pusat FRESH/dev, bukan untuk DB
// pusat yang sudah berisi data sungguhan.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    console.log('Menjalankan schema.sql ...');
    await connection.query(schemaSql);
    console.log('Schema pos_pusat berhasil dibuat/diperbarui.');
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error('Migrasi gagal:', err);
  process.exit(1);
});
