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
        const purchases = await Purchase.find({ isDeleted: false })
            .populate('vendorId', 'name email phone')
            .populate('userId', 'name email')
            .populate('billFrom', 'name address')
            .populate('billTo', 'name address')
            .populate('bank', 'bankName accountNumber')
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