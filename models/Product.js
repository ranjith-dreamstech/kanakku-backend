const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    item_type: {
        type: String,
        enum: ['Product', 'Service'],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: true
    },
    unit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
        required: true
    },
    selling_price: {
        type: Number,
        required: true
    },
    purchase_price: {
        type: Number,
        required: true
    },
    discount_type: {
        // type: mongoose.Schema.Types.ObjectId,
        // ref: 'DiscountType',
        type: String,
        required: true
    },
    discount_value: {
        type: Number,
        required: true
    },
    tax: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaxGroup',
        required: true
    },
    barcode: {
        type: String,
        required: true,
        unique: true
    },
    alert_quantity: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    product_image: {
        type: String, // store file path or URL
        required: true
    },
    gallery_images: [
        {
            type: String // store file path or URL
        }
    ],
    status: {
        type: Boolean,
        default: true
    }
},
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Product', productSchema);
