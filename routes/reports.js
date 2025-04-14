/************************************
 * routes/reports.js
 ************************************/
 
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Supermarket = require('../models/Supermarket');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// IMPORTANT: import your ArchivedReport model (if used)
const ArchivedReport = require('../models/ArchivedReport');

// Serve favicon.ico requests
router.get('/favicon.ico', (req, res) => res.status(204).end());

// Middleware to check if user is logged in
const ensureLoggedIn = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/login');
};

// Middleware for admin
const ensureAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  return res.redirect('/adminlogin');
};

// Ensure persistent storage path for PDFs in /mnt/data
function ensurePersistPath() {
  const persistPath = '/mnt/data';
  if (!fs.existsSync(persistPath)) {
    fs.mkdirSync(persistPath, { recursive: true });
  }
  return persistPath;
}

// Helper to format a date in French (eg. 12 avr. 2025)
function formatFrenchDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getMonthName(monthNum) {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return months[monthNum - 1];
}

// -------------------
// REPORT GENERATION
// -------------------

// GET main reports page (report generator form)
router.get('/', ensureLoggedIn, async (req, res) => {
  try {
    let supermarkets;
    if (req.session.region === 'ALL') {
      supermarkets = await Supermarket.find({});
    } else {
      supermarkets = await Supermarket.find({ ville: req.session.region });
    }
    
    const months = [
      { value: 1, name: 'Janvier' },
      { value: 2, name: 'Février' },
      { value: 3, name: 'Mars' },
      { value: 4, name: 'Avril' },
      { value: 5, name: 'Mai' },
      { value: 6, name: 'Juin' },
      { value: 7, name: 'Juillet' },
      { value: 8, name: 'Août' },
      { value: 9, name: 'Septembre' },
      { value: 10, name: 'Octobre' },
      { value: 11, name: 'Novembre' },
      { value: 12, name: 'Décembre' }
    ];
    
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
    
    // Render reports.ejs and pass also new checkboxes for scoring and DRL (see view below)
    res.render('reports', {
      supermarkets,
      months,
      years,
      currentUser: req.session.user
    });
  } catch (err) {
    console.error('Error loading reports page:', err);
    res.status(500).send('Erreur serveur lors du chargement de la page de rapports');
  }
});

