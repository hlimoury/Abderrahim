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
    
    // Build details for each market
    let details = [];
    
    for (const market of supermarkets) {
      let marketTotals = {
        formation: 0,
        accidents: { count: 0, jours: 0 },
        incidents: 0,
        interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
      };
      
      // For each instance in the market, sum up totals
      for (const instance of market.instances) {
        instance.formation.forEach(f => marketTotals.formation += Number(f.nombrePersonnes));
        instance.accidents.forEach(a => {
          marketTotals.accidents.count += Number(a.nombreAccidents);
          marketTotals.accidents.jours += Number(a.joursArret);
        });
        instance.incidents.forEach(i => marketTotals.incidents += Number(i.nombreIncidents));
        instance.interpellations.forEach(inter => {
          marketTotals.interpellations.personnes += Number(inter.nombrePersonnes);
          marketTotals.interpellations.poursuites += Number(inter.poursuites);
          marketTotals.interpellations.valeur += Number(inter.valeurMarchandise);
          
          // Also update global totals by type
          const type = inter.typePersonne;
          if (interpellationByType[type]) {
            interpellationByType[type].personnes += Number(inter.nombrePersonnes);
            interpellationByType[type].poursuites += Number(inter.poursuites);
            interpellationByType[type].valeur += Number(inter.valeurMarchandise);
          }
        });
      }
      
      // Accumulate to global totals
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
        marketTotals
      });
    }
    
    // If a search query is provided, filter the details by market name or city (case-insensitive)
    if (searchQuery) {
      details = details.filter(d =>
        d.marketName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.marketVille.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    res.render('stats', { details, globalTotals, interpellationByType, searchQuery });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
