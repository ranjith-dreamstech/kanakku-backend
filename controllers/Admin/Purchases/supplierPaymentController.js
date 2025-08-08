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
      createdBy: userId
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

      return {
        id: p._id,
        paymentId: p.paymentId,
        referenceNumber: p.referenceNumber,
        paymentDate: formatDate(p.paymentDate),
        amount: p.amount,
        paidAmount: p.paidAmount,
        dueAmount: p.dueAmount,
        notes: p.notes,
        attachment: p.attachment,
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
    const { id } = req.params;

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

    // Check if payment exists
    const existing = await SupplierPayment.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Supplier payment not found' });
    }

    // Handle new file if uploaded
    let attachment = existing.attachment;
    if (req.file) {
      attachment = req.file.filename;
    }

    const updated = await SupplierPayment.findByIdAndUpdate(id, {
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
      createdBy
    }, { new: true });

    res.status(200).json({
      success: true,
      message: 'Supplier payment updated successfully',
      data: updated
    });

  } catch (err) {
    res.status(500).json({
      message: 'Error updating supplier payment',
      error: err.message
    });
  }
};

const deleteSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await SupplierPayment.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Supplier payment not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier payment deleted successfully',
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
