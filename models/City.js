const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  id: Number,
  name: String,
  state_id: Number,
  country_id: Number,
});

module.exports = mongoose.model('City', citySchema);
