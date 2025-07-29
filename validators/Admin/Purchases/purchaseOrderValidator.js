const { body } = require('express-validator');

const purchaseOrderValidator = [
  body('vendorId').notEmpty().withMessage('Vendor ID is required'),
  body('purchaseOrderDate').optional().isISO8601().toDate(),
  body('dueDate').isISO8601().toDate().withMessage('Valid due date is required'),
  body('referenceNo').optional().isString(),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.name').notEmpty().withMessage('Item name is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isNumeric().withMessage('Quantity must be a number'),
  body('items.*.rate').isNumeric().withMessage('Rate must be a number'),
  body('items.*.discount').optional().isNumeric(),
  body('items.*.tax').optional().isNumeric(),
  body('items.*.amount').isNumeric().withMessage('Amount must be a number'),
  body('status').optional().isIn(['NEW', 'PENDING', 'COMPLETED', 'CANCELLED']),
  body('paymentMode').isIn(['CASH', 'CREDIT', 'CHECK', 'BANK_TRANSFER', 'OTHER']).withMessage('Invalid payment mode'),
  body('taxableAmount').isNumeric().withMessage('Taxable amount must be a number'),
  body('totalDiscount').optional().isNumeric(),
  body('vat').optional().isNumeric(),
  body('roundOff').optional().isBoolean(),
  body('TotalAmount').isNumeric().withMessage('Total amount must be a number'),
  body('bank').optional().isMongoId(),
  body('notes').optional().isString(),
  body('termsAndCondition').optional().isString(),
  body('sign_type').optional().isIn(['manualSignature', 'digitalSignature', 'none']),
  body('signatureId').optional().isMongoId(),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('billFrom').isMongoId().withMessage('Valid bill from address ID is required'),
  body('billTo').isMongoId().withMessage('Valid bill to address ID is required'),
  body('convert_type').optional().isIn(['purchase', 'estimate', 'invoice'])
];

module.exports = purchaseOrderValidator;