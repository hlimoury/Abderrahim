// models/Interpellation.js
const mongoose = require('mongoose');

const InterpellationSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: 'Supermarket' },
  typePersonne: { type: String, required: true },
  nombrePersonnes: { type: Number, default: 1 }, // New field: number next to "type de personne"
  poursuitesJudiciaires: { type: Number, default: 0 }, // Now a number (e.g., number of legal actions)
  valeurMarchandiseRecuperee: { type: Number, default: 0 },
  rayonConcerne: { type: String },
  dateInterpellation: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Interpellation', InterpellationSchema);
