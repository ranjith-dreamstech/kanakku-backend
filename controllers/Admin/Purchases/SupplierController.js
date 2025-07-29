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
            firstName: firstName || supplier_name.split(' ')[0] || '',
            lastName: lastName || supplier_name.split(' ')[1] || '',
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

        // Handle file upload if exists
        if (req.file) {
            // Delete old image if it exists
            if (existingUser.profileImage && fs.existsSync(existingUser.profileImage)) {
                fs.unlinkSync(existingUser.profileImage);
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
            updates.lastName = names[1] || existingUser.lastName;
            delete updates.supplier_name;
        }

        // Update the user
        const updatedUser = await User.findOneAndUpdate(
            { _id: id, user_type: 2 },
            updates,
            { new: true, runValidators: true }
        ).select('-password -__v');

        // Format the response
        const responseData = {
            id: updatedUser._id,
            supplier_name: `${updatedUser.firstName} ${updatedUser.lastName}`,
            supplier_email: updatedUser.email,
            supplier_phone: updatedUser.phone,
            balance: updatedUser.balance,
            balance_type: updatedUser.balance_type,
            profileImage: updatedUser.profileImage ? 
                `${req.protocol}://${req.get('host')}/${updatedUser.profileImage}` : 
                null
        };

        res.status(200).json({
            message: 'Supplier updated successfully',
            data: responseData
        });
    } catch (err) {
        // Remove uploaded file if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
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