const { body, validationResult } = require('express-validator');
const TaxGroup = require('../models/TaxGroup');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = {};
        errors.array().forEach((err) => {
            const path = err.path || 'general';
            formattedErrors[path] = err.msg;
        });
        return res.status(422).json({
            message: 'Validation failed',
            errors: formattedErrors
        });
    }
    next();
};

const createTaxGroupValidator = [
    body('tax_name')
        .notEmpty().withMessage('Tax name is required')
        .isLength({ min: 2, max: 30 }).withMessage('Tax name must be between 2 and 30 characters')
        .custom(async (value) => {
            const existing = await TaxGroup.findOne({ tax_name: { $regex: `^${value}$`, $options: 'i' } });
            if (existing) {
                throw new Error('Tax name already exists');
            }
            return true;
        }),

    body('tax_rate_ids')
        .isArray({ min: 1 }).withMessage('At least one tax rate must be selected'),

    handleValidationErrors
];

const updateTaxGroupValidator = [
    body('tax_name')
        .optional()
        .isLength({ min: 2, max: 30 }).withMessage('Tax name must be between 2 and 30 characters')
        .custom(async (value, { req }) => {
            if (!value) return true;
            const existing = await TaxGroup.findOne({
                tax_name: { $regex: `^${value}$`, $options: 'i' },
                _id: { $ne: req.params.id }
            });
            if (existing) {
                throw new Error('Tax name already exists');
            }
            return true;
        }),

    body('tax_rate_ids')
        .optional()
        .isArray().withMessage('Tax rate IDs must be an array'),

    handleValidationErrors
];

module.exports = {
    createTaxGroupValidator,
    updateTaxGroupValidator
};
