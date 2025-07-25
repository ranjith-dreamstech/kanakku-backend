const Brand = require('../models/Brand');

exports.createBrand = async (req, res) => {
    try {
        const { brand_name, status } = req.body;
        const brand_image = req.file ? req.file.filename : null;

        const brand = new Brand({
            brand_name: brand_name,
            brand_image,
            status,
        });

        await brand.save();
        res.status(201).json({ message: 'Brand created', data: brand });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllBrands = async (req, res) => {
    try {
        const brands = await Brand.find();
        res.json(brands);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getBrandById = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });
        res.json(brand);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateBrand = async (req, res) => {
    try {
        const { brand_name, status } = req.body;
        const brand = await Brand.findById(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });

        if (brand_name) brand.brand_name = brand_name;
        if (status !== undefined) brand.status = status;
        if (req.file) brand.brand_image = req.file.filename;

        await brand.save();
        res.json({ message: 'Brand updated', data: brand });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteBrand = async (req, res) => {
    try {
        const brand = await Brand.findByIdAndDelete(req.params.id);
        if (!brand) return res.status(404).json({ error: 'Brand not found' });
        res.json({ message: 'Brand deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};