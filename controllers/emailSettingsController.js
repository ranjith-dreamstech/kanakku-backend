const EmailSettings = require("@models/EmailSettings");

const fs = require("fs");
const path = require("path");

/**
 * Update .env file helper
 */
const updateEnvFile = (newVars) => {
    const envPath = path.join(__dirname, "../.env");
    let envData = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

    // Convert env file into an object
    let envObj = {};
    envData.split("\n").forEach(line => {
        const [key, value] = line.split("=");
        if (key) envObj[key.trim()] = value ? value.trim() : "";
    });

    // Update with new values
    Object.keys(newVars).forEach(key => {
        envObj[key] = newVars[key];
    });

    // Write back to file
    const updatedData = Object.entries(envObj)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    fs.writeFileSync(envPath, updatedData, "utf-8");
};

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
            { new: true, upsert: true }
        );

        if (req.body.provider_type === "SMTP") {
            updateEnvFile({
                SMTP_HOST: req.body.smtpHost,
                SMTP_PORT: req.body.smtpPort,
                SMTP_SECURE: req.body.smtp_status || "false",
                SMTP_EMAIL: req.body.smtpFromEmail,
                SMTP_PASSWORD: req.body.smtpPassword
            });
        } else if (req.body.provider_type === "NODE") {
            updateEnvFile({
                NODE_HOST: req.body.nodeHost,
                NODE_PORT: req.body.nodePort,
                NODE_EMAIL: req.body.nodeFromEmail,
                NODE_PASSWORD: req.body.nodePassword
            });
        }

        res.status(200).json({
            success: true,
            message: "Email settings saved successfully and .env updated",
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
