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
    
    // Handle paidBy user name(s)
    try {
      if (expenseData.isMultiplePayers && Array.isArray(expenseData.paidBy)) {
        // Multiple payers - populate each payer's name
        const populatedPayers = [];
        for (const payer of expenseData.paidBy) {
          if (!payer.userId) {
            console.warn('Payer found without userId:', payer);
            populatedPayers.push({
              ...payer,
              userName: 'Unknown User',
              userAvatarUrl: null,
              userAvatar: null
            });
            continue;
          }
          
          const user = await User.findById(payer.userId);
          if (!user) {
            console.warn('User not found for payer ID:', payer.userId);
            populatedPayers.push({
              ...payer,
              userName: 'Unknown User',
              userAvatarUrl: null,
              userAvatar: null
            });
          } else {
            populatedPayers.push({
              ...payer,
              userName: user.name,
              userAvatarUrl: user.avatarUrl,
              userAvatar: user.avatar
            });
          }
        }
        expenseData.paidBy = populatedPayers;
        expenseData.paidByName = `${expenseData.paidBy.length} people`;
      } else {
        // Single payer
        if (!expenseData.paidBy) {
          console.warn('Expense found without paidBy:', expenseData.id);
          expenseData.paidByName = 'Unknown User';
        } else {
          const paidByUser = await User.findById(expenseData.paidBy);
          if (!paidByUser) {
            console.warn('User not found for paidBy ID:', expenseData.paidBy);
            expenseData.paidByName = 'Unknown User';
          } else {
            expenseData.paidByName = paidByUser.name;
          }
        }
      }
    } catch (error) {
      console.error('Error populating paidBy user:', error);
      if (expenseData.isMultiplePayers) {
        expenseData.paidByName = 'Multiple people';
      } else {
        expenseData.paidByName = 'Unknown User';
      }
    }
    
    // Get user names for splits
    const populatedSplits = [];
    for (const split of expenseData.splits) {
      try {
        // Handle both 'user' and 'userId' field names for backward compatibility
        const userId = split.user || split.userId;
        
        if (!userId) {
          console.warn('Split found without user ID:', split);
          populatedSplits.push({
            ...split,
            userName: 'Unknown User',
            userAvatarUrl: null,
            userAvatar: null
          });
          continue;
        }
        
        const user = await User.findById(userId);
        if (!user) {
          console.warn('User not found for ID:', userId);
          populatedSplits.push({
            ...split,
            userName: 'Unknown User',
            userAvatarUrl: null,
            userAvatar: null
          });
        } else {
          populatedSplits.push({
            ...split,
            userName: user.name,
            userAvatarUrl: user.avatarUrl,
            userAvatar: user.avatar
          });
        }
      } catch (error) {
        console.error('Error populating user for split:', error);
        populatedSplits.push({
          ...split,
          userName: 'Unknown User',
          userAvatarUrl: null,
          userAvatar: null
        });
      }
    }
    expenseData.splits = populatedSplits;
    
    populatedExpenses.push(expenseData);
  }
  
  return populatedExpenses;
};

