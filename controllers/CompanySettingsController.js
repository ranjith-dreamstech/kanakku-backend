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

        const settingsData = settings.toObject();
        
        const imageFields = ['siteLogo', 'favicon', 'companyLogo', 'companyBanner'];
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        imageFields.forEach(field => {
            if (settingsData[field]) {
                const cleanedPath = settingsData[field].replace(/^[\\/]+/, '');
                settingsData[field] = `${baseUrl}/${cleanedPath.replace(/\\/g, '/')}`;
            }
        });

        res.status(200).json({
            success: true,
            data: settingsData
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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const currentSettings = await CompanySettings.findOne({ userId }) || {};

        if (req.files) {
            const fileFields = {
                siteLogo: 'siteLogo',
                favicon: 'favicon',
                companyLogo: 'companyLogo',
                companyBanner: 'companyBanner'
            };

            for (const [field, fieldName] of Object.entries(fileFields)) {
                if (req.files[field] && req.files[field][0]) {
                    await deleteOldFile(currentSettings[field]);
                    updates[field] = `/uploads/company/${req.files[field][0].filename}`;
                }
            }
        }

        const protectedFields = ['_id', 'userId', 'createdAt', 'updatedAt'];
        protectedFields.forEach(field => delete updates[field]);

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

        const settingsData = settings.toObject();
        const imageFields = ['siteLogo', 'favicon', 'companyLogo', 'companyBanner'];
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        imageFields.forEach(field => {
            if (settingsData[field]) {
                const cleanedPath = settingsData[field].replace(/^[\\/]+/, '');
                settingsData[field] = `${baseUrl}/${cleanedPath.replace(/\\/g, '/')}`;
            }
        });

        res.status(200).json({
            success: true,
            message: 'Company settings updated successfully',
            data: settingsData
        });

    } catch (err) {
        console.error('Update company settings error:', err);
        
        if (req.files) {
            for (const fileType in req.files) {
                if (req.files[fileType] && req.files[fileType][0]) {
                    const file = req.files[fileType][0];
                    const filePath = path.join(__dirname, '../public/uploads/company', file.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
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