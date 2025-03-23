const express     = require('express');
const router      = express.Router();
const Supermarket = require('../models/Supermarket');

router.get('/', async (req, res) => {
  const supermarkets = await Supermarket.find({});
  let totals = {
    formation: 0,
    accidents: { count: 0, jours: 0 },
    incidents: 0,
    interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
  };

  // Calcul des totaux sur toutes les instances
  supermarkets.forEach(supermarket => {
    supermarket.instances.forEach(instance => {
      instance.formation.forEach(f => totals.formation += Number(f.nombrePersonnes));
      instance.accidents.forEach(a => {
        totals.accidents.count += Number(a.nombreAccidents);
        totals.accidents.jours += Number(a.joursArret);
      });
      instance.incidents.forEach(i => totals.incidents += Number(i.nombreIncidents));
      instance.interpellations.forEach(inter => {
        totals.interpellations.personnes += Number(inter.nombrePersonnes);
        totals.interpellations.poursuites += Number(inter.poursuites);
        totals.interpellations.valeur += Number(inter.valeurMarchandise);
      });
    });
  });
  
  res.render('totals', { totals });
});

module.exports = router;
