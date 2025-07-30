const mongoose = require('mongoose');

const bankDetailSchema = new mongoose.Schema({
    accountHoldername: {
        type: String,
        required: true,
        trim: true
    },
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    branchName: {
        type: String,
        required: true,
        trim: true
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    IFSCCode: {
        type: String,
        required: true,
        trim: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Add index for frequently queried fields
bankDetailSchema.index({ userId: 1 });
bankDetailSchema.index({ accountNumber: 1 }, { unique: true });

module.exports = mongoose.model('BankDetail', bankDetailSchema);