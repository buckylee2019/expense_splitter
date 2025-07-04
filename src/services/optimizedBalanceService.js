const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');

/**
 * Optimized Balance Calculation Service
 * 
 * This service implements a debt simplification algorithm that minimizes
 * the number of money transfers needed to settle all debts in a group.
 * 
 * Algorithm: 
 * 1. Calculate net balance for each user (what they owe minus what they're owed)
 * 2. Separate users into creditors (positive balance) and debtors (negative balance)
 * 3. Match creditors with debtors to minimize number of transactions
 * 4. Use greedy approach: largest debtor pays largest creditor first
 */

/**
 * Calculate optimized balances that minimize transfer count
 * @param {string} userId - Current user ID
 * @param {string} groupId - Optional group ID to filter by
 * @returns {Object} - Optimized balance data with minimal transfers
 */
const calculateOptimizedBalances = async (userId, groupId = null) => {
  try {
    // Step 1: Calculate raw net balances for all users in the group(s)
    const netBalances = await calculateNetBalances(userId, groupId);
    
    // Step 2: Generate optimized transfers
    const optimizedTransfers = optimizeTransfers(netBalances);
    
    // Step 3: Filter transfers relevant to current user
    const userTransfers = optimizedTransfers.filter(transfer => 
      transfer.from === userId || transfer.to === userId
    );
    
    // Step 4: Format for frontend consumption
    const formattedBalances = await formatBalancesForUser(userTransfers, userId);
    
    // Step 5: Calculate summary statistics
    const summary = calculateSummary(formattedBalances);
    
    return {
      balances: formattedBalances,
      summary,
      optimizedTransfers: optimizedTransfers,
      transferCount: optimizedTransfers.length,
      originalTransferCount: Object.keys(netBalances).length * (Object.keys(netBalances).length - 1) / 2
    };
    
  } catch (error) {
    console.error('Error calculating optimized balances:', error);
    throw error;
  }
};

/**
 * Calculate net balance for each user (what they're owed minus what they owe)
 * @param {string} userId - Current user ID
 * @param {string} groupId - Optional group ID
 * @returns {Object} - Net balances by user and currency
 */
const calculateNetBalances = async (userId, groupId = null) => {
  // Get all expenses for the user or group
  const expenses = await Expense.findByUserId(userId);
  const filteredExpenses = groupId 
    ? expenses.filter(expense => expense.group === groupId)
    : expenses;

  // Get all users involved in these expenses
  const allUserIds = new Set();
  filteredExpenses.forEach(expense => {
    allUserIds.add(expense.paidBy);
    expense.splits.forEach(split => {
      allUserIds.add(split.user || split.userId);
    });
  });

  // Initialize net balances: netBalances[userId][currency] = netAmount
  const netBalances = {};
  Array.from(allUserIds).forEach(uid => {
    netBalances[uid] = {};
  });

  // Calculate net balances from expenses
  filteredExpenses.forEach(expense => {
    const currency = expense.currency || 'TWD';
    const payerId = expense.paidBy;
    
    // Initialize currency for all users if not exists
    Array.from(allUserIds).forEach(uid => {
      if (!netBalances[uid][currency]) {
        netBalances[uid][currency] = 0;
      }
    });
    
    // Payer gets credited for the total amount
    netBalances[payerId][currency] += expense.amount;
    
    // Each person in splits gets debited for their share
    expense.splits.forEach(split => {
      const splitUserId = split.user || split.userId;
      netBalances[splitUserId][currency] -= split.amount;
    });
  });

  // Apply settlements to adjust net balances
  const settlements = await Settlement.findByUserId(userId);
  const filteredSettlements = groupId
    ? settlements.filter(settlement => settlement.group === groupId)
    : settlements;

  filteredSettlements.forEach(settlement => {
    const currency = settlement.currency || 'TWD';
    const fromUser = settlement.from;
    const toUser = settlement.to;
    
    // Initialize currency if not exists
    if (!netBalances[fromUser]) netBalances[fromUser] = {};
    if (!netBalances[toUser]) netBalances[toUser] = {};
    if (!netBalances[fromUser][currency]) netBalances[fromUser][currency] = 0;
    if (!netBalances[toUser][currency]) netBalances[toUser][currency] = 0;
    
    // Settlement: fromUser paid toUser
    netBalances[fromUser][currency] += settlement.amount; // fromUser owes less (net balance improves)
    netBalances[toUser][currency] -= settlement.amount;   // toUser is owed less (net balance decreases)
  });

  return netBalances;
};

