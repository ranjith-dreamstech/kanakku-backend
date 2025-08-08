const { body, validationResult } = require('express-validator');
const Currency = require('@models/Currency'); // Make sure to import your Currency model

exports.createCurrencyValidator = [
    // --- Validation for name ---
    body('name')
        .trim()
        .notEmpty().withMessage('Currency name is required')
        .isLength({ min: 2 }).withMessage('Currency name must be at least 2 characters')
        .isLength({ max: 50 }).withMessage('Currency name cannot exceed 50 characters')
        .custom(async (value) => {
            const existing = await Currency.findOne({ 
                name: { $regex: `^${value}$`, $options: 'i' },
                isDeleted: false
            });
            if (existing) {
                throw new Error('Currency name already exists');
            }
            return true;
        }),

    // --- Validation for code ---
    body('code')
        .trim()
        .notEmpty().withMessage('Currency code is required')
        .isLength({ min: 3, max: 3 }).withMessage('Currency code must be exactly 3 characters')
        .isUppercase().withMessage('Currency code must be uppercase')
        .custom(async (value) => {
            const existing = await Currency.findOne({ 
                code: { $regex: `^${value}$`, $options: 'i' },
                isDeleted: false
            });
            if (existing) {
                throw new Error('Currency code already exists');
            }
            return true;
        }),

    // --- Validation for symbol ---
    body('symbol')
        .trim()
        .notEmpty().withMessage('Currency symbol is required')
        .isLength({ max: 5 }).withMessage('Currency symbol cannot exceed 5 characters'),

    // --- Validation for isDefault ---
    body('isDefault')
        .optional()
        .isBoolean().withMessage('isDefault must be a boolean value'),

    // --- Validation for status ---
    body('status')
        .optional()
        .isBoolean().withMessage('status must be a boolean value'),

    // --- Error handling middleware ---
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = {};
            errors.array().forEach((err) => {
                const path = err.path || 'general';
                // Only keep the first error for each field
                if (!formattedErrors[path]) {
                    formattedErrors[path] = err.msg;
                }
            });
            return res.status(422).json({
                success: false,
                message: 'Validation failed',
                errors: formattedErrors
            });
        }
        next();
    }
];