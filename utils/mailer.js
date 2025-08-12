// utils/mailer.js
const nodemailer = require("nodemailer");

const createTransporter = () => {
    return nodemailer.createTransport({
        host: "smtp.googlemail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });
};

const sendMail = async (options) => {
    const transporter = createTransporter();
    return await transporter.sendMail(options);
};

module.exports = { sendMail };
