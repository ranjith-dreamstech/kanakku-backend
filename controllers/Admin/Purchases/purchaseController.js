const mongoose = require('mongoose');
const Purchase = require('@models/Purchase');
const PurchaseOrder = require('@models/PurchaseOrder');
const SupplierPayment = require('@models/SupplierPayment');
const Inventory = require('@models/Inventory');
const Product = require('@models/Product');
const User = require('@models/User');
const { body, validationResult } = require('express-validator');

// Create a new purchase
const createPurchase = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      purchaseOrderId,
      userId,
      billFrom,
      billTo,
      referenceNo,
      purchaseDate,
      status = 'pending',
      items,
      notes,
      termsAndCondition,
      paymentMode,
      subTotal,
      totalTax,
      totalDiscount,
      grandTotal
    } = req.body;

    // Validate bill from and bill to users
    const billFromUser = await User.findById(billFrom);
    const billToUser = await User.findById(billTo);
    if (!billFromUser || !billToUser) {
      return res.status(422).json({ message: 'Invalid bill from or bill to user ID' });
    }

    // Validate products in items
    for (const item of items) {
      const product = await Product.findById(item.id);
      if (!product) {
        return res.status(422).json({ message: `Invalid product ID: ${item.id}` });
      }
    }

    // Calculate amounts if not provided in payload
    const calculatedSubTotal = subTotal || items.reduce((sum, item) => {
      return sum + (item.amount || (item.quantity * (item.rate || 0)));
    }, 0);

    const calculatedTotalDiscount = totalDiscount || items.reduce((sum, item) => {
      return sum + (item.discount || 0);
    }, 0);

    const calculatedTotalTax = totalTax || items.reduce((sum, item) => {
      return sum + (item.tax || 0);
    }, 0);

    const calculatedGrandTotal = grandTotal || (calculatedSubTotal + calculatedTotalTax - calculatedTotalDiscount);

    // Create purchase
    const purchase = new Purchase({
      purchaseOrderId,
      vendorId: billTo, // Assuming billTo is the vendor/supplier
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      dueDate: new Date(purchaseDate ? new Date(purchaseDate) : new Date()), // Same as purchase date if not specified
      referenceNo: referenceNo || '',
      items: items.map(item => ({
        productId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate,
        discount: item.discount,
        tax: item.tax,
        tax_group_id: item.tax_group_id,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        amount: item.amount
      })),
      status: status,
      paymentMode,
      taxableAmount: req.body.taxableAmount || taxableAmount,
      totalDiscount: req.body.totalDiscount || totalDiscount,
      totalTax: req.body.totalTax || totalTax,
      roundOff: req.body.roundOff || false,
      totalAmount: req.body.totalAmount || totalAmount,
      paidAmount: grandTotal || 0,
      balanceAmount: grandTotal ? (calculatedGrandTotal - grandTotal) : calculatedGrandTotal,
      bank: req.body.bank || null,
      notes: notes || '',
      termsAndCondition: termsAndCondition || '',
      userId,
      billFrom,
      billTo
    });

    await purchase.save();

    // Update purchase order status if purchaseOrderId exists
    if (purchaseOrderId) {
      await PurchaseOrder.findOneAndUpdate(
        { purchaseOrderId },
        { 
          status: status === 'completed' ? 'completed' : 
                 status === 'cancelled' ? 'cancelled' : 
                 'pending' 
        }
      );
    }

    // Update inventory for each product if status is 'completed'
   
    for (const item of items) {
      let inventory = await Inventory.findOne({ 
        productId: item.id, 
        userId 
      });

      if (!inventory) {
        inventory = new Inventory({
          productId: item.id,
          userId,
          quantity: 0
        });
      }

      // Update quantity
      inventory.quantity += item.quantity || item.qty || 0;

      // Add to inventory history
      inventory.inventory_history.push({
        unitId: item.unit,
        quantity: inventory.quantity,
        notes: `Stock in from purchase ${purchase.purchaseId}`,
        type: 'stock_in',
        adjustment: item.quantity || item.qty || 0,
        referenceId: purchase._id,
        referenceType: 'purchase',
        createdBy: userId
      });

      await inventory.save();
    }

    res.status(201).json({
      message: 'Purchase created successfully',
      data: {
        purchase: {
          id: purchase._id,
          purchaseId: purchase.purchaseId,
          purchaseOrderId: purchase.purchaseOrderId,
          purchaseDate: purchase.purchaseDate,
          status: purchase.status,
          totalAmount: purchase.totalAmount,
          paidAmount: purchase.paidAmount,
          balanceAmount: purchase.balanceAmount,
          items: purchase.items
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error creating purchase',
      error: err.message
    });
  }
};

