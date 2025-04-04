const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');

// Middleware to ensure only admin can access
function ensureAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/adminlogin');
}

router.get('/stats', ensureAdmin, async (req, res) => {
  try {
    // Get search query from URL (if any)
    const searchQuery = req.query.search || '';
    
    // Retrieve all supermarkets
    const supermarkets = await Supermarket.find({});
    
    // Initialize global totals and interpellation totals by type
    let globalTotals = {
      formation: 0,
      accidents: { count: 0, jours: 0 },
      incidents: 0,
      interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
    };
    
    let interpellationByType = {
      Client: { personnes: 0, poursuites: 0, valeur: 0 },
      Personnel: { personnes: 0, poursuites: 0, valeur: 0 },
      Prestataire: { personnes: 0, poursuites: 0, valeur: 0 }
    };
    
    // Initialize formation by type and incidents by type
    let formationByType = {
      'Incendie': 0,
      'SST': 0,
      'Intégration': 0
    };
    
    let incidentByType = {
      'Départ de feu': 0,
      'Agression envers le personnel': 0,
      'Passage des autorités': 0,
      'Sinistre déclaré par un client': 0,
      'Acte de sécurisation': 0,
      'Autre': 0
    };
    
    // Build details for each market
    let details = [];
    
    for (const market of supermarkets) {
      // Initialize market-level totals
      let marketTotals = {
        formation: 0,
        accidents: { count: 0, jours: 0 },
        incidents: 0,
        interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
      };

      // Array to store instance-specific details for this market
      let instancesDetails = [];

      // Loop through each instance in the market
      for (const instance of market.instances) {
        // For each instance, calculate its totals:
        let instTotals = {
          formation: 0,
          accidents: { count: 0, jours: 0 },
          incidents: 0,
          interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
        };

        instance.formation.forEach(f => {
          instTotals.formation += Number(f.nombrePersonnes);
          // Also update formation by type
          const type = f.type;
          if (formationByType.hasOwnProperty(type)) {
            formationByType[type] += Number(f.nombrePersonnes);
          }
        });
        
        instance.accidents.forEach(a => {
          instTotals.accidents.count += Number(a.nombreAccidents);
          instTotals.accidents.jours += Number(a.joursArret);
        });
        
        instance.incidents.forEach(i => {
          instTotals.incidents += Number(i.nombreIncidents);
          // Also update incidents by type
          const type = i.typeIncident;
          if (incidentByType.hasOwnProperty(type)) {
            incidentByType[type] += Number(i.nombreIncidents);
          }
        });
        
        instance.interpellations.forEach(inter => {
          instTotals.interpellations.personnes += Number(inter.nombrePersonnes);
          instTotals.interpellations.poursuites += Number(inter.poursuites);
          instTotals.interpellations.valeur += Number(inter.valeurMarchandise);
        });
        
        // Add instance totals to market totals
        marketTotals.formation += instTotals.formation;
        marketTotals.accidents.count += instTotals.accidents.count;
        marketTotals.accidents.jours += instTotals.accidents.jours;
        marketTotals.incidents += instTotals.incidents;
        marketTotals.interpellations.personnes += instTotals.interpellations.personnes;
        marketTotals.interpellations.poursuites += instTotals.interpellations.poursuites;
        marketTotals.interpellations.valeur += instTotals.interpellations.valeur;

        // Also update global interpellation totals by type
        instance.interpellations.forEach(inter => {
          const type = inter.typePersonne;
          if (interpellationByType[type]) {
            interpellationByType[type].personnes += Number(inter.nombrePersonnes);
            interpellationByType[type].poursuites += Number(inter.poursuites);
            interpellationByType[type].valeur += Number(inter.valeurMarchandise);
          }
        });

        // Save instance-level details (include month, year, and totals)
        instancesDetails.push({
          mois: instance.mois,
          annee: instance.annee,
          totals: instTotals
        });
      }
      
      // Accumulate market totals to global totals
      globalTotals.formation += marketTotals.formation;
      globalTotals.accidents.count += marketTotals.accidents.count;
      globalTotals.accidents.jours += marketTotals.accidents.jours;
      globalTotals.incidents += marketTotals.incidents;
      globalTotals.interpellations.personnes += marketTotals.interpellations.personnes;
      globalTotals.interpellations.poursuites += marketTotals.interpellations.poursuites;
      globalTotals.interpellations.valeur += marketTotals.interpellations.valeur;
      
      // Push details for this market
      details.push({
        marketName: market.nom,
        marketVille: market.ville,
        marketTotals,
        instancesDetails
      });
    }
    
    // If a search query is provided, filter the details by market name or city (case-insensitive)
    if (searchQuery) {
      details = details.filter(d =>
        d.marketName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.marketVille.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Pagination for details: 10 markets per page
    const limit = 10;
    const currentPage = parseInt(req.query.page) || 1;
    const totalPages = Math.ceil(details.length / limit);
    const start = (currentPage - 1) * limit;
    const paginatedDetails = details.slice(start, start + limit);
    
    res.render('stats', { 
      details: paginatedDetails, 
      globalTotals, 
      interpellationByType,
      formationByType,
      incidentByType, 
      searchQuery, 
      currentPage, 
      totalPages 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
