const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },  
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },  
  referenceNumber: {
    type: String
  },
  paymentDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  paymentMode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMode'
  },
  amount: {
    type: Number,
    required: true
  },
   paidAmount: {
    type: Number,
    required: true
  },
  dueAmount: {
    type: Number,
    required: true
  },
  notes: String,
  attachment: String,
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true
});

// Pre-save hook to generate payment ID
supplierPaymentSchema.pre('save', async function (next) {
  if (!this.paymentId) {
    try {
      const count = await this.constructor.countDocuments();
      this.paymentId = `PAY-${String(count + 1).padStart(6, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);