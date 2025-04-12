const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Added to validate ObjectId
const Supermarket = require('../models/Supermarket');
const ArchivedReport = require('../models/ArchivedReport'); 
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
      // Validate the supermarketId to avoid errors from invalid ObjectIds (like "favicon.ico")
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
      
      // Override filter to only include this specific supermarket
      filter = { _id: supermarketId };
      title = `Rapport - ${supermarket.nom}`;
      
    } else if (reportType === 'month' && month && year) {
      // Create date range for the selected month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      dateFilter = { $gte: startDate, $lte: endDate };
      title = `Rapport Mensuel - ${getMonthName(month)} ${year}`;
      // Region filter is maintained from initial filter setting
    } else {
      title = 'Rapport Général';
      // Region filter is maintained from initial filter setting
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
    
    // Store report in session for later use (email, print)
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
// View the current report
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
  
  // Pass messages to template
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
    
    // Redirect to view the report instead of the main reports page
    res.redirect('/reports/view');
  } catch (err) {
    console.error('Error saving report:', err);
    req.session.error = 'Erreur lors de la mise à jour du rapport';
    res.redirect('/reports/modifier');
  }
});

// Email report
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
    
    // Create PDF
    const pdfPath = await generatePDF(reportData);
    
    // Setup email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
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
          filename: `${reportData.title.replace(/\s+/g, '_')}.pdf`,
          path: pdfPath
        }
      ]
    });
    
    // Delete temporary PDF file
    fs.unlinkSync(pdfPath);
    
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
    
    // Create PDF
    const pdfPath = await generatePDF(reportData);
    
    // Set header for download
    const safeFileName = reportData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Stream file to response
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    
    // Delete file after stream ends
    fileStream.on('end', () => {
      fs.unlink(pdfPath, (err) => {
        if (err) console.error('Error deleting PDF:', err);
      });
    });
    
  } catch (err) {
    console.error('Error downloading PDF:', err);
    res.status(500).send('Erreur lors de la génération du PDF');
  }
});

// Helper functions

