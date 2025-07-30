const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
    // Name or title for the signature (e.g., "My Official Signature", "John Doe's Signature")
    name: { // Updated: 'name' to match JSON 'signatureName'
        type: String,
        required: [true, 'Signature name is required'],
        trim: true,
        maxlength: [100, 'Signature name cannot exceed 100 characters']
    },
    // Path to the stored signature image file
    imagePath: { // Updated: 'imagePath' to match JSON 'signatureImage'
        type: String,
        required: [true, 'Signature image is required']
    },
    // Reference to the User who owns this signature
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    },
    // Optional: Add a description for the signature
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Signature description cannot exceed 500 characters']
    },
    // Adding fields from your provided JSON structure
    status: {
        type: Boolean,
        default: true
    },
    markAsDefault: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field on save
signatureSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Signature', signatureSchema);