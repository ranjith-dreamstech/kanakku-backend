const Signature = require('@models/Signature');
const User = require('@models/User');
const fs = require('fs');
const path = require('path');

// Create a new signature
const createSignature = async (req, res) => {
    try {
        const { signatureName, markAsDefault = false } = req.body;
        const userId = req.user; // Assuming user is authenticated and ID is available
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Create new signature
        const signature = new Signature({
            signatureName,
            signatureImage: req.file.path,
            markAsDefault,
            userId
        });

        await signature.save();

        // If this is set as default, update user's default signature reference
        if (markAsDefault) {
            user.defaultSignature = signature._id;
            await user.save();
        }

        res.status(201).json({ 
            success: true,
            message: 'Signature created successfully', 
            data: {
                id: signature._id,
                signatureName: signature.signatureName,
                signatureImage: `${req.protocol}://${req.get('host')}/${signature.signatureImage.replace(/\\/g, '/')}`,
                status: signature.status,
                markAsDefault: signature.markAsDefault,
                createdAt: signature.createdAt
            }
        });
    } catch (err) {
        // Clean up uploaded file if error occurs
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

// Get all signatures for a user
const getUserSignatures = async (req, res) => {
    try {
        const userId = req.user;
        
        const signatures = await Signature.find({ 
            userId, 
            isDeleted: false 
        }).sort({ createdAt: -1 });

        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        
        const formattedSignatures = signatures.map(sig => ({
            id: sig._id,
            signatureName: sig.signatureName,
            signatureImage: baseUrl + sig.signatureImage.replace(/\\/g, '/'),
            status: sig.status,
            markAsDefault: sig.markAsDefault,
            createdAt: sig.createdAt,
            updatedAt: sig.updatedAt
        }));

        res.status(200).json({
            success: true,
            data: formattedSignatures
        });
    } catch (err) {
        console.error('Error fetching signatures:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching signatures',
            error: err.message
        });
    }
};

// Update a signature
const updateSignature = async (req, res) => {
    try {
        const { signatureId } = req.params;
        const { signatureName, markAsDefault, status } = req.body;
        const userId = req.user;

        // Find the signature
        const signature = await Signature.findOne({
            _id: signatureId,
            userId,
            isDeleted: false
        });

        if (!signature) {
            return res.status(404).json({
                success: false,
                message: 'Signature not found'
            });
        }

        // Update fields if provided
        if (signatureName) signature.signatureName = signatureName;
        if (typeof markAsDefault !== 'undefined') {
            signature.markAsDefault = markAsDefault;
        }
        if (typeof status !== 'undefined') {
            signature.status = status;
        }

        // Handle image update if new file was uploaded
        if (req.file) {
            // Delete old image file
            try {
                if (fs.existsSync(signature.signatureImage)) {
                    fs.unlinkSync(signature.signatureImage);
                }
            } catch (fileErr) {
                console.error('Error deleting old signature image:', fileErr);
            }
            
            signature.signatureImage = req.file.path;
        }

        await signature.save();

        // If this is set as default, update user's default signature reference
        if (signature.markAsDefault) {
            await User.findByIdAndUpdate(userId, {
                defaultSignature: signature._id
            });
        }

        res.status(200).json({
            success: true,
            message: 'Signature updated successfully',
            data: {
                id: signature._id,
                signatureName: signature.signatureName,
                signatureImage: `${req.protocol}://${req.get('host')}/${signature.signatureImage.replace(/\\/g, '/')}`,
                status: signature.status,
                markAsDefault: signature.markAsDefault,
                updatedAt: signature.updatedAt
            }
        });
    } catch (err) {
        // Clean up uploaded file if error occurs
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (fileErr) {
                console.error('Error cleaning up signature image:', fileErr);
            }
        }
        
        console.error('Signature update error:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating signature',
            error: err.message
        });
    }
};

// Soft delete a signature
const deleteSignature = async (req, res) => {
    try {
        const { signatureId } = req.params;
        const userId = req.user;

        // Find and soft delete the signature
        const signature = await Signature.findOneAndUpdate(
            { 
                _id: signatureId, 
                userId,
                isDeleted: false 
            },
            { 
                isDeleted: true,
                status: false,
                markAsDefault: false 
            },
            { new: true }
        );

        if (!signature) {
            return res.status(404).json({
                success: false,
                message: 'Signature not found'
            });
        }

        // If this was the default signature, find a new one to set as default
        if (signature.markAsDefault) {
            const newDefault = await Signature.findOne({
                userId,
                isDeleted: false,
                status: true
            }).sort({ createdAt: -1 });

            if (newDefault) {
                newDefault.markAsDefault = true;
                await newDefault.save();
                
                await User.findByIdAndUpdate(userId, {
                    defaultSignature: newDefault._id
                });
            } else {
                // No other signatures, remove default reference
                await User.findByIdAndUpdate(userId, {
                    $unset: { defaultSignature: 1 }
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Signature deleted successfully'
        });
    } catch (err) {
        console.error('Signature deletion error:', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting signature',
            error: err.message
        });
    }
};

module.exports = {
    createSignature,
    getUserSignatures,
    updateSignature,
    deleteSignature
};