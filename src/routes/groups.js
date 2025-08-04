const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { authMiddleware } = require('../utils/auth');
const s3Service = require('../utils/s3');

const router = express.Router();

// Helper function to populate member names in groups
const populateMemberNames = async (group) => {
  const groupData = group.toJSON ? group.toJSON() : group;
  
  const populatedMembers = [];
  for (const member of groupData.members) {
    try {
      const user = await User.findById(member.user);
      populatedMembers.push({
        ...member,
        userName: user ? user.name : 'Unknown User',
        email: user ? user.email : 'Unknown Email',
        avatarUrl: user ? user.avatarUrl : null,
        avatar: user ? user.avatar : null,
        id: member.user, // Ensure we have the user ID for removal
        user: member.user // Keep original user field
      });
    } catch (error) {
      populatedMembers.push({
        ...member,
        userName: 'Unknown User',
        email: 'Unknown Email',
        avatarUrl: null,
        avatar: null,
        id: member.user,
        user: member.user
      });
    }
  }
  
  return {
    ...groupData,
    members: populatedMembers
  };
};

// Get user's groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.findByUserId(req.user.id);
    
    // Add expense count to each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const expenses = await Expense.findByGroupId(group.id);
        return {
          ...group,
          expenseCount: expenses.length
        };
      })
    );
    
    res.json(groupsWithCounts);
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

    // Populate member names
    const populatedGroup = await populateMemberNames(group);

    res.json(populatedGroup);
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

// Add member to group
router.post('/:id/members', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find the group
    const group = await Group.findByUserIdAndGroupId(req.user.id, req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found or user not a member' });
    }

    // Check if user is admin of the group
    if (!group.isAdmin(req.user.id)) {
      return res.status(403).json({ error: 'Only group admins can add members' });
    }

    // Find the user to add
    const userToAdd = await User.findByEmail(email);
    if (!userToAdd) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    // Check if user is already a member
    const isAlreadyMember = group.members.some(member => member.user === userToAdd.id);
    if (isAlreadyMember) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    // Add the user to the group
    const updatedGroup = await Group.addMember(req.params.id, {
      user: userToAdd.id,
      role: 'member',
      joinedAt: new Date().toISOString()
    });

    // Populate member names
    const populatedGroup = await populateMemberNames(updatedGroup);

    res.json({
      message: 'Member added successfully',
      group: populatedGroup
    });
  } catch (error) {
    console.error('Error adding member to group:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete group
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findByUserIdAndGroupId(req.user.id, req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found or user not a member' });
    }

    // Check if user is admin of the group
    if (!group.isAdmin(req.user.id)) {
      return res.status(403).json({ error: 'Only group admins can delete the group' });
    }

    // Check if group has expenses
    const expenses = await Expense.findByGroupId(req.params.id);
    if (expenses.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete group with existing expenses. Please delete all expenses first.',
        expenseCount: expenses.length
      });
    }

    // Delete the group
    await Group.delete(req.params.id);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
// Update group
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user.id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Update group details
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    
    await group.save();

    res.json({
      message: 'Group updated successfully',
      group
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete group
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user.id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if group has expenses
    const expenses = await Expense.findByGroupId(req.params.id);
    if (expenses.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete group with existing expenses. Please delete all expenses first.' 
      });
    }

    await group.delete();

    res.json({
      message: 'Group deleted successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove member from group
router.delete('/:id/members/:memberId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user.id)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Cannot remove the last admin
    const admins = group.members.filter(member => member.role === 'admin');
    const memberToRemove = group.members.find(member => member.user === req.params.memberId);
    
    if (memberToRemove && memberToRemove.role === 'admin' && admins.length === 1) {
      return res.status(400).json({ error: 'Cannot remove the last admin from the group' });
    }

    group.removeMember(req.params.memberId);
    await group.save();

    res.json({
      message: 'Member removed successfully',
      group
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update group photo
router.put('/:id/photo', authMiddleware, async (req, res) => {
  try {
    console.log('Photo upload request received for group:', req.params.id);
    console.log('Request user:', req.user?.id);
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      console.log('Group not found:', req.params.id);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log('Group found:', group.id, 'Members:', group.members?.length);

    // Check if user is admin
    if (!group.isAdmin(req.user.id)) {
      console.log('User not admin:', req.user.id, 'Group members:', group.members);
      return res.status(403).json({ error: 'Insufficient permissions. Only group admins can update photos.' });
    }

    const { photo } = req.body;
    console.log('Photo data received, length:', photo ? photo.length : 'null');
    
    if (!photo) {
      console.log('No photo data provided');
      return res.status(400).json({ error: 'No photo data provided' });
    }
    
    // Validate image using S3 service
    const validation = s3Service.validateImage(photo);
    if (!validation.isValid) {
      console.log('Photo validation failed:', validation.error);
      return res.status(400).json({ 
        error: 'Invalid image',
        details: validation.error
      });
    }

    console.log('Photo validation passed, size:', Math.round(validation.sizeInBytes / 1024), 'KB');
    
    try {
      // Delete old photo if it exists
      if (group.photoUrl && group.photoUrl.includes(process.env.PHOTOS_CLOUDFRONT_DOMAIN)) {
        console.log('Deleting old photo:', group.photoUrl);
        await s3Service.deleteGroupPhoto(group.photoUrl);
      }

      // Upload new photo to S3
      console.log('Uploading photo to S3...');
      const photoUrl = await s3Service.uploadGroupPhoto(
        photo, 
        group.id, 
        validation.contentType
      );
      console.log('Photo uploaded successfully:', photoUrl);

      // Update group with new photo URL (not base64 data)
      group.photoUrl = photoUrl;
      // Remove old photo field if it exists
      if (group.photo) {
        delete group.photo;
      }
      
      console.log('Saving group with photo URL...');
      await group.save();
      console.log('Group saved successfully');

      const populatedGroup = await populateMemberNames(group);
      console.log('Group populated successfully');
      
      res.json({
        message: 'Group photo updated successfully',
        group: populatedGroup,
        photoUrl: photoUrl
      });

    } catch (uploadError) {
      console.error('Error uploading photo to S3:', uploadError);
      return res.status(500).json({ 
        error: 'Failed to upload photo',
        details: uploadError.message
      });
    }

  } catch (error) {
    console.error('Error updating group photo:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'dev' ? error.stack : undefined
    });
  }
});

// Delete group photo
router.delete('/:id/photo', authMiddleware, async (req, res) => {
  try {
    console.log('Photo delete request received for group:', req.params.id);
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      console.log('Group not found:', req.params.id);
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user.id)) {
      console.log('User not admin:', req.user.id);
      return res.status(403).json({ error: 'Insufficient permissions. Only group admins can delete photos.' });
    }

    // Delete photo from S3 if it exists
    if (group.photoUrl && group.photoUrl.includes(process.env.PHOTOS_CLOUDFRONT_DOMAIN)) {
      console.log('Deleting photo from S3:', group.photoUrl);
      await s3Service.deleteGroupPhoto(group.photoUrl);
    }

    // Remove photo URL from group
    group.photoUrl = null;
    // Remove old photo field if it exists
    if (group.photo) {
      delete group.photo;
    }
    
    await group.save();
    console.log('Group photo deleted successfully');

    const populatedGroup = await populateMemberNames(group);
    
    res.json({
      message: 'Group photo deleted successfully',
      group: populatedGroup
    });

  } catch (error) {
    console.error('Error deleting group photo:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});
