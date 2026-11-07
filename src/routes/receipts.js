const express = require('express');
const Group = require('../models/Group');
const { authMiddleware } = require('../utils/auth');
const gcsService = require('../utils/gcs');
const { recognizeReceipt, ReceiptRecognitionError } = require('../services/receiptService');

const router = express.Router();

// Scan a receipt photo: recognize its line items, then store the photo
// privately. Body: { groupId, image } where image is a base64 data URL.
router.post('/scan', authMiddleware, async (req, res) => {
  try {
    const { groupId, image } = req.body;
    if (!groupId || !image) {
      return res.status(400).json({ error: 'groupId and image are required' });
    }
    const group = await Group.findByUserIdAndGroupId(req.user.id, groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found or user not a member' });
    }

    const validation = gcsService.validateImage(image);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }
    const base64 = image.replace(/^data:image\/[a-z]+;base64,/, '');

    // Recognize first, so a failed scan doesn't leave an orphaned photo behind
    const result = await recognizeReceipt(base64, validation.contentType);
    const key = await gcsService.uploadReceipt(Buffer.from(base64, 'base64'), groupId, validation.contentType);

    res.json({
      ...result,
      receipt: { key, merchant: result.merchant, model: result.model, scannedAt: new Date().toISOString() }
    });
  } catch (error) {
    if (error instanceof ReceiptRecognitionError) {
      const status = error.code === 'NO_ITEMS' ? 422 : 502;
      return res.status(status).json({ error: error.message, code: error.code });
    }
    console.error('Receipt scan failed:', error);
    res.status(500).json({ error: 'Receipt scan failed' });
  }
});

module.exports = router;
