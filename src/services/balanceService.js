const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');

// Calculate balances between users
const calculateBalances = async (userId, groupId = null) => {
  try {
    // Get all expenses where the user is involved (either as payer or in splits)
    const expenses = await Expense.findByUserId(userId);
    
    // Filter by group if specified
    const filteredExpenses = groupId 
      ? expenses.filter(expense => expense.group === groupId)
      : expenses;

    const balances = {};

    // Calculate what user owes and is owed based on expenses
    filteredExpenses.forEach(expense => {
      const userPaid = expense.paidBy === userId;
      
      // Find the user's split in this expense
      const userSplit = expense.splits.find(split => split.user === userId);
      const userOwes = userSplit ? userSplit.amount : 0;
      
      if (userPaid) {
        // User paid for this expense, so others owe them
        expense.splits.forEach(split => {
          if (split.user !== userId) {
            const otherUserId = split.user;
            if (!balances[otherUserId]) {
              balances[otherUserId] = { userId: otherUserId, balance: 0 };
            }
            // Other user owes this amount to current user
            balances[otherUserId].balance += split.amount;
          }
        });
      } else {
        // Someone else paid, user owes their share
        const payerId = expense.paidBy;
        if (!balances[payerId]) {
          balances[payerId] = { userId: payerId, balance: 0 };
        }
        // User owes this amount to the payer
        balances[payerId].balance -= userOwes;
      }
    });

    // Subtract settlements
    const settlements = await Settlement.findByUserId(userId);
    const filteredSettlements = groupId
      ? settlements.filter(settlement => settlement.group === groupId)
      : settlements;

    filteredSettlements.forEach(settlement => {
      const fromUser = settlement.from;
      const toUser = settlement.to;
      
      if (fromUser === userId) {
        // User paid someone
        if (balances[toUser]) {
          balances[toUser].balance -= settlement.amount;
        }
      } else {
        // Someone paid user
        if (balances[fromUser]) {
          balances[fromUser].balance += settlement.amount;
        }
      }
    });

    // Get user details and format response
    const result = [];
    for (const [userId, balance] of Object.entries(balances)) {
      if (Math.abs(balance.balance) > 0.01) {
        const user = await User.findById(userId);
        if (user) {
          result.push({
            user: user.toJSON(),
            amount: Math.abs(balance.balance),
            type: balance.balance > 0 ? 'owes_you' : 'you_owe'
          });
        }
      }
    }

    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = { calculateBalances };
