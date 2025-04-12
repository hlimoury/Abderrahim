// routes:index.js
const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');

// GET '/' - List supermarkets with search, region filter, and pagination
// In your index.js route file:

// GET '/' - List supermarkets with search, region filter, and pagination
router.get('/', async (req, res) => {
  try {
    // 1) Handle search query
    const searchQuery = req.query.search || '';
    let query = {};
    if (searchQuery) {
      query = {
        $or: [
          { nom: { $regex: searchQuery, $options: 'i' } },
          { ville: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    // 2) If user has a region set in session (and it's not "ALL"), filter by that region
    if (req.session.region && req.session.region !== 'ALL') {
      query.ville = req.session.region;
    }

    // 3) Pagination setup
    const limit = 10; // 10 markets per page
    const page = parseInt(req.query.page) || 1; // default page 1
    const skip = (page - 1) * limit;

    // 4) Count total documents matching the query
    const totalCount = await Supermarket.countDocuments(query);

    // 5) Retrieve markets for the current page
    const supermarkets = await Supermarket.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ _id: 1 }); // Optional sort

    // 6) Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Add the current page to the market links to remember it
    res.render('index', {
      supermarkets,  // Still named supermarkets in the route
      currentPage: page,
      totalPages,
      searchQuery
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

// In your supermarket.js route file:



// Form to add a new supermarket
router.get('/ajouter', (req, res) => {
  res.render('ajouterSupermarket');
});

router.post('/ajouter', async (req, res) => {
  const { nom } = req.body;
  // Use the logged-in user's region (stored in session) to auto-assign the market's region.
  const region = req.session.region || '';
  // Here we store the region in the "ville" field.
  const newMarket = new Supermarket({ nom, ville: region });
  await newMarket.save();
  res.redirect('/');
});

// Voir un supermarché et ses instances
router.get('/:id', async (req, res) => {
  try {
    const supermarket = await Supermarket.findById(req.params.id);
    if (!supermarket) return res.status(404).send('Supermarché introuvable');

    // Filter instances based on query parameters (mois and annee)
    const mois = req.query.mois;
    const annee = req.query.annee;
    const fromPage = req.query.fromPage || req.query.page || 1;
    const searchQuery = req.query.search || '';
    
    let instances = supermarket.instances;
    if (mois || annee) {
      instances = instances.filter(instance => {
        let match = true;
        if (mois) match = match && (instance.mois == mois);
        if (annee) match = match && (instance.annee == annee);
        return match;
      });
    }
    
    // Pass the request object to the template to access query parameters
    res.render('supermarket', { 
      supermarket, 
      instances, 
      mois, 
      annee,
      searchQuery,
      req
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});




module.exports = router;