/**
 * Optimize transfers to minimize transaction count using debt settlement algorithm
 * @param {Object} netBalances - Net balances by user and currency
 * @returns {Array} - Optimized list of transfers
 */
const optimizeTransfers = (netBalances) => {
  const transfers = [];
  
  // Process each currency separately
  const currencies = new Set();
  Object.values(netBalances).forEach(userBalances => {
    Object.keys(userBalances).forEach(currency => currencies.add(currency));
  });
  
  currencies.forEach(currency => {
    const currencyTransfers = optimizeTransfersForCurrency(netBalances, currency);
    transfers.push(...currencyTransfers);
  });
  
  return transfers;
};

/**
 * Optimize transfers for a specific currency
 * @param {Object} netBalances - Net balances by user and currency
 * @param {string} currency - Currency to optimize
 * @returns {Array} - Optimized transfers for this currency
 */
const optimizeTransfersForCurrency = (netBalances, currency) => {
  // Extract balances for this currency and filter out zero balances
  const balances = [];
  Object.entries(netBalances).forEach(([userId, userBalances]) => {
    const balance = userBalances[currency] || 0;
    if (Math.abs(balance) > 0.01) { // Ignore tiny amounts
      balances.push({ userId, balance });
    }
  });
  
  // Separate creditors (positive balance) and debtors (negative balance)
  const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);
  
  const transfers = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  
  // Greedy algorithm: match largest creditor with largest debtor
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    
    // Calculate transfer amount (minimum of what creditor is owed and what debtor owes)
    const transferAmount = Math.min(creditor.balance, Math.abs(debtor.balance));
    
    if (transferAmount > 0.01) { // Only create transfer if amount is significant
      transfers.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(transferAmount * 100) / 100, // Round to 2 decimal places
        currency: currency
      });
    }
    
    // Update balances
    creditor.balance -= transferAmount;
    debtor.balance += transferAmount;
    
    // Move to next creditor/debtor if current one is settled
    if (creditor.balance < 0.01) creditorIndex++;
    if (Math.abs(debtor.balance) < 0.01) debtorIndex++;
  }
  
  return transfers;
};

/**
 * Format optimized transfers for frontend display
 * @param {Array} transfers - Optimized transfers
 * @param {string} userId - Current user ID
 * @returns {Array} - Formatted balances for display
 */
const formatBalancesForUser = async (transfers, userId) => {
  const formattedBalances = [];
  
  for (const transfer of transfers) {
    let otherUserId, type, amount;
    
    if (transfer.from === userId) {
      // Current user owes money
      otherUserId = transfer.to;
      type = 'you_owe';
      amount = transfer.amount;
    } else {
      // Current user is owed money
      otherUserId = transfer.from;
      type = 'owes_you';
      amount = transfer.amount;
    }
    
    // Get user details
    const user = await User.findById(otherUserId);
    if (user) {
      formattedBalances.push({
        user: user.toJSON(),
        amount: amount,
        currency: transfer.currency,
        type: type,
        optimized: true // Flag to indicate this is an optimized balance
      });
    }
  }
  
  return formattedBalances;
};

/**
 * Calculate summary statistics
 * @param {Array} balances - Formatted balances
 * @returns {Object} - Summary statistics
 */
const calculateSummary = (balances) => {
  const totalOwed = balances
    .filter(b => b.type === 'owes_you')
    .reduce((sum, b) => sum + b.amount, 0);
    
  const totalOwing = balances
    .filter(b => b.type === 'you_owe')
    .reduce((sum, b) => sum + b.amount, 0);
  
  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwing: Math.round(totalOwing * 100) / 100,
    netBalance: Math.round((totalOwed - totalOwing) * 100) / 100
  };
};

/**
 * Get group-wide optimized transfers (for admin/overview purposes)
 * @param {string} groupId - Group ID
 * @returns {Object} - Complete optimization data for the group
 */
