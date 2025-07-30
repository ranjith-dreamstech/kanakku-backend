const BankDetail = require('@models/BankDetail');
const User = require('@models/User');
const mongoose = require('mongoose');

// Create bank detail
const createBankDetail = async (req, res) => {
    try {
        const { 
            accountHoldername,
            bankName,
            branchName,
            accountNumber,
            IFSCCode,
            userId
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
            isDeleted: false
        });

        await bankDetail.save();
        
        res.status(201).json({ 
            success: true,
            message: 'Bank detail created successfully', 
            data: {
                id: bankDetail._id,
                accountHoldername: bankDetail.accountHoldername,
                bankName: bankDetail.bankName,
                branchName: bankDetail.branchName,
                accountNumber: bankDetail.accountNumber,
                IFSCCode: bankDetail.IFSCCode,
                userId: bankDetail.userId,
                createdAt: bankDetail.createdAt,
                updatedAt: bankDetail.updatedAt
            }
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

module.exports = {
    createBankDetail
};