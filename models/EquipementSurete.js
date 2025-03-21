// models/EquipementSurete.js
const mongoose = require('mongoose');

const EquipementSureteSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: 'Supermarket' },
  nbCameras: { type: Number, default: 0 },
  nbNvrDvr: { type: Number, default: 0 },
  nbAds: { type: Number, default: 0 }
});

module.exports = mongoose.model('EquipementSurete', EquipementSureteSchema);