// POST: Generate report
router.post('/generate', ensureLoggedIn, async (req, res) => {
  try {
    const { 
      reportType, 
      supermarketId, 
      month, 
      year, 
      includeFormation, 
      includeAccidents, 
      includeIncidents, 
      includeInterpellations, 
      includeScoring,       // NEW: checkbox name for scoring inclusion 
      includeDRL            // NEW: checkbox name for DRL inclusion
    } = req.body;
    
    let filter = {};
    let dateFilter = {};
    let title = '';
    
    if (req.session.region !== 'ALL') {
      filter.ville = req.session.region;
    }
    
    if (reportType === 'supermarket' && supermarketId) {
      if (!mongoose.Types.ObjectId.isValid(supermarketId))
        return res.status(400).send('ID de Magasin invalide');
      const supermarket = await Supermarket.findById(supermarketId);
      if (!supermarket) return res.status(404).send('Magasin non trouvé');
      if (req.session.region !== 'ALL' && supermarket.ville !== req.session.region)
        return res.status(403).send('Accès non autorisé à ce Magasin');
      filter = { _id: supermarketId };
      title = `Rapport - ${supermarket.nom}`;
    } else if (reportType === 'month' && month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      dateFilter = { $gte: startDate, $lte: endDate };
      title = `Rapport Mensuel - ${getMonthName(month)} ${year}`;
    } else {
      title = 'Rapport Général';
    }
    
    const supermarkets = await Supermarket.find(filter).populate('instances');
    if (!supermarkets || supermarkets.length === 0)
      return res.status(404).send('Aucun Magasin trouvé avec ces critères');
    
    // Use ISO string date so later the formatter works reliably
    let reportData = {
      title,
      date: new Date().toISOString(),
      sections: []
    };
    
    // Only include sections if their checkbox is "on"
    if (includeFormation === 'on') {
      reportData.sections.push(await generateFormationSection(supermarkets, dateFilter));
    }
    if (includeAccidents === 'on') {
      reportData.sections.push(await generateAccidentsSection(supermarkets, dateFilter));
    }
    if (includeIncidents === 'on') {
      reportData.sections.push(await generateIncidentsSection(supermarkets, dateFilter));
    }
    if (includeInterpellations === 'on') {
      reportData.sections.push(await generateInterpellationsSection(supermarkets, dateFilter));
    }
    if (includeScoring === 'on') {
      reportData.sections.push(await generateScoringSection(supermarkets, dateFilter));
    }
    if (includeDRL === 'on') {
      reportData.sections.push(await generateDRLSection(supermarkets, dateFilter));
    }
    
    req.session.reportData = reportData;
    res.render('reportView', {
      reportData,
      formatDate: formatFrenchDate
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).send('Erreur lors de la génération du rapport');
  }
});

// GET: View current report
router.get('/view', ensureLoggedIn, (req, res) => {
  const reportData = req.session.reportData;
  if (!reportData) return res.redirect('/reports');
  res.render('reportView', {
    reportData,
    formatDate: formatFrenchDate
  });
});

// GET: Modify report (edit view)
router.get('/modifier', ensureLoggedIn, (req, res) => {
  const reportData = req.session.reportData;
  if (!reportData) return res.redirect('/reports');
  const success = req.session.success;
  const error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  res.render('modifierRapport', {
    reportData,
    success,
    error,
    formatDate: formatFrenchDate
  });
});

// POST: Save modifications to report
router.post('/save', ensureLoggedIn, (req, res) => {
  try {
    const { editedReport } = req.body;
    if (!editedReport) {
      req.session.error = 'Données du rapport manquantes';
      return res.redirect('/reports/modifier');
    }
    let updatedData;
    try {
      updatedData = JSON.parse(editedReport);
      if (!updatedData.date && req.session.reportData && req.session.reportData.date) {
        updatedData.date = req.session.reportData.date;
      }
      updatedData.sections?.forEach(section => {
        if (section.summary) {
          Object.entries(section.summary).forEach(([key, value]) => {
            if (typeof value !== 'number' || isNaN(value)) {
              throw new Error(`Valeur numérique invalide pour ${key}`);
            }
          });
        }
      });
    } catch (err) {
      req.session.error = err.message;
      return res.redirect('/reports/modifier');
    }
    req.session.reportData = updatedData;
    req.session.success = 'Rapport sauvegardé avec succès';
    res.redirect('/reports/view');
  } catch (err) {
    console.error('Error saving report:', err);
    req.session.error = 'Erreur lors de la mise à jour du rapport';
    res.redirect('/reports/modifier');
  }
});

// POST: Email report
router.post('/email', ensureLoggedIn, async (req, res) => {
  try {
    const { email, subject } = req.body;
    if (!email) return res.status(400).send('Adresse email requise');
    const reportData = req.session.reportData;
    if (!reportData) return res.status(400).send('Aucun rapport à envoyer');
    
    const pdfPath = await generatePDF(reportData);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'user@example.com',
        pass: process.env.SMTP_PASS || 'password'
      }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Système de Rapport" <rapports@example.com>',
      to: email,
      subject: subject || `${reportData.title} - ${formatFrenchDate(reportData.date)}`,
      text: `Veuillez trouver ci-joint le rapport "${reportData.title}" généré le ${formatFrenchDate(reportData.date)}.`,
      attachments: [
        {
          filename: path.basename(pdfPath),
          path: pdfPath
        }
      ]
    });

    // Optionally delete the PDF if no longer needed:
    // fs.unlinkSync(pdfPath);

    res.status(200).send('Rapport envoyé avec succès');
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).send('Erreur lors de l\'envoi du rapport');
  }
});

// GET: Download PDF
router.get('/download', ensureLoggedIn, async (req, res) => {
  try {
    const reportData = req.session.reportData;
    if (!reportData) return res.status(400).send('Aucun rapport à télécharger');
    const pdfPath = await generatePDF(reportData);
    const safeFileName = reportData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    // Optionally delete the file after download:
    // fileStream.on('end', () => fs.unlinkSync(pdfPath));
  } catch (err) {
    console.error('Error downloading PDF:', err);
    res.status(500).send('Erreur lors de la génération du PDF');
  }
});

