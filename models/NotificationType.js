// models/NotificationType.js
const mongoose = require('mongoose');

const NotificationTypeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    tags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationTag' // Relates to your notification_tags model
    }],
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true // Automatically adds createdAt & updatedAt
});

module.exports = mongoose.model('NotificationType', NotificationTypeSchema);