// Get user's expenses with pagination and filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      groupId, 
      page = 1, 
      limit = 20, 
      sort = 'date', 
      order = 'desc',
      startDate,
      endDate,
      search,
      category,
      minAmount,
      maxAmount
    } = req.query;
    
    // Parse pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
    const offset = (pageNum - 1) * limitNum;
    
    let expenses, totalCount;
    
    if (groupId) {
      // First verify user has access to this group
      const group = await Group.findByUserIdAndGroupId(req.user.id, groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found or user not a member' });
      }
      
      // Build filter options
      const filterOptions = {
        groupId,
        startDate,
        endDate,
        search,
        category,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
        sort,
        order,
        limit: limitNum,
        offset
      };
      
      // Get expenses for specific group with filters
      const result = await Expense.findByGroupIdWithFilters(filterOptions);
      expenses = result.expenses;
      totalCount = result.totalCount;
    } else {
      // Get user's expenses with basic pagination
      const result = await Expense.findByUserIdWithPagination(req.user.id, {
        limit: limitNum,
        offset,
        sort,
        order
      });
      expenses = result.expenses;
      totalCount = result.totalCount;
    }
    
    // Populate user names
    const populatedExpenses = await populateUserNames(expenses);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    res.json({
      expenses: populatedExpenses,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: limitNum
      }
    });
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
      project,
      group,
      groupId,
      splitType,
      splits,
      paidBy,
      isMultiplePayers,
      date,
      notes
    } = req.body;

    // Accept both 'group' and 'groupId' for backward compatibility
    const expenseGroupId = group || groupId;

    // Validate group membership if group expense
    if (expenseGroupId) {
      const group = await Group.findByUserIdAndGroupId(req.user.id, expenseGroupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found or user not a member' });
      }
      
      // Validate that the selected payer(s) are members of the group
      if (paidBy) {
        if (isMultiplePayers && Array.isArray(paidBy)) {
          // Validate multiple payers
          for (const payer of paidBy) {
            const payerIsMember = group.members.some(member => member.user === payer.userId);
            if (!payerIsMember) {
              return res.status(400).json({ error: `Payer ${payer.userId} is not a member of this group` });
            }
          }
        } else {
          // Validate single payer
          const payerIsMember = group.members.some(member => member.user === paidBy);
          if (!payerIsMember) {
            return res.status(400).json({ error: 'Selected payer is not a member of this group' });
          }
        }
      }
    }

    // Use provided paidBy or default to current user
    let expensePaidBy;
    if (isMultiplePayers && Array.isArray(paidBy)) {
      expensePaidBy = paidBy; // Keep the array of payer objects
    } else {
      expensePaidBy = paidBy || req.user.id; // Single payer ID
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
      project,
      paidBy: expensePaidBy,
      isMultiplePayers: isMultiplePayers || false,
      group: expenseGroupId,
      splitType,
      splits,
      date: date || new Date().toISOString(),
      notes
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

    // Debug: Log the expense data before population
    console.log('Raw expense data:', {
      id: expense.id,
      description: expense.description,
      notes: expense.notes,
      hasNotes: !!expense.notes
    });

    // Populate user names
    const populatedExpenses = await populateUserNames([expense]);
    
    // Debug: Log the expense data after population
    console.log('Populated expense data:', {
      id: populatedExpenses[0].id,
      description: populatedExpenses[0].description,
      notes: populatedExpenses[0].notes,
      hasNotes: !!populatedExpenses[0].notes
    });
    
    res.json(populatedExpenses[0]);
  } catch (error) {
    console.error('Error fetching expense:', error);
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
      project,
      splits,
      paidBy,
      isMultiplePayers,
      date,
      notes
    } = req.body;

    console.log('PUT request body notes field:', notes);

    // Find the existing expense
    const existingExpense = await Expense.findByUserIdAndExpenseId(req.user.id, req.params.id);
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    console.log('Existing expense notes field:', existingExpense.notes);

    // Only allow the person who paid for the expense to edit it
    // Temporarily commenting out this restriction to allow any group member to edit expenses
    /*if (existingExpense.paidBy !== req.user.id) {
      return res.status(403).json({ error: 'Only the person who paid can edit this expense' });
    }*/

    // Validate that the selected payer(s) are members of the group (if paidBy is provided)
    if (paidBy && existingExpense.group) {
      const group = await Group.findByUserIdAndGroupId(req.user.id, existingExpense.group);
      if (group) {
        if (isMultiplePayers && Array.isArray(paidBy)) {
          // Validate multiple payers
          for (const payer of paidBy) {
            const payerIsMember = group.members.some(member => member.user === payer.userId);
            if (!payerIsMember) {
              return res.status(400).json({ error: `Payer ${payer.userId} is not a member of this group` });
            }
          }
        } else {
          // Validate single payer
          const payerIsMember = group.members.some(member => member.user === paidBy);
          if (!payerIsMember) {
            return res.status(400).json({ error: 'Selected payer is not a member of this group' });
          }
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
      project: project !== undefined ? project : existingExpense.project,
      paidBy: paidBy || existingExpense.paidBy,
      isMultiplePayers: isMultiplePayers !== undefined ? isMultiplePayers : existingExpense.isMultiplePayers,
      splits: splits || existingExpense.splits,
      date: date || existingExpense.date,
      notes: notes !== undefined ? notes : existingExpense.notes,
      updatedAt: new Date().toISOString()
    });

    console.log('Updated expense notes field:', updatedExpense.notes);

    // Populate user names
    const populatedExpenses = await populateUserNames([updatedExpense]);
    
    console.log('Final response notes field:', populatedExpenses[0].notes);
    
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

    // Allow any group member to delete the expense
    // The findByUserIdAndExpenseId already ensures the user is part of the group
    // So we don't need additional permission checks

    await Expense.delete(req.params.id);

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
