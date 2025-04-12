const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');
const ArchivedReport = require('../models/ArchivedReport');
const path = require('path');

// Middleware to ensure only admin can access
function ensureAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/adminlogin');
}






router.get('/admin/archived', ensureAdmin, async (req, res) => {
  try {
    const archivedReports = await ArchivedReport.find({}).sort({ createdAt: -1 });

    // Add a basename property so the template can reference it
    const enriched = archivedReports.map(report => {
      const base = path.basename(report.filePath || '');
      return {
        ...report.toObject(),
        basename: base
      };
    });

    res.render('adminArchivedReports', { archivedReports: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});






router.get('/stats', ensureAdmin, async (req, res) => {
  try {
    // Get search parameters
    const searchParams = {
      nom: req.query.nom || '',
      ville: req.query.ville || '',
      mois: req.query.mois ? parseInt(req.query.mois) : null,
      annee: req.query.annee ? parseInt(req.query.annee) : null
    };

    // Retrieve all supermarkets
    const supermarkets = await Supermarket.find({});

    // Initialize global totals
    let globalTotals = {
      formation: 0,
      accidents: { count: 0, jours: 0 },
      incidents: 0,
      interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
    };

    // Initialize categorized data
    let interpellationByType = {
      'Client': { personnes: 0, poursuites: 0, valeur: 0 },
      'Personnel': { personnes: 0, poursuites: 0, valeur: 0 },
      'Prestataire': { personnes: 0, poursuites: 0, valeur: 0 }
    };

    let formationByType = {
      'Incendie': { total: 0 },
      'SST': { total: 0 },
      'Intégration': { total: 0 }
    };

    let incidentByType = {
      'Départ de feu': { total: 0 },
      'Agression envers le personnel': { total: 0 },
      'Passage des autorités': { total: 0 },
      'Sinistre déclaré par un client': { total: 0 },
      'Acte de sécurisation': { total: 0 },
      'Autre': { total: 0 }
    };

    // Process market data
    let filteredMarkets = [];

    for (const market of supermarkets) {
      // Check name and city filters
      if (
        (searchParams.nom && !market.nom.toLowerCase().includes(searchParams.nom.toLowerCase())) ||
        (searchParams.ville && !market.ville.toLowerCase().includes(searchParams.ville.toLowerCase()))
      ) {
        continue;
      }

      let marketTotals = {
        formation: 0,
        accidents: { count: 0, jours: 0 },
        incidents: 0,
        interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
      };

      // Process instances
      for (const instance of market.instances) {
        // Apply month/year filters
        if (
          (searchParams.mois && instance.mois !== searchParams.mois) ||
          (searchParams.annee && instance.annee !== searchParams.annee)
        ) {
          continue;
        }

        // Process formations
        instance.formation.forEach(f => {
          const count = Number(f.nombrePersonnes);
          marketTotals.formation += count;
          globalTotals.formation += count;
          
          if (formationByType[f.type]) {
            formationByType[f.type].total += count;
          }
        });

        // Process accidents
        instance.accidents.forEach(a => {
          marketTotals.accidents.count += Number(a.nombreAccidents);
          marketTotals.accidents.jours += Number(a.joursArret);
          
          globalTotals.accidents.count += Number(a.nombreAccidents);
          globalTotals.accidents.jours += Number(a.joursArret);
        });

        // Process incidents
        instance.incidents.forEach(i => {
          const count = Number(i.nombreIncidents);
          marketTotals.incidents += count;
          globalTotals.incidents += count;

          if (incidentByType[i.typeIncident]) {
            incidentByType[i.typeIncident].total += count;
          }
        });

        // Process interpellations
        instance.interpellations.forEach(inter => {
          const type = inter.typePersonne;
          if (interpellationByType[type]) {
            const personnes = Number(inter.nombrePersonnes);
            const poursuites = Number(inter.poursuites);
            const valeur = Number(inter.valeurMarchandise);

            marketTotals.interpellations.personnes += personnes;
            marketTotals.interpellations.poursuites += poursuites;
            marketTotals.interpellations.valeur += valeur;

            interpellationByType[type].personnes += personnes;
            interpellationByType[type].poursuites += poursuites;
            interpellationByType[type].valeur += valeur;

            globalTotals.interpellations.personnes += personnes;
            globalTotals.interpellations.poursuites += poursuites;
            globalTotals.interpellations.valeur += valeur;
          }
        });
      }

      filteredMarkets.push({
        marketName: market.nom,
        marketVille: market.ville,
        marketTotals
      });
    }

    // Prepare response
    res.render('stats', {
      details: filteredMarkets,
      globalTotals,
      interpellationByType,
      formationByType,
      incidentByType,
      searchParams,
      hasFilters: !!searchParams.nom || !!searchParams.ville || !!searchParams.mois || !!searchParams.annee
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});




// API endpoint for AJAX search
router.get('/api/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    
    // Skip search if query is too short
    if (query.length < 2) {
      return res.json([]);
    }
    
    // Search for supermarkets with matching name or city
    const results = await Supermarket.find({
      $or: [
        { nom: { $regex: query, $options: 'i' } },
        { ville: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);
    
    // Format results for display
    const formattedResults = results.map(market => {
      // Calculate total instances count (optional)
      const count = market.instances ? market.instances.length : 0;
      
      return {
        nom: market.nom,
        ville: market.ville,
        count: count,
        // You could also add an image URL if you have one
        image: null
      };
    });
    
    res.json(formattedResults);
  } catch (err) {
    console.error('Search API error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});






router.get('/admin/archived', ensureAdmin, async (req, res) => {
  try {
    const archivedReports = await ArchivedReport.find().sort({ createdAt: -1 });
    res.render('adminArchivedReports', { archivedReports });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur lors du chargement des rapports archivés');
  }
});

router.post('/admin/archived/:id/delete', ensureAdmin, async (req, res) => {
  try {
    const reportId = req.params.id;

    // 1) Find the archived report
    const archived = await ArchivedReport.findById(reportId);
    if (!archived) {
      return res.status(404).send('Rapport introuvable');
    }

    // 2) Delete the physical PDF file from disk
    const fs = require('fs');
    if (fs.existsSync(archived.filePath)) {
      fs.unlinkSync(archived.filePath);
    }

    // 3) Remove from DB (replace old `archived.remove()`):
    await archived.deleteOne();

    // 4) Redirect or respond
    res.redirect('/admin/archived');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur lors de la suppression du rapport archivé');
  }
});




// Serve PDF from /mnt/data to an admin at /admin/pdf/:filename
router.get('/admin/pdf/:filename', ensureAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    
    // Construct full absolute path in /mnt/data
    const filePath = path.join('/mnt/data', filename);

    // Make sure the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier PDF introuvable');
    }

    // Option A: Stream the file inline (browser will try to open it)
    // res.sendFile(filePath);
    
    // Option B: Force download prompt
    res.download(filePath);

  } catch (err) {
    console.error('Error serving PDF to admin:', err);
    res.status(500).send('Erreur lors de l\'accès au PDF');
  }
});








module.exports = router;