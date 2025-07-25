const { body } = require('express-validator');

exports.registerValidator = [
  // First Name
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .isAlpha().withMessage('First name must contain only letters')
    .isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),

  // Last Name
  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .isAlpha().withMessage('Last name must contain only letters')
    .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),

  // Email
  body('email') 
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email'),

  // Phone (optional)
  body('phone')
    .optional()
    .isMobilePhone().withMessage('Invalid phone number'),

  // Gender
  body('gender')
    .notEmpty().withMessage('Gender is required')
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),

  // Date of Birth (optional, but validate format if provided)
  body('dateOfBirth')
    .optional()
    .isISO8601().withMessage('Date of Birth must be a valid date'),

  // Password
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  // Confirm Password
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

exports.loginValidator = [
  // Email
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email'),

  // Password
  body('password')
    .notEmpty().withMessage('Password is required')
    .isString().withMessage('Password must be a string'),
];
