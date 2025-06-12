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
        // Handle both 'user' and 'userId' field names for backward compatibility
        const userId = split.user || split.userId;
        const user = await User.findById(userId);
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
      group,
      groupId,
      splitType,
      splits,
      paidBy
    } = req.body;

    // Accept both 'group' and 'groupId' for backward compatibility
    const expenseGroupId = group || groupId;

    // Validate group membership if group expense
    if (expenseGroupId) {
      const group = await Group.findByUserIdAndGroupId(req.user.id, expenseGroupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found or user not a member' });
      }
      
      // Validate that the selected payer is a member of the group
      if (paidBy) {
        const payerIsMember = group.members.some(member => member.user === paidBy);
        if (!payerIsMember) {
          return res.status(400).json({ error: 'Selected payer is not a member of this group' });
        }
      }
    }

    // Use provided paidBy or default to current user
    const expensePaidBy = paidBy || req.user.id;

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
      paidBy: expensePaidBy,
      group: expenseGroupId,
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

// Update expense
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      description,
      amount,
      currency,
      category,
      splits,
      paidBy
    } = req.body;

    // Find the existing expense
    const existingExpense = await Expense.findByUserIdAndExpenseId(req.user.id, req.params.id);
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Only allow the person who paid for the expense to edit it
    if (existingExpense.paidBy !== req.user.id) {
      return res.status(403).json({ error: 'Only the person who paid can edit this expense' });
    }

    // Validate that the selected payer is a member of the group (if paidBy is provided)
    if (paidBy && existingExpense.group) {
      const group = await Group.findByUserIdAndGroupId(req.user.id, existingExpense.group);
      if (group) {
        const payerIsMember = group.members.some(member => member.user === paidBy);
        if (!payerIsMember) {
          return res.status(400).json({ error: 'Selected payer is not a member of this group' });
        }
      }
    }

    // Validate splits total
    if (splits && amount) {
      const totalSplit = splits.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(totalSplit - amount) > 0.01) {
        return res.status(400).json({ error: 'Split amounts must equal total amount' });
      }
    }

    // Update the expense
    const updatedExpense = await Expense.update(req.params.id, {
      description: description || existingExpense.description,
      amount: amount !== undefined ? parseFloat(amount) : existingExpense.amount,
      currency: currency || existingExpense.currency,
      category: category || existingExpense.category,
      paidBy: paidBy || existingExpense.paidBy,
      splits: splits || existingExpense.splits,
      updatedAt: new Date().toISOString()
    });

    // Populate user names
    const populatedExpenses = await populateUserNames([updatedExpense]);
    
    res.json({
      message: 'Expense updated successfully',
      expense: populatedExpenses[0]
    });
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
