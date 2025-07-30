const CompanySettings = require('@models/CompanySettings');
const mongoose = require('mongoose');
const User = require('@models/User');
const fs = require('fs');
const path = require('path');

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

// Helper function to delete old files
const deleteOldFile = async (filePath) => {
  if (filePath) {
    try {
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.error('Error deleting old file:', err);
    }
  }
};

// Update company settings (with file handling)
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

        // Get current settings
        const currentSettings = await CompanySettings.findOne({ userId }) || {};

        // Process uploaded files
        if (req.files) {
            // Handle site logo
            if (req.files.siteLogo) {
                await deleteOldFile(currentSettings.siteLogo);
                updates.siteLogo = `/uploads/company/${req.files.siteLogo[0].filename}`;
            }

            // Handle favicon
            if (req.files.favicon) {
                await deleteOldFile(currentSettings.favicon);
                updates.favicon = `/uploads/company/${req.files.favicon[0].filename}`;
            }

            // Handle company logo
            if (req.files.companyLogo) {
                await deleteOldFile(currentSettings.companyLogo);
                updates.companyLogo = `/uploads/company/${req.files.companyLogo[0].filename}`;
            }
        }

        // Remove protected fields
        const protectedFields = ['_id', 'userId', 'createdAt', 'updatedAt'];
        protectedFields.forEach(field => delete updates[field]);

        // Update or create settings
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
        
        // Clean up uploaded files if error occurred
        if (req.files) {
            for (const fileType in req.files) {
                const file = req.files[fileType][0];
                const filePath = path.join(__dirname, '../public/uploads/company', file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

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