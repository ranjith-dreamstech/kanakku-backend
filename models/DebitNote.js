// models/DebitNote.js
const mongoose = require('mongoose');

const debitNoteSchema = new mongoose.Schema({
  debitNoteId: {
    type: String,
    unique: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  debitNoteDate: {
    type: Date,
    default: Date.now,
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
    },
    reason: {
      type: String,
      required: true
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'cancelled'],
    default: 'draft'
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
  totalAmount: {
    type: Number,
    required: true
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Pre-save hook to generate debit note ID
debitNoteSchema.pre('save', async function (next) {
  if (!this.debitNoteId) {
    try {
      const count = await this.constructor.countDocuments();
      this.debitNoteId = `DN-${String(count + 1).padStart(6, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('DebitNote', debitNoteSchema);