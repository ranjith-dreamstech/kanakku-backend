// customerController.js
const Customer = require('@models/Customer');
const User = require('@models/User');
const fs = require('fs');
const path = require('path');

const createCustomer = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            website,
            notes,
            status,
            billingAddress,
            shippingAddress,
            bankDetails
        } = req.body;
        
        const userId = req.user; // Assuming user is authenticated and ID is available
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            // Clean up uploaded file if exists
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Check if customer with same email already exists for this user
        // const existingCustomer = await Customer.findOne({ email, userId });
        // if (existingCustomer) {
        //     if (req.file && req.file.path) {
        //         fs.unlinkSync(req.file.path);
        //     }
        //     return res.status(409).json({
        //         success: false,
        //         message: 'Customer with this email already exists'
        //     });
        // }

        // Create new customer
        const customer = new Customer({
            name,
            email,
            phone: phone || '',
            website: website || '',
            notes: notes || '',
            image: req.file ? req.file.path : '',
            status: status || 'Active',
            billingAddress: billingAddress || {},
            shippingAddress: shippingAddress || {},
            bankDetails: bankDetails || {},
            userId
        });

        await customer.save();

        // Prepare response data
        const responseData = {
            id: customer._id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            website: customer.website,
            notes: customer.notes,
            status: customer.status,
            imageUrl: customer.imageUrl, // Using the virtual field from schema
            billingAddress: customer.billingAddress,
            shippingAddress: customer.shippingAddress,
            bankDetails: customer.bankDetails,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt
        };

        res.status(201).json({ 
            success: true,
            message: 'Customer created successfully', 
            data: responseData
        });
    } catch (err) {
        // Clean up uploaded file if error occurs
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (fileErr) {
                console.error('Error cleaning up customer image:', fileErr);
            }
        }
        
        console.error('Customer creation error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error creating customer',
            error: err.message 
        });
    }
};
const getCustomers = async (req, res) => {
    try {
        const userId = req.user;
        const { 
            page = 1, 
            limit = 10, 
            search = '',
            status
        } = req.query;

        // Build query
        const query = { 
            userId, 
            isDeleted: false 
        };

        // Add status filter if provided
        if (status) {
            query.status = status; // 'Active' or 'Inactive'
        }

        // Add search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { 'billingAddress.city': { $regex: search, $options: 'i' } },
                { 'shippingAddress.city': { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count for pagination
        const total = await Customer.countDocuments(query);

        // Get paginated results
        const customers = await Customer.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        
        const formattedCustomers = customers.map(customer => ({
            id: customer._id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            status: customer.status,
            imageUrl: customer.imageUrl, // Using the virtual field
            billingAddress: customer.billingAddress,
            shippingAddress: customer.shippingAddress,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt
        }));

        res.status(200).json({
            success: true,
            message: 'Customers fetched successfully',
            data: {
                customers: formattedCustomers,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching customers',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

module.exports = {
    createCustomer,
    getCustomers
};