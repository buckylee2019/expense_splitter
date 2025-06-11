const express = require('express');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

// Helper function to populate user names in expenses
const populateUserNames = async (expenses) => {
  const populatedExpenses = [];
  
  for (const expense of expenses) {
    const expenseData = expense.toJSON ? expense.toJSON() : expense;
    
    // Get paidBy user name
    try {
      const paidByUser = await User.findById(expenseData.paidBy);
      expenseData.paidByName = paidByUser ? paidByUser.name : 'Unknown User';
    } catch (error) {
      expenseData.paidByName = 'Unknown User';
    }
    
    // Get user names for splits
    const populatedSplits = [];
    for (const split of expenseData.splits) {
      try {
        const user = await User.findById(split.user);
        populatedSplits.push({
          ...split,
          userName: user ? user.name : 'Unknown User'
        });
      } catch (error) {
        populatedSplits.push({
          ...split,
          userName: 'Unknown User'
        });
      }
    }
    expenseData.splits = populatedSplits;
    
    populatedExpenses.push(expenseData);
  }
  
  return populatedExpenses;
};

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
    
    // Populate user names
    const populatedExpenses = await populateUserNames(expenses);
    
    res.json(populatedExpenses);
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
      group: groupId,
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

    // Populate user names
    const populatedExpenses = await populateUserNames([expense]);
    
    res.json(populatedExpenses[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete expense
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findByUserIdAndExpenseId(req.user.id, req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Only allow the person who paid for the expense to delete it
    if (expense.paidBy !== req.user.id) {
      return res.status(403).json({ error: 'Only the person who paid can delete this expense' });
    }

    await Expense.delete(req.params.id);

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
