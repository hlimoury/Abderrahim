// models/EquipementSecurite.js
const mongoose = require('mongoose');

const EquipementSecuriteSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: 'Supermarket' },
  nbExtincteurs: { type: Number, default: 0 },
  nbRIA: { type: Number, default: 0 },
  nbPortesCoupeFeu: { type: Number, default: 0 },
  nbIssueSecours: { type: Number, default: 0 },
  nbSkydomes: { type: Number, default: 0 }
});

module.exports = mongoose.model('EquipementSecurite', EquipementSecuriteSchema);
