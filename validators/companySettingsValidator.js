const { body, validationResult } = require("express-validator");
const mongoose = require('mongoose');
const User = require("@models/User");

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = {};
        errors.array().forEach((err) => {
            if(!formattedErrors[err.path]){
                formattedErrors[err.path] = err.msg;
            }
        });
        return res.status(422).json({ 
            message: 'Validation failed',
            errors: formattedErrors
         });
    }
    next();
};

exports.updateCompanySettingsValidator = [
    body("companyName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Company name is required")
        .isLength({ max: 100 })
        .withMessage("Company name cannot exceed 100 characters"),

    body("email")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address"),

    body("phone")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .isMobilePhone()
        .withMessage("Invalid phone number"),

    body("addressLine1")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Address line 1 is required"),

    body("city")
        .optional()
        .notEmpty()
        .withMessage("City is required"),

    body("state")
        .optional()
        .notEmpty()
        .withMessage("State is required"),

    body("country")
        .optional()
        .notEmpty()
        .withMessage("Country is required"),

    body("pincode")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Pincode is required"),

    validate
];