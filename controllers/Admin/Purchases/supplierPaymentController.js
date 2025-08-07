const path = require('path');
const { validationResult } = require('express-validator');
const SupplierPayment = require('@models/SupplierPayment'); // adjust path

const createSupplierPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      purchaseId,
      supplierId,
      referenceNumber,
      paymentDate,
      paymentMode,
      amount,
      paidAmount,
      dueAmount,
      notes,
      createdBy
    } = req.body;

    // Get the uploaded file
    let attachment = null;
    if (req.file) {
      attachment = req.file.filename;
    }

    const newPayment = new SupplierPayment({
      purchaseId,
      supplierId,
      referenceNumber,
      paymentDate,
      paymentMode,
      amount,
      paidAmount,
      dueAmount,
      notes,
      attachment, // Save file name/path
      createdBy
    });

    const savedPayment = await newPayment.save();

    res.status(201).json({
      success: true,
      message: 'Supplier payment created successfully',
      data: savedPayment
    });

  } catch (err) {
    console.error('Error creating supplier payment:', err);
    res.status(500).json({
      message: 'Error creating supplier payment',
      error: err.message
    });
  }
};

module.exports = {
  createSupplierPayment
};