// NEW: Send report to admin (archive the PDF)
router.get('/sendToAdmin', ensureLoggedIn, async (req, res) => {
  try {
    const reportData = req.session.reportData;
    if (!reportData) return res.status(400).send('Aucun rapport en session pour envoyer à l\'admin');
    const pdfPath = await generatePDF(reportData);
    const archived = new ArchivedReport({
      title: reportData.title,
      user: req.session.user,
      filePath: pdfPath
    });
    await archived.save();
    req.session.success = 'Rapport envoyé à l\'admin avec succès!';
    res.redirect('/reports/view');
  } catch (err) {
    console.error('Error sending to admin:', err);
    res.status(500).send('Erreur lors de l\'envoi du rapport à l\'admin');
  }
});

// NEW: Admin archive view
router.get('/adminArchive', ensureAdmin, async (req, res) => {
  try {
    const archivedReports = await ArchivedReport.find({}).sort({ createdAt: -1 });
    res.render('archivedReports', { archivedReports });
  } catch (err) {
    console.error('Error fetching archived reports:', err);
    res.status(500).send('Erreur serveur');
  }
});

/* ------------------------------------------------------------------
   HELPER FUNCTION: generatePDF
   ------------------------------------------------------------------ */
   async function generatePDF(reportData) {
    return new Promise((resolve, reject) => {
      try {
        const persistPath = ensurePersistPath();
        const fileName = `rapport-${Date.now()}.pdf`;
        const pdfPath = path.join(persistPath, fileName);
        const doc = new PDFDocument({ 
          margin: 50,
          size: 'A4',
          info: {
            Title: reportData.title,
            Author: 'Système de Rapports',
            Subject: `Rapport généré le ${formatFrenchDate(reportData.date)}`
          }
        });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);
        const primaryColor = '#0d6efd';
        const secondaryColor = '#6c757d';
        const borderColor = '#dee2e6';
  
        function addPageHeader() {
          doc.fontSize(18)
             .fillColor(primaryColor)
             .text(reportData.title, 50, 50);
          doc.fontSize(10)
             .fillColor(secondaryColor)
             .text(`Généré le: ${formatFrenchDate(reportData.date)}`, 50, 75);
          doc.moveTo(50, 110)
             .lineTo(doc.page.width - 50, 110)
             .stroke(borderColor);
          doc.y = 130;
        }
  
        function checkPageBreak(extraHeight) {
          const bottomMargin = 50;
          if (doc.y + extraHeight > doc.page.height - bottomMargin) {
            doc.addPage();
            addPageHeader();
          }
        }
  
        addPageHeader();
  
        // Loop through each section – only render the section header and its summary.
        reportData.sections.forEach((section, idx) => {
          if (idx > 0) doc.moveDown();
          doc.fontSize(16)
             .fillColor(primaryColor)
             .text(section.title.toUpperCase(), { underline: true });
          doc.moveDown();
          if (section.summary) {
            // Check if summary is an array, e.g. for scoring.
            if (Array.isArray(section.summary)) {
              const headers = Object.keys(section.summary[0]);
              const rowH = 25;
              checkPageBreak(rowH * (section.summary.length + 1));
              const startX = 50;
              const totalWidth = doc.page.width - 100;
              const colW = totalWidth / headers.length;
              let topY = doc.y;
              // Draw header row
              doc.rect(startX, topY, totalWidth, rowH).fill(primaryColor);
              doc.fillColor('#fff').fontSize(12);
              headers.forEach((header, i) => {
                doc.text(header, startX + i * colW + 5, topY + 7, { width: colW - 10 });
              });
              topY += rowH;
              // Draw summary rows
              section.summary.forEach((row, i) => {
                checkPageBreak(rowH);
                doc.rect(startX, topY, totalWidth, rowH)
                   .fillAndStroke(i % 2 === 0 ? '#f9f9f9' : '#fff', borderColor);
                doc.fillColor('#000').fontSize(10);
                const values = Object.values(row);
                values.forEach((val, j) => {
                  doc.text(val, startX + j * colW + 5, topY + 7, { width: colW - 10 });
                });
                topY += rowH;
              });
              doc.y = topY + 10;
            } else {
              // Otherwise, assume summary is an object
              const summaryRows = Object.entries(section.summary)
                                       .filter(([key]) => !['id', '_id', 'Description'].includes(key));
              const rowH = 25;
              checkPageBreak(rowH * (summaryRows.length + 1));
              const startX = 50;
              const totalWidth = doc.page.width - 100;
              const colW = totalWidth / 2;
              let topY = doc.y;
              doc.rect(startX, topY, totalWidth, rowH).fill(primaryColor);
              doc.fillColor('#fff').fontSize(12);
              doc.text('Indicateur', startX + 10, topY + 7);
              doc.text('Valeur', startX + colW + 10, topY + 7);
              topY += rowH;
              summaryRows.forEach(([key, val], i) => {
                checkPageBreak(rowH);
                doc.rect(startX, topY, totalWidth, rowH)
                   .fillAndStroke(i % 2 === 0 ? '#f9f9f9' : '#fff', borderColor);
                doc.fillColor('#000').fontSize(10);
                doc.text(key, startX + 10, topY + 7, { width: colW - 20 });
                doc.text(String(val), startX + colW + 10, topY + 7, { width: colW - 20 });
                topY += rowH;
              });
              doc.y = topY + 10;
            }
          }
          // Notice that the details block is completely removed
        });
  
        // Add page numbers
        const pageRange = doc.bufferedPageRange();
        for (let i = 0; i < pageRange.count; i++) {
          doc.switchToPage(pageRange.start + i);
          doc.fontSize(8)
             .fillColor(secondaryColor)
             .text(`Page ${i + 1} / ${pageRange.count}`, 50, doc.page.height - 50, {
               align: 'center',
               width: doc.page.width - 100
             });
        }
  
        doc.end();
        stream.on('finish', () => resolve(pdfPath));
        stream.on('error', err => reject(err));
      } catch (error) {
        reject(error);
      }
    });
  }
  

