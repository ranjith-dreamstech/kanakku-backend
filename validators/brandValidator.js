const { body, validationResult } = require('express-validator');
const Brand = require('../models/Brand');

exports.createBrandValidator = [
    // --- Validation for brand_name ---
    body('brand_name') // <--- CORRECTED: This should target 'brand_name'
        .notEmpty().withMessage('Brand name is required')
        .isLength({ min: 3 }).withMessage('Brand name must be at least 3 characters')
        .custom(async (value) => {
            const existing = await Brand.findOne({ brand_name: { $regex: `^${value}$`, $options: 'i' } });
            if (existing) {
                throw new Error('Brand name already exists');
            }
            return true;
        }),

    body('brand_image').custom((value, { req }) => {
        if (!req.file) { // Check if Multer has added a file to the request
            throw new Error('Brand image is required');
        }
        // You can add more checks here for file type, size, etc., if needed
        return true;
    }),

    //handle errors
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = {};
            errors.array().forEach((err) => {
                // For simplicity, let's ensure we assign to a path
                const path = err.path || 'general'; // Use 'general' or 'file' if path is missing
                if (!formattedErrors[path]) {
                    formattedErrors[path] = "";
                }
                formattedErrors[path] = err.msg;
            });
            return res.status(422).json({
                'message': 'Validation failed',
                'errors': formattedErrors
            });
        }
        next();
    }
];

// Your updateBrandValidator seems mostly correct for its logic,
// assuming 'brand_name' and 'brand_image' are sent in req.body.
// For brand_image, if it's an uploaded file, you'd again check req.file for its presence.

exports.updateBrandValidator = [
    // Brand image - optional
    body('brand_image').optional().custom((value, { req }) => {
        // If 'brand_image' field is present in body (could be a path or URL),
        // or if a new file is uploaded via Multer (req.file)
        if (value === '' && !req.file) { // Check if an empty string was sent AND no file uploaded
            throw new Error('Brand image cannot be empty if provided');
        }
        // You might want more specific checks for req.file if a new image is uploaded
        return true;
    }),

    // Brand name - optional, validate if provided
    body('brand_name')
        .optional()
        .isLength({ min: 3 }).withMessage('Brand name must be at least 3 characters')
        .custom(async (value, { req }) => {
            const existing = await Brand.findOne({
                brand_name: { $regex: `^${value}$`, $options: 'i' },
                _id: { $ne: req.params.id } // Exclude current brand from check
            });
            if (existing) {
                throw new Error('Brand name already exists');
            }
            return true;
        }),
    //handle errors
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = {};
            errors.array().forEach((err) => {
                const path = err.path || 'general';
                if (!formattedErrors[path]) {
                    formattedErrors[path] = "";
                }
                formattedErrors[path] = err.msg;
            });
            return res.status(422).json({
                'message': 'Validation failed',
                'errors': formattedErrors
            });
        }
        next();
    }
];