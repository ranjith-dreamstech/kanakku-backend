const Category = require('../models/Category'); 

exports.createCategory = async (req, res) => {
    try {
        const { category_name, status } = req.body;
        const slug = req.body.slug;

        const category_image = req.file ? req.file.filename : null;

        const category = new Category({ 
            category_name: category_name,
            slug: slug,
            category_image: category_image,
            status: status, 
        });

        await category.save();
        res.status(201).json({ message: 'Category created', data: category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllCategories = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        // Build search query
        const searchQuery = {
            $or: [
                { category_name: { $regex: search, $options: 'i' } },
                { category_description: { $regex: search, $options: 'i' } }
            ]
        };

        // Get total count for pagination
        const total = await Category.countDocuments(searchQuery);

        // Get paginated results
        const categories = await Category.find(searchQuery)
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.status(200).json({
            message: 'Categories fetched successfully',
            data: {
                categories,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error fetching categories',
            error: err.message 
        });
    }
};

exports.getCategoryById = async (req, res) => { 
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateCategory = async (req, res) => { 
    try {
        const { category_name, slug, status } = req.body; 
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        if (category_name) category.category_name = category_name;
        if (slug) category.slug = slug; 
        if (status !== undefined) category.status = status;
        if (req.file) category.category_image = req.file.filename;

        await category.save(); 
        res.json({ message: 'Category updated', data: category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};