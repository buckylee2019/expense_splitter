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
      
      // Calculate user's net balance for this expense
      const userNetBalance = userPaidAmount - userOwes;
      
      // If user has a net balance (positive or negative), distribute it among other users
      if (Math.abs(userNetBalance) > 0.01) {
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
            const otherUserNetBalance = otherUserPaidAmount - otherUserOwes;
            
            // Initialize balance tracking
            if (!balances[otherUserId]) {
              balances[otherUserId] = {};
            }
            if (!balances[otherUserId][currency]) {
              balances[otherUserId][currency] = 0;
            }
            
            // Simple approach: if current user overpaid and other user underpaid (or vice versa)
            // they need to settle the difference proportionally
            if (userNetBalance > 0 && otherUserNetBalance < 0) {
              // Current user overpaid, other user underpaid
              // Other user owes current user
              const settlementAmount = Math.min(userNetBalance, Math.abs(otherUserNetBalance));
              balances[otherUserId][currency] += settlementAmount;
            } else if (userNetBalance < 0 && otherUserNetBalance > 0) {
              // Current user underpaid, other user overpaid  
              // Current user owes other user
              const settlementAmount = Math.min(Math.abs(userNetBalance), otherUserNetBalance);
              balances[otherUserId][currency] -= settlementAmount;
            } else if (userNetBalance > 0 && otherUserNetBalance >= 0) {
              // Both overpaid or other user broke even, but current user overpaid more
              // Other user should contribute to current user's overpayment proportionally
              const totalSplitAmount = expense.splits.reduce((sum, s) => sum + s.amount, 0);
              const otherUserProportion = otherUserOwes / totalSplitAmount;
              const otherUserShare = userNetBalance * otherUserProportion;
              balances[otherUserId][currency] += otherUserShare;
            } else if (userNetBalance < 0 && otherUserNetBalance <= 0) {
              // Both underpaid or other user broke even, but current user underpaid more
              // Current user should pay other user proportionally
              const totalSplitAmount = expense.splits.reduce((sum, s) => sum + s.amount, 0);
              const otherUserProportion = otherUserOwes / totalSplitAmount;
              const currentUserShare = Math.abs(userNetBalance) * otherUserProportion;
              balances[otherUserId][currency] -= currentUserShare;
            }
          }
        });
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
