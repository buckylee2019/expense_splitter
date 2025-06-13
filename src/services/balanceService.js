const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');

// Calculate balances between users, separated by currency
const calculateBalances = async (userId, groupId = null) => {
  try {
    // Get all expenses where the user is involved (either as payer or in splits)
    const expenses = await Expense.findByUserId(userId);
    
    // Filter by group if specified
    const filteredExpenses = groupId 
      ? expenses.filter(expense => expense.group === groupId)
      : expenses;

    // Use nested object: balances[userId][currency] = amount
    const balances = {};

    // Calculate what user owes and is owed based on expenses, separated by currency
    filteredExpenses.forEach(expense => {
      const userPaid = expense.paidBy === userId;
      const currency = expense.currency || 'TWD';
      
      // Find the user's split in this expense (handle both 'user' and 'userId' fields)
      const userSplit = expense.splits.find(split => 
        split.user === userId || split.userId === userId
      );
      const userOwes = userSplit ? userSplit.amount : 0;
      
      if (userPaid) {
        // User paid for this expense, so others owe them
        expense.splits.forEach(split => {
          const splitUserId = split.user || split.userId;
          if (splitUserId !== userId) {
            const otherUserId = splitUserId;
            if (!balances[otherUserId]) {
              balances[otherUserId] = {};
            }
            if (!balances[otherUserId][currency]) {
              balances[otherUserId][currency] = 0;
            }
            // Other user owes this amount to current user in this currency
            balances[otherUserId][currency] += split.amount;
          }
        });
      } else {
        // Someone else paid, user owes their share
        const payerId = expense.paidBy;
        if (!balances[payerId]) {
          balances[payerId] = {};
        }
        if (!balances[payerId][currency]) {
          balances[payerId][currency] = 0;
        }
        // User owes this amount to the payer in this currency
        balances[payerId][currency] -= userOwes;
      }
    });

    // Apply settlements to adjust balances, considering currency
    const settlements = await Settlement.findByUserId(userId);
    const filteredSettlements = groupId
      ? settlements.filter(settlement => settlement.group === groupId)
      : settlements;

    filteredSettlements.forEach(settlement => {
      const fromUser = settlement.from;
      const toUser = settlement.to;
      const currency = settlement.currency || 'TWD';
      
      if (fromUser === userId) {
        // Current user paid someone else
        if (!balances[toUser]) {
          balances[toUser] = {};
        }
        if (!balances[toUser][currency]) {
          balances[toUser][currency] = 0;
        }
        balances[toUser][currency] += settlement.amount;
      } else if (toUser === userId) {
        // Someone else paid the current user
        if (!balances[fromUser]) {
          balances[fromUser] = {};
        }
        if (!balances[fromUser][currency]) {
          balances[fromUser][currency] = 0;
        }
        balances[fromUser][currency] -= settlement.amount;
      }
    });

    // Get user details and format response, separated by currency
    const result = [];
    for (const [userId, currencyBalances] of Object.entries(balances)) {
      for (const [currency, balance] of Object.entries(currencyBalances)) {
        if (Math.abs(balance) > 0.01) {
          const user = await User.findById(userId);
          if (user) {
            result.push({
              user: user.toJSON(),
              amount: Math.abs(balance),
              currency: currency,
              type: balance > 0 ? 'owes_you' : 'you_owe'
            });
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error calculating balances:', error);
    throw error;
  }
};

module.exports = { calculateBalances };
