const mongoose = require('mongoose');
const User = require('@models/User');
const fs = require('fs'); // Add this at the top of your file
const path = require('path'); // Useful for path operations

//create
const createSupplier = async (req, res) => {
    try {
        const { 
            supplier_name, 
            supplier_email, 
            supplier_phone, 
            balance = 0, // Default to 0 if not provided
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

        // Split supplier name if firstName/lastName not provided
        const nameParts = supplier_name.split(' ');
        const defaultFirstName = nameParts[0] || '';
        const defaultLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // Create User for supplier
        const user = new User({
            firstName: firstName || defaultFirstName,
            lastName: lastName || defaultLastName,
            email: supplier_email,
            phone: supplier_phone,
            password: password || 'defaultPassword123',
            user_type: 2, // 2 for supplier
            balance: Number(balance),
            balance_type: balance == 0 ? null : (balance_type || 'credit'), // Null if balance is 0
            gender,
            dateOfBirth,
            address,
            country,
            state,
            city,
            postalCode,
            profileImage
        });

        await user.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Supplier created successfully', 
            data: {
                id: user._id,
                supplier_name: `${user.firstName} ${user.lastName}`,
                supplier_email: user.email,
                supplier_phone: user.phone,
                balance: user.balance,
                balance_type: user.balance_type,
                profileImage: user.profileImage ? 
                    `${req.protocol}://${req.get('host')}/${user.profileImage.replace(/\\/g, '/')}` : 
                    null
            }
        });
    } catch (err) {
        // Clean up uploaded file if error occurs
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (fileErr) {
                console.error('Error cleaning up profile image:', fileErr);
            }
        }
        
        console.error('Supplier creation error:', err);
        res.status(500).json({ 
            message: 'Error creating supplier user',
            error: err.message 
        });
    }
};

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

        // Transform the data to match your desired format
        const suppliers = users.map(user => ({
            id: user._id, // Include the user ID
            supplier_name: `${user.firstName} ${user.lastName}`,
            supplier_email: user.email,
            supplier_phone: user.phone,
            balance: user.balance,
            balance_type: user.balance_type,
            profileImage: user.profileImage 
                ? `${req.protocol}://${req.get('host')}/${user.profileImage}`
                : `${req.protocol}://${req.get('host')}/uploads/default-profile.jpg`,
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
        let updates = req.body;
        
        // First get the existing user to handle image cleanup
        const existingUser = await User.findOne({ _id: id, user_type: 2 });
        
        if (!existingUser) {
            return res.status(404).json({
                message: "Supplier not found"
            });
        }

        // Handle profile image removal if requested
        if (updates.profile_image_removed === "true") {
            try {
                if (existingUser.profileImage) {
                    const fullPath = path.join(process.cwd(), existingUser.profileImage);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                }
                updates.profileImage = null; // Set profileImage to null
            } catch (err) {
                console.error('Error removing profile image:', err);
                // Continue even if deletion fails
            }
            delete updates.profile_image_removed; // Remove this field from updates
        }

        // Handle file upload if exists
        if (req.file) {
            // Delete old image if it exists
            if (existingUser.profileImage) {
                try {
                    const fullPath = path.join(process.cwd(), existingUser.profileImage);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                } catch (err) {
                    console.error('Error deleting old profile image:', err);
                    // Continue even if deletion fails
                }
            }
            updates.profileImage = req.file.path;
        }

        // Prevent changing critical fields
        const restrictedFields = ['user_type', 'email', '_id', 'password'];
        restrictedFields.forEach(field => {
            if (updates[field]) {
                delete updates[field];
            }
        });

        // Transform supplier_name to firstName and lastName if provided
        if (updates.supplier_name) {
            const names = updates.supplier_name.split(' ');
            updates.firstName = names[0] || existingUser.firstName;
            updates.lastName = names.length > 1 ? names.slice(1).join(' ') : existingUser.lastName;
            delete updates.supplier_name;
        }

        // Update the user
        const updatedUser = await User.findOneAndUpdate(
            { _id: id, user_type: 2 },
            updates,
            { new: true, runValidators: true }
        ).select('-password -__v');

        if (!updatedUser) {
            // Remove uploaded file if update failed
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({
                message: "Supplier not found or update failed"
            });
        }

        // Format the response
        const responseData = {
            id: updatedUser._id,
            supplier_name: `${updatedUser.firstName} ${updatedUser.lastName}`,
            supplier_email: updatedUser.email,
            supplier_phone: updatedUser.phone,
            balance: updatedUser.balance,
            balance_type: updatedUser.balance_type,
            profileImage: updatedUser.profileImage ? 
                `${req.protocol}://${req.get('host')}/${updatedUser.profileImage.replace(/\\/g, '/')}` : 
                null
        };

        res.status(200).json({
            message: 'Supplier updated successfully',
            data: responseData
        });
    } catch (err) {
        // Remove uploaded file if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (fileErr) {
                console.error('Error cleaning up uploaded file:', fileErr);
            }
        }
        
        console.error('Supplier update error:', err);
        res.status(500).json({ 
            message: 'Error updating supplier',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

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