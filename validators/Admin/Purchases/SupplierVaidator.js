const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');
const Supplier = require("@models/Supplier");
const User = require("@models/User");

// Validation middleware
exports.createSupplierValidator = [
    body("supplier_name")
        .trim()
        .notEmpty()
        .withMessage("Supplier name is required")
        .isLength({ min: 2 })
        .withMessage("Supplier name must be at least 2 characters")
        .isLength({ max: 50 })
        .withMessage("Supplier name cannot exceed 50 characters"),

    body("supplier_email")
        .trim()
        .notEmpty()
        .withMessage("Supplier email is required")
        .isEmail()
        .withMessage("Invalid email address")
        .custom(async (value) => {
            const existingUser = await User.findOne({ email: value });
            if (existingUser) {
                throw new Error("Supplier email already exists");
            }
            return true;
        }),
    
    body("supplier_phone")
        .trim()
        .notEmpty()
        .withMessage("Supplier phone is required")
        .isMobilePhone("any")
        .withMessage("Invalid phone number"),

    body("balance")
        .trim()
        .optional()
        .isNumeric()
        .withMessage("Balance must be a valid number")
        .custom((value, { req }) => {
            if (value == 0) {
                req.body.balance_type = null;
            }
            return true;
        }),
        
    body("balance_type")
        .trim()
        .optional()
        .custom((value, { req }) => {
            if (req.body.balance && req.body.balance != 0) {
                if (!['credit', 'debit'].includes(value)) {
                    throw new Error("Balance type must be either 'credit' or 'debit'");
                }
            }
            return true;
        }),
        
    body("password")
        .optional()
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = {};
            errors.array().forEach((err) => {
                if(!formattedErrors[err.path]){
                    formattedErrors[err.path] = err.msg;
                }
            })
            return res.status(422).json({ 
                'message': 'Validation failed',
                'errors': formattedErrors
             });
        }
        next();
    },
];