const { body } = require('express-validator');

const quotationValidator = [
  body('quotationDate')
    .notEmpty().withMessage('Quotation date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),
  
  body('expiryDate')
    .notEmpty().withMessage('Expiry date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),
  
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  
  body('items.*.id')
    .notEmpty().withMessage('Product ID is required')
    .isMongoId().withMessage('Invalid Product ID format'),
  
  body('items.*.qty')
    .notEmpty().withMessage('Quantity is required')
    .isNumeric().withMessage('Quantity must be a number')
    .toFloat(),
  
  body('items.*.rate')
    .notEmpty().withMessage('Rate is required')
    .isNumeric().withMessage('Rate must be a number')
    .toFloat(),
  
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
  body('paymentTerms').optional().isString(),
  body('sign_type').optional().isIn(['eSignature', 'digitalSignature', 'none']),
  body('signatureId').optional().isMongoId(),
  body('convert_type').optional().isIn(['quotation', 'invoice', 'purchase'])
];

// Update validator - makes most fields optional
const updateQuotationValidator = [
  body('customerId')
    .optional()
    .isMongoId().withMessage('Invalid Customer ID format'),
  
  body('quotationDate')
    .optional()
    .isISO8601().withMessage('Invalid date format')
    .toDate(),
  
  body('expiryDate')
    .optional()
    .isISO8601().withMessage('Invalid date format')
    .toDate(),
  
  body('items')
    .optional()
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  
  body('items.*.name')
    .optional()
    .isString().withMessage('Item name must be a string'),
  
  body('items.*.productId')
    .optional()
    .isMongoId().withMessage('Invalid Product ID format'),
  
  body('items.*.quantity')
    .optional()
    .isNumeric().withMessage('Quantity must be a number')
    .toFloat(),
  
  body('items.*.rate')
    .optional()
    .isNumeric().withMessage('Rate must be a number')
    .toFloat(),
  
  body('items.*.discount')
    .optional()
    .isNumeric().withMessage('Discount must be a number')
    .toFloat(),
  
  body('items.*.tax')
    .optional()
    .isNumeric().withMessage('Tax must be a number')
    .toFloat(),
  
  body('status')
    .optional()
    .isIn(['new', 'pending', 'completed', 'cancelled', 'partially_paid', 'paid'])
    .withMessage('Invalid status'),
  
  body('billFrom')
    .optional()
    .isMongoId().withMessage('Invalid Bill from user ID format'),
  
  body('billTo')
    .optional()
    .isMongoId().withMessage('Invalid Bill to user ID format'),
  
  // Optional fields
  body('referenceNo').optional().isString(),
  body('notes').optional().isString(),
  body('termsAndCondition').optional().isString(),
  body('paymentTerms').optional().isString(),
  body('sign_type').optional().isIn(['eSignature', 'digitalSignature', 'none']),
  body('signatureId').optional().isMongoId(),
  body('convert_type').optional().isIn(['quotation', 'invoice', 'purchase']),
  body('roundOff').optional().isBoolean(),
  body('taxableAmount').optional().isNumeric(),
  body('totalDiscount').optional().isNumeric(),
  body('vat').optional().isNumeric(),
  body('TotalAmount').optional().isNumeric()
];

module.exports = { quotationValidator, updateQuotationValidator };