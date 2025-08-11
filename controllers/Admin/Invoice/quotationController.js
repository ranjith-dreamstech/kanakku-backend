const mongoose = require('mongoose');
const Quotation = require('@models/Quotation');
const User = require('@models/User');
const Product = require('@models/Product');
const Signature = require('@models/Signature');
const TaxGroup = require('@models/TaxGroup');

const createQuotation = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { 
            customerId,
            quotationDate,
            expiryDate,
            referenceNo,
            items,
            status,
            paymentTerms,
            notes,
            termsAndCondition,
            sign_type,
            signatureId,
            signatureName,
            billFrom,
            billTo,
            convert_type
        } = req.body;

        // Validate requesting user exists
        const userId = req.user;
        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new Error('Invalid user ID');
        }

        // Get bill from and bill to user addresses
        const billFromUser = await User.findById(billFrom).session(session);
        const billToUser = await User.findById(billTo).session(session);
        
        if (!billFromUser || !billToUser) {
            throw new Error('Invalid bill from or bill to user ID');
        }

        if (!billFromUser.address && !billToUser.address) {
            throw new Error('Both bill from and bill to addresses are missing');
        }

        // Validate products in items
        for (const item of items) {
            const product = await Product.findById(item.id).session(session);
            if (!product) {
                throw new Error(`Invalid product ID: ${item.id}`);
            }
        }

        const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
        if (sign_type && !validSignatureTypes.includes(sign_type)) {
            throw new Error('Invalid signature type');
        }

        if (sign_type === 'eSignature') {
            if (!req.file) throw new Error('Signature image is required for eSignature');
            if (!signatureName) throw new Error('Signature name is required for eSignature');
        }

        // Calculate amounts
        let taxableAmount = 0;
        let totalDiscount = 0;
        let vat = 0;
        let totalAmount = 0;

        items.forEach(item => {
            const itemAmount = item.amount || (item.qty * (item.rate || 0));
            taxableAmount += itemAmount;
            totalDiscount += item.discount || 0;
            vat += item.tax || 0;
            totalAmount += itemAmount;
        });

        // Create quotation
        const quotation = new Quotation({
            customerId,
            quotationDate: new Date(quotationDate),
            expiryDate: new Date(expiryDate),
            referenceNo: referenceNo || '',
            items: items.map(item => ({
                id: item.id,
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                tax_group_id: item.tax_group_id,
                discount_type: item.discount_type,
                discount_value: item.discount_value,
                amount: item.amount
            })),
            status: status || 'draft',
            paymentTerms: paymentTerms || '',
            taxableAmount: req.body.subTotal || taxableAmount,
            totalDiscount: req.body.totalDiscount || totalDiscount,
            vat: req.body.totalTax || vat,
            roundOff: req.body.roundOff || false,
            TotalAmount: req.body.grandTotal || totalAmount,
            notes: notes || '',
            termsAndCondition: termsAndCondition || '',
            sign_type: sign_type || 'none',
            signatureId: signatureId || null,
            signatureImage: sign_type === 'eSignature' ? req.file.path : null,
            signatureName: sign_type === 'eSignature' ? signatureName : null,
            userId,
            billFrom,
            billTo,
            convert_type: convert_type || 'quotation'
        });

        await quotation.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: 'Quotation created successfully',
            data: quotation
        });

    } catch (err) {
        // Rollback transaction
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            message: 'Error creating quotation',
            error: err.message
        });
    }
};

const getQuotationById = async (req, res) => {
    try {
        const { id } = req.params;

        const quotation = await Quotation.findById(id)
            .populate('customerId', 'firstName lastName email phone')
            .populate('userId', 'firstName lastName email phone')
            .populate('billFrom', 'firstName lastName email phone address')
            .populate('billTo', 'firstName lastName email phone address')
            .populate('items.id', 'name description price');

        if (!quotation) {
            return res.status(404).json({
                message: 'Quotation not found'
            });
        }

        res.status(200).json({
            message: 'Quotation retrieved successfully',
            data: quotation
        });
    } catch (err) {
        res.status(500).json({
            message: 'Error retrieving quotation',
            error: err.message
        });
    }
};

