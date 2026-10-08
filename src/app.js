const express = require('express');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const syncRoutes = require('./routes/sync.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pos-pusat', time: new Date().toISOString() });
});

app.use('/api/sync', syncRoutes);
app.use('/api/auth', authRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
