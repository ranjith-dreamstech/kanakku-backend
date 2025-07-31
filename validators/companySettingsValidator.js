const { body, validationResult } = require("express-validator");

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
        .trim()
        .notEmpty()
        .withMessage("Company name is required")
        .isLength({ max: 100 })
        .withMessage("Company name cannot exceed 100 characters"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address"),

    body("phone")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .isMobilePhone()
        .withMessage("Invalid phone number"),

    body("address")
        .trim()
        .notEmpty()
        .withMessage("Address is required"),

    body("city")
        .notEmpty()
        .withMessage("City is required"),

    body("state")
        .notEmpty()
        .withMessage("State is required"),

    body("country")
        .notEmpty()
        .withMessage("Country is required"),

    body("pincode")
        .trim()
        .notEmpty()
        .withMessage("Pincode is required"),

    validate
];