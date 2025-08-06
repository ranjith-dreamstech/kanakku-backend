// models/Purchase.js
const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  purchaseId: {
    type: String,
    unique: true
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
  referenceNo: {
    type: String,
    default: ""
  },
  supplierInvoiceSerialNumber: {
    type: String,
    default: ""
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit'
    },
    quantity: {
      type: Number,
      required: true
    },
    rate: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    discountValue: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number,
      required: true
    }
  }],
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING', 'PAID', 'CANCELLED'],
    default: 'DRAFT'
  },
  paymentMode: {
    type: String,
    enum: ['CASH', 'CREDIT', 'CHECK', 'BANK_TRANSFER', 'OTHER'],
    required: true
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
  totalAmount: {
    type: Number,
    required: true
  },
  discountType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discount'
  },
  discount: {
    type: Number,
    default: 0
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankDetail',
  },
  notes: String,
  termsAndCondition: String,
  sign_type: {
    type: String,
    enum: ['digitalSignature', 'manualSignature', 'none'],
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  billTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purchaseNo: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Pre-save hook to generate purchase ID
purchaseSchema.pre('save', async function (next) {
  if (!this.purchaseNo) {
    try {
      const count = await this.constructor.countDocuments();
      this.purchaseNo = `PUR-${String(count + 1).padStart(6, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

// Add validation based on sign_type
purchaseSchema.pre('validate', function (next) {
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
  } else if (this.sign_type === 'manualSignature') {
    this.signatureId = undefined;
  } else if (this.sign_type === 'digitalSignature') {
    this.signatureImage = undefined;
  }

  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);