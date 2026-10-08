const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireBranchToken } = require('../middleware/branchAuth');
const SyncReceiverService = require('../services/SyncReceiverService');

const router = express.Router();

// POST /api/sync/batch — body: { batchId, generatedAt, sales: [...], salesReturns: [...] }
// Lihat server/docs/SYNC_DESIGN_TAHAP1.md utk bentuk persis tiap field.
router.post(
  '/batch',
  requireBranchToken,
  asyncHandler(async (req, res) => {
    const { batchId, sales = [], salesReturns = [] } = req.body;
    const counts = await SyncReceiverService.receiveBatch({
      branchCode: req.branch.branchCode,
      sales,
      salesReturns,
    });
    res.json({ accepted: true, batchId: batchId || null, counts });
  })
);

module.exports = router;
