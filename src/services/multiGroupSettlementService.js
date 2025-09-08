const Settlement = require('../models/Settlement');
const { calculateBalances } = require('./balanceService');
const Group = require('../models/Group');

const createMultiGroupSettlement = async (fromUserId, toUserId, totalAmount, currency = 'TWD', method = 'cash', notes = '') => {
  try {
    // Get all groups where both users are members
    const fromUserGroups = await Group.findByUserId(fromUserId);
    const toUserGroups = await Group.findByUserId(toUserId);
    
    const sharedGroups = fromUserGroups.filter(fromGroup => 
      toUserGroups.some(toGroup => toGroup.id === fromGroup.id)
    );

    if (sharedGroups.length === 0) {
      throw new Error('Users do not share any groups');
    }

    // Calculate debt in each shared group
    const groupDebts = [];
    let totalDebt = 0;

    for (const group of sharedGroups) {
      const balances = await calculateBalances(fromUserId, group.id);
      const debtToUser = balances.find(b => b.user.id === toUserId && b.type === 'you_owe');
      
      if (debtToUser && debtToUser.amount > 0) {
        groupDebts.push({
          groupId: group.id,
          groupName: group.name,
          amount: debtToUser.amount
        });
        totalDebt += debtToUser.amount;
      }
    }

    if (totalDebt === 0) {
      throw new Error('No debt found between users');
    }

    // Create separate settlement record for each group with proportional amount
    const settlements = [];
    const settlementDate = new Date().toISOString();

    for (const groupDebt of groupDebts) {
      const proportionalAmount = (groupDebt.amount / totalDebt) * totalAmount;
      
      const settlement = await Settlement.create({
        from: fromUserId,
        to: toUserId,
        amount: proportionalAmount,
        currency: currency,
        method: method,
        group: groupDebt.groupId,
        notes: `${notes} (${proportionalAmount.toFixed(2)}/${totalAmount} of multi-group settlement)`,
        settledAt: settlementDate,
        recordedBy: fromUserId
      });
      
      settlements.push({
        ...settlement,
        groupName: groupDebt.groupName,
        originalDebt: groupDebt.amount
      });
    }

    return {
      settlements,
      totalDebt,
      settledAmount: totalAmount,
      groupBreakdown: groupDebts
    };

  } catch (error) {
    console.error('Error creating multi-group settlement:', error);
    throw error;
  }
};

module.exports = { createMultiGroupSettlement };
