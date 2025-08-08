const Currency = require('@models/Currency');
const User = require('@models/User');
const mongoose = require('mongoose');

const createCurrency = async (req, res) => {
    try {
       
        const { name, code, symbol, status = true, isDefault = false } = req.body;
        const createdBy = req.user;
        
        const existingCode = await Currency.findOne({ code, isDeleted: false });
        if (existingCode) {
            return res.status(409).json({ 
                success: false,
                message: 'Currency code already exists' 
            });
        }

        const existingName = await Currency.findOne({ name, isDeleted: false });
        if (existingName) {
            return res.status(409).json({ 
                success: false,
                message: 'Currency name already exists' 
            });
        }

        const currency = new Currency({
            name,
            code,
            symbol,
            status,
            isDefault,
            createdBy
        });

        await currency.save();

        if (isDefault) {
            await User.updateMany(
                {},
                { $set: { defaultCurrency: currency._id } }
            );
        }

        res.status(201).json({ 
            success: true,
            message: 'Currency created successfully', 
            data: {
                id: currency._id,
                name: currency.name,
                code: currency.code,
                symbol: currency.symbol,
                status: currency.status,
                isDefault: currency.isDefault,
                createdAt: currency.createdAt
            }
        });
    } catch (err) {
        console.error('Currency creation error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error creating currency',
            error: err.message 
        });
    }
};

const getAllCurrencies = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status } = req.query;
        const skip = (page - 1) * limit;
        
        const query = { isDeleted: false };
        
        if (status !== undefined) {
            query.status = status === 'true';
        }
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }
        
        const total = await Currency.countDocuments(query);
        const currencies = await Currency.find(query)
            .sort({ createdAt: -1, name: 1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('createdBy', 'firstName lastName');
            
        const formattedCurrencies = currencies.map(currency => ({
            id: currency._id,
            name: currency.name,
            code: currency.code,
            symbol: currency.symbol,
            status: currency.status,
            isDefault: currency.isDefault,
            createdBy: currency.createdBy ? {
                id: currency.createdBy._id,
                name: `${currency.createdBy.firstName} ${currency.createdBy.lastName}`
            } : null,
            createdAt: currency.createdAt
        }));
        
        res.status(200).json({
            success: true,
            message: 'Currencies retrieved successfully',
            data: {
                currencies: formattedCurrencies,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error('Error fetching currencies:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching currencies',
            error: err.message 
        });
    }
};

const updateCurrency = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, symbol, status, isDefault } = req.body;
        
        const errors = {};
        
        // Validate required fields if they're being updated
        if (name !== undefined && !name) {
            errors.name = 'Currency name is required';
        }
        if (code !== undefined && !code) {
            errors.code = 'Currency code is required';
        }
        
        // If there are validation errors, return them
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const currency = await Currency.findOne({ _id: id, isDeleted: false });
        if (!currency) {
            return res.status(404).json({ 
                success: false,
                message: 'Currency not found',
                errors: {
                    id: 'Currency not found'
                }
            });
        }

        // Check if currency code already exists (excluding current currency)
        if (code && code !== currency.code) {
            const existingCode = await Currency.findOne({ 
                code, 
                isDeleted: false,
                _id: { $ne: id }
            });
            if (existingCode) {
                errors.code = 'Currency code already exists';
            }
        }

        // Check if currency name already exists (excluding current currency)
        if (name && name !== currency.name) {
            const existingName = await Currency.findOne({ 
                name, 
                isDeleted: false,
                _id: { $ne: id }
            });
            if (existingName) {
                errors.name = 'Currency name already exists';
            }
        }

        // If there are duplicate errors, return them
        if (Object.keys(errors).length > 0) {
            return res.status(409).json({ 
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        // Update fields if they exist in the request
        if (name) currency.name = name;
        if (code) currency.code = code;
        if (symbol) currency.symbol = symbol;
        if (status !== undefined) currency.status = status;
        if (isDefault !== undefined) currency.isDefault = isDefault;
        
        await currency.save();

        // If this is set as default, update all other currencies
        if (currency.isDefault) {
            await Currency.updateMany(
                { _id: { $ne: currency._id } },
                { $set: { isDefault: false } }
            );
            
            // Update user's default currency reference
            await User.updateMany(
                {},
                { $set: { defaultCurrency: currency._id } }
            );
        }

        res.status(200).json({ 
            success: true,
            message: 'Currency updated successfully', 
            data: {
                id: currency._id,
                name: currency.name,
                code: currency.code,
                symbol: currency.symbol,
                status: currency.status,
                isDefault: currency.isDefault
            }
        });
    } catch (err) {
        console.error('Currency update error:', err);
        
        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = {};
            for (const field in err.errors) {
                validationErrors[field] = err.errors[field].message;
            }
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Error updating currency',
            error: err.message 
        });
    }
};

const deleteCurrency = async (req, res) => {
    try {
        const { id } = req.params;
        
        const currency = await Currency.findOne({ _id: id, isDeleted: false });
        if (!currency) {
            return res.status(404).json({ 
                success: false,
                message: 'Currency not found' 
            });
        }

        // Soft delete
        currency.isDeleted = true;
        await currency.save();

        // If this was the default currency, set another one as default
        if (currency.isDefault) {
            const newDefault = await Currency.findOne({ 
                isDeleted: false,
                _id: { $ne: id }
            }).sort({ createdAt: 1 });
            
            if (newDefault) {
                newDefault.isDefault = true;
                await newDefault.save();
                
                // Update user's default currency reference
                await User.updateMany(
                    {},
                    { $set: { defaultCurrency: newDefault._id } }
                );
            }
        }

        res.status(200).json({ 
            success: true,
            message: 'Currency deleted successfully'
        });
    } catch (err) {
        console.error('Currency deletion error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting currency',
            error: err.message 
        });
    }
};

const updateCurrencyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, isDefault } = req.body;
        const updatedBy = req.user._id;

        // Validate input
        if (typeof status !== 'boolean' && typeof isDefault !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Both status and isDefault must be boolean values'
            });
        }

        // Find the currency
        const currency = await Currency.findById(id);
        if (!currency) {
            return res.status(404).json({
                success: false,
                message: 'Currency not found'
            });
        }

        // Prepare update object
        const update = { updatedBy };
        if (typeof status === 'boolean') update.status = status;
        if (typeof isDefault === 'boolean') update.isDefault = isDefault;

        // Update currency
        const updatedCurrency = await Currency.findByIdAndUpdate(
            id,
            update,
            { new: true }
        );

        // Handle default currency change
        if (isDefault === true) {
            // Unset any other default currencies
            await Currency.updateMany(
                { _id: { $ne: id }, isDeleted: false },
                { $set: { isDefault: false } }
            );

            // Update all users' default currency reference
            await User.updateMany(
                {},
                { $set: { defaultCurrency: id } }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Currency updated successfully',
            data: {
                id: updatedCurrency._id,
                name: updatedCurrency.name,
                code: updatedCurrency.code,
                status: updatedCurrency.status,
                isDefault: updatedCurrency.isDefault,
                updatedAt: updatedCurrency.updatedAt
            }
        });

    } catch (err) {
        console.error('Currency update error:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating currency',
            error: err.message
        });
    }
};       

module.exports = {
    createCurrency,
    getAllCurrencies,
    updateCurrency,
    deleteCurrency,
    updateCurrencyStatus
};