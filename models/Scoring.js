// models/Scoring.js
const mongoose = require('mongoose');

const ScoringSchema = new mongoose.Schema({
  supermarketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supermarket',
    required: true
  },
  sectionType: {
    type: String,
    enum: ['incendie', 'sst', 'surete'], // 3 main categories
    required: true
  },
  indicatorName: { 
    type: String, 
    required: true 
  },
  niveau: { 
    type: Number, 
    default: 0 
  },   // "Niveau de sécurité du site"
  objectif: { 
    type: Number, 
    default: 0 
  }  // "Objectif"
}, { timestamps: true });

module.exports = mongoose.model('Scoring', ScoringSchema);
