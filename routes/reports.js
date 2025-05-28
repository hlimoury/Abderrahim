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
      moisDebut, 
      moisFin, 
      annee, 
      includeFormation, 
      includeAccidents, 
      includeIncidents, 
      includeInterpellations,
      includeScoring,
      includeDRL
    } = req.body;
    
    // 1) Filtrage par région
    let filter = {};
    if (req.session.region !== 'ALL') {
      filter.ville = req.session.region;
    }

    // 2) Construction du filtre de date et du libellé de période
    let dateFilter = {};
    let periodLabel = '';
    if (moisDebut && moisFin && annee) {
      const start = parseInt(moisDebut, 10);
      const end   = parseInt(moisFin,   10);
      // on remplit dateFilter pour les sections
      dateFilter = { start, end, year: parseInt(annee, 10) };
      if (start === end) {
        // même mois
        periodLabel = `${getMonthName(start)} ${annee}`;
      } else {
        // période multi-mois
        periodLabel = `De ${getMonthName(start)} à ${getMonthName(end)} ${annee}`;
      }
    }

    // 3) Détermination du titre
    let title = '';
    if (reportType === 'supermarket') {
      // Vérifier et charger le supermarché
      if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
        return res.status(400).send('ID de Magasin invalide');
      }
      const supermarket = await Supermarket.findById(supermarketId);
      if (!supermarket) return res.status(404).send('Magasin non trouvé');
      if (req.session.region !== 'ALL' && supermarket.ville !== req.session.region) {
        return res.status(403).send('Accès non autorisé à ce Magasin');
      }
      filter = { _id: supermarketId };
      title = `Rapport - ${supermarket.nom}` + (periodLabel ? ` | Période: ${periodLabel}` : '');
    }
    else if (reportType === 'month' && periodLabel) {
      title = `Rapport Mensuel - ${periodLabel}`;
    }
    else {
      title = 'Rapport Général';
    }

    // 4) Chargement des supermarchés/instances
    const supermarkets = await Supermarket.find(filter).populate('instances');
    if (!supermarkets.length) {
      return res.status(404).send('Aucun Magasin trouvé avec ces critères');
    }

    // 5) Assemblage du rapport
    let reportData = {
      title,
      date: new Date().toISOString(),
      sections: []
    };

    if (includeFormation       === 'on') reportData.sections.push(await generateFormationSection(supermarkets, dateFilter));
    if (includeAccidents       === 'on') reportData.sections.push(await generateAccidentsSection   (supermarkets, dateFilter));
    if (includeIncidents       === 'on') reportData.sections.push(await generateIncidentsSection    (supermarkets, dateFilter));
    if (includeInterpellations === 'on') reportData.sections.push(await generateInterpellationsSection(supermarkets, dateFilter));
    if (includeScoring         === 'on') reportData.sections.push(await generateScoringSection      (supermarkets, dateFilter));
    if (includeDRL             === 'on') reportData.sections.push(await generateDRLSection          (supermarkets, dateFilter));

    // 6) Rendu
    req.session.reportData = reportData;
    res.render('reportView', {
         reportData,
         success: null,
         error  : null,
         formatDate: formatFrenchDate
       });

  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).send('Erreur lors de la génération du rapport');
  }
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





// VIEW the last generated report
   /* ------------------------------------------------------------------
   VIEW: affiche le dernier rapport + messages flash
------------------------------------------------------------------ */
router.get('/view', ensureLoggedIn, (req, res) => {
  const reportData = req.session.reportData;
  if (!reportData) return res.redirect('/reports');

  // on récupère puis on efface les messages
  const success = req.session.success;
  const error   = req.session.error;
  delete req.session.success;
  delete req.session.error;

  res.render('reportView', {
    reportData,
    success,             // <-- on transmet
    error,
    formatDate: formatFrenchDate
  });
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
      region: req.session.region,
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
    const archivedReports = await ArchivedReport
    .find({})
    .sort({ region: 1, createdAt: -1 });    // ← first by region, then newest first
  res.render('adminArchivedReports', { archivedReports });
  } catch (err) {
    console.error('Error fetching archived reports:', err);
    res.status(500).send('Erreur serveur');
  }
});

