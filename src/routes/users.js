const express = require('express');
const User = require('../models/User');
const Group = require('../models/Group');
const { authMiddleware } = require('../utils/auth');
const s3Service = require('../utils/gcs');

const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json(req.user.toJSON());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    
    // Update basic fields if provided
    if (name !== undefined) req.user.name = name;
    if (phone !== undefined) req.user.phone = phone;
    
    // Handle avatar upload to S3 if provided
    if (avatar !== undefined) {
      if (avatar === null || avatar === '') {
        // Remove avatar
        if (req.user.avatarUrl && req.user.avatarUrl.includes(process.env.PHOTOS_BASE_URL)) {
          console.log('Deleting old avatar:', req.user.avatarUrl);
          await s3Service.deleteUserAvatar(req.user.avatarUrl);
        }
        req.user.avatarUrl = null;
        // Clear legacy avatar field if it exists
        if (req.user.avatar) {
          delete req.user.avatar;
        }
      } else {
        // Validate and upload new avatar
        const validation = s3Service.validateImage(avatar);
        if (!validation.isValid) {
          console.log('Avatar validation failed:', validation.error);
          return res.status(400).json({ 
            error: `Invalid avatar image: ${validation.error}` 
          });
        }

        console.log('Avatar validation passed, size:', Math.round(validation.sizeInBytes / 1024), 'KB');
        
        try {
          // Delete old avatar if it exists
          if (req.user.avatarUrl && req.user.avatarUrl.includes(process.env.PHOTOS_BASE_URL)) {
            console.log('Deleting old avatar:', req.user.avatarUrl);
            await s3Service.deleteUserAvatar(req.user.avatarUrl);
          }

          // Upload new avatar to S3
          console.log('Uploading avatar to S3...');
          const avatarUrl = await s3Service.uploadUserAvatar(
            avatar, 
            req.user.id, 
            validation.contentType
          );
          console.log('Avatar uploaded successfully:', avatarUrl);

          // Update user with new avatar URL (not base64 data)
          req.user.avatarUrl = avatarUrl;
          // Remove old avatar field if it exists
          if (req.user.avatar) {
            delete req.user.avatar;
          }

        } catch (uploadError) {
          console.error('Error uploading avatar to S3:', uploadError);
          return res.status(500).json({ 
            error: 'Failed to upload avatar. Please try again.' 
          });
        }
      }
    }
    
    // Update timestamp
    req.user.updatedAt = new Date().toISOString();
    
    await req.user.save();

    res.json({
      message: 'Profile updated successfully',
      user: req.user.toJSON()
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(400).json({ error: error.message });
  }
});

// Search users by name (partial) or email (exact).
// Must be registered before '/:id' or Express treats "search" as an id.
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    if (q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const users = await User.search(q, req.user.id);
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// People the current user shares at least one group with, most shared first
router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.findByUserId(req.user.id);

    const sharedCounts = new Map();
    for (const group of groups) {
      for (const member of group.members) {
        const memberId = typeof member === 'object' ? member.user : member;
        if (memberId && memberId !== req.user.id) {
          sharedCounts.set(memberId, (sharedCounts.get(memberId) || 0) + 1);
        }
      }
    }

    const users = await Promise.all([...sharedCounts.keys()].map(id => User.findById(id)));
    const contacts = users
      .filter(Boolean)
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        avatar: user.avatar,
        sharedGroups: sharedCounts.get(user.id)
      }))
      .sort((a, b) => b.sharedGroups - a.sharedGroups || (a.name || '').localeCompare(b.name || ''));

    res.json(contacts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
