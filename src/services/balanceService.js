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

    // Apply settlements to adjust balances
    const settlements = await Settlement.findByUserId(userId);
    const filteredSettlements = groupId
      ? settlements.filter(settlement => settlement.group === groupId)
      : settlements;

    filteredSettlements.forEach(settlement => {
      const fromUser = settlement.from;
      const toUser = settlement.to;
      
      if (fromUser === userId) {
        // Current user paid someone else
        // This reduces what the current user owes to that person
        // OR increases what that person owes to the current user
        if (!balances[toUser]) {
          balances[toUser] = { userId: toUser, balance: 0 };
        }
        balances[toUser].balance += settlement.amount;
      } else if (toUser === userId) {
        // Someone else paid the current user
        // This reduces what that person owes to the current user
        // OR increases what the current user owes to that person
        if (!balances[fromUser]) {
          balances[fromUser] = { userId: fromUser, balance: 0 };
        }
        balances[fromUser].balance -= settlement.amount;
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
    console.error('Error calculating balances:', error);
    throw error;
  }
};

module.exports = { calculateBalances };
