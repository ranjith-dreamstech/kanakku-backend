// controllers/debitNoteController.js
const mongoose = require('mongoose');
const DebitNote = require('@models/DebitNote');
const Purchase = require('@models/Purchase');
const Product = require('@models/Product');
const User = require('@models/User');
const Inventory = require('@models/Inventory');
const { body, validationResult } = require('express-validator');

// Create a new debit note
const createDebitNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      purchaseId,
      debitNoteDate,
      referenceNo,
      items,
      notes,
      termsAndCondition,
      status = 'draft',
      userId,
      createdBy
    } = req.body;

    // Validate purchase exists
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Validate vendor
    const vendor = await User.findById(purchase.vendorId);
    if (!vendor) {
      return res.status(422).json({ message: 'Invalid vendor ID from purchase' });
    }

    // Validate created by user
    // const createdByUser = await User.findById(createdBy);
    // if (!createdByUser) {
    //   return res.status(422).json({ message: 'Invalid created by user ID' });
    // }

    // Validate products in items
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(422).json({ message: `Invalid product ID: ${item.productId}` });
      }
    }

    // Calculate amounts
    const taxableAmount = items.reduce((sum, item) => {
      return sum + (item.quantity * item.rate);
    }, 0);

    const totalDiscount = items.reduce((sum, item) => {
      return sum + (item.discount || 0);
    }, 0);

    const totalTax = items.reduce((sum, item) => {
      return sum + (item.tax || 0);
    }, 0);

    const totalAmount = taxableAmount + totalTax - totalDiscount;

    // Create debit note
    const debitNote = new DebitNote({
      purchaseId,
      vendorId: purchase.vendorId,
      debitNoteDate: debitNoteDate ? new Date(debitNoteDate) : new Date(),
      referenceNo: referenceNo || '',
      items: items.map(item => ({
        productId: item.productId,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        tax_group_id: item.tax_group_id,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        amount: item.amount || (item.quantity * item.rate),
        reason: item.reason
      })),
      status,
      taxableAmount,
      totalDiscount,
      totalTax,
      totalAmount,
      notes: notes || '',
      termsAndCondition: termsAndCondition || '',
      userId,
      createdBy
    });

    await debitNote.save();

    // If status is approved, update inventory
    if (status === 'approved') {
      for (const item of items) {
        let inventory = await Inventory.findOne({ 
          productId: item.productId, 
          userId 
        });

        if (!inventory) {
          inventory = new Inventory({
            productId: item.productId,
            userId,
            quantity: 0
          });
        }

        // Reduce quantity (since it's a debit note)
        inventory.quantity -= item.quantity;

        // Add to inventory history
        inventory.inventory_history.push({
          unitId: item.unit,
          quantity: inventory.quantity,
          notes: `Stock out from debit note ${debitNote.debitNoteId}`,
          type: 'stock_out',
          adjustment: -item.quantity,
          referenceId: debitNote._id,
          referenceType: 'debit_note',
          createdBy: userId
        });

        await inventory.save();
      }
    }

    res.status(201).json({
      message: 'Debit note created successfully',
      data: {
        debitNote: {
          id: debitNote._id,
          debitNoteId: debitNote.debitNoteId,
          purchaseId: debitNote.purchaseId,
          debitNoteDate: debitNote.debitNoteDate,
          status: debitNote.status,
          totalAmount: debitNote.totalAmount,
          items: debitNote.items.map(item => ({
            productId: item.productId,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            rate: item.rate,
            discount: item.discount,
            tax: item.tax,
            tax_group_id: item.tax_group_id,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            amount: item.amount,
            reason: item.reason
          }))
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error creating debit note',
      error: err.message
    });
  }
};

// Get all debit notes
const getAllDebitNotes = async (req, res) => {
  try {
    const { status, vendorId, startDate, endDate } = req.query;
    const userId = req.user._id; // Assuming user is authenticated

    let query = { userId, isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (vendorId) {
      query.vendorId = vendorId;
    }

    if (startDate && endDate) {
      query.debitNoteDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const debitNotes = await DebitNote.find(query)
      .populate('vendorId', 'name email')
      .populate('purchaseId', 'purchaseId purchaseDate')
      .sort({ debitNoteDate: -1 });

    res.status(200).json({
      message: 'Debit notes retrieved successfully',
      data: debitNotes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error retrieving debit notes',
      error: err.message
    });
  }
};

// Get debit note by ID
const getDebitNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id; // Assuming user is authenticated

    const debitNote = await DebitNote.findOne({ _id: id, userId, isDeleted: false })
      .populate('vendorId', 'name email phone address')
      .populate('purchaseId', 'purchaseId purchaseDate totalAmount')
      .populate('items.productId', 'name sku barcode')
      .populate('items.tax_group_id', 'name rate');

    if (!debitNote) {
      return res.status(404).json({ message: 'Debit note not found' });
    }

    res.status(200).json({
      message: 'Debit note retrieved successfully',
      data: debitNote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error retrieving debit note',
      error: err.message
    });
  }
};

// Update debit note status
const updateDebitNoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy } = req.body;
    const userId = req.user._id; // Assuming user is authenticated

    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const debitNote = await DebitNote.findOne({ _id: id, userId, isDeleted: false });
    if (!debitNote) {
      return res.status(404).json({ message: 'Debit note not found' });
    }

    // Validate approved by user if status is being approved
    if (status === 'approved') {
      const approver = await User.findById(approvedBy);
      if (!approver) {
        return res.status(422).json({ message: 'Invalid approved by user ID' });
      }
      debitNote.approvedBy = approvedBy;
    }

    debitNote.status = status;
    await debitNote.save();

    // If status is approved, update inventory
    if (status === 'approved') {
      for (const item of debitNote.items) {
        let inventory = await Inventory.findOne({ 
          productId: item.productId, 
          userId 
        });

        if (!inventory) {
          inventory = new Inventory({
            productId: item.productId,
            userId,
            quantity: 0
          });
        }

        // Reduce quantity (since it's a debit note)
        inventory.quantity -= item.quantity;

        // Add to inventory history
        inventory.inventory_history.push({
          unitId: item.unit,
          quantity: inventory.quantity,
          notes: `Stock out from debit note ${debitNote.debitNoteId}`,
          type: 'stock_out',
          adjustment: -item.quantity,
          referenceId: debitNote._id,
          referenceType: 'debit_note',
          createdBy: userId
        });

        await inventory.save();
      }
    }

    res.status(200).json({
      message: 'Debit note status updated successfully',
      data: debitNote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error updating debit note status',
      error: err.message
    });
  }
};

// Delete debit note (soft delete)
const deleteDebitNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id; // Assuming user is authenticated

    const debitNote = await DebitNote.findOneAndUpdate(
      { _id: id, userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!debitNote) {
      return res.status(404).json({ message: 'Debit note not found' });
    }

    res.status(200).json({
      message: 'Debit note deleted successfully',
      data: debitNote
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error deleting debit note',
      error: err.message
    });
  }
};

module.exports = {
  createDebitNote,
  getAllDebitNotes,
  getDebitNoteById,
  updateDebitNoteStatus,
  deleteDebitNote
};