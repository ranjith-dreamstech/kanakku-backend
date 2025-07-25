const { body, param, validationResult } = require('express-validator');
const Product = require('../models/Product'); // Assuming this path is correct

// Shared validation rules for product
const productValidationRules = () => [
    body('item_type')
        .notEmpty().withMessage('Item type is required')
        .isIn(['Product', 'Service']).withMessage('Invalid item type'),
    body('name')
        .notEmpty().withMessage('Product name is required')
        .isLength({ min: 2 }).withMessage('Product name must be at least 2 characters')
        .isLength({ max: 50 }).withMessage('Product name cannot exceed 50 characters'),
    body('code')
        .notEmpty().withMessage('Product code is required'),
    body('category')
        .notEmpty().withMessage('Category is required'),
    body('brand')
        .notEmpty().withMessage('Brand is required'),
    body('unit')
        .notEmpty().withMessage('Unit is required'),
    body('selling_price')
        .notEmpty().withMessage('Selling price is required')
        .isFloat({ gt: 0 }).withMessage('Selling price must be greater than 0'),
    body('purchase_price')
        .notEmpty().withMessage('Purchase price is required')
        .isFloat({ gt: 0 }).withMessage('Purchase price must be greater than 0'),
    body('selling_price').custom((value, { req }) => {
        const sellingPrice = parseFloat(value);
        const purchasePrice = parseFloat(req.body.purchase_price);
        if (isNaN(sellingPrice) || isNaN(purchasePrice)) {
            throw new Error('Selling price and purchase price must be valid numbers.');
        }
        if (sellingPrice <= purchasePrice) {
            throw new Error('Selling price must be greater than purchase price');
        }
        return true;
    }),
    body('discount_type')
        .notEmpty().withMessage('Discount type is required')
        .isIn(['Percentage', 'Fixed']).withMessage('Invalid discount type'),
    body('discount_value')
        .notEmpty().withMessage('Discount value is required')
        .isFloat({ min: 0 }).withMessage('Discount value must be a non-negative number'),
    body('tax')
        .notEmpty().withMessage('Tax group is required'),
    body('barcode')
        .notEmpty().withMessage('Barcode is required'),
    body('alert_quantity')
        .notEmpty().withMessage('Alert quantity is required')
        .isInt({ min: 0 }).withMessage('Alert quantity must be a non-negative integer'),
    body('description')
        .notEmpty().withMessage('Product description is required')
        .isLength({ max: 500 }).withMessage('Product description cannot exceed 500 characters')
];

// Reusable error handling logic as a function
const commonErrorHandler = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = {};
        errors.array().forEach((err) => {
            const path = err.path || err.param || 'general';
            formattedErrors[path] = err.msg;
        });
        return res.status(422).json({
            message: 'Validation failed',
            errors: formattedErrors
        });
    }
    next();
};

// Validator for creating a product
const createProductValidator = [
    ...productValidationRules(),
    // Unique checks for name, code, barcode
    body('name').custom(async (value) => {
        const existing = await Product.findOne({ name: value });
        if (existing) throw new Error('Product name already exists');
        return true;
    }),
    body('code').custom(async (value) => {
        const existing = await Product.findOne({ code: value });
        if (existing) throw new Error('Product code already exists');
        return true;
    }),
    body('barcode').custom(async (value) => {
        const existing = await Product.findOne({ barcode: value });
        if (existing) throw new Error('Barcode already exists');
        return true;
    }),

    // Validation for REQUIRED single product image
    body('product_image').custom((value, { req }) => {
        // This check correctly uses req.files which is populated by multer.fields()
        // req.files.product_image will be an array of file objects
        if (!req.files || !req.files.product_image || req.files.product_image.length === 0) {
            throw new Error('Product image is required.');
        }
        return true;
    }),
    commonErrorHandler
];

// Validator for updating a product
const updateProductValidator = [
    ...productValidationRules(),
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('name').custom(async (value, { req }) => {
        const existing = await Product.findOne({ name: value, _id: { $ne: req.params.id } });
        if (existing) throw new Error('Product name already exists');
        return true;
    }),
    body('code').custom(async (value, { req }) => {
        const existing = await Product.findOne({ code: value, _id: { $ne: req.params.id } });
        if (existing) throw new Error('Product code already exists');
        return true;
    }),
    body('barcode').custom(async (value, { req }) => {
        const existing = await Product.findOne({ barcode: value, _id: { $ne: req.params.id } });
        if (existing) throw new Error('Barcode already exists');
        return true;
    }),
    commonErrorHandler
];

module.exports = {
    createProductValidator,
    updateProductValidator
};