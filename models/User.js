const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    dateOfBirth: {
      type: Date,
    },
    password: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String,
    },
    address: {
      type: String,
    },
    country: {
      type: mongoose.Schema.Types.Int32,
      ref: 'Country',
    },
    state: {
      type: mongoose.Schema.Types.Int32,
      ref: 'State',
    },
    city: {
      type: mongoose.Schema.Types.Int32,
      ref: 'City',
    },
    postalCode: {
      type: String,
    },
    user_type: {
      type: Number,
      required: true,
      default: 1, // 1 for regular user, 2 for supplier
    },
    balance: {
      type: Number,
      default: 0
    },
    balance_type: {
      type: String,
      enum: ['credit', 'debit']
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

// hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.virtual('profileImageUrl').get(function () {
  if (!this.profileImage) {
    return 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile';
  }
  return `http://127.0.0.1:5000/${this.profileImage}`;
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);