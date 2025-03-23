const express    = require('express');
const router     = express.Router();
const Supermarket = require('../models/Supermarket');

// Affichage de la liste des supermarchés
// GET '/'
router.get('/', async (req, res) => {
  const searchQuery = req.query.search;
  let query = {};

  if (searchQuery) {
    query = {
      $or: [
        { nom: { $regex: searchQuery, $options: 'i' } },
        { ville: { $regex: searchQuery, $options: 'i' } }
      ]
    };
  }

  const supermarkets = await Supermarket.find(query);
  res.render('index', { supermarkets });
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
