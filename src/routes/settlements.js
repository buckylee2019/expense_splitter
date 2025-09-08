const express = require('express');
const Settlement = require('../models/Settlement');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Group = require('../models/Group');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

// Get user's settlements
router.get('/', authMiddleware, async (req, res) => {
  try {
    const settlements = await Settlement.findByUserId(req.user.id);
    res.json(settlements);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create new settlement
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      fromUserId, // Optional: for third-party settlements
      toUserId,
      amount,
      currency,
      groupId,
      method,
      notes
    } = req.body;

    // Validate required fields
    if (!toUserId || !amount || !groupId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Determine who is making the payment
    // If fromUserId is provided, use it (third-party settlement)
    // Otherwise, use the current user's ID (normal settlement)
    const fromUser = fromUserId || req.user.id;
    
    // Verify that both users are members of the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const isFromUserInGroup = group.members.some(m => m.user === fromUser);
    const isToUserInGroup = group.members.some(m => m.user === toUserId);
    
    if (!isFromUserInGroup || !isToUserInGroup) {
      return res.status(400).json({ error: 'Both users must be members of the group' });
    }
    
    // Verify that the current user is a member of the group
    const isCurrentUserInGroup = group.members.some(m => m.user === req.user.id);
    if (!isCurrentUserInGroup) {
      return res.status(403).json({ error: 'You must be a member of the group to record settlements' });
    }

    const settlement = await Settlement.create({
      from: fromUser,
      to: toUserId,
      amount: parseFloat(amount),
      currency,
      group: groupId,
      method,
      notes,
      settledAt: new Date().toISOString(),
      recordedBy: req.user.id // Track who recorded the settlement
    });

    res.status(201).json({
      message: 'Settlement recorded successfully',
      settlement
    });
  } catch (error) {
    console.error('Settlement creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create multi-group settlement
router.post('/multi-group', authMiddleware, async (req, res) => {
  try {
    const {
      fromUserId,
      toUserId,
      amount,
      method,
      notes,
      currencies
    } = req.body;

    console.log('Multi-group settlement request:', { fromUserId, toUserId, amount, method, currencies });

    // Validate required fields
    if (!fromUserId || !toUserId || !amount || !currencies || !Array.isArray(currencies)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Ensure the current user is either the payer or payee
    if (req.user.id !== fromUserId && req.user.id !== toUserId) {
      return res.status(403).json({ error: 'You can only record settlements you are involved in' });
    }

    const createdSettlements = [];
    
    console.log(`Processing multi-group settlement from ${fromUserId} to ${toUserId}`);
    
    // Import Group model inside function to avoid circular dependency
    const Group = require('../models/Group');
    
    // Get all groups where both users are members
    const groups = await Group.findByUserId(req.user.id);
    console.log(`Found ${groups.length} groups for current user`);
    
    const relevantGroups = [];
    
    for (const group of groups) {
      const isFromUserInGroup = group.members.some(m => m.user === fromUserId);
      const isToUserInGroup = group.members.some(m => m.user === toUserId);
      
      if (!isFromUserInGroup || !isToUserInGroup) {
        console.log(`Skipping group ${group.name} - one or both users not members`);
        continue;
      }
      
      console.log(`Processing group ${group.name} (${group.id})`);
      
      try {
        // Calculate current balances for this group from the perspective of the current user
        const balanceService = require('../services/balanceService');
        const groupBalances = await balanceService.calculateBalances(req.user.id, group.id);
        
        console.log(`Group ${group.name} balances:`, groupBalances);
        
        // Find the balance between current user and the other user
        const otherUserId = req.user.id === fromUserId ? toUserId : fromUserId;
        const relevantBalance = groupBalances.find(balance => 
          balance.user.id === otherUserId
        );
        
        console.log(`Relevant balance for ${otherUserId} in group ${group.name}:`, relevantBalance);
        
        if (relevantBalance && Math.abs(relevantBalance.amount) > 0.01) {
          relevantGroups.push({
            group,
            balance: relevantBalance
          });
        }
      } catch (groupError) {
        console.error(`Error processing group ${group.name}:`, groupError);
        // Continue with other groups even if one fails
      }
    }
    
    console.log(`Found ${relevantGroups.length} relevant groups with outstanding balances`);
    
    if (relevantGroups.length === 0) {
      return res.status(400).json({ error: 'No outstanding balances found between users' });
    }
    
    // Calculate total outstanding amount across all groups
    const totalOutstanding = relevantGroups.reduce((sum, item) => sum + Math.abs(item.balance.amount), 0);
    console.log(`Total outstanding amount: ${totalOutstanding}`);
    
    // Distribute the settlement amount proportionally across groups
    for (const { group, balance } of relevantGroups) {
      const groupProportion = Math.abs(balance.amount) / totalOutstanding;
      const groupSettlementAmount = parseFloat(amount) * groupProportion;
      
      console.log(`Group ${group.name}: proportion ${groupProportion}, amount ${groupSettlementAmount}`);
      
      if (groupSettlementAmount > 0.01) { // Only create settlement if amount is significant
        // Use the explicit from/to user IDs provided by the frontend
        console.log(`Creating settlement: ${fromUserId} -> ${toUserId}, amount: ${groupSettlementAmount}`);
        
        const settlement = await Settlement.create({
          from: fromUserId,
          to: toUserId,
          amount: Math.round(groupSettlementAmount * 100) / 100, // Round to 2 decimal places
          currency: balance.currency || 'TWD',
          group: group.id,
          method,
          notes: `${notes} (Multi-group settlement - ${group.name})`,
          settledAt: new Date().toISOString(),
          recordedBy: req.user.id,
          isMultiGroupSettlement: true
        });
        
        createdSettlements.push({
          settlement,
          groupName: group.name,
          proportion: groupProportion
        });
      }
    }
    
    console.log(`Created ${createdSettlements.length} settlements`);
    
    res.status(201).json({
      message: `Multi-group settlement recorded successfully across ${createdSettlements.length} groups`,
      settlements: createdSettlements,
      totalAmount: parseFloat(amount)
    });
  } catch (error) {
    console.error('Multi-group settlement creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update settlement
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id);
    
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    // Check if user recorded this settlement
    if (settlement.recordedBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit settlements you recorded' });
    }

    const { amount, method, notes } = req.body;
    
    if (amount !== undefined) {
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
      settlement.amount = parseFloat(amount);
    }
    
    if (method !== undefined) settlement.method = method;
    if (notes !== undefined) settlement.notes = notes;
    
    await settlement.update();

    res.json({
      message: 'Settlement updated successfully',
      settlement
    });
  } catch (error) {
    console.error('Error updating settlement:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete settlement
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id);
    
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    // Check if user is involved in this settlement (either from or to)
    if (settlement.from !== req.user.id && settlement.to !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete settlements you are involved in' });
    }

    await settlement.delete();

    res.json({
      message: 'Settlement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting settlement:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