/* ------------------------------------------------------------------
   NEW SECTION GENERATORS
   ------------------------------------------------------------------ */

// Generate Scoring Section (Niveau de Sécurité Global)
async function generateScoringSection(supermarkets, dateFilter) {
  let scoringCategories = ['securiteIncendie', 'sst', 'surete'];
  // We'll keep separate arrays to accumulate percentages per category
  let categoryData = {};
  // Also accumulate global values
  let globalPercentages = [];
  let details = [];

  // If filtering by month, extract month and year from dateFilter.$gte
  let filterMonth, filterYear;
  if (dateFilter && dateFilter.$gte) {
    const dt = new Date(dateFilter.$gte);
    filterMonth = dt.getMonth() + 1; // 0-based
    filterYear = dt.getFullYear();
  }

  // Initialize each category accumulator
  scoringCategories.forEach(cat => {
    categoryData[cat] = { percentages: [], objectifs: [] };
  });

  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      // If filtering by month/year, skip if instance doesn't match.
      if (filterMonth && filterYear) {
        if (instance.mois !== filterMonth || instance.annee !== filterYear) return;
      }
      if (!instance.scoring) return;
      scoringCategories.forEach(category => {
        if (!instance.scoring[category] || instance.scoring[category].length === 0) return;
        instance.scoring[category].forEach(item => {
          // Only compute percentage if objectif > 0
          const objectif = Number(item.objectif);
          if (objectif > 0) {
            const niveau = Number(item.niveau);
            let percent = (niveau / objectif) * 100;
            // Cap percentage to maximum of 100%
            percent = Math.min(percent, 100);
            categoryData[category].percentages.push(percent);
            categoryData[category].objectifs.push(objectif);
            globalPercentages.push(percent);
            details.push({
              "Magasin": market.nom,
              "Thème": 
                  category === 'securiteIncendie' ? 'Sécurité Incendie'
                : category === 'sst' ? 'Sécurité et Santé au Travail'
                : 'Sûreté',
              "Nom": item.nom,
              "Niveau (%)": percent.toFixed(2) + '%'
            });
          }
        });
      });
    });
  });

  // Build summary rows for each scoring category
  let summaryRows = [];
  scoringCategories.forEach(category => {
    let label;
    if (category === 'securiteIncendie') label = 'Sécurité Incendie';
    else if (category === 'sst') label = 'Sécurité et Santé au Travail';
    else if (category === 'surete') label = 'Sûreté';
    const percents = categoryData[category].percentages;
    const objectifs = categoryData[category].objectifs;
    if (percents.length > 0) {
      const avgNiveau = percents.reduce((sum, p) => sum + p, 0) / percents.length;
      const avgObj = objectifs.reduce((sum, o) => sum + o, 0) / objectifs.length;
      const diff = avgNiveau - avgObj;
      summaryRows.push({
        "Thème": label,
        "Niveau (%)": avgNiveau.toFixed(2) + '%',
        "Objectifs (%)": avgObj.toFixed(2) + '%',
        "Écart (%)": diff.toFixed(2) + '%'
      });
    } else {
      summaryRows.push({
        "Thème": label,
        "Niveau (%)": 'N/A',
        "Objectifs (%)": 'N/A',
        "Écart (%)": 'N/A'
      });
    }
  });

  // Global row computed from all percentages
  let globalRow = {
    "Thème": "Niveau de Sécurité Global",
    "Niveau (%)": 'N/A',
    "Objectifs (%)": 'N/A',
    "Écart (%)": 'N/A'
  };
  if (globalPercentages.length > 0) {
    const globalAvg = globalPercentages.reduce((sum, p) => sum + p, 0) / globalPercentages.length;
    // For global objectives, we can compute the average of each category's average objective, if desired.
    let globalObjTotal = 0, globalCount = 0;
    scoringCategories.forEach(category => {
      const objectifs = categoryData[category].objectifs;
      if (objectifs.length > 0) {
        const avgObj = objectifs.reduce((sum, o) => sum + o, 0) / objectifs.length;
        globalObjTotal += avgObj;
        globalCount++;
      }
    });
    const globalAvgObj = globalCount ? (globalObjTotal / globalCount) : 0;
    globalRow["Niveau (%)"] = globalAvg.toFixed(2) + '%';
    globalRow["Objectifs (%)"] = globalAvgObj.toFixed(2) + '%';
    globalRow["Écart (%)"] = (globalAvg - globalAvgObj).toFixed(2) + '%';
  }
  summaryRows.push(globalRow);

  return {
    title: 'Scoring - Niveau de Sécurité Global',
    summary: summaryRows,
    details: details
  };
}



