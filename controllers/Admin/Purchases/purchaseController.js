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
      vendorId,
      purchaseDate,
      dueDate,
      referenceNo,
      items,
      paymentMode,
      notes,
      termsAndCondition,
      userId,
      billFrom,
      billTo,
      paidAmount
    } = req.body;

    // Validate purchase order exists
    // const purchaseOrder = await PurchaseOrder.findOne({ purchaseOrderId });
    // if (!purchaseOrder) {
    //   return res.status(400).json({ message: 'Invalid purchase order ID' });
    // }

    // Validate vendor exists and is a supplier
    // const vendor = await User.findById(vendorId);
    // if (!vendor || vendor.user_type !== 'supplier') {
    //   return res.status(400).json({ message: 'Invalid vendor ID or vendor is not a supplier' });
    // }

    // Validate requesting user exists
    // const user = await User.findById(userId);
    // if (!user) {
    //   return res.status(422).json({ message: 'Invalid user ID' });
    // }

    // Validate bill from and bill to users
    const billFromUser = await User.findById(billFrom);
    const billToUser = await User.findById(billTo);
    if (!billFromUser || !billToUser) {
      return res.status(422).json({ message: 'Invalid bill from or bill to user ID' });
    }

    // Validate products in items
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(422).json({ message: `Invalid product ID: ${item.productId}` });
      }
    }

    // Calculate amounts
    let taxableAmount = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalAmount = 0;

    items.forEach(item => {
      const itemAmount = item.amount || (item.quantity * (item.rate || 0));
      const itemDiscount = item.discount || 0;
      const itemTax = item.tax || 0;
      
      taxableAmount += itemAmount;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
      totalAmount += itemAmount;
    });

    // Create purchase
    const purchase = new Purchase({
      purchaseOrderId,
      vendorId,
      purchaseDate: new Date(purchaseDate),
      dueDate: new Date(dueDate || purchaseDate),
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
        amount: item.amount
      })),
      status: 'pending',
      paymentMode,
      taxableAmount: req.body.taxableAmount || taxableAmount,
      totalDiscount: req.body.totalDiscount || totalDiscount,
      totalTax: req.body.totalTax || totalTax,
      roundOff: req.body.roundOff || false,
      totalAmount: req.body.totalAmount || totalAmount,
      paidAmount: paidAmount || 0,
      balanceAmount: (req.body.totalAmount || totalAmount) - (paidAmount || 0),
      bank: req.body.bank || null,
      notes: notes || '',
      termsAndCondition: termsAndCondition || '',
      userId,
      billFrom,
      billTo
    });

    await purchase.save();

    // Update purchase order status
    await PurchaseOrder.findOneAndUpdate(
      { purchaseOrderId },
      { status: 'completed' }
    );

    // Create supplier payment if paidAmount > 0
    if (paidAmount > 0) {
      const supplierPayment = new SupplierPayment({
        purchaseId: purchase._id,
        purchaseOrderId,
        supplierId: vendorId,
        paymentDate: new Date(purchaseDate),
        paymentMode,
        amount: paidAmount,
        status: 'completed',
        notes: `Payment for purchase ${purchase.purchaseId}`,
        createdBy: userId
      });

      await supplierPayment.save();

      // Update purchase status if fully paid
      if (paidAmount >= purchase.totalAmount) {
        await Purchase.findByIdAndUpdate(
          purchase._id,
          { status: 'paid', balanceAmount: 0 }
        );
      } else {
        await Purchase.findByIdAndUpdate(
          purchase._id,
          { status: 'partially_paid' }
        );
      }
    }

    // Update inventory for each product
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

      // Update quantity
      inventory.quantity += item.quantity;

      // Add to inventory history
      inventory.inventory_history.push({
        unitId: item.unit,
        quantity: inventory.quantity,
        notes: `Stock in from purchase ${purchase.purchaseId}`,
        type: 'stock_in',
        adjustment: item.quantity,
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