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
    
    // Get month/year filters from URL (if any)
    const filterMonth = req.query.filterMonth ? parseInt(req.query.filterMonth) : null;
    const filterYear = req.query.filterYear ? parseInt(req.query.filterYear) : null;
    
    // Retrieve all supermarkets
    const supermarkets = await Supermarket.find({});
    
    // Initialize global totals and interpellation totals by type
    let globalTotals = {
      formation: 0,
      accidents: { count: 0, jours: 0 },
      incidents: 0,
      interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
    };
    
    // Initialize totals by type with sources tracking
    let interpellationByType = {
      'Client': { personnes: 0, poursuites: 0, valeur: 0, sources: [] },
      'Personnel': { personnes: 0, poursuites: 0, valeur: 0, sources: [] },
      'Prestataire': { personnes: 0, poursuites: 0, valeur: 0, sources: [] }
    };
    
    // Initialize formation by type with sources
    let formationByType = {
      'Incendie': { total: 0, sources: [] },
      'SST': { total: 0, sources: [] },
      'Intégration': { total: 0, sources: [] }
    };
    
    // Initialize incident by type with sources
    let incidentByType = {
      'Départ de feu': { total: 0, sources: [] },
      'Agression envers le personnel': { total: 0, sources: [] },
      'Passage des autorités': { total: 0, sources: [] },
      'Sinistre déclaré par un client': { total: 0, sources: [] },
      'Acte de sécurisation': { total: 0, sources: [] },
      'Autre': { total: 0, sources: [] }
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
        // Apply month/year filters if provided
        if ((filterMonth && instance.mois !== filterMonth) || 
            (filterYear && instance.annee !== filterYear)) {
          continue; // Skip this instance if it doesn't match filters
        }
        
        // For each instance, calculate its totals:
        let instTotals = {
          formation: 0,
          accidents: { count: 0, jours: 0 },
          incidents: 0,
          interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
        };

        // Create a source identifier for this instance
        const sourceId = `${market.nom} (${market.ville}) - ${instance.mois}/${instance.annee}`;

        instance.formation.forEach(f => {
          instTotals.formation += Number(f.nombrePersonnes);
          // Only process if the instance passes the filter
          const type = f.type;
          if (formationByType.hasOwnProperty(type)) {
            formationByType[type].total += Number(f.nombrePersonnes);
            // Only add source if there's actual data
            if (Number(f.nombrePersonnes) > 0) {
              formationByType[type].sources.push({
                sourceId,
                count: Number(f.nombrePersonnes),
                date: `${instance.mois}/${instance.annee}`
              });
            }
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
            incidentByType[type].total += Number(i.nombreIncidents);
            // Only add source if there's actual data
            if (Number(i.nombreIncidents) > 0) {
              incidentByType[type].sources.push({
                sourceId,
                count: Number(i.nombreIncidents),
                date: `${instance.mois}/${instance.annee}`
              });
            }
          }
        });
        
        instance.interpellations.forEach(inter => {
          instTotals.interpellations.personnes += Number(inter.nombrePersonnes);
          instTotals.interpellations.poursuites += Number(inter.poursuites);
          instTotals.interpellations.valeur += Number(inter.valeurMarchandise);
          
          // Update global interpellation totals by type
          const type = inter.typePersonne;
          if (interpellationByType[type]) {
            interpellationByType[type].personnes += Number(inter.nombrePersonnes);
            interpellationByType[type].poursuites += Number(inter.poursuites);
            interpellationByType[type].valeur += Number(inter.valeurMarchandise);
            
            // Only add source if there's actual data
            if (Number(inter.nombrePersonnes) > 0) {
              interpellationByType[type].sources.push({
                sourceId,
                personnes: Number(inter.nombrePersonnes),
                poursuites: Number(inter.poursuites),
                valeur: Number(inter.valeurMarchandise),
                date: `${instance.mois}/${instance.annee}`
              });
            }
          }
        });
        
        // Add instance totals to market totals
        marketTotals.formation += instTotals.formation;
        marketTotals.accidents.count += instTotals.accidents.count;
        marketTotals.accidents.jours += instTotals.accidents.jours;
        marketTotals.incidents += instTotals.incidents;
        marketTotals.interpellations.personnes += instTotals.interpellations.personnes;
        marketTotals.interpellations.poursuites += instTotals.interpellations.poursuites;
        marketTotals.interpellations.valeur += instTotals.interpellations.valeur;

        // Save instance-level details
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
    
    // Clean up and sort sources for better presentation
    Object.keys(formationByType).forEach(type => {
      formationByType[type].sources.sort((a, b) => b.count - a.count);
      formationByType[type].sources = formationByType[type].sources.slice(0, 5); // Top 5 sources
    });
    
    Object.keys(incidentByType).forEach(type => {
      incidentByType[type].sources.sort((a, b) => b.count - a.count);
      incidentByType[type].sources = incidentByType[type].sources.slice(0, 5); // Top 5 sources
    });
    
    Object.keys(interpellationByType).forEach(type => {
      interpellationByType[type].sources.sort((a, b) => b.personnes - a.personnes);
      interpellationByType[type].sources = interpellationByType[type].sources.slice(0, 5); // Top 5 sources
    });
    
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
      filterMonth,
      filterYear,
      currentPage, 
      totalPages 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;