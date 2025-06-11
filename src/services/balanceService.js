const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');

// Calculate balances between users
const calculateBalances = async (userId, groupId = null) => {
  try {
    // Get all expenses for the user
    const expenses = await Expense.findByUserId(userId);
    
    // Filter by group if specified
    const filteredExpenses = groupId 
      ? expenses.filter(expense => expense.group === groupId)
      : expenses;

    const balances = {};

    // Calculate what user owes and is owed
    filteredExpenses.forEach(expense => {
      const paidByUser = expense.paidBy === userId;
      
      expense.splits.forEach(split => {
        const splitUserId = split.user;
        
        if (splitUserId !== userId) {
          if (!balances[splitUserId]) {
            balances[splitUserId] = {
              userId: splitUserId,
              balance: 0 // positive means they owe you, negative means you owe them
            };
          }

          if (paidByUser) {
            // User paid, so split user owes them
            balances[splitUserId].balance += split.amount;
          }
        } else if (!paidByUser) {
          // User owes money for this expense
          const paidById = expense.paidBy;
          
          if (!balances[paidById]) {
            balances[paidById] = {
              userId: paidById,
              balance: 0
            };
          }
          
          balances[paidById].balance -= split.amount;
        }
      });
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
