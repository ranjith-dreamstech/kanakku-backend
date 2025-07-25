const TaxRate = require('../models/TaxRate');

// Get all tax rates
exports.getAllTaxRates = async (req, res) => {
    try {
        const taxRates = await TaxRate.find().sort({ createdAt: -1 });
        res.status(200).json(taxRates);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch tax rates', error: error.message });
    }
};

// Create new tax rate
exports.createTaxRate = async (req, res) => {
    try {
        const { tax_name, tax_rate, status } = req.body;

        const newTaxRate = new TaxRate({ tax_name, tax_rate, status });
        await newTaxRate.save();

        res.status(201).json({ message: 'Tax rate created successfully', data: newTaxRate });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create tax rate', error: error.message });
    }
};

// Get single tax rate by ID
exports.getTaxRateById = async (req, res) => {
    try {
        const taxRate = await TaxRate.findById(req.params.id);
        if (!taxRate) {
            return res.status(404).json({ message: 'Tax rate not found' });
        }
        res.status(200).json(taxRate);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch tax rate', error: error.message });
    }
};

// Update tax rate
exports.updateTaxRate = async (req, res) => {
    try {
        const updated = await TaxRate.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!updated) {
            return res.status(404).json({ message: 'Tax rate not found' });
        }
        res.status(200).json({ message: 'Tax rate updated successfully', data: updated });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update tax rate', error: error.message });
    }
};

// Delete tax rate
exports.deleteTaxRate = async (req, res) => {
    try {
        const deleted = await TaxRate.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Tax rate not found' });
        }
        res.status(200).json({ message: 'Tax rate deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete tax rate', error: error.message });
    }
};
