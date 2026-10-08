const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { requireAuth } = require('../middleware/requireAuth');
const ReportService = require('../services/ReportService');
const { resolveRange } = require('../utils/reportDateRange');

const router = express.Router();

// SELURUH modul laporan di belakang requireAuth — tanpa sesi valid, tolak
// SEBELUM query apa pun jalan (bukan cuma sembunyikan di UI). Ini lebih
// sensitif dari endpoint sync (yg dijaga token cabang) — ini data keuangan
// gabungan semua cabang, dijaga sesi login manusia.
router.use(requireAuth);

// GET /api/reports/consolidated?period=today|month|custom&startDate=&endDate=
router.get(
  '/consolidated',
  asyncHandler(async (req, res) => {
    const { period = 'today', startDate, endDate } = req.query;

    let range;
    try {
      range = resolveRange({ period, startDate, endDate });
    } catch (err) {
      throw new HttpError(400, 'bad_request', err.message);
    }

    const report = await ReportService.getConsolidatedReport({ startDate: range.start, endDate: range.end });

    res.json({
      period,
      label: range.label,
      startDate: range.start,
      endDate: range.end,
      ...report,
    });
  })
);

module.exports = router;
