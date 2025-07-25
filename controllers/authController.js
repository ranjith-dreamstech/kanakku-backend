// controllers/authController.js
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const validationResult = require('express-validator').validationResult;

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map(err => err.msg),
    });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    gender,
    dateOfBirth,
    password,
  } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({
        firstName,
        lastName,
        email,
        phone,
        gender,
        dateOfBirth,
        password,
    });

    res.status(201).json({
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map(err => err.msg),
    });
  }
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      message: 'Login successful',
      token: generateToken(user._id),
      user : user,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout (just clear token client-side, nothing needed here)
exports.logout = (req, res) => {
  res.json({ message: 'Logout successful (handled client-side)' });
};
