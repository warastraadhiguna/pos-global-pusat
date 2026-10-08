require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 4100; // beda default dari server cabang (4000) supaya bisa jalan bareng di satu mesin saat uji lokal
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  await pool.query('SELECT 1');
  app.listen(PORT, HOST, () => {
    console.log(`pos-pusat (penerima sync) berjalan di http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Gagal start pos-pusat (cek koneksi database):', err.message);
  process.exit(1);
});
