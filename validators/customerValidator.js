// customerValidator.js
const { body, validationResult } = require("express-validator");
const fs = require('fs');
const path = require('path');

exports.createCustomerValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Customer name is required")
        .isLength({ min: 2 })
        .withMessage("Customer name must be at least 2 characters")
        .isLength({ max: 100 })
        .withMessage("Customer name cannot exceed 100 characters"),
        
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please provide a valid email address"),
        
    body("phone")
        .optional()
        .trim()
        .isMobilePhone()
        .withMessage("Please provide a valid phone number"),
        
    body("website")
        .optional()
        .trim()
        .isURL()
        .withMessage("Please provide a valid website URL"),
        
    body("status")
        .optional()
        .isIn(['Active', 'Inactive'])
        .withMessage("Status must be either Active or Inactive"),
        
    body("billingAddress")
        .optional()
        .isObject()
        .withMessage("Billing address must be an object"),
        
    body("shippingAddress")
        .optional()
        .isObject()
        .withMessage("Shipping address must be an object"),
        
    body("bankDetails")
        .optional()
        .isObject()
        .withMessage("Bank details must be an object"),

    (req, res, next) => {
        // Handle image validation if file is uploaded
        if (req.file) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(req.file.mimetype)) {
                fs.unlinkSync(req.file.path);
                return res.status(422).json({
                    message: 'Validation failed',
                    errors: { image: 'Only JPEG, PNG, and GIF images are allowed' }
                });
            }

            if (req.file.size > 2 * 1024 * 1024) {
                fs.unlinkSync(req.file.path);
                return res.status(422).json({
                    message: 'Validation failed',
                    errors: { image: 'Image size must be less than 2MB' }
                });
            }
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Clean up uploaded file if validation fails
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            
            const formattedErrors = {};
            errors.array().forEach((err) => {
                if(!formattedErrors[err.path]){
                    formattedErrors[err.path] = err.msg;
                }
            });
            
            return res.status(422).json({ 
                message: 'Validation failed',
                errors: formattedErrors
            });
        }
        next();
    },
];