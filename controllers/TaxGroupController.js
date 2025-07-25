const TaxGroup = require('../models/TaxGroup');

// Get all tax groups
exports.getAllTaxGroups = async (req, res) => {
    try {
        const taxGroups = await TaxGroup.find().populate('tax_rate_ids');

        const result = taxGroups.map(taxGroup => {
            const totalTaxRate = taxGroup.tax_rate_ids.reduce((sum, rate) => sum + (rate.tax_rate || 0), 0);

            return {
                ...taxGroup.toObject(),
                total_tax_rate: totalTaxRate
            };
        });

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tax groups', error: err.message });
    }
};

// Create new tax group
exports.createTaxGroup = async (req, res) => {
    try {
        const { tax_name, tax_rate, tax_rate_ids } = req.body;

        const newGroup = new TaxGroup({ tax_name, tax_rate, tax_rate_ids });
        await newGroup.save();

        res.status(201).json({ message: 'Tax group created successfully', data: newGroup });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create tax group', error: err.message });
    }
};

// Get a single tax group
exports.getTaxGroupById = async (req, res) => {
    try {
        const group = await TaxGroup.findById(req.params.id).populate('tax_rate_ids');
        if (!group) return res.status(404).json({ message: 'Tax group not found' });

        res.status(200).json(group);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tax group', error: err.message });
    }
};

// Update a tax group
exports.updateTaxGroup = async (req, res) => {
    try {
        const updated = await TaxGroup.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Tax group not found' });

        res.status(200).json({ message: 'Tax group updated successfully', data: updated });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update tax group', error: err.message });
    }
};

// Delete a tax group
exports.deleteTaxGroup = async (req, res) => {
    try {
        const deleted = await TaxGroup.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Tax group not found' });

        res.status(200).json({ message: 'Tax group deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete tax group', error: err.message });
    }
};
