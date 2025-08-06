const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
   purchaseOrderId: {
    type: String,
    unique: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  purchaseOrderDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  referenceNo: {
    type: String,
    default: ""
  },
  items: [{
    name: {
      type: String,
      required: true
    },
    key: String,
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    qty: {
      type: Number,
      required: true
    },
    // units: String,
    // unit: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Unit'
    // },
    rate: {
      type: Number,
      required: true
    },
    items: [{
        name: {
            type: String,
            required: true
        },
        key: String,
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        units: String,
        unit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Unit'
        },
        rate: {
            type: Number,
            required: true
        },
        discount: Number,
        tax: Number,
        taxInfo: mongoose.Schema.Types.Mixed,
        amount: {
            type: Number,
            required: true
        },
        discountType: String,
        isRateFormUpdated: Boolean,
        form_updated_discounttype: String,
        form_updated_discount: Number,
        form_updated_rate: Number,
        form_updated_tax: Number
    }],
    status: {
        type: String,
        enum: ['NEW', 'PENDING', 'COMPLETED', 'CANCELLED'],
        default: 'NEW'
    },
    discountType: String,
    isRateFormUpdated: Boolean,
    form_updated_discounttype: String,
    form_updated_discount: Number,
    form_updated_rate: Number,
    form_updated_tax: Number
  }],
  status: {
    type: String,
    enum: ['new', 'pending', 'completed', 'cancelled'],
    default: 'new'
  },
  paymentMode: {
    type: String,
    enum: ['CASH', 'CREDIT', 'CHECK', 'BANK_TRANSFER', 'OTHER'],
    required: false
  },
  taxableAmount: {
    type: Number,
    required: true
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  vat: {
    type: Number,
    default: 0
  },
  roundOff: {
    type: Boolean,
    default: false
  },
  TotalAmount: {
    type: Number,
    required: true
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankDetail',
  },
  notes: String,
  termsAndCondition: String,
  sign_type: {
    type: String,
    enum: ['manualSignature', 'digitalSignature', 'none'],
    default: 'none'
  },
  signatureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Signature'
  },
  signatureImage: String,
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
    type: String,
    required: true
  },
  billTo: {   
    type: String,
    required: true
  },
  convert_type: {
    type: String,
    enum: ['purchase', 'estimate', 'invoice'],
    default: 'purchase'
  }
}, {
    timestamps: true
});

// Pre-save hook to generate purchase order ID
purchaseOrderSchema.pre('save', async function(next) {
    if (!this.purchaseOrderId) {
        try {
            const count = await this.constructor.countDocuments();
            this.purchaseOrderId = `PO-${String(count + 1).padStart(6, '0')}`;
            next();
        } catch (err) {
            next(err);
        }
    } else {
        next();
    }
});

// Add validation based on sign_type
purchaseOrderSchema.pre('validate', function(next) {
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
    } else if (this.sign_type === 'digitalSignature') {
        this.signatureImage = undefined;
        this.signatureName = undefined;
    }
    
    next();
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);