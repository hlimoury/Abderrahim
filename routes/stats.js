const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');

// Middleware to ensure user is admin
function ensureAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/adminlogin');
}

// GET /stats - Admin-only route
router.get('/stats', ensureAdmin, async (req, res) => {
  try {
    const supermarkets = await Supermarket.find({});
    
    // We'll accumulate overall totals here
    let globalTotals = {
      formation: 0,
      accidents: { count: 0, jours: 0 },
      incidents: 0,
      interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
    };

    // We'll also build a details array to show each supermarket's totals
    let details = [];

    // Loop through each supermarket
    for (const market of supermarkets) {
      // Totals for this single market
      let marketTotals = {
        formation: 0,
        accidents: { count: 0, jours: 0 },
        incidents: 0,
        interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
      };

      // Loop through each instance
      for (const instance of market.instances) {
        // Formation
        instance.formation.forEach(f => {
          marketTotals.formation += Number(f.nombrePersonnes);
        });

        // Accidents
        instance.accidents.forEach(a => {
          marketTotals.accidents.count += Number(a.nombreAccidents);
          marketTotals.accidents.jours += Number(a.joursArret);
        });

        // Incidents
        instance.incidents.forEach(i => {
          marketTotals.incidents += Number(i.nombreIncidents);
        });

        // Interpellations
        instance.interpellations.forEach(inter => {
          marketTotals.interpellations.personnes += Number(inter.nombrePersonnes);
          marketTotals.interpellations.poursuites += Number(inter.poursuites);
          marketTotals.interpellations.valeur += Number(inter.valeurMarchandise);
        });
      }

      // Add this market's totals to global totals
      globalTotals.formation += marketTotals.formation;
      globalTotals.accidents.count += marketTotals.accidents.count;
      globalTotals.accidents.jours += marketTotals.accidents.jours;
      globalTotals.incidents += marketTotals.incidents;
      globalTotals.interpellations.personnes += marketTotals.interpellations.personnes;
      globalTotals.interpellations.poursuites += marketTotals.interpellations.poursuites;
      globalTotals.interpellations.valeur += marketTotals.interpellations.valeur;

      // Push the detail object for rendering
      details.push({
        marketName: market.nom,
        marketTotals
      });
    }

    // Render stats page
    res.render('stats', { details, globalTotals });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
