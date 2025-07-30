const BankDetail = require('@models/BankDetail');
const User = require('@models/User');
const mongoose = require('mongoose');

// Create bank detail (existing)
const createBankDetail = async (req, res) => {
    try {
        const { 
            accountHoldername,
            bankName,
            branchName,
            accountNumber,
            IFSCCode,
            userId,
            status = true // Default to true if not provided
        } = req.body;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Create new bank detail
        const bankDetail = new BankDetail({
            accountHoldername,
            bankName,
            branchName,
            accountNumber,
            IFSCCode,
            userId,
            status,
            isDeleted: false
        });

        await bankDetail.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Bank detail created successfully', 
            data: bankDetail
        });
    } catch (err) {
        console.error('Bank detail creation error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error creating bank detail',
            error: err.message 
        });
    }
};

// Update bank detail
const updateBankDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Remove fields that shouldn't be updated
        delete updates._id;
        delete updates.userId;
        delete updates.createdAt;
        delete updates.updatedAt;
        delete updates.isDeleted;

        const bankDetail = await BankDetail.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!bankDetail || bankDetail.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Bank detail not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bank detail updated successfully',
            data: bankDetail
        });
    } catch (err) {
        console.error('Bank detail update error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error updating bank detail',
            error: err.message 
        });
    }
};

// Get bank detail by ID
const getBankDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const bankDetail = await BankDetail.findOne({ 
            _id: id, 
            isDeleted: false 
        });

        if (!bankDetail) {
            return res.status(404).json({
                success: false,
                message: 'Bank detail not found'
            });
        }

        res.status(200).json({
            success: true,
            data: bankDetail
        });
    } catch (err) {
        console.error('Get bank detail error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching bank detail',
            error: err.message 
        });
    }
};
// List all bank details (with pagination)
const listBankDetails = async (req, res) => {
    try {
        const { page = 1, limit = 10, userId, status } = req.query;
        const skip = (page - 1) * limit;

        const query = { isDeleted: false };
        
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID format'
                });
            }
            query.userId = userId;
        }

        if (status !== undefined) {
            query.status = status === 'true';
        }

        const [bankDetails, total] = await Promise.all([
            BankDetail.find(query)
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 }),
            BankDetail.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: bankDetails,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('List bank details error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching bank details',
            error: err.message 
        });
    }
};

// Update bank detail status only
const updateBankDetailStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status is provided and is boolean
        if (typeof status !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Status must be a boolean value'
            });
        }

        const bankDetail = await BankDetail.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        );

        if (!bankDetail || bankDetail.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Bank detail not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bank detail status updated successfully',
            data: {
                id: bankDetail._id,
                status: bankDetail.status
            }
        });
    } catch (err) {
        console.error('Bank detail status update error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error updating bank detail status',
            error: err.message 
        });
    }
};

// Soft delete bank detail
const deleteBankDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const bankDetail = await BankDetail.findByIdAndUpdate(
            id,
            { $set: { isDeleted: true } },
            { new: true }
        );

        if (!bankDetail) {
            return res.status(404).json({
                success: false,
                message: 'Bank detail not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bank detail deleted successfully'
        });
    } catch (err) {
        console.error('Delete bank detail error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting bank detail',
            error: err.message 
        });
    }
};

module.exports = {
    createBankDetail,
    updateBankDetail,
    getBankDetail,
    listBankDetails,
    updateBankDetailStatus,
    deleteBankDetail
};