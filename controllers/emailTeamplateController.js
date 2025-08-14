const EmailTemplate = require('@models/EmailTemplate');
const NotificationType = require('@models/NotificationType');

// Create Email Template (already provided)
const createEmailTemplate = async (req, res) => {
    try {
        const {
            title,
            notification_type,
            description,
            subject,
            sms_content,
            notification_content,
            status = 'active'
        } = req.body;

        if (!title || !notification_type || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Title, notification_type, and subject are required'
            });
        }

        const notificationTypeExists = await NotificationType.findById(notification_type);
        if (!notificationTypeExists) {
            return res.status(404).json({
                success: false,
                message: 'Notification type not found'
            });
        }

        const emailTemplate = new EmailTemplate({
            title,
            notification_type,
            description,
            subject,
            sms_content,
            notification_content,
            status
        });

        await emailTemplate.save();

        res.status(201).json({
            success: true,
            message: 'Email template created successfully',
            data: emailTemplate
        });
    } catch (err) {
        console.error('Email template creation error:', err);
        res.status(500).json({
            success: false,
            message: 'Error creating email template',
            error: err.message
        });
    }
};

// List all Email Templates
const listEmailTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.find()
            .populate('notification_type', 'title slug')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Email templates fetched successfully',
            data: templates
        });
    } catch (err) {
        console.error('Error fetching email templates:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching email templates',
            error: err.message
        });
    }
};

// Update Email Template
const updateEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.notification_type) {
            const notificationTypeExists = await NotificationType.findById(updates.notification_type);
            if (!notificationTypeExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Notification type not found'
                });
            }
        }

        const updatedTemplate = await EmailTemplate.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true
        });

        if (!updatedTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Email template not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Email template updated successfully',
            data: updatedTemplate
        });
    } catch (err) {
        console.error('Error updating email template:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating email template',
            error: err.message
        });
    }
};

// Delete Email Template
const deleteEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedTemplate = await EmailTemplate.findByIdAndDelete(id);

        if (!deletedTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Email template not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Email template deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting email template:', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting email template',
            error: err.message
        });
    }
};

module.exports = {
    createEmailTemplate,
    listEmailTemplates,
    updateEmailTemplate,
    deleteEmailTemplate
};
