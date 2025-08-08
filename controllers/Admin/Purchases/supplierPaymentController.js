const path = require('path');
const { validationResult } = require('express-validator');
const SupplierPayment = require('@models/SupplierPayment');
const Purchase = require('@models/Purchase');

const createSupplierPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    let userId = req.user;
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
    } = req.body;

    let attachment = null;
    if (req.file) {
      attachment = `uploads/${req.file.filename}`;
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
      attachment,
      createdBy: userId
    });

    const savedPayment = await newPayment.save();

    let purchaseStatus = 'partially_paid';
    if (dueAmount === 0) {
      purchaseStatus = 'paid';
    }

    await Purchase.findByIdAndUpdate(
      purchaseId,
      {
        $set: {
          status: purchaseStatus,
        }
      }
    );

    res.status(201).json({
      success: true,
      message: 'Supplier payment created successfully',
      data: {
        payment: savedPayment,
        updatedPurchaseStatus: purchaseStatus
      }
    });

  } catch (err) {
    console.error('Error creating supplier payment:', err);
    res.status(500).json({
      message: 'Error creating supplier payment',
      error: err.message
    });
  }
};

const listSupplierPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      supplierId,
      startDate,
      endDate,
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isDeleted: false };

    // Filter by supplierId
    if (supplierId && mongoose.Types.ObjectId.isValid(supplierId)) {
      query.supplierId = supplierId;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) {
        query.paymentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.paymentDate.$lte = new Date(endDate);
      }
    }

    // Search in specific fields
    if (search) {
      query.$or = [
        { referenceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { paymentId: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await SupplierPayment.countDocuments(query);

    const payments = await SupplierPayment.find(query)
      .populate({
        path: 'supplierId',
        select: 'firstName lastName email phone profileImage',
        model: 'User'
      })
      .populate('purchaseId', 'purchaseId totalAmount purchaseDate')
      .populate('paymentMode', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Format function
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `${day}, ${month} ${year}`;
    };

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    const formattedPayments = payments.map((p) => {
      const supplier = p.supplierId ? {
        id: p.supplierId._id,
        name: `${p.supplierId.firstName || ''} ${p.supplierId.lastName || ''}`.trim(),
        email: p.supplierId.email || null,
        phone: p.supplierId.phone || null,
        profileImage: p.supplierId.profileImage 
          ? `${baseUrl}${p.supplierId.profileImage.replace(/\\/g, '/')}`
          : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile'
      } : null;

      const purchase = p.purchaseId ? {
        id: p.purchaseId._id,
        purchaseId: p.purchaseId.purchaseId,
        totalAmount: p.purchaseId.totalAmount,
        purchaseDate: formatDate(p.purchaseId.purchaseDate)
      } : null;

      // Handle attachment URL
      let attachmentUrl = null;
      if (p.attachment) {
        const cleanPath = p.attachment.replace(/\\/g, '/');
        // Check if the path already includes the base URL
        attachmentUrl = cleanPath.startsWith('http') 
          ? cleanPath 
          : `${baseUrl}${cleanPath}`;
      }

      return {
        id: p._id,
        paymentId: p.paymentId,
        referenceNumber: p.referenceNumber,
        paymentDate: formatDate(p.paymentDate),
        amount: p.amount,
        paidAmount: p.paidAmount,
        dueAmount: p.dueAmount,
        notes: p.notes,
        attachment: attachmentUrl,
        supplier,
        purchase,
        paymentMode: p.paymentMode ? p.paymentMode.name : null,
        createdAt: formatDate(p.createdAt),
        updatedAt: formatDate(p.updatedAt)
      };
    });

    res.status(200).json({
      success: true,
      message: 'Supplier payments retrieved successfully',
      data: {
        payments: formattedPayments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Error fetching supplier payments:', err);
    res.status(500).json({
      message: 'Error fetching supplier payments',
      error: err.message
    });
  }
};

const updateSupplierPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const userId = req.user;
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
    } = req.body;

    // Check if payment exists
    const existingPayment = await SupplierPayment.findById(id);
    if (!existingPayment) {
      return res.status(404).json({ 
        success: false,
        message: 'Supplier payment not found' 
      });
    }

    // Handle new file if uploaded - include 'uploads/' prefix
    let attachment = existingPayment.attachment;
    if (req.file) {
      attachment = `uploads/${req.file.filename}`;
    }

    const updatedPayment = await SupplierPayment.findByIdAndUpdate(
      id,
      {
        purchaseId,
        supplierId,
        referenceNumber,
        paymentDate,
        paymentMode,
        amount,
        paidAmount,
        dueAmount,
        notes,
        attachment,
        updatedBy: userId
      },
      { new: true }
    );

    // Update purchase status if payment amounts changed
    if (existingPayment.paidAmount !== paidAmount || existingPayment.dueAmount !== dueAmount) {
      let purchaseStatus = 'partially_paid';
      if (dueAmount === 0) {
        purchaseStatus = 'paid';
      }

      await Purchase.findByIdAndUpdate(
        purchaseId,
        {
          $set: {
            status: purchaseStatus,
          }
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Supplier payment updated successfully',
      data: {
        payment: updatedPayment,
        ...(existingPayment.purchaseId === purchaseId && {
          updatedPurchaseStatus: dueAmount === 0 ? 'paid' : 'partially_paid'
        })
      }
    });

  } catch (err) {
    console.error('Error updating supplier payment:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating supplier payment',
      error: err.message
    });
  }
};

const deleteSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;

    // First find the payment to get the purchaseId
    const payment = await SupplierPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: 'Supplier payment not found' });
    }

    // Delete the payment
    const deleted = await SupplierPayment.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Supplier payment not found' });
    }

    // Update the associated purchase status to "partial paid"
    const purchase = await Purchase.findByIdAndUpdate(
      payment.purchaseId,
      { status: 'partial paid' },
      { new: true }
    );

    if (!purchase) {
      console.warn(`Purchase ${payment.purchaseId} not found, but payment was deleted`);
    }

    res.status(200).json({
      success: true,
      message: 'Supplier payment deleted successfully and purchase status updated to partial paid',
    });

  } catch (err) {
    res.status(500).json({
      message: 'Error deleting supplier payment',
      error: err.message
    });
  }
};



module.exports = {
  createSupplierPayment,
  listSupplierPayments,
  updateSupplierPayment,
  deleteSupplierPayment
};
