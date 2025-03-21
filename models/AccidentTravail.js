// models/AccidentTravail.js
const mongoose = require('mongoose');

const AccidentTravailSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: 'Supermarket' },
  numeroAccident: { type: Number, default: 1 }, // New field: number of the accident
  estDeclare: { type: Boolean, default: false },
  nombreJoursArret: { type: Number, default: 0 },
  cause: { type: String },
  dateAccident: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AccidentTravail', AccidentTravailSchema);
