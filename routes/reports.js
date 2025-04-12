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

// Serve favicon.ico requests to avoid misrouting them
router.get('/favicon.ico', (req, res) => res.status(204).end());

// Middleware to check if user is logged in
const ensureLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Helper: ensure /mnt/data directory exists, then return its path
function getPersistPath() {
  const persistPath = '/mnt/data'; // The Render disk mount point
  if (!fs.existsSync(persistPath)) {
    fs.mkdirSync(persistPath, { recursive: true });
  }
  return persistPath;
}

// Main reports page
router.get('/', ensureLoggedIn, async (req, res) => {
  try {
    // Get supermarkets filtered by user's region
    let supermarkets;
    if (req.session.region === 'ALL') {
      // Main account sees all supermarkets
      supermarkets = await Supermarket.find({});
    } else {
      // Other accounts only see supermarkets in their region
      supermarkets = await Supermarket.find({ ville: req.session.region });
    }
    
    // Create month options for the dropdown
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
    
    // Get current year and last 5 years for dropdown
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
    
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

// Generate report
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
      includeInterpellations 
    } = req.body;
    
    let filter = {};
    let dateFilter = {};
    let title = '';
    
    // Add region filter based on user's session
    if (req.session.region !== 'ALL') {
      filter.ville = req.session.region;
    }
    
    // Build filters based on report type
    if (reportType === 'supermarket' && supermarketId) {
      // Validate the supermarketId
      if (!mongoose.Types.ObjectId.isValid(supermarketId)) {
        return res.status(400).send('ID de supermarché invalide');
      }
      
      // Check if supermarket belongs to user's region
      const supermarket = await Supermarket.findById(supermarketId);
      if (!supermarket) {
        return res.status(404).send('Supermarché non trouvé');
      }
      
      // Verify region access permission
      if (req.session.region !== 'ALL' && supermarket.ville !== req.session.region) {
        return res.status(403).send('Accès non autorisé à ce supermarché');
      }
      
      // Restrict to this supermarket only
      filter = { _id: supermarketId };
      title = `Rapport - ${supermarket.nom}`;
      
    } else if (reportType === 'month' && month && year) {
      // Create date range for the selected month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      dateFilter = { $gte: startDate, $lte: endDate };
      title = `Rapport Mensuel - ${getMonthName(month)} ${year}`;
      
    } else {
      // General report
      title = 'Rapport Général';
    }
    
    // Get supermarkets based on filter
    const supermarkets = await Supermarket.find(filter).populate('instances');
    
    if (!supermarkets || supermarkets.length === 0) {
      return res.status(404).send('Aucun supermarché trouvé avec les critères spécifiés');
    }
    
    // Initialize report data
    let reportData = {
      title,
      date: new Date().toLocaleDateString('fr-FR'),
      sections: []
    };
    
    // Include requested sections
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
    
    // Store report in session for later use (email, print, etc.)
    req.session.reportData = reportData;
    
    res.render('reportView', { 
      reportData,
      formatDate: (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).send('Erreur lors de la génération du rapport');
  }
});

// View the current report in session
router.get('/view', ensureLoggedIn, (req, res) => {
  const reportData = req.session.reportData;
  if (!reportData) {
    return res.redirect('/reports');
  }
  
  res.render('reportView', { 
    reportData,
    formatDate: (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  });
});

// Display modification page
router.get('/modifier', ensureLoggedIn, (req, res) => {
  const reportData = req.session.reportData;
  if (!reportData) {
    return res.redirect('/reports');
  }
  
  const success = req.session.success;
  const error = req.session.error;
  delete req.session.success;
  delete req.session.error;

  res.render('modifierRapport', { 
    reportData,
    success,
    error,
    formatDate: (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  });
});

// Handle modification submission
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
      // Validate numeric fields
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

// Email report (no longer deleting the file!)
router.post('/email', ensureLoggedIn, async (req, res) => {
  try {
    const { email, subject } = req.body;
    if (!email) {
      return res.status(400).send('Adresse email requise');
    }
    
    const reportData = req.session.reportData;
    if (!reportData) {
      return res.status(400).send('Aucun rapport à envoyer');
    }
    
    // Create PDF (on /mnt/data)
    const pdfPath = await generatePDF(reportData);
    
    // Setup email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'user@example.com',
        pass: process.env.SMTP_PASS || 'password'
      }
    });
    
    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Système de Rapport" <rapports@example.com>',
      to: email,
      subject: subject || `${reportData.title} - ${reportData.date}`,
      text: `Veuillez trouver ci-joint le rapport "${reportData.title}" généré le ${reportData.date}.`,
      attachments: [
        {
          filename: path.basename(pdfPath),
          path: pdfPath
        }
      ]
    });
    
    // We do NOT delete the PDF now — it stays in /mnt/data
    // If you want to remove it, you can uncomment:
    // fs.unlinkSync(pdfPath);
    
    res.status(200).send('Rapport envoyé avec succès');
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).send('Erreur lors de l\'envoi du rapport');
  }
});

