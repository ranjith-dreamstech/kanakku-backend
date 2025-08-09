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

module.exports = {
    createCustomer
};