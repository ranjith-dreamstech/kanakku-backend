const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    purchaseId: {
        type: String,
        unique: true,
        required: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    purchaseDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    referenceNo: String,
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        unit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Unit'
        },
        rate: {
            type: Number,
            required: true,
            min: 0
        },
        discount: {
            type: Number,
            default: 0,
            min: 0
        },
        tax: {
            type: Number,
            default: 0,
            min: 0
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        productName: String,
        discountValue: Number,
        discountType: String,
        taxType: String
    }],
    status: {
        type: String,
        enum: ['DRAFT', 'PENDING', 'PAID', 'CANCELLED', 'REFUNDED'],
        default: 'DRAFT'
    },
    paymentMode: {
        type: String,
        enum: ['CASH', 'CREDIT', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE'],
        required: true
    },
    taxableAmount: {
        type: Number,
        required: true,
        min: 0
    },
    totalDiscount: {
        type: Number,
        default: 0,
        min: 0
    },
    vat: {
        type: Number,
        default: 0,
        min: 0
    },
    roundOff: {
        type: Boolean,
        default: false
    },
    TotalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    bank: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bank'
    },
    notes: String,
    termsAndCondition: String,
    sign_type: {
        type: String,
        enum: ['none', 'manualSignature', 'digitalSignature'],
        default: 'none'
    },
    signatureId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Signature'
    },
    signatureImage: String,
    signatureName: String,
    isDeleted: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    billFrom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    billTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    purchase_no: {
        type: String,
        unique: true
    },
    supplierInvoiceSerialNumber: String,
    taxType: String
}, {
    timestamps: true
});

// Pre-save hook for purchase ID generation
purchaseSchema.pre('save', async function(next) {
    if (!this.purchase_no) {
        try {
            const count = await this.constructor.countDocuments();
            this.purchase_no = `PO-${String(count + 1).padStart(6, '0')}`;
            next();
        } catch (err) {
            next(err);
        }
    } else {
        next();
    }
});

// Validation based on sign_type
purchaseSchema.pre('validate', function(next) {
    if (this.sign_type === 'manualSignature' && !this.signatureImage) {
        this.invalidate('signatureImage', 'Signature image is required for manual signature');
    }
    if (this.sign_type === 'digitalSignature' && !this.signatureId) {
        this.invalidate('signatureId', 'Signature ID is required for digital signature');
    }

    // Clear unused signature fields
    if (this.sign_type === 'none') {
        this.signatureId = undefined;
        this.signatureImage = undefined;
        this.signatureName = undefined;
    } else if (this.sign_type === 'manualSignature') {
        this.signatureId = undefined;
        if (!this.signatureName) this.signatureName = 'Manual Signature';
    } else if (this.sign_type === 'digitalSignature') {
        this.signatureImage = undefined;
        this.signatureName = undefined;
    }

    next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);