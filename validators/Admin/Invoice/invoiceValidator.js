const { body, param } = require('express-validator');
const Invoice = require('@models/Invoice');
const Customer = require('@models/Customer');

const createInvoiceValidator = [
  body('customerId')
    .notEmpty().withMessage('Customer ID is required')
    .isMongoId().withMessage('Invalid Customer ID')
    .custom(async (value) => {
      const customer = await Customer.findById(value);
      if (!customer) {
        throw new Error('Customer not found');
      }
      return true;
    }),

  body('invoiceDate')
    .notEmpty().withMessage('Invoice date is required')
    .isISO8601().withMessage('Invalid date format'),

  body('dueDate')
    .notEmpty().withMessage('Due date is required')
    .isISO8601().withMessage('Invalid date format'),

  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),

  body('billFrom')
    .notEmpty().withMessage('Bill from is required')
    .isMongoId().withMessage('Invalid Bill From ID'),

  body('billTo')
    .notEmpty().withMessage('Bill to is required')
    .isMongoId().withMessage('Invalid Bill To ID'),

  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID')
];

const updateInvoiceValidator = [
  param('id')
    .notEmpty().withMessage('Invoice ID is required')
    .isMongoId().withMessage('Invalid Invoice ID')
    .custom(async (value) => {
      const invoice = await Invoice.findById(value);
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      return true;
    }),

  ...createInvoiceValidator
];

module.exports = {
  createInvoiceValidator,
  updateInvoiceValidator
};