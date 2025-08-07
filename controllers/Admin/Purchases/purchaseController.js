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
      grandTotal,
      paidAmount = 0,
      sign_type,
      signatureId,
      signatureName,
      checkNumber,
      bank
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
    const calculatedPaidAmount = status === 'paid' ? calculatedGrandTotal : paidAmount;
    const calculatedDueAmount = calculatedGrandTotal - calculatedPaidAmount;

    // Generate purchaseOrderId if not provided
    let purchaseId = req.body.purchaseId;
    if (!purchaseId) {
      const count = await PurchaseOrder.countDocuments();
      purchaseId = `PO-${String(count + 1).padStart(6, '0')}`;
    }

    // Create purchase
    const purchase = new Purchase({
      purchaseOrderId,
      vendorId: billTo, // Assuming billTo is the vendor/supplier
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      dueDate: new Date(purchaseDate ? new Date(purchaseDate) : new Date()), // Same as purchase date if not specified
      referenceNo: referenceNo || '',
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        qty: item.quantity,
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
      taxableAmount: req.body.subTotal || taxableAmount,
      totalDiscount: req.body.totalDiscount || totalDiscount,
      totalTax: req.body.totalTax || totalTax,
      roundOff: req.body.roundOff || false,
      totalAmount: req.body.grandTotal || totalAmount,
      paidAmount: calculatedPaidAmount,
      balanceAmount: calculatedDueAmount,
      bank: req.body.bank || null,
      notes: notes || '',
      termsAndCondition: termsAndCondition || '',
      sign_type: sign_type || 'none',
      signatureId: signatureId || null,
      signatureImage: sign_type === 'eSignature' ? req.file.path : null,
      signatureName: sign_type === 'eSignature' ? signatureName : null,
      checkNumber: checkNumber || null,
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

    // Create supplier payment if status is paid or partially_paid
    if (status === 'paid' || status === 'partially_paid') {
      const supplierPayment = new SupplierPayment({
        purchaseId: purchase._id,
        supplierId: billTo,
        referenceNumber: req.body.sp_referenceNumber || '',
        paymentDate: req.body.sp_paymentDate || '',
        paymentMode: req.body.sp_paymentMode || '',
        amount: req.body.sp_amount || '',
        paidAmount: req.body.sp_amount || '',
        dueAmount: req.body.sp_due_amount || '',
        notes: req.body.sp_notes  || '',
        createdBy: userId
      });

      await supplierPayment.save();
    }

    // Update inventory for each product ONLY if status is 'paid' or 'partially_paid'
    if (status === 'paid') {
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
        inventory.quantity += item.quantity || 0;

        // Add to inventory history
        inventory.inventory_history.push({
          unitId: item.unit,
          quantity: inventory.quantity,
          notes: `Stock in from purchase ${purchase.purchaseId}`,
          type: 'stock_in',
          adjustment: item.quantity || 0,
          referenceId: purchase._id,
          referenceType: 'purchase',
          createdBy: userId
        });

        await inventory.save();
      }
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
          sign_type: purchase.sign_type,
          signatureName: purchase.signatureName,
          items: purchase.items.map(item => ({
            id: item.productId, // Updated to match the schema change
            name: item.name,
            unit: item.unit,
            quantity: item.quantity, // Updated to match the schema change
            rate: item.rate,
            discount: item.discount,
            tax: item.tax,
            tax_group_id: item.tax_group_id,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            amount: item.amount
          }))
        },
        ...((status === 'paid' || status === 'partially_paid') && {
          payment: {
            paymentId: supplierPayment.paymentId,
            amount: supplierPayment.amount,
            paidAmount: supplierPayment.paidAmount,
            dueAmount: supplierPayment.dueAmount
          }
        })
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
        const { 
            page = 1, 
            limit = 10, 
            status, 
            search = '',
            vendorId,
            startDate,
            endDate,
            paymentMode
        } = req.query;

        const skip = (page - 1) * limit;

        // Build query
        const query = { 
            isDeleted: false 
        };

        // Add status filter
        if (status && ['pending', 'completed', 'cancelled', 'partially_paid', 'paid'].includes(status)) {
            query.status = status;
        }

        // Add vendor filter
        if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
            query.vendorId = vendorId;
        }

        // Add payment mode filter
        if (paymentMode) {
            query.paymentMode = { $exists: true, $ne: null };
        }

        // Add date range filter
        if (startDate || endDate) {
            query.purchaseDate = {};
            if (startDate) {
                query.purchaseDate.$gte = new Date(startDate);
            }
            if (endDate) {
                query.purchaseDate.$lte = new Date(endDate);
            }
        }

        // Add search filter
        if (search) {
            query.$or = [
                { purchaseId: { $regex: search, $options: 'i' } },
                { purchaseOrderId: { $regex: search, $options: 'i' } },
                { referenceNo: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count
        const total = await Purchase.countDocuments(query);

        // Build base query
        let purchaseQuery = Purchase.find(query)
            .populate('vendorId', 'firstName lastName email phone')
            .populate('userId', 'firstName lastName email')
            .populate('billFrom', 'firstName lastName email profileImage phone')
            .populate('billTo', 'firstName lastName email profileImage phone')
            .populate({
                path: 'bank',
                model: 'BankDetail',
                select: 'bankName accountNumber accountHoldername IFSCCode'
            })
            .sort({ purchaseDate: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Conditionally populate paymentMode only when paymentMode filter is applied
        if (paymentMode) {
            purchaseQuery = purchaseQuery.populate({
                path: 'paymentMode',
                model: 'PaymentMode',
                select: 'name slug status',
                match: { _id: mongoose.Types.ObjectId.isValid(paymentMode) ? mongoose.Types.ObjectId(paymentMode) : null }
            });
        }

        // Execute query
        const purchases = await purchaseQuery;

        const formattedPurchases = await Promise.all(purchases.map(async (purchase) => {
            const baseUrl = `${req.protocol}://${req.get('host')}/`;
            const signatureImage = purchase.signatureImage 
                ? `${baseUrl}${purchase.signatureImage.replace(/\\/g, '/')}`
                : null;

            // Format dates as "dd, MMM yyyy"
            const formatDate = (date) => {
                if (!date) return null;
                const d = new Date(date);
                const day = d.getDate().toString().padStart(2, '0');
                const month = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear();
                return `${day}, ${month} ${year}`;
            };

            // Vendor details
            const vendorDetails = purchase.vendorId ? {
                id: purchase.vendorId._id,
                name: `${purchase.vendorId.firstName || ''} ${purchase.vendorId.lastName || ''}`.trim(),
                email: purchase.vendorId.email || null,
                phone: purchase.vendorId.phone || null
            } : null;

            // User details (who created the purchase)
            const userDetails = purchase.userId ? {
                id: purchase.userId._id,
                name: `${purchase.userId.firstName || ''} ${purchase.userId.lastName || ''}`.trim(),
                email: purchase.userId.email || null
            } : null;

            // BillFrom details
            const billFromDetails = purchase.billFrom ? {
                id: purchase.billFrom._id,
                name: `${purchase.billFrom.firstName || ''} ${purchase.billFrom.lastName || ''}`.trim(),
                email: purchase.billFrom.email || null,
                phone: purchase.billFrom.phone || null,
                profileImage: purchase.billFrom.profileImage 
                    ? `${baseUrl}${purchase.billFrom.profileImage.replace(/\\/g, '/')}`
                    : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile'
            } : null;

            // BillTo details
            const billToDetails = purchase.billTo ? {
                id: purchase.billTo._id,
                name: `${purchase.billTo.firstName || ''} ${purchase.billTo.lastName || ''}`.trim(),
                email: purchase.billTo.email || null,
                phone: purchase.billTo.phone || null,
                profileImage: purchase.billTo.profileImage 
                    ? `${baseUrl}${purchase.billTo.profileImage.replace(/\\/g, '/')}`
                    : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile'
            } : null;

            // Bank details
            const bankDetails = purchase.bank ? {
                id: purchase.bank._id,
                name: purchase.bank.bankName || null,
                accountNumber: purchase.bank.accountNumber || null,
                accountHolderName: purchase.bank.accountHoldername || null,
                ifscCode: purchase.bank.IFSCCode || null
            } : null;

            // Payment mode details (only if paymentMode was populated)
            const paymentModeDetails = purchase.paymentMode ? {
                id: purchase.paymentMode._id,
                name: purchase.paymentMode.name,
                slug: purchase.paymentMode.slug,
                status: purchase.paymentMode.status
            } : null;

            // Signature details
            const signatureDetails = purchase.sign_type === 'eSignature' ? {
                name: purchase.signatureName || null,
                image: signatureImage
            } : purchase.signatureId ? {
                id: purchase.signatureId._id,
                name: purchase.signatureId.signatureName || null
            } : null;

            return {
                id: purchase._id,
                purchaseId: purchase.purchaseId,
                purchaseOrderId: purchase.purchaseOrderId,
                vendor: vendorDetails,
                user: userDetails,
                purchaseDate: formatDate(purchase.purchaseDate),
                dueDate: formatDate(purchase.dueDate),
                referenceNo: purchase.referenceNo,
                status: purchase.status,
                paymentMode: paymentModeDetails,
                taxableAmount: purchase.taxableAmount,
                totalDiscount: purchase.totalDiscount,
                totalTax: purchase.totalTax,
                totalAmount: purchase.totalAmount,
                paidAmount: purchase.paidAmount,
                balanceAmount: purchase.balanceAmount,
                itemsCount: purchase.items.length,
                billFrom: billFromDetails,
                billTo: billToDetails,
                notes: purchase.notes,
                termsAndCondition: purchase.termsAndCondition,
                sign_type: purchase.sign_type,
                signature: signatureDetails,
                bank: bankDetails,
                checkNumber: purchase.checkNumber,
                createdAt: formatDate(purchase.createdAt),
                updatedAt: formatDate(purchase.updatedAt)
            };
        }));

        res.status(200).json({
            success: true,
            message: 'Purchases retrieved successfully',
            data: {
                purchases: formattedPurchases,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (err) {
        console.error('Get all purchases error:', err);
        res.status(500).json({
            message: 'Error fetching purchases',
            error: err.message
        });
    }
};

const listPurchasesMinimal = async (req, res) => {
    try {
        const { search = '' } = req.query;
        const userId = req.user;

        // Build query
        const query = { 
            userId, 
            isDeleted: false 
        };

        // Add search filter if search term exists
        if (search) {
            query.$or = [
                { purchaseId: { $regex: search, $options: 'i' } },
                { purchaseOrderId: { $regex: search, $options: 'i' } },
                { referenceNo: { $regex: search, $options: 'i' } },
                { 'vendorId.name': { $regex: search, $options: 'i' } } // Assuming vendorId is populated
            ];
        }

        // Get purchases with different limits based on search
        const purchases = await Purchase.find(query)
            .select('_id purchaseId referenceNo purchaseDate status totalAmount vendorId')
            .populate('vendorId', 'name') // Minimal vendor info
            .sort({ purchaseDate: -1 })
            .limit(search ? 0 : 20); // No limit when searching, limit 20 otherwise

        // Format response
        const formattedPurchases = purchases.map(purchase => ({
            id: purchase._id,
            purchaseId: purchase.purchaseId,
            referenceNo: purchase.referenceNo,
            purchaseDate: purchase.purchaseDate,
            status: purchase.status,
            totalAmount: purchase.totalAmount,
            vendor: purchase.vendorId ? {
                id: purchase.vendorId._id,
                name: purchase.vendorId.name
            } : null
        }));

        res.status(200).json({
            success: true,
            message: search 
                ? 'Search results for purchases retrieved successfully'
                : 'Last 20 purchases retrieved successfully',
            data: formattedPurchases,
            meta: {
                count: purchases.length,
                isSearchResult: !!search
            }
        });

    } catch (err) {
        console.error('List minimal purchases error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching purchases',
            error: err.message
        });
    }
};

// Get purchase by ID
const getPurchaseById = async (req, res) => {
    try {
        const purchase = await Purchase.findById(req.params.id)
            .populate('vendorId', 'firstName lastName email phone')
            .populate('userId', 'firstName lastName email')
            .populate('billFrom', 'firstName lastName email profileImage phone address')
            .populate('billTo', 'firstName lastName email profileImage phone address')
            .populate({
                path: 'items.id',
                model: 'Product',
                select: 'name sku description'
            })
            .populate({
                path: 'items.tax_group_id',
                model: 'TaxGroup',
                select: 'name rate'
            })
            .populate({
                path: 'bank',
                model: 'BankDetail',
                select: 'bankName accountNumber accountHoldername IFSCCode'
            });

        if (!purchase) {
            return res.status(404).json({ 
                success: false,
                message: 'Purchase not found' 
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        const signatureImage = purchase.signatureImage 
            ? `${baseUrl}${purchase.signatureImage.replace(/\\/g, '/')}`
            : null;

        // Format dates as "dd, MMM yyyy"
        const formatDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = d.getDate().toString().padStart(2, '0');
            const month = d.toLocaleString('default', { month: 'short' });
            const year = d.getFullYear();
            return `${day}, ${month} ${year}`;
        };

        // Vendor details
        const vendorDetails = purchase.vendorId ? {
            id: purchase.vendorId._id,
            name: `${purchase.vendorId.firstName || ''} ${purchase.vendorId.lastName || ''}`.trim(),
            email: purchase.vendorId.email || null,
            phone: purchase.vendorId.phone || null
        } : null;

        // User details (who created the purchase)
        const userDetails = purchase.userId ? {
            id: purchase.userId._id,
            name: `${purchase.userId.firstName || ''} ${purchase.userId.lastName || ''}`.trim(),
            email: purchase.userId.email || null
        } : null;

        // BillFrom details
        const billFromDetails = purchase.billFrom ? {
            id: purchase.billFrom._id,
            name: `${purchase.billFrom.firstName || ''} ${purchase.billFrom.lastName || ''}`.trim(),
            email: purchase.billFrom.email || null,
            phone: purchase.billFrom.phone || null,
            address: purchase.billFrom.address || null,
            profileImage: purchase.billFrom.profileImage 
                ? `${baseUrl}${purchase.billFrom.profileImage.replace(/\\/g, '/')}`
                : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile'
        } : null;

        // BillTo details
        const billToDetails = purchase.billTo ? {
            id: purchase.billTo._id,
            name: `${purchase.billTo.firstName || ''} ${purchase.billTo.lastName || ''}`.trim(),
            email: purchase.billTo.email || null,
            phone: purchase.billTo.phone || null,
            address: purchase.billTo.address || null,
            profileImage: purchase.billTo.profileImage 
                ? `${baseUrl}${purchase.billTo.profileImage.replace(/\\/g, '/')}`
                : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile'
        } : null;

        // Bank details
        const bankDetails = purchase.bank ? {
            id: purchase.bank._id,
            name: purchase.bank.bankName || null,
            accountNumber: purchase.bank.accountNumber || null,
            accountHolderName: purchase.bank.accountHoldername || null,
            ifscCode: purchase.bank.IFSCCode || null
        } : null;

        // Signature details
        const signatureDetails = purchase.sign_type === 'eSignature' ? {
            name: purchase.signatureName || null,
            image: signatureImage
        } : purchase.signatureId ? {
            id: purchase.signatureId._id,
            name: purchase.signatureId.signatureName || null
        } : null;

        // Format items with product details
        const formattedItems = purchase.items.map(item => ({
            id: item.id?._id || null,
            product: item.id ? {
                id: item.id._id,
                name: item.id.name,
                sku: item.id.sku,
                description: item.id.description
            } : null,
            name: item.name,
            unit: item.unit,
            qty: item.qty,
            rate: item.rate,
            discount: item.discount,
            tax: item.tax,
            tax_group: item.tax_group_id ? {
                id: item.tax_group_id._id,
                name: item.tax_group_id.name,
                rate: item.tax_group_id.rate
            } : null,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            amount: item.amount
        }));

        const responseData = {
            id: purchase._id,
            purchaseId: purchase.purchaseId,
            purchaseOrderId: purchase.purchaseOrderId,
            vendor: vendorDetails,
            user: userDetails,
            purchaseDate: formatDate(purchase.purchaseDate),
            dueDate: formatDate(purchase.dueDate),
            referenceNo: purchase.referenceNo,
            status: purchase.status,
            paymentMode: purchase.paymentMode,
            taxableAmount: purchase.taxableAmount,
            totalDiscount: purchase.totalDiscount,
            totalTax: purchase.totalTax,
            totalAmount: purchase.totalAmount,
            paidAmount: purchase.paidAmount,
            balanceAmount: purchase.balanceAmount,
            items: formattedItems,
            billFrom: billFromDetails,
            billTo: billToDetails,
            notes: purchase.notes,
            termsAndCondition: purchase.termsAndCondition,
            sign_type: purchase.sign_type,
            signature: signatureDetails,
            bank: bankDetails,
            checkNumber: purchase.checkNumber,
            roundOff: purchase.roundOff,
            createdAt: formatDate(purchase.createdAt),
            updatedAt: formatDate(purchase.updatedAt)
        };

        res.status(200).json({
            success: true,
            message: 'Purchase retrieved successfully',
            data: responseData
        });
    } catch (err) {
        console.error('Get purchase by ID error:', err);
        res.status(500).json({
            success: false,
            message: 'Error retrieving purchase',
            error: err.message
        });
    }
};

// Update purchase status
const updatePurchaseStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        // Validate status
        const validStatuses = ['pending', 'completed', 'cancelled', 'partially_paid', 'paid'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid status value' 
            });
        }

        // Find and update purchase
        const purchase = await Purchase.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        )
        .populate('vendorId', 'firstName lastName email phone')
        .populate('userId', 'firstName lastName email')
        .populate('billFrom', 'firstName lastName email profileImage phone')
        .populate('billTo', 'firstName lastName email profileImage phone')
        .populate({
            path: 'items.id',
            model: 'Product',
            select: 'name sku description'
        })
        .populate({
            path: 'bank',
            model: 'BankDetail',
            select: 'bankName accountNumber accountHoldername IFSCCode'
        });

        if (!purchase) {
            return res.status(404).json({ 
                success: false,
                message: 'Purchase not found' 
            });
        }

        // Format dates as "dd, MMM yyyy"
        const formatDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = d.getDate().toString().padStart(2, '0');
            const month = d.toLocaleString('default', { month: 'short' });
            const year = d.getFullYear();
            return `${day}, ${month} ${year}`;
        };

        // Prepare response data
        const responseData = {
            id: purchase._id,
            purchaseId: purchase.purchaseId,
            purchaseOrderId: purchase.purchaseOrderId,
            purchaseDate: formatDate(purchase.purchaseDate),
            dueDate: formatDate(purchase.dueDate),
            referenceNo: purchase.referenceNo,
            status: purchase.status,
            paymentMode: purchase.paymentMode,
            taxableAmount: purchase.taxableAmount,
            totalDiscount: purchase.totalDiscount,
            totalTax: purchase.totalTax,
            totalAmount: purchase.totalAmount,
            paidAmount: purchase.paidAmount,
            balanceAmount: purchase.balanceAmount,
            items: purchase.items.map(item => ({
                id: item.id?._id || null,
                product: item.id ? {
                    id: item.id._id,
                    name: item.id.name,
                    sku: item.id.sku,
                    description: item.id.description
                } : null,
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                discount_type: item.discount_type,
                discount_value: item.discount_value,
                amount: item.amount
            })),
            notes: purchase.notes,
            termsAndCondition: purchase.termsAndCondition,
            sign_type: purchase.sign_type,
            checkNumber: purchase.checkNumber,
            createdAt: formatDate(purchase.createdAt),
            updatedAt: formatDate(purchase.updatedAt)
        };

        res.status(200).json({
            success: true,
            message: 'Purchase status updated successfully',
            data: responseData
        });

    } catch (err) {
        console.error('Update purchase status error:', err);
        res.status(500).json({
            success: false,
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
  listPurchasesMinimal,
  getPurchaseById,
  updatePurchaseStatus,
  deletePurchase,
  createSupplierPayment,
  getSupplierPayments
};