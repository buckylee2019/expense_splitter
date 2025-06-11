const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

// Get user's groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.findByUserId(req.user.id);
    res.json(groups);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create new group
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;

    const group = await Group.create({
      name,
      description,
      members: [{
        user: req.user.id,
        role: 'admin',
        joinedAt: new Date().toISOString()
      }],
      createdBy: req.user.id
    });

    res.status(201).json({
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get group details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findByUserIdAndGroupId(req.user.id, req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add member to group
router.post('/:id/members', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user.id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const userToAdd = await User.findByEmail(email);
    if (!userToAdd) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already a member
    const isAlreadyMember = group.members.some(
      member => member.user === userToAdd.id
    );

    if (isAlreadyMember) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    group.addMember(userToAdd.id, 'member');
    await group.save();

    res.json({
      message: 'Member added successfully',
      group
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get group expenses
router.get('/:id/expenses', authMiddleware, async (req, res) => {
  try {
    console.log('Getting expenses for group:', req.params.id);
    
    const group = await Group.findByUserIdAndGroupId(req.user.id, req.params.id);

    if (!group) {
      console.log('Group not found for user:', req.user.id, 'group:', req.params.id);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log('Group found, fetching expenses...');
    const expenses = await Expense.findByGroupId(req.params.id);
    console.log('Found', expenses.length, 'expenses for group', req.params.id);
    
    res.json(expenses);
  } catch (error) {
    console.error('Error getting group expenses:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
