// models/AutreIncident.js
const mongoose = require('mongoose');

const AutreIncidentSchema = new mongoose.Schema({
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: 'Supermarket' },
  numeroIncident: { type: Number, default: 1 }, // New field: number of the incident
  typeIncident: { type: String },
  dateIncident: { type: Date, default: Date.now },
  details: { type: String }
});

module.exports = mongoose.model('AutreIncident', AutreIncidentSchema);
