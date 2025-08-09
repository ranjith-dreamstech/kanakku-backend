// models/Customer.js
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      minlength: [2, 'Customer name must be at least 2 characters'],
      maxlength: [100, 'Customer name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: props => `${props.value} is not a valid email address`
      }
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[\d\s+-]+$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number`
      }
    },
    website: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
        },
        message: props => `${props.value} is not a valid website URL`
      }
    },
    image: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['Active', 'Inactive'],
        message: 'Status must be either Active or Inactive'
      },
      default: 'Active'
    },
    billingAddress: {
      name: {
        type: String,
        trim: true
      },
      addressLine1: {
        type: String,
        trim: true
      },
      addressLine2: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      pincode: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true
      }
    },
    shippingAddress: {
      name: {
        type: String,
        trim: true
      },
      addressLine1: {
        type: String,
        trim: true
      },
      addressLine2: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      pincode: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true
      }
    },
    bankDetails: {
      bankName: {
        type: String,
        trim: true
      },
      branch: {
        type: String,
        trim: true
      },
      accountHolderName: {
        type: String,
        trim: true
      },
      accountNumber: {
        type: String,
        trim: true
      },
      IFSC: {
        type: String,
        trim: true,
        uppercase: true
      }
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for profile image URL
customerSchema.virtual('imageUrl').get(function () {
  if (this.image) {
   return `${process.env.BASE_URL || 'http://127.0.0.1:5000'}/${this.image.replace(/\\/g, '/')}`;
  }
});

module.exports = mongoose.model('Customer', customerSchema);