// Generate PDF from report data with improved styling
// Generate PDF from report data with improved styling
async function generatePDF(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const os = require('os');
      // Use the system's temporary directory
      const tmpDir = path.join(os.tmpdir(), 'my-app-tmp');

      // Create tmp directory if it doesn't exist
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const pdfPath = path.join(tmpDir, `rapport-${Date.now()}.pdf`);
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: reportData.title,
          Author: 'Système de Rapports',
          Subject: `Rapport généré le ${reportData.date}`
        }
      });

      // Pipe PDF to file using a write stream
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Listen for the 'finish' event on the write stream to resolve the promise
      writeStream.on('finish', () => {
        resolve(pdfPath);
      });

      // Add styling variables and helper functions as before
      const primaryColor = '#0d6efd';
      const secondaryColor = '#6c757d';
      const headerColor = '#f8f9fa';
      const borderColor = '#dee2e6';

      // Helper function to check page break
      function checkPageBreak(height) {
        const marginBottom = 50;
        if (doc.y + height >= doc.page.height - marginBottom) {
          doc.addPage();
          addPageHeader(); // Add header to new page
          return true;
        }
        return false;
      }

      // Helper to add page header
      function addPageHeader() {
        try {
          const logoPath = path.join(__dirname, '../public/logo.png');
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 50, { width: 100 });
            doc.fontSize(18).text(reportData.title, 160, 65, { align: 'left' });
            doc.fontSize(10)
              .fillColor(secondaryColor)
              .text(`Généré le: ${reportData.date}`, 160, 90);
          } else {
            doc.fontSize(18).fillColor(primaryColor).text(reportData.title, 50, 50);
            doc.fontSize(10)
              .fillColor(secondaryColor)
              .text(`Généré le: ${reportData.date}`, 50, 75);
          }
        } catch (err) {
          console.error('Error adding logo to PDF:', err);
          doc.fontSize(18).fillColor(primaryColor).text(reportData.title, 50, 50);
          doc.fontSize(10)
            .fillColor(secondaryColor)
            .text(`Généré le: ${reportData.date}`, 50, 75);
        }
        
        // Add line separator
        doc.moveTo(50, 110)
          .lineTo(doc.page.width - 50, 110)
          .stroke(borderColor);
          
        doc.y = 130; // Set cursor position after header
      }

      // Add initial header
      addPageHeader();

      // Process each section
      reportData.sections.forEach((section, sectionIndex) => {
        if (sectionIndex > 0) {
          doc.moveDown();
        }

        // Calculate total height needed for this section
        let sectionHeight = 40;
        if (section.summary) {
          const summaryRows = Object.entries(section.summary).map(([key, value]) => [key, value]);
          const rowHeight = 25;
          sectionHeight += rowHeight * (summaryRows.length + 1);
        }
        
        if (doc.y + sectionHeight > doc.page.height - 100) {
          doc.addPage();
          addPageHeader();
        }

        // Section header with improved styling
        doc.fontSize(16)
          .fillColor(primaryColor)
          .text(section.title.toUpperCase(), { underline: true, align: 'left' });
        
        doc.moveDown();

        // Summary table with better formatting
        if (section.summary) {
          const summaryRows = Object.entries(section.summary).map(([key, value]) => [key, value]);
          const rowHeight = 25;
          const totalTableHeight = rowHeight * (summaryRows.length + 1);
          
          if (checkPageBreak(totalTableHeight)) {
            // Continue as the cursor is on a new page
          }
          
          const tableTop = doc.y;
          const tableWidth = doc.page.width - 100;
          const colWidth = tableWidth / 2;
          
          // Draw summary header
          doc.rect(50, tableTop, tableWidth, rowHeight)
            .fill(primaryColor);
            
          doc.fillColor('#ffffff').fontSize(12);
          doc.text('Indicateur', 60, tableTop + 7);
          doc.text('Valeur', 50 + colWidth + 10, tableTop + 7);
          
          let currentY = tableTop + rowHeight;
          
          summaryRows.forEach(([key, value], i) => {
            if (currentY + rowHeight > doc.page.height - 50) {
              doc.addPage();
              addPageHeader();
              currentY = doc.y;
              
              doc.rect(50, currentY, tableWidth, rowHeight)
                .fill(primaryColor);
                
              doc.fillColor('#ffffff').fontSize(12);
              doc.text('Indicateur', 60, currentY + 7);
              doc.text('Valeur', 50 + colWidth + 10, currentY + 7);
              
              currentY += rowHeight;
            }
            
            doc.rect(50, currentY, tableWidth, rowHeight)
              .fillAndStroke(i % 2 === 0 ? '#f9f9f9' : '#ffffff', borderColor);
            
            doc.fillColor('#000000');
            doc.fontSize(10).text(key, 60, currentY + 7, { width: colWidth - 20 });
            doc.fontSize(10).text(String(value), 50 + colWidth + 10, currentY + 7, { width: colWidth - 20 });
            
            currentY += rowHeight;
          });
          
          doc.y = currentY + 10;
        }

        // Details table with improved layout
        if (section.details && section.details.length > 0) {
          const headers = Object.keys(section.details[0])
            .filter(k => k !== 'id' && k !== 'Description');
          
          const columnWidths = [];
          const tableWidth = doc.page.width - 100;
          
          headers.forEach(header => {
            if (header.includes('Date')) {
              columnWidths.push(tableWidth * 0.15);
            } else if (header === 'Supermarché') {
              columnWidths.push(tableWidth * 0.25);
            } else if (header.includes('Nombre')) {
              columnWidths.push(tableWidth * 0.12);
            } else if (header.includes('Valeur')) {
              columnWidths.push(tableWidth * 0.15);
            } else {
              columnWidths.push(tableWidth * 0.18);
            }
          });
          
          const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
          columnWidths.forEach((width, i) => {
            columnWidths[i] = (width / totalWidth) * tableWidth;
          });
          
          const rowHeight = 25;
          checkPageBreak(rowHeight * 3);
          
          let currentY = doc.y;
          doc.rect(50, currentY, tableWidth, rowHeight)
            .fill(primaryColor);
          
          let xOffset = 50;
          headers.forEach((header, i) => {
            doc.fillColor('#ffffff').fontSize(10);
            doc.text(header, xOffset + 5, currentY + 8, { width: columnWidths[i] - 10 });
            xOffset += columnWidths[i];
          });
          
          currentY += rowHeight;
          
          section.details.forEach((detail, rowIndex) => {
            if (currentY + rowHeight > doc.page.height - 50) {
              doc.addPage();
              addPageHeader();
              currentY = doc.y;
              
              doc.rect(50, currentY, tableWidth, rowHeight)
                .fill(primaryColor);
              
              let headerXOffset = 50;
              headers.forEach((header, i) => {
                doc.fillColor('#ffffff').fontSize(10);
                doc.text(header, headerXOffset + 5, currentY + 8, { width: columnWidths[i] - 10 });
                headerXOffset += columnWidths[i];
              });
              
              currentY += rowHeight;
            }
            
            doc.rect(50, currentY, tableWidth, rowHeight)
              .fillAndStroke(rowIndex % 2 === 0 ? '#f9f9f9' : '#ffffff', borderColor);
            
            let cellXOffset = 50;
            headers.forEach((header, i) => {
              doc.fillColor('#000000').fontSize(9);
              doc.text(detail[header] || 'N/A', cellXOffset + 5, currentY + 8, { width: columnWidths[i] - 10 });
              cellXOffset += columnWidths[i];
            });
            
            currentY += rowHeight;
          });
          
          doc.y = currentY + 10;
        }
      });

      // Add footer with page numbers
      const pageRange = doc.bufferedPageRange();
      for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
          .fillColor(secondaryColor)
          .text(
            `Page ${i + 1} sur ${pageRange.count}`,
            50,
            doc.page.height - 50,
            { align: 'center', width: doc.page.width - 100 }
          );
      }
      
      // Finalize and close PDF
      doc.end();
    } catch (err) {
      console.error('PDF generation error:', err);
      reject(err);
    }
  });
}






