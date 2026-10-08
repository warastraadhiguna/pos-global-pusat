const path = require('path');
const express = require('express');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const syncRoutes = require('./routes/sync.routes');
const authRoutes = require('./routes/auth.routes');
const reportsRoutes = require('./routes/reports.routes');

const app = express();

app.use(express.json());

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
