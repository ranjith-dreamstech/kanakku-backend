const mongoose = require('mongoose');
const Invoice = require('@models/Invoice');
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

    let signatureImage = null;
    if (sign_type === 'eSignature' && req.file) {
      signatureImage = req.file.path;
    }

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
            .populate('customerId', 'name email phone image billingAddress')
            .populate('billFrom', 'name email phone companyName address')
            .populate('billTo', 'name email phone billingAddress')
            .populate('bank', 'accountHoldername bankName branchName accountNumber IFSCCode');

        if (!invoice) {
            return res.status(404).json({ 
                success: false,
                message: 'Invoice not found' 
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}/`;

        // Format dates as "dd, MMM yyyy"
        const formatDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = d.getDate().toString().padStart(2, '0');
            const month = d.toLocaleString('default', { month: 'short' });
            const year = d.getFullYear();
            return `${day}, ${month} ${year}`;
        };

        // Customer details with image
        const customerDetails = invoice.customerId ? {
            id: invoice.customerId._id,
            name: invoice.customerId.name || '',
            email: invoice.customerId.email || null,
            phone: invoice.customerId.phone || null,
            image: invoice.customerId.image 
                ? `${baseUrl}${invoice.customerId.image.replace(/\\/g, '/')}`
                : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Customer',
            billingAddress: invoice.customerId.billingAddress || null
        } : null;

        const billFromDetails = invoice.billFrom ? {
            id: invoice.billFrom._id,
            name: invoice.billFrom.name || '',
            email: invoice.billFrom.email || null,
            phone: invoice.billFrom.phone || null,
            companyName: invoice.billFrom.companyName || null,
            address: invoice.billFrom.address || null
        } : null;

        const billToDetails = invoice.billTo ? {
            id: invoice.billTo._id,
            name: invoice.billTo.name || '',
            email: invoice.billTo.email || null,
            phone: invoice.billTo.phone || null,
            billingAddress: invoice.billTo.billingAddress || null
        } : null;

        // Bank details
        const bankDetails = invoice.bank ? {
            accountHoldername: invoice.bank.accountHoldername || '',
            bankName: invoice.bank.bankName || '',
            branchName: invoice.bank.branchName || '',
            accountNumber: invoice.bank.accountNumber || '',
            IFSCCode: invoice.bank.IFSCCode || ''
        } : null;

        // Signature details
        const signatureImage = invoice.signatureImage 
            ? `${baseUrl}${invoice.signatureImage.replace(/\\/g, '/')}`
            : null;

        const signatureDetails = invoice.sign_type === 'eSignature' ? {
            name: invoice.signatureName || null,
            image: signatureImage
        } : null;

        // Format items
        const formattedItems = invoice.items.map(item => ({
            id: item._id,
            productId: item.productId?._id || null,
            name: item.name || (item.productId?.name || ''),
            description: item.productId?.description || '',
            code: item.productId?.code || '',
            key: item.key || 0,
            quantity: item.quantity,
            units: item.units,
            unit: item.unit ? {
                id: item.unit._id,
                name: item.unit.name,
                symbol: item.unit.symbol
            } : null,
            rate: item.rate,
            discount: item.discount,
            tax: item.tax,
            taxInfo: item.taxInfo,
            amount: item.amount,
            discountType: item.discountType,
            isRateFormUpdated: item.isRateFormUpdated,
            form_updated_discounttype: item.form_updated_discounttype,
            form_updated_discount: item.form_updated_discount,
            form_updated_rate: item.form_updated_rate,
            form_updated_tax: item.form_updated_tax
        }));

        const responseData = {
            id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            customer: customerDetails,
            invoiceDate: formatDate(invoice.invoiceDate),
            dueDate: formatDate(invoice.dueDate),
            referenceNo: invoice.referenceNo,
            status: invoice.status,
            payment_method: invoice.payment_method,
            taxableAmount: invoice.taxableAmount,
            totalDiscount: invoice.totalDiscount,
            vat: invoice.vat,
            TotalAmount: invoice.TotalAmount,
            roundOff: invoice.roundOff,
            items: formattedItems,
            billFrom: billFromDetails,
            billTo: billToDetails,
            bank: bankDetails,
            notes: invoice.notes,
            termsAndCondition: invoice.termsAndCondition,
            isRecurring: invoice.isRecurring,
            recurring: invoice.isRecurring ? invoice.recurring : null,
            recurringDuration: invoice.isRecurring ? invoice.recurringDuration : null,
            sign_type: invoice.sign_type,
            signature: signatureDetails,
            createdAt: formatDate(invoice.createdAt),
            updatedAt: formatDate(invoice.updatedAt)
        };

        res.status(200).json({
            success: true,
            message: 'Invoice retrieved successfully',
            data: responseData
        });

    } catch (err) {
        console.error('Get invoice error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching invoice',
            error: err.message
        });
    }
};

const getAllInvoices = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            search = '',
            customerId,
            startDate,
            endDate,
            payment_method
        } = req.query;

        const userId = req.user._id;
        const skip = (page - 1) * limit;

        const query = { 
            isDeleted: false 
        };

        if (status && ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'].includes(status)) {
            query.status = status;
        }

        if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
            query.customerId = customerId;
        }

        if (payment_method) {
            query.payment_method = payment_method;
        }

        if (startDate || endDate) {
            query.invoiceDate = {};
            if (startDate) {
                query.invoiceDate.$gte = new Date(startDate);
            }
            if (endDate) {
                query.invoiceDate.$lte = new Date(endDate);
            }
        }

        // Add search filter
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { invoiceNumber: searchRegex },
                { referenceNo: searchRegex },
                { 'items.name': searchRegex },
                { notes: searchRegex },
                { 'customerId.name': searchRegex }
            ];
        }

        // Get total count
        const total = await Invoice.countDocuments(query);

        // Get invoices with pagination and population
        const invoices = await Invoice.find(query)
            .populate('customerId', 'name email phone image')
           
            .populate('billFrom', 'name email phone companyName')
            .populate('billTo', 'name email phone billingAddress')
            .populate('bank', 'accountHoldername bankName branchName accountNumber IFSCCode')
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Get the next invoice ID
        const lastInvoice = await Invoice.findOne()
            .sort({ invoiceNumber: -1 })
            .select('invoiceNumber');
        
        let nextInvoiceNumber = 'INV-000001'; // Default if no invoices exist
        if (lastInvoice && lastInvoice.invoiceNumber) {
            const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
            nextInvoiceNumber = `INV-${String(lastNumber + 1).padStart(6, '0')}`;
        }

        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        
        const formattedInvoices = invoices.map((invoice) => {
            // Format dates as "dd, MMM yyyy"
            const formatDate = (date) => {
                if (!date) return null;
                const d = new Date(date);
                const day = d.getDate().toString().padStart(2, '0');
                const month = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear();
                return `${day}, ${month} ${year}`;
            };

            // Customer details with image
            const customerDetails = invoice.customerId ? {
                id: invoice.customerId._id,
                name: invoice.customerId.name || '',
                email: invoice.customerId.email || null,
                phone: invoice.customerId.phone || null,
                image: invoice.customerId.image 
                    ? `${baseUrl}${invoice.customerId.image.replace(/\\/g, '/')}`
                    : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Customer'
            } : null;

            // BillFrom details (typically the seller/company)
            const billFromDetails = invoice.billFrom ? {
                id: invoice.billFrom._id,
                name: invoice.billFrom.name || '',
                email: invoice.billFrom.email || null,
                phone: invoice.billFrom.phone || null,
                companyName: invoice.billFrom.companyName || null
            } : null;

            // BillTo details (from Customer model)
            const billToDetails = invoice.billTo ? {
                id: invoice.billTo._id,
                name: invoice.billTo.name || '',
                email: invoice.billTo.email || null,
                phone: invoice.billTo.phone || null,
                billingAddress: invoice.billTo.billingAddress || null
            } : null;

            // Bank details
            const bankDetails = invoice.bank ? {
                accountHoldername: invoice.bank.accountHoldername || '',
                bankName: invoice.bank.bankName || '',
                branchName: invoice.bank.branchName || '',
                accountNumber: invoice.bank.accountNumber || '',
                IFSCCode: invoice.bank.IFSCCode || ''
            } : null;

            // Signature details
            const signatureImage = invoice.signatureImage 
                ? `${baseUrl}${invoice.signatureImage.replace(/\\/g, '/')}`
                : null;

            const signatureDetails = invoice.sign_type === 'eSignature' ? {
                name: invoice.signatureName || null,
                image: signatureImage
            } : null;

            // Format items
            const formattedItems = invoice.items.map(item => ({
                id: item._id,
                productId: item.productId?._id || null,
                name: item.name || (item.productId?.name || ''),
                description: item.productId?.description || '',
                key: item.key || 0,
                quantity: item.quantity,
                units: item.units,
                unit: item.unit ? {
                    id: item.unit._id,
                    name: item.unit.name,
                    symbol: item.unit.symbol
                } : null,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                taxInfo: item.taxInfo,
                amount: item.amount,
                discountType: item.discountType
            }));

            return {
                id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                customer: customerDetails,
                invoiceDate: formatDate(invoice.invoiceDate),
                dueDate: formatDate(invoice.dueDate),
                referenceNo: invoice.referenceNo,
                status: invoice.status,
                payment_method: invoice.payment_method,
                taxableAmount: invoice.taxableAmount,
                totalDiscount: invoice.totalDiscount,
                vat: invoice.vat,
                TotalAmount: invoice.TotalAmount,
                roundOff: invoice.roundOff,
                items: formattedItems,
                itemsCount: invoice.items.length,
                billFrom: billFromDetails,
                billTo: billToDetails,
                bank: bankDetails,
                notes: invoice.notes,
                termsAndCondition: invoice.termsAndCondition,
                isRecurring: invoice.isRecurring,
                recurring: invoice.isRecurring ? invoice.recurring : null,
                recurringDuration: invoice.isRecurring ? invoice.recurringDuration : null,
                sign_type: invoice.sign_type,
                signature: signatureDetails,
                createdAt: formatDate(invoice.createdAt),
                updatedAt: formatDate(invoice.updatedAt)
            };
        });

        res.status(200).json({
            success: true,
            message: 'Invoices retrieved successfully',
            data: {
                invoices: formattedInvoices,
                nextInvoiceNumber,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (err) {
        console.error('List invoices error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching invoices',
            error: err.message
        });
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