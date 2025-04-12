// /models/ArchivedReport.js

const mongoose = require('mongoose');

const archivedReportSchema = new mongoose.Schema({
  title: String,       // e.g. "Rapport - Supermarché X"
  user: String,        // Which user sent it
  filePath: String,    // Where the PDF is physically saved on disk
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('ArchivedReport', archivedReportSchema);
