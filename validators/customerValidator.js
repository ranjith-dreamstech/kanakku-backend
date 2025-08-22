// validators/customerValidator.js
const { body, validationResult } = require("express-validator");
const fs = require('fs');

exports.createCustomerValidator = [
  body("name")
    .trim()
    .notEmpty().withMessage("Customer name is required")
    .isLength({ min: 2 }).withMessage("Customer name must be at least 2 characters")
    .isLength({ max: 100 }).withMessage("Customer name cannot exceed 100 characters"),
    
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please provide a valid email address"),
    
  body("phone")
    .optional()
    .trim()
    .matches(/^[\d\s+-]+$/).withMessage("Please provide a valid phone number"),
    
  body("status")
    .optional()
    .isIn(['Active', 'Inactive']).withMessage("Status must be either Active or Inactive"),
    
  body("billingAddress")
    .optional()
    .custom(value => {
      try {
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }
        return typeof value === 'object' && !Array.isArray(value);
      } catch {
        return false;
      }
    }).withMessage("Billing address must be a valid object"),
    
  body("shippingAddress")
    .optional()
    .custom(value => {
      try {
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }
        return typeof value === 'object' && !Array.isArray(value);
      } catch {
        return false;
      }
    }).withMessage("Shipping address must be a valid object"),
    
  body("bankDetails")
    .optional()
    .custom(value => {
      try {
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }
        return typeof value === 'object' && !Array.isArray(value);
      } catch {
        return false;
      }
    }).withMessage("Bank details must be a valid object"),

  body("profile_image_removed")
    .optional()
    .isBoolean().withMessage("profile_image_removed must be a boolean"),

  (req, res, next) => {
    // Handle image validation if file is uploaded
    if (req.file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: { image: 'Only JPEG, PNG, and GIF images are allowed' }
        });
      }

      if (req.file.size > 2 * 1024 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: { image: 'Image size must be less than 2MB' }
        });
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      
      const formattedErrors = {};
      errors.array().forEach((err) => {
        if (!formattedErrors[err.path]) {
          formattedErrors[err.path] = err.msg;
        }
      });
      
      return res.status(422).json({ 
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
    }
    
    // Parse JSON strings for addresses if needed
    ['billingAddress', 'shippingAddress', 'bankDetails'].forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (err) {
          // Error will be caught by the validator
        }
      }
    });
    
    next();
  }
];