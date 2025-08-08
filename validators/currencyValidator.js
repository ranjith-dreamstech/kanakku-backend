const { body } = require("express-validator");

exports.createCurrencyValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Currency name is required")
        .isLength({ min: 2 })
        .withMessage("Currency name must be at least 2 characters")
        .isLength({ max: 50 })
        .withMessage("Currency name cannot exceed 50 characters"),
    
    body("code")
        .trim()
        .notEmpty()
        .withMessage("Currency code is required")
        .isLength({ min: 3, max: 3 })
        .withMessage("Currency code must be exactly 3 characters")
        .isUppercase()
        .withMessage("Currency code must be uppercase"),
        
    body("symbol")
        .trim()
        .notEmpty()
        .withMessage("Currency symbol is required")
        .isLength({ max: 5 })
        .withMessage("Currency symbol cannot exceed 5 characters"),
        
    body("isDefault")
        .optional()
        .isBoolean()
        .withMessage("isDefault must be a boolean value"),
        
    body("status")
        .optional()
        .isBoolean()
        .withMessage("status must be a boolean value")
];