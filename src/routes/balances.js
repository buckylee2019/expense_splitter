const express = require('express');
const { authMiddleware } = require('../utils/auth');
const { calculateBalances } = require('../services/balanceService');

const router = express.Router();

// Get user's balances
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.query;
    const balances = await calculateBalances(req.user.id, groupId);
    
    res.json({
      balances,
      summary: {
        totalOwed: balances
          .filter(b => b.type === 'owes_you')
          .reduce((sum, b) => sum + b.amount, 0),
        totalOwing: balances
          .filter(b => b.type === 'you_owe')
          .reduce((sum, b) => sum + b.amount, 0)
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