/* -----------------------------------------------------------
   API : /reports/api/supermarket/:id/stats
   ↳ renvoie les 5 derniers rapports archivés pour le magasin
----------------------------------------------------------- */
router.get('/api/supermarket/:id/stats', ensureLoggedIn, async (req, res) => {
  try {
    const market = await Supermarket.findById(req.params.id);
    if (!market) return res.status(404).json({ error: 'Magasin introuvable' });

    // Tous les rapports correspondant au magasin, triés du plus récent
    const regex = new RegExp(market.nom, 'i');
    const all   = await ArchivedReport.find({ title: { $regex: regex } })
                                      .sort({ createdAt: -1 });

    /* ---- on ne renvoie que les 5 plus récents ---- */
    const lastFive = all.slice(0, 5).map(d => ({
      id    : d._id,
      titre : d.title,
      date  : d.createdAt,
      region: d.region
    }));

    res.json({ count: all.length, reports: lastFive });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* ------------------------------------------------------------------
   HELPER FUNCTION: generatePDF - Fixed Version with Better Page Breaks
   ------------------------------------------------------------------ */
   async function generatePDF(reportData) {
    return new Promise((resolve, reject) => {
      try {
        const persistPath = ensurePersistPath();
        const fileName = `rapport-${Date.now()}.pdf`;
        const pdfPath = path.join(persistPath, fileName);
        
        const doc = new PDFDocument({ 
          margin: 40,
          size: 'A4',
          info: {
            Title: reportData.title,
            Author: 'Système de Rapports',
            Subject: `Rapport généré le ${formatFrenchDate(reportData.date)}`
          }
        });
        
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);
  
        // Enhanced color scheme
        const colors = {
          primary: '#2c3e50',
          secondary: '#34495e', 
          accent: '#3498db',
          success: '#27ae60',
          background: '#ecf0f1',
          lightGray: '#f8f9fa',
          mediumGray: '#e9ecef',
          darkGray: '#6c757d',
          border: '#dee2e6',
          white: '#ffffff'
        };
  
        function addPageHeader() {
          // Header background
          doc.rect(0, 0, doc.page.width, 120)
             .fill(colors.primary);
  
          // Title
          doc.fontSize(22)
             .fillColor(colors.white)
             .font('Helvetica-Bold')
             .text(reportData.title, 50, 35, { align: 'center' });
  
          // Subtitle with date
          doc.fontSize(12)
             .fillColor(colors.background)
             .font('Helvetica')
             .text(`Rapport généré le: ${formatFrenchDate(reportData.date)}`, 50, 65, { align: 'center' });
  
          // Decorative line
          doc.rect(50, 90, doc.page.width - 100, 3)
             .fill(colors.accent);
  
          doc.y = 140;
        }
  
        function checkPageBreak(extraHeight) {
          const bottomMargin = 80;
          if (doc.y + extraHeight > doc.page.height - bottomMargin) {
            doc.addPage();
            addPageHeader();
            return true;
          }
          return false;
        }
  
        // New function to calculate table height
        function calculateTableHeight(data, isArrayData = false) {
          if (!data || (Array.isArray(data) && data.length === 0)) return 0;
          
          const rowHeight = 35;
          let totalHeight = rowHeight; // Header row
          
          if (isArrayData) {
            totalHeight += data.length * rowHeight;
            // Add separator space (every 3 rows)
            const separators = Math.floor((data.length - 1) / 3);
            totalHeight += separators * 8;
          } else {
            const entries = Object.entries(data)
                                .filter(([key]) => !['id', '_id', 'Description'].includes(key));
            totalHeight += entries.length * rowHeight;
            // Add separator space (every 3 rows)
            const separators = Math.floor((entries.length - 1) / 3);
            totalHeight += separators * 10;
          }
          
          return totalHeight + 20; // Extra spacing
        }
  
        // New function to check if section fits on current page
        function checkSectionFit(data, isArrayData = false) {
          const sectionHeaderHeight = 60;
          const tableHeight = calculateTableHeight(data, isArrayData);
          const totalHeight = sectionHeaderHeight + tableHeight;
          
          return checkPageBreak(totalHeight);
        }
  
        function drawSectionHeader(title) {
          // Section background
          doc.rect(30, doc.y - 5, doc.page.width - 60, 45)
             .fill(colors.background);
  
          // Section border
          doc.rect(30, doc.y - 5, doc.page.width - 60, 45)
             .stroke(colors.border);
  
          // Section title
          doc.fontSize(16)
             .fillColor(colors.primary)
             .font('Helvetica-Bold')
             .text(title.toUpperCase(), 50, doc.y + 10);
  
          doc.y += 55;
        }
  
        function drawTable(data, isArrayData = false) {
          if (!data || (Array.isArray(data) && data.length === 0)) return;
  
          const startX = 50;
          const tableWidth = doc.page.width - 100;
          const rowHeight = 35;
          
          // Move currentY declaration outside conditional blocks
          let currentY = doc.y;
          
          if (isArrayData) {
            // Handle array data (like scoring tables)
            const headers = Object.keys(data[0]);
            const colWidth = tableWidth / headers.length;
  
            // Draw table header
            doc.rect(startX, currentY, tableWidth, rowHeight)
               .fill(colors.secondary);
            
            doc.rect(startX, currentY, tableWidth, rowHeight)
               .stroke(colors.border);
  
            doc.fillColor(colors.white)
               .fontSize(12)
               .font('Helvetica-Bold');
  
            headers.forEach((header, i) => {
              // Replace "Valeur" with "Nmbr"
              const displayHeader = header.toLowerCase().includes('valeur') ? 'Nmbr' : header;
              doc.text(displayHeader, startX + (i * colWidth) + 10, currentY + 12, {
                width: colWidth - 20,
                align: 'left'
              });
            });
  
            currentY += rowHeight;
  
            // Draw data rows with grouping
            data.forEach((row, index) => {
              // Add separator every 3 rows
              if (index > 0 && index % 3 === 0) {
                doc.rect(startX, currentY, tableWidth, 2)
                   .fill(colors.accent);
                currentY += 8;
              }
  
              // Alternate row colors
              const bgColor = index % 2 === 0 ? colors.white : colors.lightGray;
              doc.rect(startX, currentY, tableWidth, rowHeight)
                 .fill(bgColor);
  
              doc.rect(startX, currentY, tableWidth, rowHeight)
                 .stroke(colors.border);
  
              doc.fillColor(colors.primary)
                 .fontSize(10)
                 .font('Helvetica');
  
              const values = Object.values(row);
              values.forEach((value, i) => {
                doc.text(String(value), startX + (i * colWidth) + 10, currentY + 12, {
                  width: colWidth - 20,
                  align: 'left'
                });
              });
  
              currentY += rowHeight;
            });
  
          } else {
            // Handle object data (key-value pairs)
            const entries = Object.entries(data)
                                .filter(([key]) => !['id', '_id', 'Description'].includes(key));
            
            const colWidth = tableWidth / 2;
  
            // Draw table header
            doc.rect(startX, currentY, tableWidth, rowHeight)
               .fill(colors.secondary);
            
            doc.rect(startX, currentY, tableWidth, rowHeight)
               .stroke(colors.border);
  
            doc.fillColor(colors.white)
               .fontSize(12)
               .font('Helvetica-Bold');
  
            doc.text('Indicateur', startX + 10, currentY + 12, { width: colWidth - 20 });
            doc.text('Nmbr', startX + colWidth + 10, currentY + 12, { width: colWidth - 20 });
  
            currentY += rowHeight;
  
            // Draw data rows with enhanced grouping
            entries.forEach(([key, value], index) => {
              // Add visual separator every 3 rows
              if (index > 0 && index % 3 === 0) {
                doc.rect(startX, currentY, tableWidth, 3)
                   .fill(colors.accent);
                currentY += 10;
              }
  
              // Enhanced row styling
              const bgColor = index % 2 === 0 ? colors.white : colors.lightGray;
              doc.rect(startX, currentY, tableWidth, rowHeight)
                 .fill(bgColor);
  
              // Add subtle left border for visual appeal
              doc.rect(startX, currentY, 4, rowHeight)
                 .fill(colors.accent);
  
              doc.rect(startX, currentY, tableWidth, rowHeight)
                 .stroke(colors.border);
  
              // Text styling
              doc.fillColor(colors.primary)
                 .fontSize(11)
                 .font('Helvetica');
  
              doc.text(key, startX + 15, currentY + 12, { 
                width: colWidth - 25,
                align: 'left'
              });
  
              doc.fillColor(colors.secondary)
                 .font('Helvetica-Bold')
                 .text(String(value), startX + colWidth + 10, currentY + 12, { 
                   width: colWidth - 20,
                   align: 'right'
                 });
  
              currentY += rowHeight;
            });
          }
  
          // Update doc.y to the final position
          doc.y = currentY + 20;
        }
  
        // Start document
        addPageHeader();
  
        // Process sections with improved page break logic
        reportData.sections.forEach((section, sectionIndex) => {
          if (sectionIndex > 0) {
            doc.moveDown(2);
          }
  
          // Check if the entire section (header + table) fits on current page
          if (section.summary) {
            const isArrayData = Array.isArray(section.summary);
            checkSectionFit(section.summary, isArrayData);
          } else {
            // If no summary, just check for header space
            checkPageBreak(60);
          }
  
          // Draw section header
          drawSectionHeader(section.title);
  
          // Draw table if exists
          if (section.summary) {
            if (Array.isArray(section.summary)) {
              drawTable(section.summary, true);
            } else {
              drawTable(section.summary, false);
            }
          }
  
          // Add spacing between sections
          doc.moveDown(1.5);
        });
  
        // Enhanced footer with page numbers
        const pageRange = doc.bufferedPageRange();
        for (let i = 0; i < pageRange.count; i++) {
          doc.switchToPage(pageRange.start + i);
          
          // Footer background
          doc.rect(0, doc.page.height - 60, doc.page.width, 60)
             .fill(colors.mediumGray);
  
          // Page number
          doc.fontSize(10)
             .fillColor(colors.darkGray)
             .font('Helvetica')
             .text(
               `Page ${i + 1} sur ${pageRange.count}`, 
               50, 
               doc.page.height - 35, 
               {
                 align: 'center',
                 width: doc.page.width - 100
               }
             );
  
          // Footer decoration
          doc.rect(50, doc.page.height - 50, doc.page.width - 100, 2)
             .fill(colors.accent);
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
// Fonction de génération de la section Scoring 
// (méthode originale : moyenne des niveaux et moyenne des objectifs,
// puis calcul du pourcentage à partir de ces moyennes)
async function generateScoringSection(supermarkets, dateFilter) {
  const scoringCategories = ['securiteIncendie', 'sst', 'surete'];
  // Pour chaque catégorie, nous accumulons la somme des niveaux et la somme des objectifs ainsi que le nombre d'indicateurs.
  let categorySums = {};
  scoringCategories.forEach(cat => {
    categorySums[cat] = { sumNiveau: 0, sumObj: 0, count: 0 };
  });
  
  let globalSumNiveau = 0, globalSumObj = 0, globalCount = 0;
  
  // Si dateFilter est défini, il s'agit d'un objet { start, end, year }
  let filterStart, filterEnd, filterYear;
  if (dateFilter && dateFilter.start && dateFilter.end && dateFilter.year) {
    filterStart = dateFilter.start;
    filterEnd = dateFilter.end;
    filterYear = dateFilter.year;
  }
  
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (filterStart && filterEnd && filterYear) {
        if (instance.annee !== filterYear || instance.mois < filterStart || instance.mois > filterEnd)
          return;
      }
      if (!instance.scoring) return;
      scoringCategories.forEach(category => {
        if (!instance.scoring[category] || instance.scoring[category].length === 0) return;
        instance.scoring[category].forEach(item => {
          const niveau = parseFloat(item.niveau) || 0;
          const objectif = parseFloat(item.objectif) || 0;
          // On ne considère que les indicateurs avec objectif > 0
          if (objectif > 0) {
            categorySums[category].sumNiveau += niveau;
            categorySums[category].sumObj += objectif;
            categorySums[category].count++;
            globalSumNiveau += niveau;
            globalSumObj += objectif;
            globalCount++;
          }
        });
      });
    });
  });
  
  // Calcul des moyennes pour chaque catégorie
  let summaryRows = [];
  scoringCategories.forEach(category => {
    let label;
    if (category === 'securiteIncendie') label = 'Sécurité Incendie';
    else if (category === 'sst') label = 'Sécurité et Santé au Travail';
    else if (category === 'surete') label = 'Sûreté';
    
    const { sumNiveau, sumObj, count } = categorySums[category];
    if (count > 0) {
      const avgNiveau = sumNiveau / count;
      const avgObj = sumObj / count;
      const diff = avgNiveau - avgObj;
      summaryRows.push({
        "Thème": label,
        "Niveau (%)": avgNiveau.toFixed(2) + '%',
        "Objectifs (%)": avgObj.toFixed(2) + '%',
        "Écart (%)": (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%'
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
  
  // Ligne globale calculée sur l'ensemble des indicateurs
  let globalRow = {
    "Thème": "Niveau de Sécurité Global",
    "Niveau (%)": 'N/A',
    "Objectifs (%)": 'N/A',
    "Écart (%)": 'N/A'
  };
  if (globalCount > 0) {
    const globalAvg = globalSumNiveau / globalCount;
    const globalAvgObj = globalSumObj / globalCount;
    const globalDiff = globalAvg - globalAvgObj;
    globalRow = {
      "Thème": "Niveau de Sécurité Global",
      "Niveau (%)": globalAvg.toFixed(2) + '%',
      "Objectifs (%)": globalAvgObj.toFixed(2) + '%',
      "Écart (%)": (globalDiff >= 0 ? '+' : '') + globalDiff.toFixed(2) + '%'
    };
  }
  summaryRows.push(globalRow);
  
  return {
    title: 'Scoring - Niveau de Sécurité Global',
    summary: summaryRows,
    details: [] // Nous ne retournons pas de détails ici dans le rapport
  };
}
  


// Génération de la section DRL
async function generateDRLSection(supermarkets, dateFilter) {
  let totalAccepted = 0;
  let totalRefused = 0;
  let details = [];
  
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (dateFilter && dateFilter.start && dateFilter.end && dateFilter.year) {
        if (instance.annee !== dateFilter.year || instance.mois < dateFilter.start || instance.mois > dateFilter.end)
          return;
      }
      if (!instance.drl) return;
      instance.drl.forEach(drlItem => {
        const valeur = parseFloat(drlItem.valeur) || 0;
        if (drlItem.statut === 'Accepté') {
          totalAccepted += valeur;
        } else if (drlItem.statut === 'Refusé') {
          totalRefused += valeur;
        }
        details.push({
          "Magasin": market.nom,
          "Valeur": valeur.toFixed(2),
          "Statut": drlItem.statut,
          "Date": drlItem.date ? new Date(drlItem.date).toLocaleDateString('fr-FR') : 'N/A'
        });
      });
    });
  });
  
  return {
    title: 'DRL',
    summary: {
      "Accepté": totalAccepted.toFixed(2),
      "Refusé": totalRefused.toFixed(2)
    },
    details: details
  };
}

/* ------------------------------------------------------------------
   EXISTING SECTION GENERATORS (Formation, Accidents, Incidents, Interpellations)
   ------------------------------------------------------------------ */
// Génération de la section Formation
async function generateFormationSection(supermarkets, dateFilter) {
  let totalPersonnes = 0;
  let formationByType = { 'Incendie': 0, 'SST': 0, 'Intégration': 0 };
  let details = [];
  
  // Si dateFilter existe, on s'attend à un objet { start, end, year }
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (dateFilter && dateFilter.start && dateFilter.end && dateFilter.year) {
        if (instance.annee !== dateFilter.year || instance.mois < dateFilter.start || instance.mois > dateFilter.end)
          return; // on ignore l'instance
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
    details: details
  };
}

// Génération de la section Accidents
async function generateAccidentsSection(supermarkets, dateFilter) {
  let totalAccidents = 0;
  let totalJours = 0;
  let details = [];
  
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (dateFilter && dateFilter.start && dateFilter.end && dateFilter.year) {
        if (instance.annee !== dateFilter.year || instance.mois < dateFilter.start || instance.mois > dateFilter.end)
          return;
      }
      if (!instance.accidents) return;
      instance.accidents.forEach(a => {
        // On peut se fier à l'instance pour la période ; sinon, on vérifie la date de l'accident si présente
        const accidentDate = a.date ? new Date(a.date) : null;
        const accidents = parseInt(a.nombreAccidents) || 0;
        const jours = parseInt(a.joursArret) || 0;
        totalAccidents += accidents;
        totalJours += jours;
        details.push({
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
    details: details
  };
}

// Génération de la section Incidents
async function generateIncidentsSection(supermarkets, dateFilter) {
  let totalIncidents = 0;
  let incidentsByType = {};
  let details = [];
  
  supermarkets.forEach(market => {
    if (!market.instances) return;
    market.instances.forEach(instance => {
      if (dateFilter && dateFilter.start && dateFilter.end && dateFilter.year) {
        if (instance.annee !== dateFilter.year || instance.mois < dateFilter.start || instance.mois > dateFilter.end)
          return;
      }
      if (!instance.incidents) return;
      instance.incidents.forEach(i => {
        const incidentDate = i.date ? new Date(i.date) : null;
        const count = parseInt(i.nombreIncidents) || 0;
        totalIncidents += count;
        incidentsByType[i.typeIncident] = (incidentsByType[i.typeIncident] || 0) + count;
        details.push({
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
    details: details
  };
}

// Génération de la section Interpellations
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
      if (dateFilter && dateFilter.start && dateFilter.end && dateFilter.year) {
        if (instance.annee !== dateFilter.year || instance.mois < dateFilter.start || instance.mois > dateFilter.end)
          return;
      }
      if (!instance.interpellations) return;
      instance.interpellations.forEach(inter => {
        const interDate = inter.date ? new Date(inter.date) : null;
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
    details: details
  };
}

module.exports = router;
