const { body } = require('express-validator');

const supplierPaymentValidator = [
  body('purchaseId')
    .notEmpty().withMessage('Purchase ID is required')
    .isMongoId().withMessage('Invalid purchase ID format'),

  body('supplierId')
    .notEmpty().withMessage('Supplier ID is required')
    .isMongoId().withMessage('Invalid supplier ID format'),

  body('paymentDate')
    .notEmpty().withMessage('Payment date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isNumeric().withMessage('Amount must be a number')
    .toFloat(),

  body('paidAmount')
    .notEmpty().withMessage('Paid amount is required')
    .isNumeric().withMessage('Paid amount must be a number')
    .toFloat(),

  body('dueAmount')
    .notEmpty().withMessage('Due amount is required')
    .isNumeric().withMessage('Due amount must be a number')
    .toFloat(),

  // body('createdBy')
  //   .notEmpty().withMessage('CreatedBy is required')
  //   .isMongoId().withMessage('Invalid createdBy format'),

  // Optional fields
  body('referenceNumber').optional().isString(),
  body('notes').optional().isString(),
  body('attachment').optional().isString(),
  body('paymentMode').optional().isMongoId().withMessage('Invalid payment mode ID')
];

module.exports = {
  supplierPaymentValidator
};
