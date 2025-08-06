// controllers/purchaseController.js
const mongoose = require('mongoose');
const Purchase = require('@models/Purchase');
const User = require('@models/User');
const Product = require('@models/Product');
const BankDetail = require('@models/BankDetail');
const Signature = require('@models/Signature');
const Unit = require('@models/Unit');

// Create a new purchase
const createPurchase = async (req, res) => {
    try {
        const { 
            vendorId,
            purchaseDate,
            referenceNo,
            supplierInvoiceSerialNumber,
            items,
            status,
            paymentMode,
            taxableAmount,
            totalDiscount,
            vat,
            roundOff,
            totalAmount,
            discountType,
            discount,
            notes,
            termsAndCondition,
            sign_type,
            signatureId,
            userId,
            billFrom,
            billTo
        } = req.body;

        // Validate vendor exists
        const vendor = await User.findById(vendorId);
        if (!vendor) {
            return res.status(400).json({ message: 'Invalid vendor ID' });
        }

        // Validate requesting user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(422).json({ message: 'Invalid user ID' });
        }

        // Get bill from and bill to user addresses
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
            
            // Validate unit if provided
            if (item.unit) {
                const unit = await Unit.findById(item.unit);
                if (!unit) {
                    return res.status(422).json({ message: `Invalid unit ID: ${item.unit}` });
                }
            }
        }

        // Validate signature type
        const validSignatureTypes = ['none', 'digitalSignature', 'manualSignature'];
        if (sign_type && !validSignatureTypes.includes(sign_type)) {
            return res.status(400).json({ message: 'Invalid signature type' });
        }

        // Validate signature data if manualSignature is selected
        if (sign_type === 'manualSignature') {
            if (!req.file) {
                return res.status(400).json({ message: 'Signature image is required for manual signature' });
            }
        }

        // Validate signature ID if digitalSignature is selected
        if (sign_type === 'digitalSignature') {
            if (!signatureId) {
                return res.status(400).json({ message: 'Signature ID is required for digital signature' });
            }
            const signature = await Signature.findById(signatureId);
            if (!signature) {
                return res.status(422).json({ message: 'Invalid signature ID' });
            }
        }

        // Validate bank if provided
        if (req.body.bank) {
            const bank = await BankDetail.findById(req.body.bank);
            if (!bank) {
                return res.status(422).json({ message: 'Invalid bank ID' });
            }
        }

        // Create purchase with items
        const purchase = new Purchase({
            vendorId,
            purchaseDate: new Date(purchaseDate),
            referenceNo: referenceNo || '',
            supplierInvoiceSerialNumber: supplierInvoiceSerialNumber || '',
            items: items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                unit: item.unit,
                quantity: item.quantity,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                discountValue: item.discountValue,
                amount: item.amount
            })),
            status: status || 'PAID',
            paymentMode,
            taxableAmount,
            totalDiscount,
            vat,
            roundOff: roundOff || false,
            totalAmount,
            discountType: discountType || null,
            discount: discount || 0,
            bank: req.body.bank || null,
            notes: notes || '',
            termsAndCondition: termsAndCondition || '',
            sign_type: sign_type || 'none',
            signatureId: sign_type === 'digitalSignature' ? signatureId : null,
            signatureImage: sign_type === 'manualSignature' ? req.file.path : null,
            userId,
            billFrom,
            billTo
        });

        await purchase.save();

        res.status(201).json({ 
            message: 'Purchase created successfully', 
            data: {
                purchase: {
                    id: purchase._id,
                    purchaseNo: purchase.purchaseNo,
                    purchaseDate: purchase.purchaseDate,
                    status: purchase.status,
                    totalAmount: purchase.totalAmount,
                    billFrom: purchase.billFrom,
                    billTo: purchase.billTo,
                    sign_type: purchase.sign_type,
                    items: purchase.items.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        unit: item.unit,
                        quantity: item.quantity,
                        rate: item.rate,
                        discount: item.discount,
                        tax: item.tax,
                        discountValue: item.discountValue,
                        amount: item.amount
                    }))
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

        const userId = req.user?._id; // Assuming user is attached to request
        const skip = (page - 1) * limit;

        // Build query
        const query = { 
            isDeleted: false 
        };

        // Add user filter if user is available
        if (userId) {
            query.userId = userId;
        }

        // Add status filter
        if (status && ['DRAFT', 'PENDING', 'PAID', 'CANCELLED'].includes(status.toUpperCase())) {
            query.status = status.toUpperCase();
        }

        // Add vendor filter
        if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
            query.vendorId = vendorId;
        }

        // Add payment mode filter
        if (paymentMode && ['CASH', 'CREDIT', 'CHECK', 'BANK_TRANSFER', 'OTHER'].includes(paymentMode.toUpperCase())) {
            query.paymentMode = paymentMode.toUpperCase();
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
                { purchaseNo: { $regex: search, $options: 'i' } },
                { referenceNo: { $regex: search, $options: 'i' } },
                { supplierInvoiceSerialNumber: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } },
                { 'items.productName': { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count
        const total = await Purchase.countDocuments(query);

        // Get purchases with pagination
        const purchases = await Purchase.find(query)
            .populate('vendorId', 'firstName lastName email phone')
            .populate('signatureId', 'signatureName')
            .populate('userId', 'firstName lastName email profileImage phone')
            .populate('billFrom', 'firstName lastName email address phone')
            .populate('billTo', 'firstName lastName email address phone')
            .populate({
                path: 'bank',
                model: 'BankDetail',
                select: 'bankName accountNumber accountHoldername IFSCCode'
            })
            .populate({
                path: 'items.unit',
                model: 'Unit',
                select: 'name symbol'
            })
            .sort({ purchaseDate: -1 })
            .skip(skip)
            .limit(Number(limit));

        const formattedPurchases = purchases.map(purchase => {
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

            // User details
            const userDetails = purchase.userId ? {
                id: purchase.userId._id,
                name: `${purchase.userId.firstName || ''} ${purchase.userId.lastName || ''}`.trim(),
                email: purchase.userId.email || null,
                phone: purchase.userId.phone || null,
                profileImage: purchase.userId.profileImage 
                    ? `${baseUrl}${purchase.userId.profileImage.replace(/\\/g, '/')}`
                    : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile'
            } : null;

            // Bill From details
            const billFromDetails = purchase.billFrom ? {
                id: purchase.billFrom._id,
                name: `${purchase.billFrom.firstName || ''} ${purchase.billFrom.lastName || ''}`.trim(),
                email: purchase.billFrom.email || null,
                phone: purchase.billFrom.phone || null,
                address: purchase.billFrom.address || null
            } : null;

            // Bill To details
            const billToDetails = purchase.billTo ? {
                id: purchase.billTo._id,
                name: `${purchase.billTo.firstName || ''} ${purchase.billTo.lastName || ''}`.trim(),
                email: purchase.billTo.email || null,
                phone: purchase.billTo.phone || null,
                address: purchase.billTo.address || null
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
            const signatureDetails = purchase.sign_type === 'manualSignature' ? {
                image: signatureImage
            } : purchase.signatureId ? {
                id: purchase.signatureId._id,
                name: purchase.signatureId.signatureName || null
            } : null;

            // Format items
            const formattedItems = purchase.items.map(item => ({
                id: item._id,
                productId: item.productId,
                productName: item.productName,
                unit: item.unit ? {
                    id: item.unit._id,
                    name: item.unit.name,
                    symbol: item.unit.symbol
                } : null,
                quantity: item.quantity,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                discountValue: item.discountValue,
                amount: item.amount
            }));

            return {
                id: purchase._id,
                purchaseNo: purchase.purchaseNo,
                vendor: vendorDetails,
                user: userDetails,
                purchaseDate: formatDate(purchase.purchaseDate),
                referenceNo: purchase.referenceNo,
                supplierInvoiceSerialNumber: purchase.supplierInvoiceSerialNumber,
                status: purchase.status,
                paymentMode: purchase.paymentMode,
                taxableAmount: purchase.taxableAmount,
                totalDiscount: purchase.totalDiscount,
                vat: purchase.vat,
                totalAmount: purchase.totalAmount,
                items: formattedItems,
                itemsCount: formattedItems.length,
                billFrom: billFromDetails,
                billTo: billToDetails,
                notes: purchase.notes,
                termsAndCondition: purchase.termsAndCondition,
                sign_type: purchase.sign_type,
                signature: signatureDetails,
                bank: bankDetails,
                discountType: purchase.discountType,
                discount: purchase.discount,
                roundOff: purchase.roundOff,
                createdAt: formatDate(purchase.createdAt),
                updatedAt: formatDate(purchase.updatedAt)
            };
        });

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
            .populate('vendorId', 'name email phone')
            .populate('userId', 'name email')
            .populate('billFrom', 'name address')
            .populate('billTo', 'name address')
            .populate('bank', 'bankName accountNumber')
            .populate('items.productId', 'name sku')
            .populate('items.unit', 'name');

        if (!purchase || purchase.isDeleted) {
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

// Update purchase
const updatePurchase = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Validate purchase exists
        const purchase = await Purchase.findById(id);
        if (!purchase || purchase.isDeleted) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        // Validate vendor if provided
        if (updateData.vendorId) {
            const vendor = await User.findById(updateData.vendorId);
            if (!vendor) {
                return res.status(400).json({ message: 'Invalid vendor ID' });
            }
        }

        // Validate products in items if provided
        if (updateData.items) {
            for (const item of updateData.items) {
                if (item.productId) {
                    const product = await Product.findById(item.productId);
                    if (!product) {
                        return res.status(422).json({ message: `Invalid product ID: ${item.productId}` });
                    }
                }
                
                // Validate unit if provided
                if (item.unit) {
                    const unit = await Unit.findById(item.unit);
                    if (!unit) {
                        return res.status(422).json({ message: `Invalid unit ID: ${item.unit}` });
                    }
                }
            }
        }

        // Validate signature type if provided
        if (updateData.sign_type) {
            const validSignatureTypes = ['none', 'digitalSignature', 'manualSignature'];
            if (!validSignatureTypes.includes(updateData.sign_type)) {
                return res.status(400).json({ message: 'Invalid signature type' });
            }

            // Validate signature data if manualSignature is selected
            if (updateData.sign_type === 'manualSignature' && !req.file) {
                return res.status(400).json({ message: 'Signature image is required for manual signature' });
            }

            // Validate signature ID if digitalSignature is selected
            if (updateData.sign_type === 'digitalSignature' && !updateData.signatureId) {
                return res.status(400).json({ message: 'Signature ID is required for digital signature' });
            }
        }

        // Validate bank if provided
        if (updateData.bank) {
            const bank = await BankDetail.findById(updateData.bank);
            if (!bank) {
                return res.status(422).json({ message: 'Invalid bank ID' });
            }
        }

        // Update purchase
        const updatedPurchase = await Purchase.findByIdAndUpdate(
            id,
            {
                ...updateData,
                signatureImage: updateData.sign_type === 'manualSignature' ? req.file.path : undefined
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: 'Purchase updated successfully',
            data: updatedPurchase
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            message: 'Error updating purchase',
            error: err.message
        });
    }
};

// Delete purchase (soft delete)
const deletePurchase = async (req, res) => {
    try {
        const { id } = req.params;

        const purchase = await Purchase.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        res.status(200).json({
            message: 'Purchase deleted successfully'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            message: 'Error deleting purchase',
            error: err.message
        });
    }
};

module.exports = {
    createPurchase,
    getAllPurchases,
    getPurchaseById,
    updatePurchase,
    deletePurchase
};