// Generate DRL Section
async function generateDRLSection(supermarkets, dateFilter) {
  let totalValeur = 0;
  let details = [];
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (!instance.drl) return;
      instance.drl.forEach(drlItem => {
        const valeur = parseFloat(drlItem.valeur) || 0;
        totalValeur += valeur;
        details.push({
          "Magasin": market.nom,
          Valeur: drlItem.valeur,
          Statut: drlItem.statut,
          Date: drlItem.date ? new Date(drlItem.date).toLocaleDateString('fr-FR') : 'N/A'
        });
      });
    });
  });
  
  return {
    title: 'DRL',
    summary: {
      'Total Valeur': totalValeur.toFixed(2)
    },
    details
  };
}

/* ------------------------------------------------------------------
   EXISTING SECTION GENERATORS (Formation, Accidents, Incidents, Interpellations)
   ------------------------------------------------------------------ */
   async function generateFormationSection(supermarkets, dateFilter) {
    let totalPersonnes = 0;
    let formationByType = { 'Incendie': 0, 'SST': 0, 'Intégration': 0 };
    let details = [];
  
    // If dateFilter exists, extract the month and year from the $gte value.
    let filterMonth, filterYear;
    if (dateFilter && dateFilter.$gte) {
      const dt = new Date(dateFilter.$gte);
      filterMonth = dt.getMonth() + 1;  // getMonth returns 0-based month.
      filterYear = dt.getFullYear();
    }
    
    supermarkets.forEach(market => {
      if (!market.instances) return;
      market.instances.forEach(instance => {
        // If filtering by month is active, skip the instance if its month/year do not match.
        if (filterMonth && filterYear) {
          if (instance.mois !== filterMonth || instance.annee !== filterYear) {
            return; // skip this instance entirely
          }
        }
        if (!instance.formation) return;
        instance.formation.forEach(f => {
          const count = parseInt(f.nombrePersonnes) || 0;
          totalPersonnes += count;
          if (formationByType[f.type] !== undefined) {
            formationByType[f.type] += count;
          }
          details.push({
            "Magasin": market.nom,
            Type: f.type,
            NPr: f.nombrePersonnes
          });
        });
      });
    });
    
    return {
      title: 'Formations',
      summary: {
        'Total des personnes formées': totalPersonnes,
        'Incendie': formationByType['Incendie'],
        'SST': formationByType['SST'],
        'Intégration': formationByType['Intégration']
      },
      details
    };
  }
  

