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
      includeReclamations
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

   // routes/reports.js
// In POST '/generate' — REPLACE the section push block with this
if (includeFormation       === 'on') reportData.sections.push(await generateFormationSection(supermarkets, dateFilter));
if (includeAccidents       === 'on') reportData.sections.push(await generateAccidentsSection   (supermarkets, dateFilter));
if (includeIncidents       === 'on') reportData.sections.push(await generateIncidentsSection    (supermarkets, dateFilter));
if (includeInterpellations === 'on') reportData.sections.push(await generateInterpellationsSection(supermarkets, dateFilter));
if (includeScoring         === 'on') reportData.sections.push(await generateScoringSection      (supermarkets, dateFilter));
if (includeReclamations    === 'on') reportData.sections.push(await generateReclamationsSection (supermarkets, dateFilter)); // <── NEW

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
  
        // Enhanced color palette with gradients
        const colors = {
          primary: '#1A1F3A',
          primaryLight: '#2A3554',
          secondary: '#3B4A6B',
          accent: '#3B82F6',
          accentLight: '#60A5FA',
          success: '#10B981',
          successLight: '#34D399',
          warning: '#F59E0B',
          warningLight: '#FBBF24',
          danger: '#EF4444',
          dangerLight: '#F87171',
          purple: '#8B5CF6',
          purpleLight: '#A78BFA',
          bgCard: '#F9FAFB',
          bgPage: '#FFFFFF',
          border: '#E5E7EB',
          borderDark: '#D1D5DB',
          text: '#1F2937',
          textLight: '#6B7280',
          textMuted: '#9CA3AF',
          white: '#FFFFFF'
        };
  
        const page = {
          top: doc.page.margins.top,
          bottom: doc.page.height - doc.page.margins.bottom,
          width: doc.page.width - 100
        };
  
        // Utility: Draw gradient effect (simulated with overlapping rectangles)
        function drawGradientRect(x, y, width, height, color1, color2) {
          const steps = 20;
          for (let i = 0; i < steps; i++) {
            const alpha = 1 - (i / steps) * 0.3;
            doc.rect(x, y + (height / steps) * i, width, height / steps)
               .fillOpacity(alpha)
               .fill(i < steps / 2 ? color1 : color2);
          }
          doc.fillOpacity(1);
        }
  
        // Enhanced footer with design elements
        function footer() {
          const range = doc.bufferedPageRange();
          for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            const y = doc.page.height - 35;
            
            doc.save();
            // Subtle top border
            doc.moveTo(50, y - 5).lineTo(doc.page.width - 50, y - 5)
               .strokeColor(colors.border).lineWidth(0.5).stroke();
            
            // Page number
            doc.fillColor(colors.textMuted).fontSize(9).font('Helvetica')
               .text(`Page ${i + 1} / ${range.count}`, 50, y, { 
                 width: doc.page.width - 100, 
                 align: 'center' 
               });
            
            // Decorative elements
            doc.circle(50, y + 4, 2).fill(colors.accent);
            doc.circle(doc.page.width - 50, y + 4, 2).fill(colors.accent);
            
            doc.restore();
          }
        }
  
        // Modern cover page with design elements
        function addCover() {
          // Gradient background header
          drawGradientRect(0, 0, doc.page.width, 220, colors.primary, colors.primaryLight);
          
          // Decorative circles
          doc.circle(doc.page.width - 80, 40, 60)
             .fillOpacity(0.1).fill(colors.accent);
          doc.circle(60, 180, 40)
             .fillOpacity(0.1).fill(colors.accentLight);
          doc.fillOpacity(1);
  
          // Title with shadow effect
          doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(32)
             .text(reportData.title, 50, 70, { 
               width: doc.page.width - 100, 
               align: 'center' 
             });
          
          // Subtitle with icon-like element
          doc.fontSize(11).font('Helvetica').fillColor('#CBD5E1')
             .text('📊 ' + `Rapport généré le ${formatFrenchDate(reportData.date)}`, 
                   50, 130, { width: doc.page.width - 100, align: 'center' });
  
          // Professional summary section
          doc.moveDown(8);
          const sections = reportData.sections || [];
          
          if (sections.length) {
            // Section title with accent bar
            const titleY = doc.y;
            doc.rect(50, titleY, 4, 24).fill(colors.accent);
            doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(16)
               .text('Sommaire Exécutif', 62, titleY + 4);
            doc.moveDown(1.5);
  
            // Modern card grid
            const cardW = (page.width - 20) / 2;
            const cardH = 75;
            let x = 50, y = doc.y;
  
            sections.forEach((s, idx) => {
              if (y + cardH > page.bottom - 50) {
                doc.addPage();
                x = 50; 
                y = page.top;
              }
  
              doc.save();
              
              // Card shadow
              doc.roundedRect(x + 2, y + 2, cardW, cardH, 10)
                 .fillOpacity(0.05).fill('#000000');
              doc.fillOpacity(1);
              
              // Card background
              doc.roundedRect(x, y, cardW, cardH, 10).fill(colors.white);
              doc.roundedRect(x, y, cardW, cardH, 10)
                 .strokeColor(colors.border).lineWidth(1).stroke();
              
              // Accent top border
              doc.roundedRect(x, y, cardW, 5, 10).fill(getSectionColor(s.title));
              
              // Icon area (colored circle)
              const iconX = x + 15, iconY = y + 20;
              doc.circle(iconX, iconY, 12)
                 .fillOpacity(0.15).fill(getSectionColor(s.title));
              doc.fillOpacity(1);
              
              // Section title
              doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(11)
                 .text(s.title, x + 35, y + 14, { width: cardW - 45, height: 30 });
              
              // Summary info
              doc.fillColor(colors.textLight).font('Helvetica').fontSize(9);
              const sub = Array.isArray(s.summary) 
                ? `${s.summary.length} entrées` 
                : (s.summary ? `${Object.keys(s.summary).length} indicateurs` : 'Aucune donnée');
              doc.text(sub, x + 15, y + 50, { width: cardW - 30 });
              
              doc.restore();
  
              if ((idx + 1) % 2 === 0) { 
                x = 50; 
                y += cardH + 15; 
              } else { 
                x += cardW + 20; 
              }
            });
          }
  
          doc.addPage();
        }
  
        // Helper to get section-specific colors
        function getSectionColor(title) {
          if (/formation/i.test(title)) return colors.primary;
          if (/accident/i.test(title)) return colors.danger;
          if (/incident/i.test(title)) return colors.warning;
          if (/interpellation/i.test(title)) return colors.success;
          if (/réclamation|reclamation/i.test(title)) return colors.purple;
          if (/scoring/i.test(title)) return colors.secondary;
          return colors.accent;
        }
  
        function ensure(nextHeight = 80) {
          if (doc.y + nextHeight > page.bottom) {
            doc.addPage();
          }
        }
  
        // Modern section header
        function sectionHeader(title, color = colors.accent) {
          ensure(100);
          
          doc.save();
          const headerY = doc.y;
          
          // Background with subtle gradient effect
          doc.rect(40, headerY, doc.page.width - 80, 55).fill(colors.bgCard);
          
          // Accent side bar with gradient
          doc.rect(40, headerY, 8, 55).fill(color);
          
          // Top accent line
          doc.moveTo(48, headerY).lineTo(doc.page.width - 40, headerY)
             .strokeColor(color).lineWidth(2).stroke();
          
          // Section icon (decorative circle)
          doc.circle(70, headerY + 27, 15)
             .fillOpacity(0.2).fill(color);
          doc.fillOpacity(1);
          
          // Title
          doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(15)
             .text(title.toUpperCase(), 95, headerY + 18);
          
          doc.restore();
          doc.moveDown(3);
        }
  
        // Enhanced KPI cards with better visuals
        function kpiCards(summaryObj, accent = colors.accent) {
          const entries = Object.entries(summaryObj)
            .filter(([k]) => !['id', '_id', 'Description'].includes(k));
  
          const cols = 3;
          const gap = 15;
          const cardW = (page.width - (gap * (cols - 1))) / cols;
          const cardH = 100;
  
          let x = 50;
          let y = doc.y;
  
          entries.forEach(([label, value], i) => {
            if (y + cardH > page.bottom - 50) {
              doc.addPage();
              y = page.top; 
              x = 50;
            }
  
            doc.save();
            
            // Card shadow
            doc.roundedRect(x + 1, y + 1, cardW, cardH, 8)
               .fillOpacity(0.03).fill('#000000');
            doc.fillOpacity(1);
            
            // Card background
            doc.roundedRect(x, y, cardW, cardH, 8).fill(colors.white);
            doc.roundedRect(x, y, cardW, cardH, 8)
               .strokeColor(colors.border).lineWidth(1).stroke();
            
            // Accent indicator (top bar)
            doc.roundedRect(x, y, cardW, 4, 8).fill(accent);
            
            // Icon circle
            doc.circle(x + 15, y + 25, 8)
               .fillOpacity(0.15).fill(accent);
            doc.fillOpacity(1);
            
            // Label
            doc.fillColor(colors.textLight).font('Helvetica').fontSize(8)
               .text(label.toUpperCase(), x + 12, y + 45, { 
                 width: cardW - 24, 
                 height: 30,
                 lineGap: 2
               });
            
            // Value
            doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(20)
               .text(String(value), x + 12, y + 70, { 
                 width: cardW - 24, 
                 align: 'left' 
               });
  
            doc.restore();
  
            if ((i + 1) % cols === 0) { 
              x = 50; 
              y += cardH + gap; 
            } else { 
              x += cardW + gap; 
            }
          });
  
          doc.y = y + cardH + 10;
        }
  
        // Modern table with better styling
        function tableFromArray(rows, accent = colors.accent) {
          if (!rows || !rows.length) return;
          
          const headers = Object.keys(rows[0]);
          const colW = page.width / headers.length;
          const rowH = 32;
  
          ensure(100);
  
          // Table header
          doc.save();
          const headerY = doc.y;
          
          // Header background with gradient effect
          doc.rect(50, headerY, page.width, rowH).fill(colors.primary);
          
          // Header text
          doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(9);
          headers.forEach((h, i) => {
            doc.text(h.toUpperCase(), 50 + i * colW + 10, headerY + 10, { 
              width: colW - 20,
              lineGap: 1
            });
          });
          doc.restore();
          
          let y = headerY + rowH;
  
          // Table rows
          rows.forEach((r, idx) => {
            if (y + rowH > page.bottom - 50) {
              doc.addPage();
              y = page.top;
              
              // Redraw header
              doc.save();
              doc.rect(50, y, page.width, rowH).fill(colors.primary);
              doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(9);
              headers.forEach((h, i) => {
                doc.text(h.toUpperCase(), 50 + i * colW + 10, y + 10, { 
                  width: colW - 20 
                });
              });
              doc.restore();
              y += rowH;
            }
  
            const bg = idx % 2 === 0 ? colors.white : colors.bgCard;
            doc.save();
            
            // Row background
            doc.rect(50, y, page.width, rowH).fill(bg);
            
            // Row border
            doc.moveTo(50, y + rowH).lineTo(50 + page.width, y + rowH)
               .strokeColor(colors.border).lineWidth(0.5).stroke();
            
            // Cell content
            doc.fillColor(colors.text).font('Helvetica').fontSize(8.5);
            const vals = Object.values(r);
            vals.forEach((val, i) => {
              doc.text(String(val), 50 + i * colW + 10, y + 10, { 
                width: colW - 20,
                height: rowH - 10
              });
            });
            
            doc.restore();
            y += rowH;
          });
  
          doc.y = y + 15;
        }
  
        // Build document
        addCover();
  
        (reportData.sections || []).forEach(section => {
          const accent = getSectionColor(section.title);
          sectionHeader(section.title, accent);
  
          if (Array.isArray(section.summary)) {
            tableFromArray(section.summary, accent);
          } else if (section.summary && typeof section.summary === 'object') {
            // Special handling for Réclamations
            if (/réclamation|reclamation/i.test(section.title)) {
              const kpiData = {};
              const topMotifs = [];
              
              Object.entries(section.summary).forEach(([key, value]) => {
                if (key.startsWith('Top Motif')) {
                  const match = String(value).match(/^(.+?)\s*\((\d+)\)$/);
                  if (match) {
                    topMotifs.push({ 
                      "Rang": key.replace('Top Motif ', ''), 
                      "Motif": match[1], 
                      "Nombre": match[2] 
                    });
                  }
                } else {
                  kpiData[key] = value;
                }
              });
  
              if (Object.keys(kpiData).length > 0) {
                kpiCards(kpiData, accent);
              }
  
              if (topMotifs.length > 0) {
                doc.moveDown(1);
                const subHeaderY = doc.y;
                doc.rect(50, subHeaderY, 4, 20).fill(accent);
                doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(13)
                   .text('Top Motifs de Réclamation', 62, subHeaderY + 2);
                doc.moveDown(1);
                tableFromArray(topMotifs, accent);
              }
  
              if (section.details && section.details.length > 0) {
                doc.moveDown(1);
                const subHeaderY = doc.y;
                doc.rect(50, subHeaderY, 4, 20).fill(accent);
                doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(13)
                   .text('Détails des Réclamations', 62, subHeaderY + 2);
                doc.moveDown(1);
                tableFromArray(section.details, accent);
              }
            } else {
              kpiCards(section.summary, accent);
            }
          } else {
            doc.fillColor(colors.textMuted).font('Helvetica-Oblique').fontSize(10)
               .text('Aucune donnée disponible pour cette section.', 50);
            doc.moveDown(2);
          }
        });
  
        footer();
  
        doc.end();
        stream.on('finish', () => resolve(pdfPath));
        stream.on('error', err => reject(err));
      } catch (err) {
        reject(err);
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
  


// routes/reports.js
// ADD this (and REMOVE generateDRLSection)
async function generateReclamationsSection(supermarkets, dateFilter) {
  let total = 0;
  let byStatut = { 'Traité': 0, 'En cours': 0, 'Non traité': 0 };
  let byMotif = {};
  let details = [];

  supermarkets.forEach(market => {
    (market.instances || []).forEach(instance => {
      if (dateFilter && dateFilter.start && dateFilter.end && dateFilter.year) {
        if (instance.annee !== dateFilter.year || instance.mois < dateFilter.start || instance.mois > dateFilter.end)
          return;
      }
      (instance.reclamations || []).forEach(r => {
        total += 1;
        const st = r.statut || 'Non traité';
        byStatut[st] = (byStatut[st] || 0) + 1;
        const motif = r.motif || 'Autre';
        byMotif[motif] = (byMotif[motif] || 0) + 1;

        details.push({
          'Magasin': market.nom,
          'Date & Heure': r.dateHeure ? new Date(r.dateHeure).toLocaleString('fr-FR') : 'N/A',
          'Motif': motif,
          'Sous-motif': r.sousMotif || '—',
          'Produit': r.designationProduit || '—',
          'Action': r.action || '—',
          'Statut': st
        });
      });
    });
  });

  const topMotifs = Object.entries(byMotif).sort((a,b)=>b[1]-a[1]).slice(0,5);
  let summary = {
    'Total réclamations': total,
    'Traité': byStatut['Traité'] || 0,
    'En cours': byStatut['En cours'] || 0,
    'Non traité': byStatut['Non traité'] || 0
  };
  topMotifs.forEach(([label, n], i) => { summary[`Top Motif ${i+1}`] = `${label} (${n})`; });

  return { title: 'Réclamations', summary, details };
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