// Download PDF report
router.get('/download', ensureLoggedIn, async (req, res) => {
  try {
    const reportData = req.session.reportData;
    
    if (!reportData) {
      return res.status(400).send('Aucun rapport à télécharger');
    }
    
    // Create PDF (on /mnt/data)
    const pdfPath = await generatePDF(reportData);
    
    // Suggest a file name
    const safeFileName = reportData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Pipe the file to response
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    // If you do not want to keep the file, uncomment:
    // fileStream.on('end', () => {
    //   fs.unlink(pdfPath, err => {
    //     if (err) console.error('Error deleting PDF:', err);
    //   });
    // });
    
  } catch (err) {
    console.error('Error downloading PDF:', err);
    res.status(500).send('Erreur lors de la génération du PDF');
  }
});

/* ------------------------------------------------------------------
   HELPER FUNCTIONS FOR GENERATING THE PDF & REPORT SECTIONS
   ------------------------------------------------------------------ */

// Generate the PDF directly in /mnt/data
async function generatePDF(reportData) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure /mnt/data is there
      const persistPath = getPersistPath();
      
      // Unique filename
      const filename = `rapport-${Date.now()}.pdf`;
      const pdfPath = path.join(persistPath, filename);

      // Create the doc
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: reportData.title,
          Author: 'Système de Rapports',
          Subject: `Rapport généré le ${reportData.date}`
        }
      });
      
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);
      
      // Styling choices
      const primaryColor = '#0d6efd';
      const secondaryColor = '#6c757d';
      const borderColor = '#dee2e6';
      
      function addPageHeader() {
        // If you want a logo, put it here:
        // doc.image('path/to/logo.png', 50, 50, { width: 100 });
        doc.fontSize(18)
          .fillColor(primaryColor)
          .text(reportData.title, 50, 50);
        doc.fontSize(10)
          .fillColor(secondaryColor)
          .text(`Généré le: ${reportData.date}`, 50, 75);

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

      // Start the doc
      addPageHeader();
      
      // Each section
      reportData.sections.forEach((section, sIndex) => {
        if (sIndex > 0) doc.moveDown();
        
        // Basic heading
        doc.fontSize(16).fillColor(primaryColor).text(section.title.toUpperCase(), {
          underline: true
        });
        doc.moveDown();

        // Summaries
        if (section.summary) {
          const summaryRows = Object.entries(section.summary).map(([k, v]) => [k, v]);
          const rowHeight = 25;
          checkPageBreak(rowHeight * (summaryRows.length + 1));
          
          const tableLeft = 50;
          const tableWidth = doc.page.width - 100;
          const colWidth = tableWidth / 2;
          const tableTop = doc.y;

          // Header background
          doc.rect(tableLeft, tableTop, tableWidth, rowHeight).fill(primaryColor);
          doc.fillColor('#fff').fontSize(12);
          doc.text('Indicateur', tableLeft + 10, tableTop + 7);
          doc.text('Valeur', tableLeft + colWidth + 10, tableTop + 7);

          let currentY = tableTop + rowHeight;

          summaryRows.forEach(([key, val], i) => {
            checkPageBreak(rowHeight);
            doc.rect(tableLeft, currentY, tableWidth, rowHeight)
               .fillAndStroke(i % 2 === 0 ? '#f9f9f9' : '#ffffff', borderColor);

            doc.fillColor('#000').fontSize(10);
            doc.text(key, tableLeft + 10, currentY + 7, { width: colWidth - 20 });
            doc.text(String(val), tableLeft + colWidth + 10, currentY + 7, { width: colWidth - 20 });

            currentY += rowHeight;
          });
          doc.y = currentY + 10;
        }

        // Details table
        if (section.details && section.details.length > 0) {
          const headers = Object.keys(section.details[0])
            .filter(k => !['id','Description'].includes(k));
          
          const tableWidth = doc.page.width - 100;
          const rowHeight = 25;
          let currentY = doc.y;
          
          // Simple distribution
          const colCount = headers.length;
          const colWidth = tableWidth / colCount;

          checkPageBreak(rowHeight * 3);
          doc.rect(50, currentY, tableWidth, rowHeight).fill(primaryColor);

          let xOffset = 50;
          doc.fillColor('#fff').fontSize(10);
          headers.forEach((header) => {
            doc.text(header, xOffset + 5, currentY + 7, { width: colWidth - 10 });
            xOffset += colWidth;
          });
          currentY += rowHeight;

          section.details.forEach((detail, rowIdx) => {
            checkPageBreak(rowHeight);
            doc.rect(50, currentY, tableWidth, rowHeight)
               .fillAndStroke(rowIdx % 2 === 0 ? '#f9f9f9' : '#ffffff', borderColor);

            let cellX = 50;
            doc.fillColor('#000').fontSize(9);
            headers.forEach((header) => {
              doc.text(detail[header] || 'N/A', cellX + 5, currentY + 8, { width: colWidth - 10 });
              cellX += colWidth;
            });
            currentY += rowHeight;
          });
          doc.y = currentY + 10;
        }
      });

      // Add page numbers
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor(secondaryColor).text(
          `Page ${i + 1} / ${pageCount}`,
          50,
          doc.page.height - 50,
          { align: 'center', width: doc.page.width - 100 }
        );
      }

      doc.end();
      writeStream.on('finish', () => resolve(pdfPath));
      writeStream.on('error', (err) => reject(err));

    } catch (err) {
      console.error('PDF generation error:', err);
      reject(err);
    }
  });
}

