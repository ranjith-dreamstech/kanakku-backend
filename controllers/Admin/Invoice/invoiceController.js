const mongoose = require('mongoose');
const Invoice = require('@models/Invoice');
const Quotation = require('@models/Quotation');
const { validationResult } = require('express-validator');
const InvoicePayment = require('@models/InvoicePayment');

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
      
    } = req.body;

    const customerId = req.user;
    const userId = req.user;

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
      status: 'UNPAID',
      payment_method : 'CASH',
      taxableAmount: req.body.subTotal || taxableAmount,
      TotalAmount: req.body.grandTotal || totalAmount,
      vat: req.body.totalTax || vat,
      totalDiscount: req.body.totalDiscount || totalDiscount,
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

    const { 
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
      status
    } = req.body;

    const invoiceId = req.params.id;
    const userId = req.user;

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

    // Handle signature image
    let signatureImage;
    if (sign_type === 'eSignature' && req.file) {
      signatureImage = req.file.path;
    } else {
      // Get existing signature if not changing
      const existingInvoice = await Invoice.findById(invoiceId).session(session);
      signatureImage = existingInvoice?.signatureImage;
    }

    const updateData = {
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
      status: status || 'UNPAID',
      payment_method: payment_method || 'CASH',
      taxableAmount: req.body.subTotal || calculatedTaxableAmount,
      TotalAmount: req.body.grandTotal || calculatedTotalAmount,
      vat: req.body.totalTax || calculatedVat,
      totalDiscount: req.body.totalDiscount || calculatedTotalDiscount,
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
    };

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
    res.status(500).json({ 
      message: 'Error updating invoice', 
      error: err.message 
    });
  }
};

const getInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customerId', 'name email phone image billingAddress')
            .populate('billFrom', 'name email phone companyName address image')  // Added image
            .populate('billTo', 'name email phone billingAddress image')       // Added image
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

        // BillTo details with image
        const billToDetails = invoice.billTo ? {
            id: invoice.billTo._id,
            name: invoice.billTo.name || '',
            email: invoice.billTo.email || null,
            phone: invoice.billTo.phone || null,
            billingAddress: invoice.billTo.billingAddress || null,
            image: invoice.billTo.image 
                ? `${baseUrl}${invoice.billTo.image.replace(/\\/g, '/')}`
                : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Customer'
        } : null;

        // Bank details
        const bankDetails = invoice.bank ? {
            id: invoice.bank.id || '',
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
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
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
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt
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

        const query = { isDeleted: false };

        if (status && ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'PARTIALLY_PAID'].includes(status)) {
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
            if (startDate) query.invoiceDate.$gte = new Date(startDate);
            if (endDate) query.invoiceDate.$lte = new Date(endDate);
        }

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

        const total = await Invoice.countDocuments(query);

        const invoices = await Invoice.find(query)
            .populate('customerId', 'name email phone image')
            .populate('billFrom', 'name email phone companyName')
            .populate('billTo', 'name email phone billingAddress image')
            .populate('bank', 'accountHoldername bankName branchName accountNumber IFSCCode')
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Get payments grouped by invoice
        const invoiceIds = invoices.map(inv => inv._id);
        const payments = await InvoicePayment.aggregate([
            { $match: { invoiceId: { $in: invoiceIds } } },
            { 
                $group: { 
                    _id: "$invoiceId",
                    totalPaid: { $sum: "$amount" },
                    lastPaymentDate: { $max: "$received_on" }
                }
            }
        ]);

        // Map payments to invoice IDs for quick lookup
        const paymentMap = {};
        payments.forEach(p => {
            paymentMap[p._id.toString()] = {
                totalPaid: p.totalPaid,
                lastPaymentDate: p.lastPaymentDate
            };
        });

        const lastInvoice = await Invoice.findOne()
            .sort({ invoiceNumber: -1 })
            .select('invoiceNumber');
        
        let nextInvoiceNumber = 'INV-000001';
        if (lastInvoice && lastInvoice.invoiceNumber) {
            const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
            nextInvoiceNumber = `INV-${String(lastNumber + 1).padStart(6, '0')}`;
        }

        const baseUrl = `${req.protocol}://${req.get('host')}/`;

        const formattedInvoices = invoices.map((invoice) => {
            const formatDate = (date) => {
                if (!date) return null;
                const d = new Date(date);
                const day = d.getDate().toString().padStart(2, '0');
                const month = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear();
                return `${day}, ${month} ${year}`;
            };

            const customerDetails = invoice.customerId ? {
                id: invoice.customerId._id,
                name: invoice.customerId.name || '',
                email: invoice.customerId.email || null,
                phone: invoice.customerId.phone || null,
                image: invoice.customerId.image 
                    ? `${baseUrl}${invoice.customerId.image.replace(/\\/g, '/')}`
                    : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Customer'
            } : null;

            const billFromDetails = invoice.billFrom ? {
                id: invoice.billFrom._id,
                name: invoice.billFrom.name || '',
                email: invoice.billFrom.email || null,
                phone: invoice.billFrom.phone || null,
                companyName: invoice.billFrom.companyName || null
            } : null;

            const billToDetails = invoice.billTo ? {
                id: invoice.billTo._id,
                name: invoice.billTo.name || '',
                email: invoice.billTo.email || null,
                phone: invoice.billTo.phone || null,
                billingAddress: invoice.billTo.billingAddress || null,
                image: invoice.billTo.image 
                      ? `${baseUrl}${invoice.billTo.image.replace(/\\/g, '/')}`
                      : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Customer' 
            } : null;

            const bankDetails = invoice.bank ? {
                accountHoldername: invoice.bank.accountHoldername || '',
                bankName: invoice.bank.bankName || '',
                branchName: invoice.bank.branchName || '',
                accountNumber: invoice.bank.accountNumber || '',
                IFSCCode: invoice.bank.IFSCCode || ''
            } : null;

            const signatureImage = invoice.signatureImage 
                ? `${baseUrl}${invoice.signatureImage.replace(/\\/g, '/')}`
                : null;

            const signatureDetails = invoice.sign_type === 'eSignature' ? {
                name: invoice.signatureName || null,
                image: signatureImage
            } : null;

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

            // Payment info
            const paymentInfo = paymentMap[invoice._id.toString()] || { totalPaid: 0, lastPaymentDate: null };

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
                totalPaid: paymentInfo.totalPaid,
                remainingBalance: invoice.TotalAmount - paymentInfo.totalPaid,
                lastPaymentDate: formatDate(paymentInfo.lastPaymentDate),
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

const listInvoicesMinimal = async (req, res) => {
    try {
        const { search = '' } = req.query;
        const userId = req.user;

        // Build base query
        const query = { 
            isDeleted: false 
            // Optionally add userId if invoices are user-specific
            // userId
        };

        // Add search filter if search term exists
        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { referenceNo: { $regex: search, $options: 'i' } },
                { 'customerId.name': { $regex: search, $options: 'i' } }
            ];
        }

        // Get invoices (limit if no search)
        const invoices = await Invoice.find(query)
            .select('_id invoiceNumber referenceNo invoiceDate status TotalAmount customerId')
            .populate('customerId', 'name') // Minimal customer info
            .sort({ invoiceDate: -1 })
            .limit(search ? 0 : 20);

        // Get payment info for these invoices
        const paymentDetails = await InvoicePayment.aggregate([
            { $match: { invoiceId: { $in: invoices.map(i => i._id) } } },
            { 
                $group: { 
                    _id: "$invoiceId",
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        // Create a quick lookup map for payments
        const paymentMap = paymentDetails.reduce((map, p) => {
            map[p._id.toString()] = p.totalPaid;
            return map;
        }, {});

        // Format response
        const formattedInvoices = invoices.map(invoice => {
            const totalPaid = paymentMap[invoice._id.toString()] || 0;
            return {
                id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                referenceNo: invoice.referenceNo,
                invoiceDate: invoice.invoiceDate,
                status: invoice.status,
                totalAmount: invoice.TotalAmount,
                customer: invoice.customerId ? {
                    id: invoice.customerId._id,
                    name: invoice.customerId.name
                } : null,
                payment: {
                    totalPaid,
                    remaining: invoice.TotalAmount - totalPaid
                }
            };
        });

        res.status(200).json({
            success: true,
            message: search 
                ? 'Search results for invoices retrieved successfully'
                : 'Last 20 invoices retrieved successfully',
            data: formattedInvoices,
            meta: {
                count: invoices.length,
                isSearchResult: !!search
            }
        });

    } catch (err) {
        console.error('List minimal invoices error:', err);
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

const convertQuotationToInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { quotationId } = req.params; // passed in URL
 const userId = req.user;
    // 1. Get quotation
    const quotation = await Quotation.findById(quotationId).session(session);
    if (!quotation) {
      throw new Error('Quotation not found');
    }

    // 2. Check if already converted
    if (quotation.invoiceId) {
      throw new Error('Quotation already converted to invoice');
    }

    // 3. Create invoice from quotation data
    const invoice = new Invoice({
      customerId: quotation.customerId || userId,
      invoiceDate: new Date(),
      dueDate: quotation.expiryDate,
      referenceNo: quotation.referenceNo,
      items: quotation.items,
      status: 'UNPAID',
      taxableAmount: quotation.taxableAmount,
      TotalAmount: quotation.TotalAmount,
      vat: quotation.vat,
      totalDiscount: quotation.totalDiscount,
      roundOff: quotation.roundOff,
      bank: quotation.bank,
      notes: quotation.notes,
      termsAndCondition: quotation.termsAndCondition,
      sign_type: quotation.sign_type,
      signatureName: quotation.signatureName,
      signatureImage: quotation.signatureImage,
      billFrom: quotation.billFrom,
      billTo: quotation.billTo,
      userId: quotation.userId,
      // store the quotation id in the invoice
      quotationId: quotation._id
    });

    await invoice.save({ session });

    // 4. Save invoiceId in quotation
    quotation.invoiceId = invoice._id;
    await quotation.save({ session });

    // 5. Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Quotation converted to invoice successfully',
      data: invoice
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: 'Error converting quotation to invoice',
      error: err.message
    });
  }
};

const recordInvoicePayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, payment_method, received_on, invoiceId, notes } = req.body;

    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Find the invoice
    const invoice = await Invoice.findById(invoiceId).session(session);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new Error('Invoice is already fully paid');
    }

    // Calculate total paid so far
    const totalPaidResult = await InvoicePayment.aggregate([
      { $match: { invoiceId: new mongoose.Types.ObjectId(invoiceId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const alreadyPaid = totalPaidResult.length > 0 ? totalPaidResult[0].total : 0;
    const remainingBalance = invoice.TotalAmount - alreadyPaid;

    if (amount > remainingBalance) {
      throw new Error(`Payment exceeds remaining balance. Remaining: ${remainingBalance}`);
    }

    // Create the payment record
    const payment = new InvoicePayment({
      invoiceId,
      amount,
      payment_method, // If ObjectId reference, make sure schema is updated
      received_on: new Date(received_on),
      notes: notes || '',
      received_by: req.user
    });

    await payment.save({ session });

    // Update invoice status
    const newTotalPaid = alreadyPaid + amount;
    if (newTotalPaid === invoice.TotalAmount) {
      invoice.status = 'PAID';
    } else if (newTotalPaid > 0) {
      invoice.status = 'PARTIALLY_PAID';
    }
    await invoice.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Payment recorded successfully',
      data: payment,
      invoice_status: invoice.status,
      remaining_balance: invoice.TotalAmount - newTotalPaid
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: 'Error recording payment',
      error: err.message
    });
  }
};

module.exports = {
  createInvoice,
  updateInvoice,
  getInvoice,
  getAllInvoices,
  listInvoicesMinimal,
  convertQuotationToInvoice,
  recordInvoicePayment,
  deleteInvoice
};