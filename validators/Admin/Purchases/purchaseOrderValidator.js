const { body } = require('express-validator');

const purchaseOrderValidator = [
  body('vendorId')
    .notEmpty().withMessage('Vendor ID is required')
    .isMongoId().withMessage('Invalid Vendor ID format'),
  
  body('dueDate')
    .notEmpty().withMessage('Due date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),
  
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  
  body('items.*.name')
    .notEmpty().withMessage('Item name is required')
    .isString().withMessage('Item name must be a string'),
  
  body('items.*.productId')
    .notEmpty().withMessage('Product ID is required')
    .isMongoId().withMessage('Invalid Product ID format'),
  
  body('items.*.quantity')
    .notEmpty().withMessage('Quantity is required')
    .isNumeric().withMessage('Quantity must be a number')
    .toFloat(),
  
  body('items.*.rate')
    .notEmpty().withMessage('Rate is required')
    .isNumeric().withMessage('Rate must be a number')
    .toFloat(),
  
  body('paymentMode')
    .notEmpty().withMessage('Payment mode is required')
    .isIn(['CASH', 'CREDIT', 'CHECK', 'BANK_TRANSFER', 'OTHER'])
    .withMessage('Invalid payment mode'),
  
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID format'),
  
  body('billFrom')
    .notEmpty().withMessage('Bill from user ID is required')
    .isMongoId().withMessage('Invalid Bill from user ID format'),
  
  body('billTo')
    .notEmpty().withMessage('Bill to user ID is required')
    .isMongoId().withMessage('Invalid Bill to user ID format'),
  
  // Optional fields
  body('referenceNo').optional().isString(),
  body('notes').optional().isString(),
  body('termsAndCondition').optional().isString(),
  body('sign_type').optional().isIn(['manualSignature', 'digitalSignature', 'none']),
  body('signatureId').optional().isMongoId(),
  body('bank').optional().isMongoId(),
  body('convert_type').optional().isIn(['purchase', 'estimate', 'invoice'])
];

module.exports = purchaseOrderValidator;