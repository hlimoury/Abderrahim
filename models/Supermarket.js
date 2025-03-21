// models/Supermarket.js
const mongoose = require('mongoose');

const SupermarketSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  city: String,
  postalCode: String,
  phone: String
});

module.exports = mongoose.model('Supermarket', SupermarketSchema);