const updateQuotation = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check if quotation exists
        const quotation = await Quotation.findById(id).session(session);
        if (!quotation) {
            throw new Error('Quotation not found');
        }

        // Validate signature data if being updated
        if (updateData.sign_type) {
            const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
            if (!validSignatureTypes.includes(updateData.sign_type)) {
                throw new Error('Invalid signature type');
            }

            if (updateData.sign_type === 'eSignature') {
                if (!req.file) throw new Error('Signature image is required for eSignature');
                if (!updateData.signatureName) throw new Error('Signature name is required for eSignature');
            }
        }

        // Update fields
        if (updateData.quotationDate) quotation.quotationDate = new Date(updateData.quotationDate);
        if (updateData.expiryDate) quotation.expiryDate = new Date(updateData.expiryDate);
        if (updateData.referenceNo !== undefined) quotation.referenceNo = updateData.referenceNo;
        if (updateData.status) quotation.status = updateData.status;
        if (updateData.paymentTerms !== undefined) quotation.paymentTerms = updateData.paymentTerms;
        if (updateData.notes !== undefined) quotation.notes = updateData.notes;
        if (updateData.termsAndCondition !== undefined) quotation.termsAndCondition = updateData.termsAndCondition;
        if (updateData.sign_type !== undefined) quotation.sign_type = updateData.sign_type;
        if (updateData.signatureId !== undefined) quotation.signatureId = updateData.signatureId;
        if (updateData.convert_type !== undefined) quotation.convert_type = updateData.convert_type;

        // Handle signature image if being updated
        if (updateData.sign_type === 'eSignature' && req.file) {
            quotation.signatureImage = req.file.path;
            quotation.signatureName = updateData.signatureName;
        }

        // Handle items update
        if (updateData.items) {
            // Validate products in items
            for (const item of updateData.items) {
                const product = await Product.findById(item.id).session(session);
                if (!product) {
                    throw new Error(`Invalid product ID: ${item.id}`);
                }
            }

            quotation.items = updateData.items.map(item => ({
                id: item.id,
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                tax_group_id: item.tax_group_id,
                discount_type: item.discount_type,
                discount_value: item.discount_value,
                amount: item.amount
            }));

            // Recalculate amounts if items changed
            let taxableAmount = 0;
            let totalDiscount = 0;
            let vat = 0;
            let totalAmount = 0;

            updateData.items.forEach(item => {
                const itemAmount = item.amount || (item.qty * (item.rate || 0));
                taxableAmount += itemAmount;
                totalDiscount += item.discount || 0;
                vat += item.tax || 0;
                totalAmount += itemAmount;
            });

            quotation.taxableAmount = updateData.subTotal || taxableAmount;
            quotation.totalDiscount = updateData.totalDiscount || totalDiscount;
            quotation.vat = updateData.totalTax || vat;
            quotation.TotalAmount = updateData.grandTotal || totalAmount;
        }

        await quotation.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: 'Quotation updated successfully',
            data: quotation
        });

    } catch (err) {
        // Rollback transaction
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            message: 'Error updating quotation',
            error: err.message
        });
    }
};

const deleteQuotation = async (req, res) => {
    try {
        const { id } = req.params;

        const quotation = await Quotation.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!quotation) {
            return res.status(404).json({
                message: 'Quotation not found'
            });
        }

        res.status(200).json({
            message: 'Quotation deleted successfully',
            data: quotation
        });
    } catch (err) {
        res.status(500).json({
            message: 'Error deleting quotation',
            error: err.message
        });
    }
};

const listQuotations = async (req, res) => {
    try {
        const { status, customerId, startDate, endDate, search } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build the query
        const query = { isDeleted: false };

        if (status) query.status = status;
        if (customerId) query.customerId = customerId;
        
        if (startDate && endDate) {
            query.quotationDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { quotationId: searchRegex },
                { referenceNo: searchRegex },
                { 'items.name': searchRegex }
            ];
        }

        const [quotations, total] = await Promise.all([
            Quotation.find(query)
                .populate('customerId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Quotation.countDocuments(query)
        ]);

        res.status(200).json({
            message: 'Quotations retrieved successfully',
            data: quotations,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (err) {
        res.status(500).json({
            message: 'Error retrieving quotations',
            error: err.message
        });
    }
};

const getAllCustomers = async (req, res) => {
    try {
        const userId = req.user;
        const { search = '', status } = req.query;

        // Build query
        const query = { 
            userId, 
            isDeleted: false 
        };

        // Add filters
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { 'billingAddress.city': { $regex: search, $options: 'i' } },
                { 'shippingAddress.city': { $regex: search, $options: 'i' } }
            ];
        }

        // Get all matching customers without pagination
        const customers = await Customer.find(query)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Customers fetched successfully',
            data: {
                customers: customers.map(formatCustomerResponse),
                count: customers.length
            }
        });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching customers',
            error: err.message 
        });
    }
};

// Helper function to format customer response
function formatCustomerResponse(customer) {
    return {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
    };
};

module.exports = {
    createQuotation,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    listQuotations,
    getAllCustomers,
    
};