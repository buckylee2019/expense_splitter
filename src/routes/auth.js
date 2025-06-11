const express = require('express');
const User = require('../models/User');
const { generateToken } = require('../utils/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt:', { body: req.body });
    console.log('Environment variables:', {
      AWS_REGION: process.env.AWS_REGION,
      USERS_TABLE_NAME: process.env.USERS_TABLE_NAME,
      NODE_ENV: process.env.NODE_ENV
    });
    
    const { name, email, password } = req.body;

    // Check if user exists
    console.log('Checking if user exists:', email);
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    console.log('Creating new user:', { name, email });
    const user = await User.create({ name, email, password });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
