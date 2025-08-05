const Purchase = require('../models/Purchase');
const User = require('../models/User');
const Product = require('../models/Product');
const Address = require('../models/Address');
const mongoose = require('mongoose');

// Create a new purchase
const createPurchase = async (req, res) => {
    try {
        const {
            vendorId,
            purchaseDate,
            referenceNo,
            items,
            status,
            paymentMode,
            notes,
            termsAndCondition,
            sign_type,
            signatureId,
            signatureName,
            userId,
            billFrom,
            billTo,
            supplierInvoiceSerialNumber,
            taxType
        } = req.body;

        // Validate required fields
        if (!vendorId || !userId || !billFrom || !billTo || !items || items.length === 0) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Validate vendor exists
        const vendor = await User.findById(vendorId);
        if (!vendor || vendor.user_type !== 'supplier') {
            return res.status(400).json({ message: 'Invalid vendor ID or vendor is not a supplier' });
        }

        // Validate user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Validate addresses
        const billFromAddress = await Address.findById(billFrom);
        const billToAddress = await Address.findById(billTo);
        if (!billFromAddress || !billToAddress) {
            return res.status(400).json({ message: 'Invalid bill from or bill to address' });
        }

        // Validate products in items
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(400).json({ message: `Invalid product ID: ${item.productId}` });
            }
        }

        // Calculate amounts
        let taxableAmount = 0;
        let totalDiscount = 0;
        let vat = 0;
        let totalAmount = 0;

        items.forEach(item => {
            const itemAmount = item.quantity * item.rate;
            const itemDiscount = item.discount || 0;
            const itemTax = item.tax || 0;
            
            taxableAmount += itemAmount;
            totalDiscount += itemDiscount;
            vat += itemTax;
            totalAmount += (itemAmount - itemDiscount + itemTax);
        });

        // Handle signature
        if (sign_type === 'manualSignature' && !req.file) {
            return res.status(400).json({ message: 'Signature image is required for manual signature' });
        }

        // Create purchase
        const purchase = new Purchase({
            vendorId,
            purchaseDate: purchaseDate || new Date(),
            referenceNo,
            items: items.map(item => ({
                ...item,
                productName: item.productName || '',
                amount: item.quantity * item.rate,
                discountValue: item.discount || 0
            })),
            status: status || 'DRAFT',
            paymentMode,
            taxableAmount,
            totalDiscount,
            vat,
            TotalAmount: totalAmount,
            notes,
            termsAndCondition,
            sign_type: sign_type || 'none',
            signatureId: sign_type === 'digitalSignature' ? signatureId : null,
            signatureImage: sign_type === 'manualSignature' ? req.file.path : null,
            signatureName: sign_type === 'manualSignature' ? (signatureName || 'Manual Signature') : null,
            userId,
            billFrom,
            billTo,
            supplierInvoiceSerialNumber,
            taxType
        });

        await purchase.save();

        res.status(201).json({
            message: 'Purchase created successfully',
            data: formatPurchaseResponse(purchase, req)
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Error creating purchase',
            error: err.message 
        });
    }
};

// Get all purchases
const getAllPurchases = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, vendorId, startDate, endDate, search } = req.query;
        const skip = (page - 1) * limit;

        const query = { isDeleted: false };

        if (status) query.status = status;
        if (vendorId) query.vendorId = vendorId;
        if (startDate || endDate) {
            query.purchaseDate = {};
            if (startDate) query.purchaseDate.$gte = new Date(startDate);
            if (endDate) query.purchaseDate.$lte = new Date(endDate);
        }
        if (search) {
            query.$or = [
                { purchase_no: { $regex: search, $options: 'i' } },
                { referenceNo: { $regex: search, $options: 'i' } },
                { 'items.productName': { $regex: search, $options: 'i' } }
            ];
        }

        const total = await Purchase.countDocuments(query);
        const purchases = await Purchase.find(query)
            .populate('vendorId', 'firstName lastName email')
            .populate('userId', 'firstName lastName')
            .populate('billFrom', 'addressLine1 city state')
            .populate('billTo', 'addressLine1 city state')
            .populate('signatureId', 'name')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Purchases retrieved successfully',
            data: purchases.map(p => formatPurchaseResponse(p, req)),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Error retrieving purchases',
            error: err.message 
        });
    }
};

