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
        
        // Build the base query
        const query = {};
        
        // Only add search conditions if search term exists
        if (search && search.trim() !== '') {
            const searchRegex = new RegExp(search.trim(), 'i');
            
            // Search in product fields
            const productSearch = {
                $or: [
                    { name: searchRegex },
                    { code: searchRegex },
                    { description: searchRegex },
                    { barcode: searchRegex }
                ]
            };
            
            // Search in populated brand and category names
            const [matchingBrands, matchingCategories] = await Promise.all([
                Brand.find({ brand_name: searchRegex }).select('_id'),
                Category.find({ category_name: searchRegex }).select('_id')
            ]);
            
            const brandIds = matchingBrands.map(b => b._id);
            const categoryIds = matchingCategories.map(c => c._id);
            
            // Combine all search conditions
            query.$or = [
                productSearch,
                brandIds.length ? { brand: { $in: brandIds } } : null,
                categoryIds.length ? { category: { $in: categoryIds } } : null
            ].filter(condition => condition !== null);
        }

        // Get total count for pagination
        const total = await Product.countDocuments(query);

        // Get paginated results with populated fields
        const products = await Product.find(query)
            .populate({
                path: 'category',
                select: 'category_name'
            })
            .populate({
                path: 'brand',
                select: 'brand_name'
            })
            .populate({
                path: 'tax',
                select: 'name total_tax_rate'
            })
            .populate({
                path: 'unit',
                select: 'name'
            })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.status(200).json({
            success: true,
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
        console.error('Error fetching products:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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