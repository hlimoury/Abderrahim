// /models/ArchivedReport.js
const mongoose = require('mongoose');

const archivedReportSchema = new mongoose.Schema({
  title: String,       // e.g. "Rapport - Supermarché X"
  user: String,        // The user who sent the report
  filePath: String,    // The PDF's file path on disk
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('ArchivedReport', archivedReportSchema);