// Get purchase by ID
const getPurchaseById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid purchase ID' });
        }

        const purchase = await Purchase.findById(id)
            .populate('vendorId', 'firstName lastName email phone')
            .populate('userId', 'firstName lastName email')
            .populate('billFrom', 'addressLine1 addressLine2 city state country postalCode')
            .populate('billTo', 'addressLine1 addressLine2 city state country postalCode')
            .populate('signatureId', 'name createdAt')
            .populate('items.productId', 'name code price')
            .populate('items.unit', 'name symbol');

        if (!purchase || purchase.isDeleted) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        res.status(200).json({
            message: 'Purchase retrieved successfully',
            data: formatPurchaseResponse(purchase, req)
        });

    } catch (err) {
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
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid purchase ID' });
        }

        const purchase = await Purchase.findById(id);
        if (!purchase || purchase.isDeleted) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        // Validate items if provided
        if (updates.items) {
            for (const item of updates.items) {
                if (item.productId) {
                    const product = await Product.findById(item.productId);
                    if (!product) {
                        return res.status(400).json({ message: `Invalid product ID: ${item.productId}` });
                    }
                }
            }
        }

        // Handle signature changes
        if (updates.sign_type) {
            if (updates.sign_type === 'manualSignature' && !req.file && !purchase.signatureImage) {
                return res.status(400).json({ message: 'Signature image is required for manual signature' });
            }
            if (updates.sign_type === 'digitalSignature' && !updates.signatureId) {
                return res.status(400).json({ message: 'Signature ID is required for digital signature' });
            }

            // Clear unused signature fields
            if (updates.sign_type === 'none') {
                updates.signatureId = null;
                updates.signatureImage = null;
                updates.signatureName = null;
            } else if (updates.sign_type === 'manualSignature') {
                updates.signatureId = null;
                updates.signatureImage = req.file ? req.file.path : purchase.signatureImage;
                updates.signatureName = updates.signatureName || purchase.signatureName || 'Manual Signature';
            } else if (updates.sign_type === 'digitalSignature') {
                updates.signatureImage = null;
                updates.signatureName = null;
            }
        } else if (req.file && purchase.sign_type === 'manualSignature') {
            updates.signatureImage = req.file.path;
        }

        // Calculate amounts if items are updated
        if (updates.items) {
            let taxableAmount = 0;
            let totalDiscount = 0;
            let vat = 0;
            let totalAmount = 0;

            updates.items.forEach(item => {
                const itemAmount = item.quantity * item.rate;
                const itemDiscount = item.discount || 0;
                const itemTax = item.tax || 0;
                
                taxableAmount += itemAmount;
                totalDiscount += itemDiscount;
                vat += itemTax;
                totalAmount += (itemAmount - itemDiscount + itemTax);
            });

            updates.taxableAmount = taxableAmount;
            updates.totalDiscount = totalDiscount;
            updates.vat = vat;
            updates.TotalAmount = totalAmount;
        }

        // Update purchase
        const updatedPurchase = await Purchase.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        )
        .populate('vendorId', 'firstName lastName email')
        .populate('userId', 'firstName lastName')
        .populate('billFrom', 'addressLine1 city state')
        .populate('billTo', 'addressLine1 city state')
        .populate('signatureId', 'name');

        res.status(200).json({
            message: 'Purchase updated successfully',
            data: formatPurchaseResponse(updatedPurchase, req)
        });

    } catch (err) {
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

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid purchase ID' });
        }

        const purchase = await Purchase.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        res.status(200).json({
            message: 'Purchase deleted successfully',
            data: { id: purchase._id }
        });

    } catch (err) {
        res.status(500).json({ 
            message: 'Error deleting purchase',
            error: err.message 
        });
    }
};

// Helper function to format purchase response
function formatPurchaseResponse(purchase, req) {
    const baseUrl = `${req.protocol}://${req.get('host')}/`;
    
    return {
        id: purchase._id,
        purchaseId: purchase.purchaseId,
        purchase_no: purchase.purchase_no,
        vendor: purchase.vendorId ? {
            id: purchase.vendorId._id,
            name: `${purchase.vendorId.firstName} ${purchase.vendorId.lastName}`,
            email: purchase.vendorId.email,
            phone: purchase.vendorId.phone
        } : null,
        user: purchase.userId ? {
            id: purchase.userId._id,
            name: `${purchase.userId.firstName} ${purchase.userId.lastName}`,
            email: purchase.userId.email
        } : null,
        purchaseDate: purchase.purchaseDate,
        dueDate: purchase.dueDate,
        referenceNo: purchase.referenceNo,
        items: purchase.items.map(item => ({
            id: item._id,
            product: item.productId ? {
                id: item.productId._id,
                name: item.productId.name,
                code: item.productId.code,
                price: item.productId.price
            } : null,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit ? {
                id: item.unit._id,
                name: item.unit.name,
                symbol: item.unit.symbol
            } : null,
            rate: item.rate,
            discount: item.discount,
            tax: item.tax,
            amount: item.amount,
            discountValue: item.discountValue,
            discountType: item.discountType,
            taxType: item.taxType
        })),
        status: purchase.status,
        paymentMode: purchase.paymentMode,
        taxableAmount: purchase.taxableAmount,
        totalDiscount: purchase.totalDiscount,
        vat: purchase.vat,
        roundOff: purchase.roundOff,
        TotalAmount: purchase.TotalAmount,
        bank: purchase.bank,
        notes: purchase.notes,
        termsAndCondition: purchase.termsAndCondition,
        sign_type: purchase.sign_type,
        signature: purchase.sign_type === 'manualSignature' ? {
            name: purchase.signatureName,
            image: purchase.signatureImage ? `${baseUrl}${purchase.signatureImage.replace(/\\/g, '/')}` : null
        } : purchase.signatureId ? {
            id: purchase.signatureId._id,
            name: purchase.signatureId.name
        } : null,
        billFrom: purchase.billFrom,
        billTo: purchase.billTo,
        supplierInvoiceSerialNumber: purchase.supplierInvoiceSerialNumber,
        taxType: purchase.taxType,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt
    };
}

module.exports = {
    createPurchase,
    getAllPurchases,
    getPurchaseById,
    updatePurchase,
    deletePurchase
};