const express = require('express');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { authMiddleware } = require('../utils/auth');
const gcsService = require('../utils/gcs');
const { computeItemizedSplits, ItemizedSplitError } = require('../utils/itemizedSplit');

const router = express.Router();

// For splitType 'itemized': clean the receipt items/adjustments, check every
// assignee is a group member, and derive the splits from them (the client's
// splits are ignored). Throws ItemizedSplitError on invalid input.
const buildItemizedSplit = (group, { items, adjustments, taxRefund, amount, currency }) => {
  const memberIds = new Set(group.members.map(member => member.user));
  // Printed text kept when the scan translated a name
  const originalText = (text) => (text ? String(text).trim().slice(0, 100) : undefined);
  const cleanItems = (Array.isArray(items) ? items : []).map(item => ({
    name: String(item.name || '').trim().slice(0, 100),
    ...(item.originalName ? { originalName: originalText(item.originalName) } : {}),
    // Tax rate (percent) used to share a tax refund; left out when the item isn't refundable
    ...(Number(item.refundRate) > 0 ? { refundRate: Number(item.refundRate) } : {}),
    quantity: Number(item.quantity) || 1,
    amount: Number(item.amount),
    assignees: [...new Set(Array.isArray(item.assignees) ? item.assignees : [])]
  }));
  cleanItems.forEach(item => {
    const outsider = item.assignees.find(userId => !memberIds.has(userId));
    if (outsider) {
      throw new ItemizedSplitError('NOT_A_MEMBER', `${item.name || 'An item'} is assigned to someone outside this group`);
    }
  });
  const cleanAdjustments = (Array.isArray(adjustments) ? adjustments : []).map(adj => ({
    type: String(adj.type || 'other'),
    label: String(adj.label || '').trim().slice(0, 100),
    ...(adj.originalLabel ? { originalLabel: originalText(adj.originalLabel) } : {}),
    amount: Number(adj.amount)
  }));
  // Refund actually received; `amount` is the net cost after it
  const received = Number(taxRefund?.received) || 0;
  const cleanTaxRefund = received > 0 ? { received } : null;
  const { splits } = computeItemizedSplits({
    items: cleanItems, adjustments: cleanAdjustments, taxRefund: cleanTaxRefund, total: amount, currency
  });
  return { items: cleanItems, adjustments: cleanAdjustments, taxRefund: cleanTaxRefund, splits };
};

// A receipt reference is only accepted if it points at this group's uploads
const cleanReceipt = (receipt, groupId) => {
  if (!receipt || typeof receipt.key !== 'string' || !receipt.key.startsWith(`receipts/${groupId}/`)) {
    return null;
  }
  return {
    key: receipt.key,
    merchant: receipt.merchant ? String(receipt.merchant).slice(0, 100) : null,
    model: receipt.model ? String(receipt.model).slice(0, 50) : null,
    scannedAt: receipt.scannedAt || new Date().toISOString()
  };
};

// Helper function to populate user names in expenses
const populateUserNames = async (expenses) => {
  const populatedExpenses = [];

  // Fetch every referenced user once up front
  let users = new Map();
  try {
    users = await User.findByIds(expenses.flatMap(expense => [
      ...(Array.isArray(expense.paidBy) ? expense.paidBy.map(payer => payer.userId) : [expense.paidBy]),
      ...(expense.splits || []).map(split => split.user || split.userId)
    ]));
  } catch (error) {
    console.error('Error fetching users for expenses:', error);
  }

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
          
          const user = users.get(payer.userId);
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
          const paidByUser = users.get(expenseData.paidBy);
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
        
        const user = users.get(userId);
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
      sort = 'createdAt', 
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
      notes,
      items,
      adjustments,
      taxRefund,
      receipt
    } = req.body;

    // Accept both 'group' and 'groupId' for backward compatibility
    const expenseGroupId = group || groupId;
    let itemized = null;

    if (splitType === 'itemized' && !expenseGroupId) {
      return res.status(400).json({ error: 'Itemized splits are only available for group expenses' });
    }

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

      if (splitType === 'itemized') {
        itemized = buildItemizedSplit(group, { items, adjustments, taxRefund, amount, currency });
      }
    }

    // Use provided paidBy or default to current user
    let expensePaidBy;
    if (isMultiplePayers && Array.isArray(paidBy)) {
      expensePaidBy = paidBy; // Keep the array of payer objects
    } else {
      expensePaidBy = paidBy || req.user.id; // Single payer ID
    }

    // Validate splits total (itemized splits are derived, so they always add up)
    const expenseSplits = itemized ? itemized.splits : splits;
    const totalSplit = expenseSplits.reduce((sum, split) => sum + split.amount, 0);
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
      splits: expenseSplits,
      items: itemized ? itemized.items : [],
      adjustments: itemized ? itemized.adjustments : [],
      taxRefund: itemized ? itemized.taxRefund : null,
      receipt: expenseGroupId ? cleanReceipt(receipt, expenseGroupId) : null,
      date: date || new Date().toISOString(),
      notes
    });

    res.status(201).json({
      message: 'Expense created successfully',
      expense
    });
  } catch (error) {
    res.status(400).json({ error: error.message, code: error.code });
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
      notes,
      splitType,
      items,
      adjustments,
      taxRefund,
      receipt
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

    // Itemized: recompute splits from the (updated or existing) items whenever
    // the expense is or becomes itemized
    const nextSplitType = splitType || existingExpense.splitType;
    let itemized = null;
    if (nextSplitType === 'itemized') {
      const group = existingExpense.group && await Group.findByUserIdAndGroupId(req.user.id, existingExpense.group);
      if (!group) {
        return res.status(400).json({ error: 'Itemized splits are only available for group expenses' });
      }
      itemized = buildItemizedSplit(group, {
        items: items !== undefined ? items : existingExpense.items,
        adjustments: adjustments !== undefined ? adjustments : existingExpense.adjustments,
        taxRefund: taxRefund !== undefined ? taxRefund : existingExpense.taxRefund,
        amount: amount !== undefined ? parseFloat(amount) : existingExpense.amount,
        currency: currency || existingExpense.currency
      });
    }

    // Validate splits total
    if (!itemized && splits && amount) {
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
      splitType: nextSplitType || null,
      splits: itemized ? itemized.splits : (splits || existingExpense.splits),
      // Switching away from itemized drops the item assignments (the receipt photo stays)
      items: itemized ? itemized.items : [],
      adjustments: itemized ? itemized.adjustments : [],
      taxRefund: itemized ? itemized.taxRefund : null,
      receipt: receipt !== undefined && existingExpense.group
        ? cleanReceipt(receipt, existingExpense.group)
        : (existingExpense.receipt || null),
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
    res.status(400).json({ error: error.message, code: error.code });
  }
});

// Receipt photo for an expense, streamed to group members only
router.get('/:id/receipt', authMiddleware, async (req, res) => {
  try {
    const expense = await Expense.findByUserIdAndExpenseId(req.user.id, req.params.id);
    if (!expense || !expense.receipt?.key) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const { stream, contentType } = await gcsService.openReceipt(expense.receipt.key);
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' });
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(404).json({ error: 'Receipt not found' });
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