// This route is called by the "Envoyer au Admin" button in reportView.ejs
router.get('/sendToAdmin', ensureLoggedIn, async (req, res) => {
  try {
    const reportData = req.session.reportData;
    if (!reportData) {
      return res.status(400).send('Aucun rapport à envoyer');
    }

    // 1) Generate the PDF (your existing function returns a temp file path)
    const tempPdfPath = await generatePDF(reportData);

    // 2) Decide where on disk to place the final PDF so it persists on Render:
    //    For example, Render’s paid plan can have a persistent disk mounted
    //    at `/mnt/data` or whatever path you configured. Adjust as needed.
    const newFileName = `rapport_${Date.now()}.pdf`;
    const finalPath = require('path').join('/mnt/data', newFileName);

    // 3) Move from the temp location to our final location
    const fs = require('fs');
    fs.renameSync(tempPdfPath, finalPath);

    // 4) Create a DB record referencing that saved file
    const archived = new ArchivedReport({
      title: reportData.title,
      user: req.session.user,    // the username who sent it
      filePath: finalPath,       // disk path
    });
    await archived.save();

    // Optionally show a success message, then redirect
    req.session.success = 'Rapport envoyé à l’admin avec succès.';
    return res.redirect('/reports/view');
  } catch (error) {
    console.error('Error sending report to admin:', error);
    return res.status(500).send('Erreur lors de l’envoi du rapport au admin');
  }
});





