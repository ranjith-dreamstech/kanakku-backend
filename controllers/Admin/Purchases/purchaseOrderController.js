const mongoose = require('mongoose');
const PurchaseOrder = require('@models/PurchaseOrder');
const User = require('@models/User');
const Product = require('@models/Product');

// Create a new purchase order
const createPurchaseOrder = async (req, res) => {
    try {
        const { 
            vendorId,
            dueDate,
            referenceNo,
            items,
            status,
            paymentMode,
            notes,
            termsAndCondition,
            sign_type,
            signatureId,
            userId,
            billFrom,  // This will now be the user ID whose address we'll use
            billTo,    // This will now be the user ID whose address we'll use
            convert_type
        } = req.body;

        // Validate vendor exists and is a supplier
        const vendor = await User.findById(vendorId);
        if (!vendor || vendor.user_type !== 2) {
            return res.status(400).json({ message: 'Invalid vendor ID or vendor is not a supplier' });
        }

        // Validate requesting user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Get bill from and bill to user addresses
        const billFromUser = await User.findById(billFrom);
        const billToUser = await User.findById(billTo);
        
        if (!billFromUser || !billToUser) {
            return res.status(400).json({ message: 'Invalid bill from or bill to user ID' });
        }

        // Validate at least one address exists
        if (!billFromUser.address && !billToUser.address) {
            return res.status(400).json({ message: 'Both bill from and bill to addresses are missing' });
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
            const itemAmount = item.quantity * (item.rate || 0);
            const itemDiscount = item.discount || 0;
            const itemTax = item.tax || 0;
            
            taxableAmount += itemAmount;
            totalDiscount += itemDiscount;
            vat += itemTax;
            totalAmount += (itemAmount - itemDiscount + itemTax);
        });

        // Create purchase order
        const purchaseOrder = new PurchaseOrder({
            vendorId,
            purchaseOrderDate: new Date(),
            dueDate: new Date(dueDate),
            referenceNo: referenceNo || '',
            items: items.map(item => ({
                ...item,
                amount: item.amount || (item.quantity * (item.rate || 0))
            })),
            status: status || 'NEW',
            paymentMode,
            taxableAmount: req.body.taxableAmount || taxableAmount,
            totalDiscount: req.body.totalDiscount || totalDiscount,
            vat: req.body.vat || vat,
            roundOff: req.body.roundOff || false,
            TotalAmount: req.body.TotalAmount || totalAmount,
            bank: req.body.bank || null,
            notes: notes || '',
            termsAndCondition: termsAndCondition || '',
            sign_type: sign_type || 'none',
            signatureId: signatureId || null,
            signatureImage: req.file ? req.file.path : null,
            userId,
            billFrom: billFromUser.address || '',
            billTo: billToUser.address || '',
            convert_type: convert_type || 'purchase'
        });

        await purchaseOrder.save();

        res.status(201).json({ 
            message: 'Purchase order created successfully', 
            data: {
                purchaseOrder: {
                    id: purchaseOrder._id,
                    purchaseOrderId: purchaseOrder.purchaseOrderId,
                    vendor: {
                        id: vendor._id,
                        name: `${vendor.firstName} ${vendor.lastName}`
                    },
                    purchaseOrderDate: purchaseOrder.purchaseOrderDate,
                    dueDate: purchaseOrder.dueDate,
                    status: purchaseOrder.status,
                    TotalAmount: purchaseOrder.TotalAmount,
                    billFrom: purchaseOrder.billFrom,
                    billTo: purchaseOrder.billTo,
                    items: purchaseOrder.items.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        rate: item.rate,
                        amount: item.amount
                    }))
                }
            }
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error creating purchase order',
            error: err.message 
        });
    }
};

module.exports = {
    createPurchaseOrder
};