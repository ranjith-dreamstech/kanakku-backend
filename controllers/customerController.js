// customerController.js
const Customer = require('@models/Customer');
const User = require('@models/User');
const fs = require('fs');
const path = require('path');

// Create Customer
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
      bankDetails,
      profile_image_removed
    } = req.body;
    
    const userId = req.user;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check for existing customer with same email
    const existingCustomer = await Customer.findOne({ email, userId });
    if (existingCustomer) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(409).json({
        success: false,
        message: 'Customer with this email already exists'
      });
    }

    // Handle image removal
    let imagePath = '';
    if (profile_image_removed === 'true') {
      imagePath = '';
    } else if (req.file) {
      imagePath = req.file.path;
    }

    // Create new customer
    const customer = new Customer({
      name,
      email,
      phone: phone || '',
      website: website || '',
      notes: notes || '',
      image: imagePath,
      status: status || 'Active',
      billingAddress: billingAddress || {},
      shippingAddress: shippingAddress || {},
      bankDetails: bankDetails || {},
      userId
    });

    await customer.save();

    res.status(201).json({ 
      success: true,
      message: 'Customer created successfully', 
      data: formatCustomerResponse(customer)
    });
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (fileErr) {
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

// Get All Customers with Pagination
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

        // Get paginated results
        const [total, customers] = await Promise.all([
            Customer.countDocuments(query),
            Customer.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
        ]);

        res.status(200).json({
            success: true,
            message: 'Customers fetched successfully',
            data: {
                customers: customers.map(formatCustomerResponse),
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
            error: err.message 
        });
    }
};

// Get Single Customer
const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user;

        const customer = await Customer.findOne({ 
            _id: id, 
            userId, 
            isDeleted: false 
        });

        if (!customer) {
            return res.status(404).json({ 
                success: false,
                message: 'Customer not found' 
            });
        }

        res.status(200).json({
            success: true,
            message: 'Customer retrieved successfully',
            data: formatCustomerResponse(customer)
        });
    } catch (err) {
        console.error('Error fetching customer:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching customer',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

// Update Customer
const updateCustomer = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file?.path) fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array().reduce((acc, err) => {
                    acc[err.path] = err.msg;
                    return acc;
                }, {})
            });
        }

        const { id } = req.params;
        const userId = req.user;
        const {
            name,
            email,
            phone,
            website,
            notes,
            status,
            billingAddress,
            shippingAddress,
            bankDetails,
            profile_image_removed
        } = req.body;

        // Find customer
        const customer = await Customer.findOne({ 
            _id: id, 
            userId, 
            isDeleted: false 
        });
        
        if (!customer) {
            if (req.file?.path) fs.unlinkSync(req.file.path);
            return res.status(404).json({ 
                success: false,
                message: 'Customer not found' 
            });
        }

        // Check for email conflict if email is being updated
        if (email && email !== customer.email) {
            const existingCustomer = await Customer.findOne({ 
                email: email, 
                userId 
            });
            if (existingCustomer) {
                if (req.file?.path) fs.unlinkSync(req.file.path);
                return res.status(409).json({
                    success: false,
                    message: 'Another customer with this email already exists'
                });
            }
        }

        // Handle image update/removal
        let oldImagePath = '';
        if (profile_image_removed === 'true') {
            oldImagePath = customer.image;
            customer.image = '';
        } else if (req.file) {
            oldImagePath = customer.image;
            customer.image = req.file.path;
        }

        // Update fields with proper validation
        const updateFields = {
            name: name !== undefined ? name : customer.name,
            email: email !== undefined ? email : customer.email,
            phone: phone !== undefined ? phone || '' : customer.phone,
            website: website !== undefined ? website || '' : customer.website,
            notes: notes !== undefined ? notes || '' : customer.notes,
            status: status !== undefined ? status || 'Active' : customer.status,
            billingAddress: billingAddress !== undefined ? 
                (typeof billingAddress === 'string' ? JSON.parse(billingAddress) : billingAddress) || {} 
                : customer.billingAddress,
            shippingAddress: shippingAddress !== undefined ? 
                (typeof shippingAddress === 'string' ? JSON.parse(shippingAddress) : shippingAddress) || {} 
                : customer.shippingAddress,
            bankDetails: bankDetails !== undefined ? 
                (typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails) || {} 
                : customer.bankDetails
        };

        // Apply updates
        Object.assign(customer, updateFields);
        await customer.save();

        // Delete old image if it was replaced or removed
        if ((req.file || profile_image_removed === 'true') && oldImagePath) {
            try { 
                fs.unlinkSync(oldImagePath); 
            } catch (err) {
                console.error('Error deleting old image:', err);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            data: formatCustomerResponse(customer)
        });
    } catch (err) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        console.error('Error updating customer:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating customer',
            error: err.message 
        });
    }
};

// Delete Customer (Soft Delete)
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user;

        const customer = await Customer.findOneAndUpdate(
            { 
                _id: id, 
                userId, 
                isDeleted: false 
            },
            { 
                isDeleted: true,
                deletedAt: new Date() 
            },
            { new: true }
        );

        if (!customer) {
            return res.status(404).json({ 
                success: false,
                message: 'Customer not found' 
            });
        }

        res.status(200).json({
            success: true,
            message: 'Customer deleted successfully',
            data: { id: customer._id }
        });
    } catch (err) {
        console.error('Error deleting customer:', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting customer',
           error: err.message 
        });
    }
};

// Helper function to format customer response
const formatCustomerResponse = (customer) => {
    return {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        website: customer.website,
        notes: customer.notes,
        status: customer.status,
        imageUrl: customer.imageUrl,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        bankDetails: customer.bankDetails,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
    };
};

module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
};