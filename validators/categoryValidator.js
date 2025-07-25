const { body, validationResult } = require('express-validator');
const Category = require('../models/Category'); 

exports.createCategoryValidator = [
   
    body('category_name')
        .notEmpty().withMessage('Category name is required')
        .isLength({ min: 3 }).withMessage('Category name must be at least 3 characters')
        .custom(async (value) => {
            const existing = await Category.findOne({ category_name: { $regex: `^${value}$`, $options: 'i' } });
            if (existing) {
                throw new Error('Category name already exists');
            }
            return true;
        }),

    body('slug')
        .notEmpty().withMessage('Category slug is required')
        .isLength({ min: 3 }).withMessage('Category slug must be at least 3 characters')
        .custom(async (value) => {
            const existing = await Category.findOne({ slug: { $regex: `^${value}$`, $options: 'i' } });
            if (existing) {
                throw new Error('Category slug already exists');
            }
            return true;
        }),

    body('category_image').custom((value, { req }) => {
        if (!req.file) {
            throw new Error('Category image is required');
        }
        return true;
    }),

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


exports.updateCategoryValidator = [
    body('category_image').optional().custom((value, { req }) => {
        if (!req.file && value === '') {
            throw new Error('Category image cannot be empty if provided');
        }
        return true;
    }),

    body('category_name')
        .optional()
        .isLength({ min: 3 }).withMessage('Category name must be at least 3 characters')
        .custom(async (value, { req }) => {
            const existing = await Category.findOne({
                category_name: { $regex: `^${value}$`, $options: 'i' },
                _id: { $ne: req.params.id } 
            });
            if (existing) {
                throw new Error('Category name already exists');
            }
            return true;
        }),

    body('slug')
        .optional() 
        .isLength({ min: 3 }).withMessage('Category slug must be at least 3 characters')
        .custom(async (value, { req }) => {
            const existing = await Category.findOne({
                slug: { $regex: `^${value}$`, $options: 'i' },
                _id: { $ne: req.params.id } 
            });
            if (existing) {
                throw new Error('Category slug already exists');
            }
            return true;
        }),

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