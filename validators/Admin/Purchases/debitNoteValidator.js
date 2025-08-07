const { body } = require('express-validator');

const debitNoteValidator = [
  body('purchaseId')
    .notEmpty().withMessage('Purchase ID is required')
    .isMongoId().withMessage('Invalid purchase ID format'),
  
  body('debitNoteDate')
    .notEmpty().withMessage('Debit note date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),
  
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  
  body('items.*.productId')
    .notEmpty().withMessage('Product ID is required')
    .isMongoId().withMessage('Invalid product ID format'),
  
  body('items.*.quantity')
    .notEmpty().withMessage('Quantity is required')
    .isNumeric().withMessage('Quantity must be a number')
    .toFloat(),
  
  body('items.*.rate')
    .notEmpty().withMessage('Rate is required')
    .isNumeric().withMessage('Rate must be a number')
    .toFloat(),
  
  body('items.*.reason')
    .notEmpty().withMessage('Reason is required')
    .isString().withMessage('Reason must be a string'),
  
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid user ID format'),
  
  body('createdBy')
    .notEmpty().withMessage('Created by user ID is required')
    .isMongoId().withMessage('Invalid created by user ID format'),
  
  // Optional fields
  body('referenceNo').optional().isString(),
  body('notes').optional().isString(),
  body('termsAndCondition').optional().isString(),
  body('status').optional().isIn(['draft', 'pending', 'approved', 'rejected', 'cancelled'])
];

module.exports = {
  debitNoteValidator
};