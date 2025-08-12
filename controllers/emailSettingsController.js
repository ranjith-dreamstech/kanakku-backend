const EmailSettings = require("@models/EmailSettings");

/**
 * Create or update email settings (only one entry per user)
 */
exports.createOrUpdateEmailSettings = async (req, res) => {
    try {
        const userId = req.body.userId;

        const updateData = {
            provider_type: req.body.provider_type,
            nodeFromName: req.body.nodeFromName,
            nodeFromEmail: req.body.nodeFromEmail,
            nodeHost: req.body.nodeHost,
            nodePort: req.body.nodePort,
            nodeUsername: req.body.nodeUsername,
            nodePassword: req.body.nodePassword,
            smtpFromName: req.body.smtpFromName,
            smtpFromEmail: req.body.smtpFromEmail,
            smtpHost: req.body.smtpHost,
            smtpPort: req.body.smtpPort,
            smtpUsername: req.body.smtpUsername,
            smtpPassword: req.body.smtpPassword,
            smtp_status: req.body.smtp_status,
            node_status: req.body.node_status,
            userId
        };

        const settings = await EmailSettings.findOneAndUpdate(
            { userId },
            updateData,
            { new: true, upsert: true } // upsert ensures create if not exists
        );

        res.status(200).json({
            success: true,
            message: "Email settings saved successfully",
            data: settings
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error saving email settings",
            error: err.message
        });
    }
};

/**
 * List email settings for a user
 */
exports.getEmailSettings = async (req, res) => {
    try {
        const userId = req.query.userId;
        const settings = await EmailSettings.findOne({ userId });

        res.status(200).json({
            success: true,
            data: settings || {}
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error fetching email settings",
            error: err.message
        });
    }
};