// Section generators with consistent date handling
async function generateFormationSection(supermarkets, dateFilter) {
  let totalPersonnes = 0;
  let formationByType = {
    'Incendie': 0,
    'SST': 0,
    'Intégration': 0
  };
  
  let details = [];
  
  supermarkets.forEach(supermarket => {
    if (!supermarket.instances) return;
    
    supermarket.instances.forEach(instance => {
      if (!instance.formation || !Array.isArray(instance.formation)) return;
      
      instance.formation.forEach(f => {
        // Since formation records don't have a date, we simply include them.
        // (Optionally, if a date filter is provided, you could decide to ignore formation records.)
        if (dateFilter && Object.keys(dateFilter).length > 0) {
          // Skip filtering by date for formation records
        }
        
        const count = parseInt(f.nombrePersonnes) || 0;
        totalPersonnes += count;
        
        if (formationByType[f.type] !== undefined) {
          formationByType[f.type] += count;
        }
        
        // Include formation record details without a date field.
        details.push({
          id: f._id,
          Supermarché: supermarket.nom,
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
  
  supermarkets.forEach(supermarket => {
    if (!supermarket.instances) return;
    
    supermarket.instances.forEach(instance => {
      if (!instance.accidents || !Array.isArray(instance.accidents)) return;
      
      instance.accidents.forEach(a => {
        try {
          // Ensure date is properly parsed
          let accidentDate;
          if (a.date instanceof Date) {
            accidentDate = a.date;
          } else if (typeof a.date === 'string') {
            accidentDate = new Date(a.date);
          } else {
            console.warn('Invalid accident date format:', a.date);
            return;
          }
          
          // Check if date is valid
          if (isNaN(accidentDate.getTime())) {
            console.warn('Invalid accident date:', a.date);
            return;
          }
          
          // Apply date filter if provided
          if (dateFilter && Object.keys(dateFilter).length > 0) {
            if (accidentDate < dateFilter.$gte || accidentDate > dateFilter.$lte) {
              return;
            }
          }
          
          const accidents = parseInt(a.nombreAccidents) || 0;
          const jours = parseInt(a.joursArret) || 0;
          
          totalAccidents += accidents;
          totalJours += jours;
          
          // Add to details without description
          details.push({
            id: a._id,
            Supermarché: supermarket.nom,
            Date: accidentDate.toLocaleDateString('fr-FR'),
            'NAt': a.nombreAccidents,
            'Jours d\'arrêt': a.joursArret
          });
        } catch (err) {
          console.error('Error processing accident record:', err);
        }
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
  
  supermarkets.forEach(supermarket => {
    if (!supermarket.instances) return;
    
    supermarket.instances.forEach(instance => {
      if (!instance.incidents || !Array.isArray(instance.incidents)) return;
      
      instance.incidents.forEach(i => {
        try {
          // Ensure date is properly parsed
          let incidentDate;
          if (i.date instanceof Date) {
            incidentDate = i.date;
          } else if (typeof i.date === 'string') {
            incidentDate = new Date(i.date);
          } else {
            console.warn('Invalid incident date format:', i.date);
            return;
          }
          
          // Check if date is valid
          if (isNaN(incidentDate.getTime())) {
            console.warn('Invalid incident date:', i.date);
            return;
          }
          
          // Apply date filter if provided
          if (dateFilter && Object.keys(dateFilter).length > 0) {
            if (incidentDate < dateFilter.$gte || incidentDate > dateFilter.$lte) {
              return;
            }
          }
          
          const count = parseInt(i.nombreIncidents) || 0;
          totalIncidents += count;
          
          // Add to incidents type breakdown
          if (!incidentsByType[i.typeIncident]) {
            incidentsByType[i.typeIncident] = 0;
          }
          incidentsByType[i.typeIncident] += count;
          
          // Add to details without description
          details.push({
            id: i._id,
            Supermarché: supermarket.nom,
            Date: incidentDate.toLocaleDateString('fr-FR'),
            Type: i.typeIncident,
            'Nombre d\'incidents': i.nombreIncidents
          });
        } catch (err) {
          console.error('Error processing incident record:', err);
        }
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
  
  supermarkets.forEach(supermarket => {
    if (!supermarket.instances) return;
    
    supermarket.instances.forEach(instance => {
      if (!instance.interpellations || !Array.isArray(instance.interpellations)) return;
      
      instance.interpellations.forEach(inter => {
        try {
          // Ensure date is properly parsed
          let interpellationDate;
          if (inter.date instanceof Date) {
            interpellationDate = inter.date;
          } else if (typeof inter.date === 'string') {
            interpellationDate = new Date(inter.date);
          } else {
            console.warn('Invalid interpellation date format:', inter.date);
            return;
          }
          
          // Check if date is valid
          if (isNaN(interpellationDate.getTime())) {
            console.warn('Invalid interpellation date:', inter.date);
            return;
          }
          
          // Apply date filter if provided
          if (dateFilter && Object.keys(dateFilter).length > 0) {
            if (interpellationDate < dateFilter.$gte || interpellationDate > dateFilter.$lte) {
              return;
            }
          }
          
          const personnes = parseInt(inter.nombrePersonnes) || 0;
          const poursuites = parseInt(inter.poursuites) || 0;
          const valeur = parseFloat(inter.valeurMarchandise) || 0;
          
          totalPersonnes += personnes;
          totalPoursuites += poursuites;
          totalValeur += valeur;
          
          // Add to type breakdown
          const type = inter.typePersonne;
          if (interpellationsByType[type]) {
            interpellationsByType[type].personnes += personnes;
            interpellationsByType[type].poursuites += poursuites;
            interpellationsByType[type].valeur += valeur;
          }
          
          // Add to details without description
          details.push({
            id: inter._id,
            Supermarché: supermarket.nom,
            Date: interpellationDate.toLocaleDateString('fr-FR'),
            'TP': inter.typePersonne,
            'NPr': inter.nombrePersonnes,
            'Poursuites': inter.poursuites,
            'Valeur(kDH)': parseFloat(inter.valeurMarchandise).toFixed(3)
          });
        } catch (err) {
          console.error('Error processing interpellation record:', err);
        }
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
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return months[monthNum - 1];
}

module.exports = router;
