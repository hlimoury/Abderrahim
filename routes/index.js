const express    = require('express');
const router     = express.Router();
const Supermarket = require('../models/Supermarket');

// Affichage de la liste des supermarchés
router.get('/', async (req, res) => {
  const supermarkets = await Supermarket.find({});
  res.render('index', { supermarkets });
});

// Formulaire pour ajouter un nouveau supermarché
router.get('/ajouter', (req, res) => {
  res.render('ajouterSupermarket');
});

router.post('/ajouter', async (req, res) => {
  const { nom } = req.body;
  const newMarket = new Supermarket({ nom });
  await newMarket.save();
  res.redirect('/');
});

module.exports = router;
