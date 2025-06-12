const express = require('express');
const Settlement = require('../models/Settlement');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Group = require('../models/Group');
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
      fromUserId, // Optional: for third-party settlements
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

    // Determine who is making the payment
    // If fromUserId is provided, use it (third-party settlement)
    // Otherwise, use the current user's ID (normal settlement)
    const fromUser = fromUserId || req.user.id;
    
    // Verify that both users are members of the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const isFromUserInGroup = group.members.some(m => m.user === fromUser);
    const isToUserInGroup = group.members.some(m => m.user === toUserId);
    
    if (!isFromUserInGroup || !isToUserInGroup) {
      return res.status(400).json({ error: 'Both users must be members of the group' });
    }
    
    // Verify that the current user is a member of the group
    const isCurrentUserInGroup = group.members.some(m => m.user === req.user.id);
    if (!isCurrentUserInGroup) {
      return res.status(403).json({ error: 'You must be a member of the group to record settlements' });
    }

    const settlement = await Settlement.create({
      from: fromUser,
      to: toUserId,
      amount: parseFloat(amount),
      currency,
      group: groupId,
      method,
      notes,
      expenses: expenseIds || [],
      settledAt: new Date().toISOString(),
      recordedBy: req.user.id // Track who recorded the settlement
    });

    // Update related expenses as settled
    if (expenseIds && expenseIds.length > 0) {
      await Expense.updateSettlementStatus(expenseIds, fromUser, true);
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
