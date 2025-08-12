const mongoose = require('mongoose');
const Invoice = require('@models/Invoice');
const Customer = require('@models/Customer');
const Product = require('@models/Product');
const { validationResult } = require('express-validator');

const createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      customerId,
      invoiceDate,
      dueDate,
      referenceNo,
      items,
      payment_method,
      notes,
      termsAndCondition,
      taxableAmount,
      TotalAmount,
      vat,
      totalDiscount,
      roundOff,
      bank,
      isRecurring,
      recurringDuration,
      recurring,
      sign_type,
      signatureName,
      billFrom,
      billTo,
      userId
    } = req.body;

    // Calculate amounts if not provided
    let calculatedTaxableAmount = taxableAmount || 0;
    let calculatedVat = vat || 0;
    let calculatedTotalDiscount = totalDiscount || 0;
    let calculatedTotalAmount = TotalAmount || 0;

    if (!taxableAmount || !TotalAmount || !vat || !totalDiscount) {
      calculatedTaxableAmount = items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
      calculatedTotalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
      calculatedVat = items.reduce((sum, item) => sum + (item.tax || 0), 0);
      calculatedTotalAmount = calculatedTaxableAmount + calculatedVat - calculatedTotalDiscount;
    }

    // Handle signature image if eSignature
    let signatureImage = null;
    if (sign_type === 'eSignature' && req.file) {
      signatureImage = req.file.path;
    }

    // Create invoice
    const invoice = new Invoice({
      customerId,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      referenceNo: referenceNo || '',
      items: items.map(item => ({
        productId: item.productId,
        name: item.name,
        key: item.key,
        quantity: item.quantity,
        units: item.units,
        unit: item.unit,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        taxInfo: item.taxInfo,
        amount: item.amount || (item.rate * item.quantity),
        discountType: item.discountType,
        isRateFormUpdated: item.isRateFormUpdated,
        form_updated_discounttype: item.form_updated_discounttype,
        form_updated_discount: item.form_updated_discount,
        form_updated_rate: item.form_updated_rate,
        form_updated_tax: item.form_updated_tax
      })),
      status: 'DRAFT',
      payment_method,
      taxableAmount: calculatedTaxableAmount,
      TotalAmount: calculatedTotalAmount,
      vat: calculatedVat,
      totalDiscount: calculatedTotalDiscount,
      roundOff: roundOff || false,
      bank: bank || null,
      notes: notes || '',
      termsAndCondition: termsAndCondition || '',
      isRecurring: isRecurring || false,
      recurringDuration: isRecurring ? recurringDuration : 0,
      recurring: isRecurring ? recurring : 'monthly',
      sign_type: sign_type || 'none',
      signatureName: sign_type === 'eSignature' ? signatureName : null,
      signatureImage,
      billFrom,
      billTo,
      userId
    });

    await invoice.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Invoice created successfully',
      data: invoice
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({ message: 'Error creating invoice', error: err.message });
  }
};

const updateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = req.params.id;
    const updateData = req.body;

    // Handle signature image if eSignature
    if (updateData.sign_type === 'eSignature' && req.file) {
      updateData.signatureImage = req.file.path;
    }

    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      updateData,
      { new: true, session }
    );

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: 'Invoice updated successfully',
      data: invoice
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({ message: 'Error updating invoice', error: err.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customerId')
      .populate('items.productId')
      .populate('items.unit')
      .populate('billFrom')
      .populate('billTo');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200).json({
      message: 'Invoice retrieved successfully',
      data: invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving invoice', error: err.message });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const { status, customerId, startDate, endDate } = req.query;
    const filter = { isDeleted: false };

    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (startDate && endDate) {
      filter.invoiceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const invoices = await Invoice.find(filter)
      .populate('customerId')
      .sort({ invoiceDate: -1 });

    res.status(200).json({
      message: 'Invoices retrieved successfully',
      count: invoices.length,
      data: invoices
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving invoices', error: err.message });
  }
};

const deleteInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true, session }
    );

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: 'Invoice deleted successfully',
      data: invoice
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({ message: 'Error deleting invoice', error: err.message });
  }
};

module.exports = {
  createInvoice,
  updateInvoice,
  getInvoice,
  getAllInvoices,
  deleteInvoice
};