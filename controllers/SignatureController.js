const Signature = require('@models/Signature');
const User = require('@models/User');
const fs = require('fs');
const path = require('path');

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

const getUserSignatures = async (req, res) => {
    try {
        const userId = req.user;
        const { 
            page = 1, 
            limit = 10, 
            search = '',
            status,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Validate pagination parameters
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        if (isNaN(pageNumber) || pageNumber < 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid page number'
            });
        }
        if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
            return res.status(400).json({
                success: false,
                message: 'Limit must be between 1 and 100'
            });
        }

        // Build query
        const query = { 
            userId, 
            isDeleted: false 
        };

        // Add search filter
        if (search) {
            query.signatureName = { 
                $regex: search, 
                $options: 'i' // case insensitive
            };
        }

        // Add status filter if provided
        if (status !== undefined) {
            query.status = status === 'true';
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get total count for pagination info
        const total = await Signature.countDocuments(query);

        // Get paginated results
        const signatures = await Signature.find(query)
            .sort(sort)
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        
        const formattedSignatures = signatures.map(sig => ({
            id: sig._id,
            signatureName: sig.signatureName,
            signatureImage: sig.signatureImage 
                ? `${baseUrl}${sig.signatureImage.replace(/\\/g, '/')}`
                : null,
            status: sig.status,
            markAsDefault: sig.markAsDefault,
            createdAt: sig.createdAt,
            updatedAt: sig.updatedAt
        }));

        res.status(200).json({
            success: true,
            data: formattedSignatures,
            pagination: {
                total,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(total / limitNumber),
                hasNextPage: pageNumber * limitNumber < total,
                hasPreviousPage: pageNumber > 1
            }
        });
    } catch (err) {
        console.error('Error fetching signatures:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching signatures',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

const updateSignature = async (req, res) => {
    try {
        const { signatureId } = req.params;
        const { signatureName, markAsDefault, status } = req.body;
        const userId = req.user;

        const signature = await Signature.findOne({
            _id: signatureId,
            userId,
            isDeleted: false
        });

        if (!signature) {
            if (req.file?.path) fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: 'Signature not found or you dont have permission'
            });
        }

        if (signatureName) signature.signatureName = signatureName;
        if (typeof markAsDefault !== 'undefined') signature.markAsDefault = markAsDefault;
        if (typeof status !== 'undefined') signature.status = status;

        if (req.file) {
            try {
                if (signature.signatureImage && fs.existsSync(signature.signatureImage)) {
                    fs.unlinkSync(signature.signatureImage);
                }
                signature.signatureImage = req.file.path;
            } catch (fileErr) {
                console.error('Error handling signature image:', fileErr);
                fs.unlinkSync(req.file.path);
                throw new Error('Error updating signature image');
            }
        }

        await signature.save();

        // Update default signature reference if needed
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
                signatureImage: signature.signatureImage 
                    ? `${req.protocol}://${req.get('host')}/${signature.signatureImage.replace(/\\/g, '/')}`
                    : undefined,
                status: signature.status,
                markAsDefault: signature.markAsDefault,
                updatedAt: signature.updatedAt
            }
        });

    } catch (err) {
        // Clean up uploaded file if error occurs
        if (req.file?.path) {
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
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

const deleteSignature = async (req, res) => {
    try {
        const { signatureId } = req.params;
        const userId = req.user;

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
// Set a signature as default
const setAsDefaultSignature = async (req, res) => {
    try {
        const { signatureId } = req.params;
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
                message: 'Signature not found or you dont have permission'
            });
        }

        // If already default, return success
        if (signature.markAsDefault) {
            return res.status(200).json({
                success: true,
                message: 'Signature is already set as default'
            });
        }

        // Transaction to ensure atomic update
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Remove default from all other signatures
            await Signature.updateMany(
                { userId, markAsDefault: true },
                { $set: { markAsDefault: false } },
                { session }
            );

            // Set this signature as default
            signature.markAsDefault = true;
            await signature.save({ session });

            // Update user's default signature reference
            await User.findByIdAndUpdate(
                userId,
                { defaultSignature: signature._id },
                { session }
            );

            await session.commitTransaction();
            
            res.status(200).json({
                success: true,
                message: 'Signature set as default successfully',
                data: {
                    id: signature._id,
                    signatureName: signature.signatureName,
                    markAsDefault: signature.markAsDefault
                }
            });
        } catch (transactionError) {
            await session.abortTransaction();
            throw transactionError;
        } finally {
            session.endSession();
        }
    } catch (err) {
        console.error('Set default signature error:', err);
        res.status(500).json({
            success: false,
            message: 'Error setting signature as default',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

// Update signature status
const updateSignatureStatus = async (req, res) => {
    try {
        const { signatureId } = req.params;
        const { status } = req.body;
        const userId = req.user;

        // Validate status
        if (typeof status !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Status must be a boolean value'
            });
        }

        // Find and update the signature
        const signature = await Signature.findOneAndUpdate(
            {
                _id: signatureId,
                userId,
                isDeleted: false
            },
            { 
                status,
                // If disabling, also unset as default
                ...(status === false && { markAsDefault: false })
            },
            { new: true }
        );

        if (!signature) {
            return res.status(404).json({
                success: false,
                message: 'Signature not found or you dont have permission'
            });
        }

        // If this was the default signature and we're disabling it,
        // find a new default signature
        if (status === false && signature.markAsDefault) {
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
            message: 'Signature status updated successfully',
            data: {
                id: signature._id,
                signatureName: signature.signatureName,
                status: signature.status,
                markAsDefault: signature.markAsDefault
            }
        });
    } catch (err) {
        console.error('Update signature status error:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating signature status',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};


module.exports = {
    createSignature,
    getUserSignatures,
    updateSignature,
    deleteSignature,
    setAsDefaultSignature,
    updateSignatureStatus
};