const { body } = require('express-validator');

const purchaseValidator = [
  body('purchaseOrderId')
    .notEmpty().withMessage('Purchase order ID is required')
    .isString().withMessage('Purchase order ID must be a string'),
  
  body('vendorId')
    .notEmpty().withMessage('Vendor ID is required')
    .isMongoId().withMessage('Invalid vendor ID format'),
  
  body('purchaseDate')
    .notEmpty().withMessage('Purchase date is required')
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
  
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid user ID format'),
  
  body('billFrom')
    .notEmpty().withMessage('Bill from user ID is required')
    .isMongoId().withMessage('Invalid bill from user ID format'),
  
  body('billTo')
    .notEmpty().withMessage('Bill to user ID is required')
    .isMongoId().withMessage('Invalid bill to user ID format'),
  
  // Optional fields
  body('referenceNo').optional().isString(),
  body('notes').optional().isString(),
  body('termsAndCondition').optional().isString(),
  body('paidAmount').optional().isNumeric().toFloat(),
  body('bank').optional().isMongoId()
];

const supplierPaymentValidator = [
  body('purchaseId')
    .notEmpty().withMessage('Purchase ID is required')
    .isMongoId().withMessage('Invalid purchase ID format'),
  
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isNumeric().withMessage('Amount must be a number')
    .toFloat(),
  
  body('paymentDate')
    .notEmpty().withMessage('Payment date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),
  
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid user ID format'),
  
  // Optional fields
  body('paymentMode').optional().isMongoId(),
  body('referenceNumber').optional().isString(),
  body('notes').optional().isString()
];

module.exports = {
  purchaseValidator,
  supplierPaymentValidator
};