const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const handleValidationResult = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = {};
        errors.array().forEach((err) => {
            if (!formattedErrors[err.path]) {
                formattedErrors[err.path] = err.msg;
            }
        });

        return res.status(422).json({
            message: 'Validation failed',
            errors: formattedErrors,
        });
    }

    next();
};


exports.updateProfileValidator = [
    //firstName
    body('firstName')
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 3 }).withMessage('First name must be at least 2 characters')
        .isLength({ max: 30 }).withMessage('First name cannot exceed 30 characters'),

    //lastName
    body('lastName')
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 2 }).withMessage('Last name must be at least 2 characters')
        .isLength({ max: 30 }).withMessage('Last name cannot exceed 30 characters'),

    //email
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email')
        .custom(async (value, { req }) => {
            const user = await User.findOne({ email: value });
            if (user && user._id.toString() !== req.user.toString()) {
                throw new Error('Email already exists');
            }
            return true;
        }),

    //phone
    body('phone')
        .optional()
        .isMobilePhone().withMessage('Invalid phone number'),

    //gender
    body('gender')
        .optional()
        .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
    //dateOfBirth
    body('dateOfBirth')
        .optional()
        .isDate().withMessage('Invalid date format'),

    //profileImage
    body('profileImage')
        .optional()
        .custom((value, { req }) => {
            if (!req.file && value === '') {
                throw new Error('Profile image cannot be empty if provided');
            }
            return true;
        }),

    //address
    body('address')
        .optional()
        .isLength({ max: 100 }).withMessage('Address cannot exceed 100 characters'),
    //country
    body('country')
        .notEmpty().withMessage('Country is required'),
    //state
    body('state')
        .notEmpty().withMessage('State is required'),
    //city
    body('city')
        .notEmpty().withMessage('City is required'),
    //postalCode
    body('postalCode')
        .notEmpty().withMessage('Postal code is required')
        .isLength({ max: 6 }).withMessage('Postal code cannot exceed 6 characters')
        .isLength({ min: 5 }).withMessage('Postal code must be at least 5 characters')
        .isNumeric().withMessage('Postal code must be a number'),
    // Final validation result handler
    handleValidationResult
];
