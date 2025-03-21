// models/Formation.js
const mongoose = require('mongoose');

const FormationSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: 'Supermarket' },
  nombreFormation: { type: Number, default: 1 },
  typeFormation: { type: String, enum: ["Incendie", "SST", "Integration"], required: true },
  dateFormation: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Formation', FormationSchema);