async function generateAccidentsSection(supermarkets, dateFilter) {
  let totalAccidents = 0;
  let totalJours = 0;
  let details = [];
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (!instance.accidents) return;
      instance.accidents.forEach(a => {
        const accidentDate = a.date ? new Date(a.date) : null;
        if (accidentDate && dateFilter.$gte && accidentDate < dateFilter.$gte) return;
        if (accidentDate && dateFilter.$lte && accidentDate > dateFilter.$lte) return;
        const accidents = parseInt(a.nombreAccidents) || 0;
        const jours = parseInt(a.joursArret) || 0;
        totalAccidents += accidents;
        totalJours += jours;
        details.push({
          id: a._id,
          "Magasin": market.nom,
          Date: accidentDate ? accidentDate.toLocaleDateString('fr-FR') : 'N/A',
          NAt: a.nombreAccidents,
          "Jours d'arrêt": a.joursArret
        });
      });
    });
  });
  return {
    title: 'Accidents',
    summary: {
      'Total des accidents': totalAccidents,
      "Total des jours d'arrêt": totalJours
    },
    details
  };
}

async function generateIncidentsSection(supermarkets, dateFilter) {
  let totalIncidents = 0;
  let incidentsByType = {};
  let details = [];
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (!instance.incidents) return;
      instance.incidents.forEach(i => {
        const incidentDate = i.date ? new Date(i.date) : null;
        if (incidentDate && dateFilter.$gte && incidentDate < dateFilter.$gte) return;
        if (incidentDate && dateFilter.$lte && incidentDate > dateFilter.$lte) return;
        const count = parseInt(i.nombreIncidents) || 0;
        totalIncidents += count;
        incidentsByType[i.typeIncident] = (incidentsByType[i.typeIncident] || 0) + count;
        details.push({
          id: i._id,
          "Magasin": market.nom,
          Date: incidentDate ? incidentDate.toLocaleDateString('fr-FR') : 'N/A',
          Type: i.typeIncident,
          "Nombre d'incidents": i.nombreIncidents
        });
      });
    });
  });
  return {
    title: 'Incidents',
    summary: {
      'Total des incidents': totalIncidents,
      ...incidentsByType
    },
    details
  };
}

async function generateInterpellationsSection(supermarkets, dateFilter) {
  let totalPersonnes = 0;
  let totalPoursuites = 0;
  let totalValeur = 0;
  let interByType = {
    'Client': { personnes: 0, poursuites: 0, valeur: 0 },
    'Personnel': { personnes: 0, poursuites: 0, valeur: 0 },
    'Prestataire': { personnes: 0, poursuites: 0, valeur: 0 }
  };
  let details = [];
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (!instance.interpellations) return;
      instance.interpellations.forEach(inter => {
        const interDate = inter.date ? new Date(inter.date) : null;
        if (interDate && dateFilter.$gte && interDate < dateFilter.$gte) return;
        if (interDate && dateFilter.$lte && interDate > dateFilter.$lte) return;
        const personnes = parseInt(inter.nombrePersonnes) || 0;
        const poursuites = parseInt(inter.poursuites) || 0;
        const valeur = parseFloat(inter.valeurMarchandise) || 0;
        totalPersonnes += personnes;
        totalPoursuites += poursuites;
        totalValeur += valeur;
        if (interByType[inter.typePersonne]) {
          interByType[inter.typePersonne].personnes += personnes;
          interByType[inter.typePersonne].poursuites += poursuites;
          interByType[inter.typePersonne].valeur += valeur;
        }
        details.push({
          id: inter._id,
          "Magasin": market.nom,
          Date: interDate ? interDate.toLocaleDateString('fr-FR') : 'N/A',
          TP: inter.typePersonne,
          NPr: inter.nombrePersonnes,
          Poursuites: inter.poursuites,
          "Valeur(kDH)": valeur.toFixed(3)
        });
      });
    });
  });
  return {
    title: 'Interpellations',
    summary: {
      'Total des personnes': totalPersonnes,
      'Total des poursuites': totalPoursuites,
      'Valeur totale (kDH)': totalValeur.toFixed(3),
      'Client - Personnes': interByType['Client'].personnes,
      'Client - Poursuites': interByType['Client'].poursuites,
      'Client - Valeur (kDH)': interByType['Client'].valeur.toFixed(3),
      'Personnel - Personnes': interByType['Personnel'].personnes,
      'Personnel - Poursuites': interByType['Personnel'].poursuites,
      'Personnel - Valeur (kDH)': interByType['Personnel'].valeur.toFixed(3),
      'Prestataire - Personnes': interByType['Prestataire'].personnes,
      'Prestataire - Poursuites': interByType['Prestataire'].poursuites,
      'Prestataire - Valeur (kDH)': interByType['Prestataire'].valeur.toFixed(3)
    },
    details
  };
}

module.exports = router;
