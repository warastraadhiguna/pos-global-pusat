require('dotenv').config();
const mysql = require('mysql2/promise');

// Pola identik dgn server/src/config/db.js — host/port dibaca dari env,
// bukan hardcode.
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_pusat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: false, // DECIMAL tetap string dari driver — jangan lewat Number JS biasa
});

module.exports = pool;
