//routes : this is total.js(
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





// Ajoutez ces nouvelles routes après la route GET principale

/// Route pour les listes détaillées 
// Route pour les listes détaillées 
router.get('/details/:type', ensureLoggedIn, async (req, res) => {
  try {
    const type = req.params.type;
    const userRegion = req.session.region;
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 20; // 10 items per page
    const skip = (page - 1) * limit;
    
    // Search query parameter
    const searchQuery = req.query.q || '';
    
    // Filtrer par région
    let regionFilter = {};
    if (userRegion && userRegion !== 'ALL') {
      regionFilter.ville = userRegion;
    }
    
    // Add search functionality
    let searchFilter = {};
    if (searchQuery) {
      searchFilter = {
        $or: [
          { 'nom': { $regex: searchQuery, $options: 'i' } },
          { 'ville': { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }
    
    // Combine filters
    const finalFilter = { ...regionFilter, ...searchFilter };
    
    // Fetch supermarkets with populated instances
    const supermarkets = await Supermarket.find(finalFilter).populate('instances');
    
    // Collect all entries
    let allEntries = [];
    
    supermarkets.forEach(supermarket => {
      supermarket.instances.forEach(instance => {
        if (instance[type] && Array.isArray(instance[type])) {
          instance[type].forEach(entry => {
            allEntries.push({
              supermarket,
              instance,
              entry
            });
          });
        }
      });
    });
    
    // Total count for pagination
    const totalItems = allEntries.length;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Apply pagination
    const paginatedEntries = allEntries.slice(skip, skip + limit);
    
    res.render('detailsList', {
      type,
      entries: paginatedEntries,
      currentPage: page,
      totalPages: totalPages,
      q: searchQuery,
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
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});
// Route pour les détails d'une entrée spécifique
router.get('/details/:type/:supermarketId/:instanceId/:entryId', ensureLoggedIn, async (req, res) => {
  try {
    const { type, supermarketId, instanceId, entryId } = req.params;
    
    const supermarket = await Supermarket.findById(supermarketId);
    if (!supermarket) return res.status(404).send('Supermarché non trouvé');
    
    const instance = supermarket.instances.id(instanceId);
    if (!instance) return res.status(404).send('Instance non trouvée');
    
    const entry = instance[type].id(entryId);
    if (!entry) return res.status(404).send('Entrée non trouvée');

    res.render('entryDetails', {
      type,
      supermarket,
      instance,
      entry,
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
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;