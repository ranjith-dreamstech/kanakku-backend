const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    category_name: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      trim: true
    },
    category_image: {
      type: String,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true } 
  }
);

categorySchema.virtual('categoryImageUrl').get(function () {
  if (this.category_image) {
    return `${process.env.BASE_URL}/uploads/${this.category_image}`;
  }
  return "https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile";
});
module.exports = mongoose.model('Category', categorySchema);
