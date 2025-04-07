const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');

// Middleware to check if user is logged in
const ensureLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
};

router.get('/', ensureLoggedIn, async (req, res) => {
  try {
    // Determine region filter based on user's session
    let regionFilter = {};
    const userRegion = req.session.region;
    
    if (userRegion && userRegion !== 'ALL') {
      regionFilter.ville = userRegion;
    }

    // Get markets based on region filter
    const supermarkets = await Supermarket.find(regionFilter).populate('instances');
    
    // Initialize totals
    let totals = {
      formation: 0,
      accidents: { count: 0, jours: 0 },
      incidents: 0,
      interpellations: {
        personnes: 0,
        poursuites: 0,
        valeur: 0,
        parType: {
          Client: { personnes: 0, poursuites: 0, valeur: 0 },
          Personnel: { personnes: 0, poursuites: 0, valeur: 0 },
          Prestataire: { personnes: 0, poursuites: 0, valeur: 0 }
        }
      }
    };

    // Initialize formation types
    let formationByType = {
      'Incendie': { total: 0 },
      'SST': { total: 0 },
      'Intégration': { total: 0 }
    };

    // Calculate totals
    supermarkets.forEach(supermarket => {
      supermarket.instances.forEach(instance => {
        // Formation totals
        instance.formation.forEach(f => {
          const count = Number(f.nombrePersonnes);
          totals.formation += count;
          
          // Add to formation type breakdown
          const type = f.type;
          if (formationByType[type]) {
            formationByType[type].total += count;
          }
        });

        // Accidents totals
        instance.accidents.forEach(a => {
          totals.accidents.count += Number(a.nombreAccidents);
          totals.accidents.jours += Number(a.joursArret);
        });

        // Incidents totals
        instance.incidents.forEach(i => {
          totals.incidents += Number(i.nombreIncidents);
        });

        // Interpellations totals
        instance.interpellations.forEach(inter => {
          const type = inter.typePersonne;
          
          // Overall interpellations
          totals.interpellations.personnes += Number(inter.nombrePersonnes);
          totals.interpellations.poursuites += Number(inter.poursuites);
          totals.interpellations.valeur += Number(inter.valeurMarchandise);

          // By type
          if (totals.interpellations.parType[type]) {
            totals.interpellations.parType[type].personnes += Number(inter.nombrePersonnes);
            totals.interpellations.parType[type].poursuites += Number(inter.poursuites);
            totals.interpellations.parType[type].valeur += Number(inter.valeurMarchandise);
          }
        });
      });
    });

    res.render('totals', {
      totals,
      formationByType, // Now included in the template data
      region: userRegion === 'ALL' ? 'Toutes les régions' : userRegion,
      currentUser: req.session.user
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;