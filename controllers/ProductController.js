const Product = require('../models/Product');
const Unit = require('../models/Unit');
const Brand = require('../models/Brand');
const getFilePath = (file) => file ? `/uploads/products/${file.filename}` : null;

exports.createProduct = async (req, res) => {
    try {
        const productImageArray = req.files && req.files.product_image ? req.files.product_image : [];
        const product_image = getFilePath(productImageArray[0]);

        const galleryImagesArray = req.files && req.files.gallery_images ? req.files.gallery_images : [];
        const gallery_images = galleryImagesArray.map(file => getFilePath(file));

        const product = new Product({
            ...req.body,
            product_image,
            gallery_images
        });

        await product.save();

        res.status(201).json({
            message: 'Product created successfully',
            data: product
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        
        // Build search query
        const searchQuery = {
            $or: [
                { product_name: { $regex: search, $options: 'i' } },
                { product_code: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        };

        // Get total count for pagination
        const total = await Product.countDocuments(searchQuery);

        // Get paginated results with populated fields
        const products = await Product.find(searchQuery)
            .populate('category', 'category_name')
            .populate('brand', 'brand_name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.status(200).json({
            message: 'Products fetched successfully',
            data: {
                products,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category brand unit discount_type tax');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const existingProduct = await Product.findById(productId);

        if (!existingProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        let newProductImagePath = existingProduct.product_image;

        const productImageArray = req.files && req.files.product_image ? req.files.product_image : [];
        if (productImageArray.length > 0) {
            newProductImagePath = getFilePath(productImageArray[0]);
        }

      
        let newGalleryImages = existingProduct.gallery_images || [];

        const uploadedGalleryImages = req.files && req.files.gallery_images ? req.files.gallery_images : [];

        if (uploadedGalleryImages.length > 0) {
            const newUploadedPaths = uploadedGalleryImages.map(file => getFilePath(file));
            newGalleryImages = [...newGalleryImages, ...newUploadedPaths];
        }

        const imagesToRemove = req.body.images_to_remove || [];
        if (imagesToRemove.length > 0) {
            newGalleryImages = newGalleryImages.filter(imgPath => !imagesToRemove.includes(imgPath));
        }

        const updateData = {
            ...req.body,
            product_image: newProductImagePath,
            gallery_images: newGalleryImages
        };

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            updateData,
            { new: true, runValidators: true } 
        );

        res.status(200).json({
            message: 'Product updated successfully',
            data: updatedProduct
        });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const deleted = await Product.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({
            message: 'Product deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


const Category = require('../models/Category');

exports.getAllProductCategories = async (req, res) => {
    try {
        const categories = await Category.find({ status: true });
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


exports.getAllProductBrands = async (req, res) => {
    try {
        const brands = await Brand.find({ status: true });
        res.status(200).json(brands);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getAllUnits = async (req, res) => {
    try {
        const units = await Unit.find({ status: true });
        res.status(200).json(units);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const TaxGroup = require('../models/TaxGroup');

exports.getAllTaxGroups = async (req, res) => {
    try {
        const taxes = await TaxGroup.find({ status: true });
        res.status(200).json(taxes);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};