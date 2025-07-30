const { body, validationResult } = require("express-validator");

// Middleware to validate signature creation, including file check
exports.createSignatureValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Signature name is required")
        .isLength({ max: 100 })
        .withMessage("Signature name cannot exceed 100 characters"),

    body("description")
        .trim()
        .optional()
        .isLength({ max: 500 })
        .withMessage("Signature description cannot exceed 500 characters"),

    // Custom middleware to check for file existence
   (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = {};
            errors.array().forEach((err) => {
                if(!formattedErrors[err.path]){
                    formattedErrors[err.path] = err.msg;
                }
            })
            return res.status(422).json({ 
                'message': 'Validation failed',
                'errors': formattedErrors
             });
        }
        next();
    },
];