// Get all purchases
const getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ isDeleted: false })
      .populate('vendorId', 'name email')
      .populate('userId', 'name email')
      .populate('billFrom', 'name email')
      .populate('billTo', 'name email')
      .sort({ purchaseDate: -1 });

    res.status(200).json({
      message: 'Purchases retrieved successfully',
      data: purchases
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error retrieving purchases',
      error: err.message
    });
  }
};

// Get purchase by ID
const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('vendorId', 'name email phone')
      .populate('userId', 'name email')
      .populate('billFrom', 'name email address')
      .populate('billTo', 'name email address')
      .populate('items.productId', 'name sku description')
      .populate('items.tax_group_id', 'name rate');

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    res.status(200).json({
      message: 'Purchase retrieved successfully',
      data: purchase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error retrieving purchase',
      error: err.message
    });
  }
};

// Update purchase status
const updatePurchaseStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const purchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    res.status(200).json({
      message: 'Purchase status updated successfully',
      data: purchase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error updating purchase status',
      error: err.message
    });
  }
};

// Delete purchase (soft delete)
const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    res.status(200).json({
      message: 'Purchase deleted successfully',
      data: purchase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error deleting purchase',
      error: err.message
    });
  }
};

// Create supplier payment for a purchase
const createSupplierPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      purchaseId,
      amount,
      paymentDate,
      paymentMode,
      referenceNumber,
      notes,
      userId
    } = req.body;

    // Validate purchase exists
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(422).json({ message: 'Invalid user ID' });
    }

    // Create supplier payment
    const supplierPayment = new SupplierPayment({
      purchaseId,
      purchaseOrderId: purchase.purchaseOrderId,
      supplierId: purchase.vendorId,
      paymentDate: new Date(paymentDate),
      paymentMode,
      amount,
      referenceNumber,
      notes,
      status: 'completed',
      createdBy: userId
    });

    await supplierPayment.save();

    // Update purchase payment status
    const newPaidAmount = purchase.paidAmount + amount;
    const balanceAmount = purchase.totalAmount - newPaidAmount;

    let status = purchase.status;
    if (balanceAmount <= 0) {
      status = 'paid';
    } else if (newPaidAmount > 0) {
      status = 'partially_paid';
    }

    await Purchase.findByIdAndUpdate(
      purchaseId,
      {
        paidAmount: newPaidAmount,
        balanceAmount,
        status
      }
    );

    res.status(201).json({
      message: 'Supplier payment created successfully',
      data: supplierPayment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error creating supplier payment',
      error: err.message
    });
  }
};

// Get all supplier payments for a purchase
const getSupplierPayments = async (req, res) => {
  try {
    const payments = await SupplierPayment.find({ 
      purchaseId: req.params.purchaseId,
      isDeleted: false 
    })
    .populate('supplierId', 'name email')
    .populate('createdBy', 'name email')
    .sort({ paymentDate: -1 });

    res.status(200).json({
      message: 'Supplier payments retrieved successfully',
      data: payments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Error retrieving supplier payments',
      error: err.message
    });
  }
};

module.exports = {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  updatePurchaseStatus,
  deletePurchase,
  createSupplierPayment,
  getSupplierPayments
};