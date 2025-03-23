const express     = require('express');
const router      = express.Router();
const Supermarket = require('../models/Supermarket');

router.get('/', async (req, res) => {
  const supermarkets = await Supermarket.find({});
  let totals = {
    formation: 0,
    accidents: { count: 0, jours: 0 },
    incidents: 0,
    // We'll still calculate overall interpellations if needed
    interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
  };

  // Object to hold totals by type of person
  let interpellationByType = {
    Client: { personnes: 0, poursuites: 0, valeur: 0 },
    Personnel: { personnes: 0, poursuites: 0, valeur: 0 },
    Prestataire: { personnes: 0, poursuites: 0, valeur: 0 }
  };

  // Calculate totals over all supermarkets and all instances
  supermarkets.forEach(supermarket => {
    supermarket.instances.forEach(instance => {
      // Formation totals
      instance.formation.forEach(f => totals.formation += Number(f.nombrePersonnes));
      
      // Accidents totals
      instance.accidents.forEach(a => {
        totals.accidents.count += Number(a.nombreAccidents);
        totals.accidents.jours += Number(a.joursArret);
      });

      // Incidents totals
      instance.incidents.forEach(i => totals.incidents += Number(i.nombreIncidents));

      // Interpellations overall
      instance.interpellations.forEach(inter => {
        totals.interpellations.personnes += Number(inter.nombrePersonnes);
        totals.interpellations.poursuites += Number(inter.poursuites);
        totals.interpellations.valeur += Number(inter.valeurMarchandise);
        
        // Group by type (ensure matching case)
        const type = inter.typePersonne;
        if(interpellationByType[type]){
          interpellationByType[type].personnes += Number(inter.nombrePersonnes);
          interpellationByType[type].poursuites += Number(inter.poursuites);
          interpellationByType[type].valeur += Number(inter.valeurMarchandise);
        }
      });
    });
  });
  
  res.render('totals', { totals, interpellationByType });
});

module.exports = router;
