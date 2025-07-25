const { body, validationResult } = require('express-validator');
const Unit = require('../models/Unit'); 

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
exports.createUnitValidator = [
  // Unit Name
  body('unit_name')
    .notEmpty().withMessage('Unit name is required')
    .matches(/^[A-Za-z\s]+$/).withMessage('Unit name must contain only letters and spaces')
    .isLength({ min: 2 }).withMessage('Unit name must be at least 2 characters')
    .custom(async (value) => {
      const existing = await Unit.findOne({ unit_name: { $regex: `^${value}$`, $options: 'i' } });
      if (existing) {
        throw new Error('Unit name already exists');
      }
      return true;
    }),

  // Short Name
  body('short_name')
    .notEmpty().withMessage('Short name is required')
    .isAlpha().withMessage('Short name must contain only letters')
    .isLength({ min: 1 }).withMessage('Short name must be at least 1 characters'),

  // Status
  body('status')
    .notEmpty().withMessage('Status is required')
    .isBoolean().withMessage('Status must be a boolean value'),

  // Final validation result handler
  handleValidationResult
];


exports.updateUnitValidator = [
  // Unit Name
  body('unit_name')
    .optional()
    .matches(/^[A-Za-z\s]+$/).withMessage('Unit name must contain only letters and spaces')
    .isLength({ min: 2 }).withMessage('Unit name must be at least 2 characters')
    .custom(async (value, { req }) => {
      if (typeof value === 'undefined') return true;

      const unitId = req.params.id;
      if (!unitId) throw new Error('Unit ID is required for update');

      const existing = await Unit.findOne({ unit_name: { $regex: `^${value}$`, $options: 'i' } });
      
      if (existing && existing._id.toString() !== unitId) {
        throw new Error('Unit name already exists');
      }

      return true;
    }),



  // Short Name
  body('short_name')
    .optional()
    .isAlpha().withMessage('Short name must contain only letters')
    .isLength({ min: 1 }).withMessage('Short name must be at least 1 characters'),

  // Status
  body('status')
    .optional()
    .isBoolean().withMessage('Status must be a boolean value'),

  // Final validation result handler
  handleValidationResult
];