// Generate each section’s data
async function generateFormationSection(supermarkets, dateFilter) {
  let totalPersonnes = 0;
  let formationByType = { 'Incendie': 0, 'SST': 0, 'Intégration': 0 };
  let details = [];

  supermarkets.forEach(market => {
    if (!market.instances) return;
    
    market.instances.forEach(instance => {
      if (!instance.formation) return;
      instance.formation.forEach(f => {
        const count = parseInt(f.nombrePersonnes) || 0;
        totalPersonnes += count;
        if (formationByType[f.type] !== undefined) {
          formationByType[f.type] += count;
        }
        details.push({
          id: f._id,
          Supermarché: market.nom,
          Type: f.type,
          'NPr': f.nombrePersonnes
        });
      });
    });
  });

  return {
    title: 'Formations',
    summary: {
      'Total des personnes formées': totalPersonnes,
      'Incendie': formationByType.Incendie,
      'SST': formationByType.SST,
      'Intégration': formationByType.Intégration
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
        let accidentDate = null;
        if (typeof a.date === 'string') accidentDate = new Date(a.date);

        // Check date filter if needed
        if (accidentDate && dateFilter.$gte && accidentDate < dateFilter.$gte) return;
        if (accidentDate && dateFilter.$lte && accidentDate > dateFilter.$lte) return;

        const accidents = parseInt(a.nombreAccidents) || 0;
        const jours = parseInt(a.joursArret) || 0;
        totalAccidents += accidents;
        totalJours += jours;

        details.push({
          id: a._id,
          Supermarché: market.nom,
          Date: accidentDate ? accidentDate.toLocaleDateString('fr-FR') : 'N/A',
          'NAt': a.nombreAccidents,
          'Jours d\'arrêt': a.joursArret
        });
      });
    });
  });

  return {
    title: 'Accidents',
    summary: {
      'Total des accidents': totalAccidents,
      'Total des jours d\'arrêt': totalJours
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
        let incidentDate = null;
        if (typeof i.date === 'string') incidentDate = new Date(i.date);

        if (incidentDate && dateFilter.$gte && incidentDate < dateFilter.$gte) return;
        if (incidentDate && dateFilter.$lte && incidentDate > dateFilter.$lte) return;

        const count = parseInt(i.nombreIncidents) || 0;
        totalIncidents += count;
        incidentsByType[i.typeIncident] = (incidentsByType[i.typeIncident] || 0) + count;

        details.push({
          id: i._id,
          Supermarché: market.nom,
          Date: incidentDate ? incidentDate.toLocaleDateString('fr-FR') : 'N/A',
          Type: i.typeIncident,
          'Nombre d\'incidents': i.nombreIncidents
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
  let interpellationsByType = {
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
        let interDate = null;
        if (typeof inter.date === 'string') interDate = new Date(inter.date);

        if (interDate && dateFilter.$gte && interDate < dateFilter.$gte) return;
        if (interDate && dateFilter.$lte && interDate > dateFilter.$lte) return;

        const personnes = parseInt(inter.nombrePersonnes) || 0;
        const poursuites = parseInt(inter.poursuites) || 0;
        const valeur = parseFloat(inter.valeurMarchandise) || 0;

        totalPersonnes += personnes;
        totalPoursuites += poursuites;
        totalValeur += valeur;

        if (interpellationsByType[inter.typePersonne]) {
          interpellationsByType[inter.typePersonne].personnes += personnes;
          interpellationsByType[inter.typePersonne].poursuites += poursuites;
          interpellationsByType[inter.typePersonne].valeur += valeur;
        }

        details.push({
          id: inter._id,
          Supermarché: market.nom,
          Date: interDate ? interDate.toLocaleDateString('fr-FR') : 'N/A',
          'TP': inter.typePersonne,
          'NPr': inter.nombrePersonnes,
          'Poursuites': inter.poursuites,
          'Valeur(kDH)': valeur.toFixed(3)
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
      'Client - Personnes': interpellationsByType['Client'].personnes,
      'Client - Poursuites': interpellationsByType['Client'].poursuites,
      'Client - Valeur (kDH)': interpellationsByType['Client'].valeur.toFixed(3),
      'Personnel - Personnes': interpellationsByType['Personnel'].personnes,
      'Personnel - Poursuites': interpellationsByType['Personnel'].poursuites,
      'Personnel - Valeur (kDH)': interpellationsByType['Personnel'].valeur.toFixed(3),
      'Prestataire - Personnes': interpellationsByType['Prestataire'].personnes,
      'Prestataire - Poursuites': interpellationsByType['Prestataire'].poursuites,
      'Prestataire - Valeur (kDH)': interpellationsByType['Prestataire'].valeur.toFixed(3)
    },
    details
  };
}

// Helper to get month name
function getMonthName(monthNum) {
  const months = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
  ];
  return months[monthNum - 1];
}

module.exports = router;
