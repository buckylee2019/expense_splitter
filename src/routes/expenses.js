const express = require('express');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

// Get user's expenses
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.query;
    
    let expenses;
    if (groupId) {
      // First verify user has access to this group
      const group = await Group.findByUserIdAndGroupId(req.user.id, groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found or user not a member' });
      }
      
      // Get expenses for specific group
      expenses = await Expense.findByGroupId(groupId);
    } else {
      // Get all user's expenses
      expenses = await Expense.findByUserId(req.user.id);
    }
    
    res.json(expenses);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create new expense
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      description,
      amount,
      currency,
      category,
      groupId,
      splitType,
      splits
    } = req.body;

    // Validate group membership if group expense
    if (groupId) {
      const group = await Group.findByUserIdAndGroupId(req.user.id, groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found or user not a member' });
      }
    }

    // Validate splits total
    const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(totalSplit - amount) > 0.01) {
      return res.status(400).json({ error: 'Split amounts must equal total amount' });
    }

    const expense = await Expense.create({
      description,
      amount,
      currency,
      category,
      paidBy: req.user.id,
      group: groupId,
      splitType,
      splits,
      date: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Expense created successfully',
      expense
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get expense details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findByUserIdAndExpenseId(req.user.id, req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
