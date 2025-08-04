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
      const currency = expense.currency || 'TWD';
      
      // Find the user's split in this expense (handle both 'user' and 'userId' fields)
      const userSplit = expense.splits.find(split => 
        split.user === userId || split.userId === userId
      );
      const userOwes = userSplit ? userSplit.amount : 0;
      
      // Calculate how much the current user paid for this expense
      let userPaidAmount = 0;
      
      if (expense.isMultiplePayers && Array.isArray(expense.paidBy)) {
        // Multiple payers - find user's payment
        const userPayment = expense.paidBy.find(payer => payer.userId === userId);
        if (userPayment) {
          userPaidAmount = userPayment.amount;
        }
      } else {
        // Single payer - user paid full amount if they are the payer
        if (expense.paidBy === userId) {
          userPaidAmount = expense.amount;
        }
      }
      
      // For each split, calculate the balance between current user and other users
      expense.splits.forEach(split => {
        const otherUserId = split.user || split.userId;
        if (otherUserId !== userId) {
          // Calculate how much the other user paid
          let otherUserPaidAmount = 0;
          
          if (expense.isMultiplePayers && Array.isArray(expense.paidBy)) {
            const otherUserPayment = expense.paidBy.find(payer => payer.userId === otherUserId);
            if (otherUserPayment) {
              otherUserPaidAmount = otherUserPayment.amount;
            }
          } else {
            if (expense.paidBy === otherUserId) {
              otherUserPaidAmount = expense.amount;
            }
          }
          
          const otherUserOwes = split.amount;
          
          // Initialize balance tracking
          if (!balances[otherUserId]) {
            balances[otherUserId] = {};
          }
          if (!balances[otherUserId][currency]) {
            balances[otherUserId][currency] = 0;
          }
          
          // Simple direct calculation:
          // If current user paid more than they owe, others owe them the difference
          // If current user paid less than they owe, they owe others the difference
          
          if (userPaidAmount > 0) {
            // Current user paid something, so others owe them proportionally
            const userPaidProportion = userPaidAmount / expense.amount;
            const otherUserShouldPayToCurrentUser = otherUserOwes * userPaidProportion;
            balances[otherUserId][currency] += otherUserShouldPayToCurrentUser;
          }
          
          if (otherUserPaidAmount > 0) {
            // Other user paid something, so current user owes them proportionally
            const otherUserPaidProportion = otherUserPaidAmount / expense.amount;
            const currentUserShouldPayToOtherUser = userOwes * otherUserPaidProportion;
            balances[otherUserId][currency] -= currentUserShouldPayToOtherUser;
          }
        }
      });
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
        // Current user paid someone else - this REDUCES what user owes to that person
        if (!balances[toUser]) {
          balances[toUser] = {};
        }
        if (!balances[toUser][currency]) {
          balances[toUser][currency] = 0;
        }
        balances[toUser][currency] -= settlement.amount; // SUBTRACT because user paid
      } else if (toUser === userId) {
        // Someone else paid the current user - this REDUCES what that person owes to user
        if (!balances[fromUser]) {
          balances[fromUser] = {};
        }
        if (!balances[fromUser][currency]) {
          balances[fromUser][currency] = 0;
        }
        balances[fromUser][currency] += settlement.amount; // ADD because they paid user
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
