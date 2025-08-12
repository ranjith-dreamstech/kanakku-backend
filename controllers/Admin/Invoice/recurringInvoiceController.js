const mongoose = require('mongoose');
const Invoice = require('@models/Invoice');
const { validationResult } = require('express-validator');

const createRecurringInvoice = async (req, res) => {
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
      parentInvoiceId, // ID of the original invoice
      ...invoiceData
    } = req.body;

    // Get the parent invoice
    const parentInvoice = await Invoice.findById(parentInvoiceId).session(session);
    if (!parentInvoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Parent invoice not found' });
    }

    if (!parentInvoice.isRecurring) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Parent invoice is not a recurring invoice' });
    }

    // Calculate next recurring date
    const nextRecurringDate = calculateNextRecurringDate(
      new Date(),
      parentInvoice.recurring,
      parentInvoice.recurringDuration
    );

    // Create the new recurring invoice
    const recurringInvoice = new Invoice({
      ...parentInvoice.toObject(),
      _id: new mongoose.Types.ObjectId(),
      parentInvoice: parentInvoiceId,
      invoiceDate: new Date(),
      dueDate: nextRecurringDate,
      status: 'DRAFT',
      isRecurring: true,
      nextRecurringDate: calculateNextRecurringDate(
        nextRecurringDate,
        parentInvoice.recurring,
        parentInvoice.recurringDuration
      ),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Remove fields that shouldn't be copied
    delete recurringInvoice.invoiceNumber;
    delete recurringInvoice._id;

    await recurringInvoice.save({ session });

    // Update parent invoice's next recurring date
    parentInvoice.nextRecurringDate = nextRecurringDate;
    await parentInvoice.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Recurring invoice created successfully',
      data: recurringInvoice
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    res.status(500).json({ message: 'Error creating recurring invoice', error: err.message });
  }
};

const getAllRecurringInvoices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      status,
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = { 
      isDeleted: false,
      isRecurring: true
    };

    // Add status filter
    if (status && ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'].includes(status)) {
      query.status = status;
    }

    // Add search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { invoiceNumber: searchRegex },
        { referenceNo: searchRegex },
        { 'customerId.name': searchRegex }
      ];
    }

    // Get total count
    const total = await Invoice.countDocuments(query);

    // Get invoices with pagination
    const invoices = await Invoice.find(query)
      .populate('customerId', 'name email phone')
      .populate('parentInvoice', 'invoiceNumber invoiceDate')
      .sort({ nextRecurringDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    const baseUrl = `${req.protocol}://${req.get('host')}/`;

    const formattedInvoices = invoices.map(invoice => {
      // Format dates as "dd, MMM yyyy"
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('default', { month: 'short' });
        const year = d.getFullYear();
        return `${day}, ${month} ${year}`;
      };

      return {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customerId ? {
          id: invoice.customerId._id,
          name: invoice.customerId.name,
          email: invoice.customerId.email,
          phone: invoice.customerId.phone
        } : null,
        parentInvoice: invoice.parentInvoice ? {
          id: invoice.parentInvoice._id,
          invoiceNumber: invoice.parentInvoice.invoiceNumber,
          invoiceDate: formatDate(invoice.parentInvoice.invoiceDate)
        } : null,
        invoiceDate: formatDate(invoice.invoiceDate),
        dueDate: formatDate(invoice.dueDate),
        nextRecurringDate: formatDate(invoice.nextRecurringDate),
        status: invoice.status,
        recurring: invoice.recurring,
        recurringDuration: invoice.recurringDuration,
        TotalAmount: invoice.TotalAmount,
        createdAt: formatDate(invoice.createdAt)
      };
    });

    res.status(200).json({
      success: true,
      message: 'Recurring invoices retrieved successfully',
      data: {
        invoices: formattedInvoices,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Error getting recurring invoices:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching recurring invoices',
      error: err.message
    });
  }
};

const getChildInvoices = async (req, res) => {
  try {
    const { parentInvoiceId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      parentInvoice: parentInvoiceId,
      isDeleted: false
    };

    // Get total count
    const total = await Invoice.countDocuments(query);

    // Get child invoices
    const childInvoices = await Invoice.find(query)
      .populate('customerId', 'name email')
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    const formattedInvoices = childInvoices.map(invoice => ({
      id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      TotalAmount: invoice.TotalAmount,
      payment_method: invoice.payment_method
    }));

    res.status(200).json({
      success: true,
      message: 'Child invoices retrieved successfully',
      data: {
        invoices: formattedInvoices,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (err) {
    console.error('Error getting child invoices:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching child invoices',
      error: err.message
    });
  }
};

function calculateNextRecurringDate(currentDate, frequency, duration) {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + duration);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (duration * 7));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + duration);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + duration);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }
  
  return date;
}

module.exports = {
  createRecurringInvoice,
  getAllRecurringInvoices,
  getChildInvoices
};