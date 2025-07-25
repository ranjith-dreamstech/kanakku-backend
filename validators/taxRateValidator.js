const { body, validationResult } = require('express-validator');
const TaxRate = require('../models/TaxRate');

const createTaxRateValidator = [
    body('tax_name')
        .notEmpty().withMessage('Tax name is required')
        .isLength({ min: 2 , max: 30}).withMessage('Tax name must be between 2 and 30 characters')
        .custom(async (value) => {
            const existing = await TaxRate.findOne({ tax_name: { $regex: `^${value}$`, $options: 'i' } });
            if (existing) {
                throw new Error('Tax name already exists');
            }
            return true;
        }),

    body('tax_rate')
        .notEmpty().withMessage('Tax rate is required')
        .isFloat({ min: 1, max: 100 }).withMessage('Tax rate must be a valid number between 1 and 100'),

    body('status')
        .optional()
        .isBoolean().withMessage('Status must be true or false'),

    handleValidationErrors
];

const updateTaxRateValidator = [
    body('tax_name')
        .optional()
        .isLength({ min: 2, max: 30 }).withMessage('Tax name must be between 2 and 30 characters')
        .custom(async (value, { req }) => {
            const existing = await TaxRate.findOne({
                tax_name: { $regex: `^${value}$`, $options: 'i' },
                _id: { $ne: req.params.id } 
            });
            if (existing) {
                throw new Error('Tax name already exists');
            }
            return true;
        }),

    body('tax_rate')
        .optional()
        .isFloat({ min: 1, max: 100 }).withMessage('Tax rate must be a valid number between 1 and 100'),

    body('status')
        .optional()
        .isBoolean().withMessage('Status must be true or false'),

    handleValidationErrors
];

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = {};
        errors.array().forEach((err) => {
            const path = err.path || 'general';
            formattedErrors[path] = err.msg;
        });
        return res.status(422).json({
            message: 'Validation failed',
            errors: formattedErrors,
        });
    }
    next();
}

module.exports = {
    createTaxRateValidator,
    updateTaxRateValidator
};
