const path = require('path');
const express = require('express');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const syncRoutes = require('./routes/sync.routes');
const authRoutes = require('./routes/auth.routes');
const reportsRoutes = require('./routes/reports.routes');

const app = express();

// Default express.json() cuma 100kb — terlalu kecil utk batch sync
// (batch_size default 200 baris sales + 200 sales_returns bisa ~150-250kb
// terserialisasi). 15mb dipilih dgn headroom besar tapi TETAP terbatas
// (bukan unlimited) — batch_size dibatasi maks 2000 di sisi pengirim
// (SyncSettingsService), jadi ini jauh di atas kebutuhan wajar tanpa
// membuka pintu payload sembarang besar. Lihat server/docs/SYNC_BATCHING.md.
app.use(express.json({ limit: '15mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pos-pusat', time: new Date().toISOString() });
});

app.use('/api/sync', syncRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);

// Dashboard (Tahap 4 Bagian C) — HTML/JS statis TANPA build step (lihat
// alasan di commit terkait: pos-pusat belum punya tooling build, UI Lapis 1
// kecil & tetap, menjaga deploy VPS tetap "git pull + pm2 reload"). Proteksi
// SEBENARNYA tetap di API (requireAuth di reports.routes.js/auth.routes.js)
// — file statis ini cuma UI, bukan lapis keamanan.
app.use(express.static(path.join(__dirname, '../public')));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
