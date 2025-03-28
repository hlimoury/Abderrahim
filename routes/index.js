// routes/index.js (example)
const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');

// GET '/'
router.get('/', async (req, res) => {
  try {
    // 1) Handle search
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

    // 2) Pagination
    const limit = 10; // 10 markets per page
    const page = parseInt(req.query.page) || 1; // Current page (default 1)
    const skip = (page - 1) * limit;

    // 3) Count total documents (for total pages)
    const totalCount = await Supermarket.countDocuments(query);

    // 4) Retrieve documents for the current page
    const supermarkets = await Supermarket.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ _id: 1 }); // Optional sort

    // 5) Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    res.render('index', {
      supermarkets,
      currentPage: page,
      totalPages,
      searchQuery
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

// Formulaire pour ajouter un nouveau supermarché
router.get('/ajouter', (req, res) => {
  res.render('ajouterSupermarket');
});

router.post('/ajouter', async (req, res) => {
  const { nom, ville } = req.body;
  const newMarket = new Supermarket({ nom, ville });
  await newMarket.save();
  res.redirect('/');
});

module.exports = router;
