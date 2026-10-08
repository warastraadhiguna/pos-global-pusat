// STUB — belum diimplementasi, menunggu konfirmasi struktur Bagian A.
//
// POST /api/sync/batch — SATU-SATUNYA endpoint pusat utk Tahap 2.
// Digerbangi requireBranchToken (branchAuth.js) — begitu lolos middleware
// itu, req.branch.branchCode sudah pasti valid & terpercaya.
//
// RENCANA:
//   Body yang diterima: { batchId, generatedAt, sales: [...], salesReturns: [...] }
//   (bentuk persis sesuai SYNC_DESIGN_TAHAP1.md Bagian 2, ditambah array
//   salesReturns yang menyusul di keputusan sync_status kemarin)
//
//   router.post('/batch', requireBranchToken, asyncHandler(async (req, res) => {
//     const { sales = [], salesReturns = [] } = req.body;
//     const result = await SyncReceiverService.receiveBatch({
//       branchCode: req.branch.branchCode,
//       sales,
//       salesReturns,
//     });
//     res.json({ accepted: true, batchId: req.body.batchId, counts: result });
//   }));
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireBranchToken } = require('../middleware/branchAuth');
const SyncReceiverService = require('../services/SyncReceiverService');

const router = express.Router();

router.post(
  '/batch',
  requireBranchToken,
  asyncHandler(async (req, res) => {
    throw new Error('POST /batch belum diimplementasi — menunggu konfirmasi struktur Bagian A');
  })
);

module.exports = router;
