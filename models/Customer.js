const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    website: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    billingAddress: {
      name: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
    },
    shippingAddress: {
      name: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
    },
    bankDetails: {
      bankName: String,
      branch: String,
      accountHolderName: String,
      accountNumber: String,
      IFSC: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Virtual for profile image URL
customerSchema.virtual('imageUrl').get(function () {
  if (!this.image) {
    return 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Customer';
  }
  return `http://127.0.0.1:5000/${this.image}`;
});

// Add any pre-save hooks if needed
// customerSchema.pre('save', async function () {
//   // Add any pre-save logic here
// });

module.exports = mongoose.model('Customer', customerSchema);