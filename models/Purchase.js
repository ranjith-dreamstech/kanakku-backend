const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  purchaseId: {
    type: String,
    unique: true
  },
  purchaseOrderId: {
    type: String,
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
  dueDate: {
    type: Date,
    required: true
  },
  referenceNo: {
    type: String,
    default: ""
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    unit: {
      type: String,
      required: false
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
    tax_group_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaxGroup'
    },
    discount_type: {
      type: String,
      enum: ['Fixed', 'Percentage'],
      default: 'Fixed'
    },
    discount_value: {
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
    enum: ['pending', 'completed', 'cancelled', 'partially_paid', 'paid'],
    default: 'pending'
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
  totalTax: {
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
  paidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankDetail',
  },
  notes: String,
  termsAndCondition: String,
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
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  billTo: {
    ref: 'User',
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, {
  timestamps: true
});

// Pre-save hook to generate purchase ID
purchaseSchema.pre('save', async function (next) {
  if (!this.purchaseId) {
    try {
      const count = await this.constructor.countDocuments();
      this.purchaseId = `PUR-${String(count + 1).padStart(6, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Purchase', purchaseSchema);