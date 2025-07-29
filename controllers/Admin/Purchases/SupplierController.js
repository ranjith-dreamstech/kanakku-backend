const mongoose = require('mongoose');
const User = require('@models/User');

//create
const createSupplier = async (req, res) => {
    try {
        const { 
            supplier_name, 
            supplier_email, 
            supplier_phone, 
            balance, 
            balance_type,
            firstName,
            lastName,
            password,
            gender,
            dateOfBirth,
            address,
            country,
            state,
            city,
            postalCode
        } = req.body;

        // Get the uploaded file path
        const profileImage = req.file ? req.file.path : undefined;

        // Create User for supplier
        const user = new User({
            firstName: firstName || supplier_name.split(' ')[0] || 'Supplier',
            lastName: lastName || supplier_name.split(' ')[1] || 'User',
            email: supplier_email,
            phone: supplier_phone,
            password: password || 'defaultPassword123',
            user_type: 2, // 2 for supplier
            balance: balance || 0,
            balance_type: balance_type || 'credit',
            gender,
            dateOfBirth,
            address,
            country,
            state,
            city,
            postalCode,
            profileImage // Add the image path to the user
        });

        await user.save();
        
        res.status(201).json({ 
            message: 'Supplier user created successfully', 
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    user_type: user.user_type,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    profileImage: user.profileImage // Include in response
                }
            }
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error creating supplier user',
            error: err.message 
        });
    }
}

//list
const listSuppliers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        // Build search query
        const searchQuery = {
            user_type: 2, // Only suppliers
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ]
        };

        // Get total count for pagination
        const total = await User.countDocuments(searchQuery);

        // Get paginated results
        const users = await User.find(searchQuery)
            .select('-password -__v') // Exclude sensitive fields
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const suppliers = users.map(user => ({
            supplier_name: `${user.firstName} ${user.lastName}`,
            supplier_email: user.email,
            supplier_phone: user.phone,
            balance: user.balance,
            balance_type: user.balance_type,
            profileImage: user.profileImage,
            address: user.address,
            country: user.country,
            state: user.state,
            city: user.city,
            postalCode: user.postalCode,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));

        res.status(200).json({
            message: 'Suppliers fetched successfully',
            data: {
                suppliers,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error fetching suppliers',
            error: err.message 
        });
    }
}
// Update supplier
const updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Handle file upload if exists
        if (req.file) {
            updates.profileImage = req.file.path;
        }

        // Prevent changing user_type or email
        if (updates.user_type || updates.email) {
            return res.status(400).json({
                message: "Cannot change user type or email"
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: id, user_type: 2 }, // Only update suppliers
            updates,
            { new: true, runValidators: true }
        ).select('-password -__v');

        if (!updatedUser) {
            return res.status(404).json({
                message: "Supplier not found"
            });
        }

        res.status(200).json({
            message: 'Supplier updated successfully',
            data: updatedUser
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error updating supplier',
            error: err.message 
        });
    }
}

// Delete supplier
const deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedUser = await User.findOneAndDelete({
            _id: id,
            user_type: 2 // Only delete suppliers
        }).select('-password -__v');

        if (!deletedUser) {
            return res.status(404).json({
                message: "Supplier not found"
            });
        }

        // TODO: Add any additional cleanup (e.g., delete profile image file)

        res.status(200).json({
            message: 'Supplier deleted successfully',
            data: deletedUser
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error deleting supplier',
            error: err.message 
        });
    }
}

module.exports = { 
    createSupplier, 
    listSuppliers,
    updateSupplier,
    deleteSupplier
};