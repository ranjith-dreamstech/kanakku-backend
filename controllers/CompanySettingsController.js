const CompanySettings = require('@models/CompanySettings');
const mongoose = require('mongoose');
const User = require('@models/User');

// Get company settings (single entry)
const getCompanySettings = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format'
            });
        }

        const settings = await CompanySettings.findOne({ userId });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Company settings not found',
                data: null
            });
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (err) {
        console.error('Get company settings error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching company settings',
            error: err.message 
        });
    }
};

// Update company settings (upsert - create if not exists)
const updateCompanySettings = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format'
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Remove fields that shouldn't be updated
        delete updates._id;
        delete updates.userId;
        delete updates.createdAt;
        delete updates.updatedAt;

        // Find and update or create new
        const settings = await CompanySettings.findOneAndUpdate(
            { userId },
            { $set: updates },
            { 
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        res.status(200).json({
            success: true,
            message: 'Company settings updated successfully',
            data: settings
        });
    } catch (err) {
        console.error('Update company settings error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error updating company settings',
            error: err.message 
        });
    }
};

module.exports = {
    getCompanySettings,
    updateCompanySettings
};