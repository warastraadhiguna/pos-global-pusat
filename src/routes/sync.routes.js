const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireBranchToken } = require('../middleware/branchAuth');
const SyncReceiverService = require('../services/SyncReceiverService');

const router = express.Router();

// POST /api/sync/batch — body: { batchId, generatedAt, sales: [...], salesReturns: [...],
// purchases: [...], purchaseReturns: [...] }. Lihat server/docs/SYNC_DESIGN_TAHAP1.md
// utk bentuk persis field Lapis 1, dan SYNC_LAPIS2_PURCHASES_AUDIT.md utk Lapis 2.
router.post(
  '/batch',
  requireBranchToken,
  asyncHandler(async (req, res) => {
    const { batchId, sales = [], salesReturns = [], purchases = [], purchaseReturns = [] } = req.body;
    const counts = await SyncReceiverService.receiveBatch({
      branchCode: req.branch.branchCode,
      sales,
      salesReturns,
      purchases,
      purchaseReturns,
    });
    res.json({ accepted: true, batchId: batchId || null, counts });
  })
);

module.exports = router;
