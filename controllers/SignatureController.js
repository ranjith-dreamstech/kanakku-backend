const Signature = require('../models/Signature'); // Adjust path as necessary
const fs = require('fs');
const path = require('path');

// @desc    Create a new signature
// @route   POST /api/signatures
// @access  Private (requires authentication)
const createSignature = async (req, res) => {
    try {
        // Updated: Use 'name' and 'description' from req.body, matching Joi schema and Mongoose model
        const { name, description } = req.body;

        // req.file is populated by multer's upload.single('signatureImage')
        const signatureImage = req.file ? req.file.path : undefined;

        // req.user is populated by the protect middleware (assuming it adds user info to req)
        if (!req.user || !req.user._id) {
            // Clean up uploaded file if user is not authenticated/available
            if (signatureImage) {
                try {
                    fs.unlinkSync(signatureImage);
                } catch (fileErr) {
                    console.error('Error cleaning up signature image for unauthenticated user:', fileErr);
                }
            }
            return res.status(401).json({
                success: false,
                message: 'Not authorized, user ID not found.'
            });
        }

        const userId = req.user._id; // Get the user ID from the authenticated user

        const signature = new Signature({
            name, // Updated: Matches the 'name' field in the model and JSON
            imagePath: signatureImage, // Updated: Matches 'imagePath' in the model and 'signatureImage' in JSON
            user: userId,
            description
        });

        await signature.save();

        res.status(201).json({
            success: true,
            message: 'Signature created successfully',
            data: {
                id: signature._id,
                name: signature.name,
                imagePath: signature.imagePath ?
                    `${req.protocol}://${req.get('host')}/${signature.imagePath.replace(/\\/g, '/')}` :
                    null,
                user: signature.user,
                description: signature.description
            }
        });

    } catch (err) {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (fileErr) {
                console.error('Error cleaning up signature image:', fileErr);
            }
        }

        console.error('Signature creation error:', err);
        res.status(500).json({
            success: false,
            message: 'Error creating signature',
            error: err.message
        });
    }
};

module.exports = {
    createSignature
};