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
    const userId = req.user;

    const { 
      purchaseId,
      debitNoteDate,
      referenceNo,
      items,
      notes,
      termsAndCondition,
      status = 'draft',
      createdBy = userId,
      billFrom,
      billTo,
      sign_type,
      signatureId,
      signatureName,
      checkNumber,
      bank,
      paidAmount = 0
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

    // Validate bill from and bill to users
    const billFromUser = await User.findById(billFrom);
    const billToUser = await User.findById(billTo);
    if (!billFromUser || !billToUser) {
      return res.status(422).json({ message: 'Invalid bill from or bill to user ID' });
    }

    // Validate created by user
    // const createdByUser = await User.findById(createdBy);
    // if (!createdByUser) {
    //   return res.status(422).json({ message: 'Invalid created by user ID' });
    // }

    // Validate products in items
    for (const item of items) {
      const product = await Product.findById(item.id);
      if (!product) {
        return res.status(422).json({ message: `Invalid product ID: ${item.id}` });
      }
    }

    // Validate signature type
    const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
    if (sign_type && !validSignatureTypes.includes(sign_type)) {
      return res.status(400).json({ message: 'Invalid signature type' });
    }

    // Validate signature data if eSignature is selected
    if (sign_type === 'eSignature') {
      if (!req.file) {
        return res.status(400).json({ message: 'Signature image is required for eSignature' });
      }
      if (!signatureName) {
        return res.status(400).json({ message: 'Signature name is required for eSignature' });
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
    const balanceAmount = totalAmount - paidAmount;

    // Create debit note
    const debitNote = new DebitNote({
      purchaseId,
      vendorId: purchase.vendorId,
      debitNoteDate: debitNoteDate ? new Date(debitNoteDate) : new Date(),
      dueDate: new Date(debitNoteDate ? new Date(debitNoteDate) : new Date()),
      referenceNo: referenceNo || '',
      items: items.map(item => ({
        productId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: item.qty,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        tax_group_id: item.tax_group_id,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        amount: item.amount || (item.quantity * item.rate),
      })),
      status,
      taxableAmount: req.body.subTotal || taxableAmount,
      totalDiscount: req.body.totalDiscount || totalDiscount,
      totalTax: req.body.totalTax || totalTax,
      totalAmount: req.body.grandTotal || totalAmount,
      paidAmount,
      balanceAmount: 0,
      bank: bank || null,
      notes: notes || '',
      termsAndCondition: termsAndCondition || '',
      sign_type: sign_type || 'none',
      signatureId: signatureId || null,
      signatureImage: sign_type === 'eSignature' ? req.file.path : null,
      signatureName: sign_type === 'eSignature' ? signatureName : null,
      checkNumber: checkNumber || null,
      userId,
      createdBy,
      billFrom,
      billTo
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
          paidAmount: debitNote.paidAmount,
          balanceAmount: debitNote.balanceAmount,
          sign_type: debitNote.sign_type,
          signatureName: debitNote.signatureName,
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
    const {
      page = 1,
      limit = 10,
      status,
      vendorId,
      startDate,
      endDate,
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = vendorId;
    }

    if (startDate || endDate) {
      query.debitNoteDate = {};
      if (startDate) {
        query.debitNoteDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.debitNoteDate.$lte = new Date(endDate);
      }
    }

    // Add search filter
    if (search) {
      query.$or = [
        { debitNoteId: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'items.reason': { $regex: search, $options: 'i' } },
        { signatureName: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await DebitNote.countDocuments(query);

    // Fetch debit notes
    const debitNotes = await DebitNote.find(query)
      .populate('vendorId', 'firstName lastName email phone')
      .populate('purchaseId', 'purchaseId purchaseDate totalAmount')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ debitNoteDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Format function for date
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    // Format response
    const formattedDebitNotes = debitNotes.map((note) => {
      const vendor = note.vendorId ? {
        id: note.vendorId._id,
        name: `${note.vendorId.firstName || ''} ${note.vendorId.lastName || ''}`.trim(),
        email: note.vendorId.email || null,
        phone: note.vendorId.phone || null
      } : null;

      const purchase = note.purchaseId ? {
        id: note.purchaseId._id,
        purchaseId: note.purchaseId.purchaseId || null,
        purchaseDate: formatDate(note.purchaseId.purchaseDate),
        totalAmount: note.purchaseId.totalAmount || 0
      } : null;

      const createdBy = note.createdBy ? {
        id: note.createdBy._id,
        name: `${note.createdBy.firstName || ''} ${note.createdBy.lastName || ''}`.trim()
      } : null;

      const approvedBy = note.approvedBy ? {
        id: note.approvedBy._id,
        name: `${note.approvedBy.firstName || ''} ${note.approvedBy.lastName || ''}`.trim()
      } : null;

      return {
        id: note._id,
        debitNoteId: note.debitNoteId,
        referenceNo: note.referenceNo || null,
        vendor,
        purchase,
        debitNoteDate: formatDate(note.debitNoteDate),
        status: note.status,
        totalAmount: note.totalAmount,
        paidAmount: note.paidAmount || 0,
        balanceAmount: note.balanceAmount || 0,
        sign_type: note.sign_type || 'none',
        signatureName: note.signatureName || null,
        signatureImage: note.signatureImage ? `${process.env.BASE_URL}${note.signatureImage}` : null,
        notes: note.notes || null,
        createdBy,
        approvedBy,
        createdAt: formatDate(note.createdAt),
        updatedAt: formatDate(note.updatedAt)
      };
    });

    // Send response
    res.status(200).json({
      success: true,
      message: 'Debit notes retrieved successfully',
      data: {
        debitNotes: formattedDebitNotes,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Get all debit notes error:', err);
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
    const userId = req.user; // Assuming user is authenticated

    const debitNote = await DebitNote.findOne({ _id: id, isDeleted: false })
      .populate('vendorId', 'firstName lastName email phone address')
      .populate('purchaseId', 'purchaseId purchaseDate totalAmount')
      .populate('items.productId', 'name sku barcode')
      .populate('items.tax_group_id', 'name rate')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate('bank', 'bankName accountNumber branch');

    if (!debitNote) {
      return res.status(404).json({ message: 'Debit note not found' });
    }

    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    // Vendor details
    const vendor = debitNote.vendorId ? {
      id: debitNote.vendorId._id,
      name: `${debitNote.vendorId.firstName || ''} ${debitNote.vendorId.lastName || ''}`.trim(),
      email: debitNote.vendorId.email || null,
      phone: debitNote.vendorId.phone || null,
      address: debitNote.vendorId.address || null
    } : null;

    // Purchase details
    const purchase = debitNote.purchaseId ? {
      id: debitNote.purchaseId._id,
      purchaseId: debitNote.purchaseId.purchaseId || null,
      purchaseDate: formatDate(debitNote.purchaseId.purchaseDate),
      totalAmount: debitNote.purchaseId.totalAmount || 0
    } : null;

    // Bank details
    const bank = debitNote.bank ? {
      id: debitNote.bank._id,
      bankName: debitNote.bank.bankName || null,
      accountNumber: debitNote.bank.accountNumber || null,
      branch: debitNote.bank.branch || null
    } : null;

    // Created by
    const createdBy = debitNote.createdBy ? {
      id: debitNote.createdBy._id,
      name: `${debitNote.createdBy.firstName || ''} ${debitNote.createdBy.lastName || ''}`.trim()
    } : null;

    // Approved by
    const approvedBy = debitNote.approvedBy ? {
      id: debitNote.approvedBy._id,
      name: `${debitNote.approvedBy.firstName || ''} ${debitNote.approvedBy.lastName || ''}`.trim()
    } : null;

    // Items
    const items = debitNote.items.map(item => ({
      product: item.productId ? {
        id: item.productId._id,
        name: item.productId.name || null,
        sku: item.productId.sku || null,
        barcode: item.productId.barcode || null
      } : null,
      quantity: item.quantity || 0,
      rate: item.rate || 0,
      discount: item.discount || 0,
      discount_type: item.discount_type || 'Fixed',
      discount_value: item.discount_value || 0,
      tax: item.tax || 0,
      amount: item.amount || 0,
      reason: item.reason || null,
      taxGroup: item.tax_group_id ? {
        id: item.tax_group_id._id,
        name: item.tax_group_id.name || null,
        rate: item.tax_group_id.rate || 0
      } : null
    }));

    // Final formatted response
    const formattedDebitNote = {
      id: debitNote._id,
      debitNoteId: debitNote.debitNoteId,
      referenceNo: debitNote.referenceNo || null,
      vendor,
      purchase,
      debitNoteDate: formatDate(debitNote.debitNoteDate),
      dueDate: formatDate(debitNote.dueDate),
      status: debitNote.status || null,
      taxableAmount: debitNote.taxableAmount || 0,
      totalDiscount: debitNote.totalDiscount || 0,
      totalTax: debitNote.totalTax || 0,
      totalAmount: debitNote.totalAmount || 0,
      paidAmount: debitNote.paidAmount || 0,
      balanceAmount: debitNote.balanceAmount || 0,
      paymentMode: debitNote.paymentMode || null,
      bank,
      notes: debitNote.notes || null,
      termsAndCondition: debitNote.termsAndCondition || null,
      sign_type: debitNote.sign_type || 'none',
      signatureId: debitNote.signatureId || null,
      signatureImage: debitNote.signatureImage ? `${process.env.BASE_URL}${debitNote.signatureImage}` : null,
      signatureName: debitNote.signatureName || null,
      checkNumber: debitNote.checkNumber || null,
      items,
      createdBy,
      approvedBy,
      createdAt: formatDate(debitNote.createdAt),
      updatedAt: formatDate(debitNote.updatedAt)
    };

    res.status(200).json({
      success: true,
      message: 'Debit note retrieved successfully',
      data: formattedDebitNote
    });

  } catch (err) {
    console.error('Get debit note by ID error:', err);
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
    const { 
      status, 
      approvedBy,
      sign_type,
      signatureId,
      signatureName,
      signatureImage
    } = req.body;
    const userId = req.user; // Assuming user is authenticated

    const validStatuses = ['draft', 'pending', 'approved', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const debitNote = await DebitNote.findOne({ _id: id, isDeleted: false });
    if (!debitNote) {
      return res.status(404).json({ message: 'Debit note not found' });
    }

    // Validate signature type if provided
    if (sign_type) {
      const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
      if (!validSignatureTypes.includes(sign_type)) {
        return res.status(400).json({ message: 'Invalid signature type' });
      }
      
      debitNote.sign_type = sign_type;
      
      if (sign_type === 'eSignature') {
        if (!signatureName) {
          return res.status(400).json({ message: 'Signature name is required for eSignature' });
        }
        debitNote.signatureName = signatureName;
        debitNote.signatureImage = req.file ? req.file.path : signatureImage;
      } else {
        debitNote.signatureName = null;
        debitNote.signatureImage = null;
      }
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

    // Prepare response data
    const responseData = {
      id: debitNote._id,
      debitNoteId: debitNote.debitNoteId,
      status: debitNote.status,
      approvedBy: debitNote.approvedBy ? {
        id: debitNote.approvedBy._id,
        name: `${debitNote.approvedBy.firstName || ''} ${debitNote.approvedBy.lastName || ''}`.trim()
      } : null,
      sign_type: debitNote.sign_type,
      signatureName: debitNote.signatureName,
      signatureImage: debitNote.signatureImage ? `${process.env.BASE_URL}${debitNote.signatureImage}` : null,
      updatedAt: new Date(debitNote.updatedAt)
    };

    res.status(200).json({
      message: 'Debit note status updated successfully',
      data: responseData
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
    const userId = req.user; // Assuming user is authenticated

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