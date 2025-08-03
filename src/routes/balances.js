const express = require('express');
const { authMiddleware } = require('../utils/auth');
const { calculateBalances } = require('../services/balanceService');
const { calculateOptimizedBalances, calculateOptimizedGroupBalances, getGroupOptimizedTransfers } = require('../services/optimizedBalanceService');

const router = express.Router();

// Get user's balances (with option for optimized calculation)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { groupId, optimized } = req.query;
    
    if (optimized === 'true') {
      if (groupId) {
        // Use group-specific optimization
        const result = await calculateOptimizedGroupBalances(req.user.id, groupId);
        res.json(result);
      } else {
        // Use global optimization across all groups
        const result = await calculateOptimizedBalances(req.user.id, groupId);
        res.json(result);
      }
    } else {
      // Use original algorithm for backward compatibility
      const balances = await calculateBalances(req.user.id, groupId);
      
      res.json({
        balances,
        summary: {
          totalOwed: balances
            .filter(b => b.type === 'owes_you')
            .reduce((sum, b) => sum + b.amount, 0),
          totalOwing: balances
            .filter(b => b.type === 'you_owe')
            .reduce((sum, b) => sum + b.amount, 0)
        }
      });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get optimized transfers for a group (admin/overview feature)
router.get('/group/:groupId/optimized', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const result = await getGroupOptimizedTransfers(groupId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get group breakdown for a specific user balance
router.get('/breakdown/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    // Get all groups where both users are members
    const groups = await Group.findByUserId(currentUserId);
    const breakdown = [];
    
    for (const group of groups) {
      // Check if the target user is also in this group
      const isTargetUserInGroup = group.members.some(m => m.user === userId);
      if (!isTargetUserInGroup) continue;
      
      // Calculate balances for this specific group
      const groupBalances = await balanceService.calculateBalances(group.id, false);
      
      // Find the balance between current user and target user
      const relevantBalance = groupBalances.balances.find(balance => 
        balance.user.id === userId
      );
      
      if (relevantBalance && Math.abs(relevantBalance.amount) > 0.01) {
        breakdown.push({
          groupId: group.id,
          groupName: group.name,
          currencies: [{
            currency: relevantBalance.currency || 'TWD',
            amount: relevantBalance.amount,
            type: relevantBalance.type
          }]
        });
      }
    }
    
    res.json({ groups: breakdown });
  } catch (error) {
    console.error('Group breakdown error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
