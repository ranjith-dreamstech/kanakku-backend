const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');
const User = require("@models/User");

exports.createBankDetailValidator = [
    body("accountHoldername")
        .trim()
        .notEmpty()
        .withMessage("Account holder name is required")
        .isLength({ min: 2 })
        .withMessage("Account holder name must be at least 2 characters")
        .isLength({ max: 100 })
        .withMessage("Account holder name cannot exceed 100 characters"),

    body("bankName")
        .trim()
        .notEmpty()
        .withMessage("Bank name is required")
        .isLength({ min: 2 })
        .withMessage("Bank name must be at least 2 characters")
        .isLength({ max: 100 })
        .withMessage("Bank name cannot exceed 100 characters"),

    body("branchName")
        .trim()
        .notEmpty()
        .withMessage("Branch name is required")
        .isLength({ min: 2 })
        .withMessage("Branch name must be at least 2 characters")
        .isLength({ max: 100 })
        .withMessage("Branch name cannot exceed 100 characters"),

    body("accountNumber")
        .trim()
        .notEmpty()
        .withMessage("Account number is required")
        .isLength({ min: 5 })
        .withMessage("Account number must be at least 5 characters")
        .isLength({ max: 20 })
        .withMessage("Account number cannot exceed 20 characters"),

    body("IFSCCode")
        .trim()
        .notEmpty()
        .withMessage("IFSC code is required")
        .isLength({ min: 5 })
        .withMessage("IFSC code must be at least 5 characters")
        .isLength({ max: 20 })
        .withMessage("IFSC code cannot exceed 20 characters"),

    body("userId")
        .notEmpty()
        .withMessage("User ID is required")
        .custom(async (value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error("Invalid user ID format");
            }
            const user = await User.findById(value);
            if (!user) {
                throw new Error("User not found");
            }
            return true;
        }),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = {};
            errors.array().forEach((err) => {
                if(!formattedErrors[err.path]){
                    formattedErrors[err.path] = err.msg;
                }
            });
            return res.status(422).json({ 
                'message': 'Validation failed',
                'errors': formattedErrors
             });
        }
        next();
    },
];