const express = require('express');
const Settlement = require('../models/Settlement');
const Expense = require('../models/Expense');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

// Get user's settlements
router.get('/', authMiddleware, async (req, res) => {
  try {
    const settlements = await Settlement.findByUserId(req.user.id);
    res.json(settlements);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create new settlement
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      toUserId,
      amount,
      currency,
      groupId,
      method,
      notes,
      expenseIds
    } = req.body;

    // Validate required fields
    if (!toUserId || !amount || !groupId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const settlement = await Settlement.create({
      from: req.user.id,
      to: toUserId,
      amount: parseFloat(amount),
      currency,
      group: groupId,
      method,
      notes,
      expenses: expenseIds || [],
      settledAt: new Date().toISOString()
    });

    // Update related expenses as settled
    if (expenseIds && expenseIds.length > 0) {
      await Expense.updateSettlementStatus(expenseIds, req.user.id, true);
    }

    res.status(201).json({
      message: 'Settlement recorded successfully',
      settlement
    });
  } catch (error) {
    console.error('Settlement creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