const getGroupOptimizedTransfers = async (groupId) => {
  try {
    // Get all expenses in the group
    const expenses = await Expense.findByGroupId(groupId);
    
    // Get all users in the group
    const allUserIds = new Set();
    expenses.forEach(expense => {
      allUserIds.add(expense.paidBy);
      expense.splits.forEach(split => {
        allUserIds.add(split.user || split.userId);
      });
    });
    
    // Calculate net balances for the entire group
    const netBalances = {};
    Array.from(allUserIds).forEach(uid => {
      netBalances[uid] = {};
    });
    
    // Process expenses
    expenses.forEach(expense => {
      const currency = expense.currency || 'TWD';
      const payerId = expense.paidBy;
      
      Array.from(allUserIds).forEach(uid => {
        if (!netBalances[uid][currency]) {
          netBalances[uid][currency] = 0;
        }
      });
      
      netBalances[payerId][currency] += expense.amount;
      
      expense.splits.forEach(split => {
        const splitUserId = split.user || split.userId;
        netBalances[splitUserId][currency] -= split.amount;
      });
    });
    
    // Apply settlements
    const settlements = await Settlement.findByGroupId(groupId);
    settlements.forEach(settlement => {
      const currency = settlement.currency || 'TWD';
      const fromUser = settlement.from;
      const toUser = settlement.to;
      
      if (!netBalances[fromUser]) netBalances[fromUser] = {};
      if (!netBalances[toUser]) netBalances[toUser] = {};
      if (!netBalances[fromUser][currency]) netBalances[fromUser][currency] = 0;
      if (!netBalances[toUser][currency]) netBalances[toUser][currency] = 0;
      
      netBalances[fromUser][currency] += settlement.amount; // fromUser owes less (net balance improves)
      netBalances[toUser][currency] -= settlement.amount;   // toUser is owed less (net balance decreases)
    });
    
    // Generate optimized transfers
    const optimizedTransfers = optimizeTransfers(netBalances);
    
    // Calculate statistics
    const totalTransferAmount = optimizedTransfers.reduce((sum, t) => sum + t.amount, 0);
    const originalTransferCount = Math.max(0, allUserIds.size * (allUserIds.size - 1) / 2);
    
    return {
      optimizedTransfers,
      transferCount: optimizedTransfers.length,
      originalTransferCount,
      totalTransferAmount: Math.round(totalTransferAmount * 100) / 100,
      savingsPercentage: originalTransferCount > 0 
        ? Math.round((1 - optimizedTransfers.length / originalTransferCount) * 100)
        : 0
    };
    
  } catch (error) {
    console.error('Error calculating group optimized transfers:', error);
    throw error;
  }
};

/**
 * Calculate optimized balances for a specific group (user-specific view)
 * @param {string} userId - Current user ID
 * @param {string} groupId - Group ID to filter by
 * @returns {Object} - Optimized balance data with minimal transfers for this user
 */
const calculateOptimizedGroupBalances = async (userId, groupId) => {
  try {
    // Get group-wide optimization first
    const groupOptimization = await getGroupOptimizedTransfers(groupId);
    
    // Filter transfers relevant to current user
    const userTransfers = groupOptimization.optimizedTransfers.filter(transfer => 
      transfer.from === userId || transfer.to === userId
    );
    
    // Format for frontend consumption
    const formattedBalances = await formatBalancesForUser(userTransfers, userId);
    
    // Calculate summary statistics
    const summary = calculateSummary(formattedBalances);
    
    return {
      balances: formattedBalances,
      summary,
      optimizedTransfers: userTransfers,
      transferCount: userTransfers.length,
      originalTransferCount: groupOptimization.originalTransferCount,
      groupTransferCount: groupOptimization.transferCount,
      groupSavingsPercentage: groupOptimization.savingsPercentage
    };
    
  } catch (error) {
    console.error('Error calculating optimized group balances:', error);
    throw error;
  }
};

module.exports = { 
  calculateOptimizedBalances,
  calculateOptimizedGroupBalances,
  getGroupOptimizedTransfers,
  calculateNetBalances,
  optimizeTransfers
};
