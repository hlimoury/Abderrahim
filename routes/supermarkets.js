const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');


// ==========================
// SCORING ROUTES
// ==========================

// 1) Afficher la page de scoring
// GET scoring page
// GET scoring page
router.get('/:id/instance/:instanceId/scoring', async (req, res) => {
  const { id, instanceId } = req.params;
  const supermarket = await Supermarket.findById(id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  const instance = supermarket.instances.id(instanceId);
  if (!instance) return res.status(404).send('Instance introuvable');

  const {
    securiteIncendie = [],
    sst = [],
    surete = []
    // We skip 'global' if you no longer store that as a separate category
  } = instance.scoring || {};

  function averageValues(arr, field) {
    if (!arr.length) return 0;
    const sum = arr.reduce((acc, item) => acc + (parseFloat(item[field]) || 0), 0);
    return sum / arr.length;
  }

  // Averages per category
  const incNiveauAvg = averageValues(securiteIncendie, 'niveau');
  const incObjAvg    = averageValues(securiteIncendie, 'objectif');

  const sstNiveauAvg = averageValues(sst, 'niveau');
  const sstObjAvg    = averageValues(sst, 'objectif');

  const sureteNiveauAvg = averageValues(surete, 'niveau');
  const sureteObjAvg    = averageValues(surete, 'objectif');

  // Overall average across all items
  const combinedAll = [
    ...securiteIncendie,
    ...sst,
    ...surete
  ];
  const totalNiveauAvg = averageValues(combinedAll, 'niveau');
  const totalObjAvg    = averageValues(combinedAll, 'objectif');

  res.render('scoring', {
    supermarketId: id,
    instance,
    incNiveauAvg,
    incObjAvg,
    sstNiveauAvg,
    sstObjAvg,
    sureteNiveauAvg,
    sureteObjAvg,
    totalNiveauAvg,
    totalObjAvg
  });
});


// 2) Ajouter un sous-indicateur (POST)
router.post('/:id/instance/:instanceId/scoring/:category/ajouter', async (req, res) => {
  const { id, instanceId, category } = req.params;
  const { nom, niveau, objectif } = req.body;

  const supermarket = await Supermarket.findById(id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  const instance = supermarket.instances.id(instanceId);
  if (!instance) return res.status(404).send('Instance introuvable');

  // Initialize scoring if not defined
  if (!instance.scoring) {
    instance.scoring = {
      securiteIncendie: [],
      sst: [],
      surete: [],
      global: []
    };
  }

  if (!instance.scoring[category]) {
    return res.status(400).send('Catégorie invalide');
  }

  instance.scoring[category].push({ nom, niveau, objectif });
  await supermarket.save();
  res.redirect(`/supermarkets/${id}/instance/${instanceId}/scoring`);
});


// 3) Éditer un sous-indicateur (GET form)
router.get('/:id/instance/:instanceId/scoring/:category/editer/:scoreId', async (req, res) => {
  const { id, instanceId, category, scoreId } = req.params;
  const supermarket = await Supermarket.findById(id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  const instance = supermarket.instances.id(instanceId);
  if (!instance) return res.status(404).send('Instance introuvable');

  const scoringItem = instance.scoring[category].id(scoreId);
  if (!scoringItem) return res.status(404).send('Sous-indicateur introuvable');

  res.render('editerScoring', {
    supermarketId: id,
    instanceId,
    category,
    scoringItem
  });
});

// 4) Éditer un sous-indicateur (POST submit)
router.post('/:id/instance/:instanceId/scoring/:category/editer/:scoreId', async (req, res) => {
  const { id, instanceId, category, scoreId } = req.params;
  const { nom, niveau, objectif } = req.body;

  const supermarket = await Supermarket.findById(id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  const instance = supermarket.instances.id(instanceId);
  if (!instance) return res.status(404).send('Instance introuvable');

  const scoringItem = instance.scoring[category].id(scoreId);
  if (!scoringItem) return res.status(404).send('Sous-indicateur introuvable');

  // Update fields
  scoringItem.nom = nom;
  scoringItem.niveau = niveau;
  scoringItem.objectif = objectif;

  await supermarket.save();
  res.redirect(`/supermarkets/${id}/instance/${instanceId}/scoring`);
});

// 5) Supprimer un sous-indicateur
router.get('/:id/instance/:instanceId/scoring/:category/supprimer/:scoreId', async (req, res) => {
  const { id, instanceId, category, scoreId } = req.params;
  const supermarket = await Supermarket.findById(id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  const instance = supermarket.instances.id(instanceId);
  if (!instance) return res.status(404).send('Instance introuvable');

  instance.scoring[category].pull({ _id: scoreId });
  await supermarket.save();
  res.redirect(`/supermarkets/${id}/instance/${instanceId}/scoring`);
});




// ------------------------------
// Supermarket & Instance Routes
// ------------------------------

// Voir un supermarché et ses instances
router.get('/:id', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  res.render('supermarket', { supermarket });
});



// ======================
// Edit a Supermarket
// ======================

// GET: Edit form
router.get('/:id/editer', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');
  // Render the edit form
  res.render('editerSupermarket', { supermarket });
});

// POST: Save edited data
router.post('/:id/editer', async (req, res) => {
  const { nom } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  supermarket.nom = nom;
  await supermarket.save();

  res.redirect('/');
});

// ======================
// Delete a Supermarket
// ======================
// Delete route (GET)
router.get('/:id/supprimer', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  if (!supermarket) {
    return res.status(404).send('Supermarché introuvable');
  }

  // Instead of supermarket.remove(), use supermarket.deleteOne()
  await supermarket.deleteOne();
  // Or: await Supermarket.findByIdAndDelete(req.params.id);

  res.redirect('/');
});


// Formulaire pour ajouter une instance (mois/année)
router.get('/:id/ajouter-instance', (req, res) => {
  res.render('monthInstance', { supermarketId: req.params.id });
});

router.post('/:id/ajouter-instance', async (req, res) => {
  const { mois, annee } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  supermarket.instances.push({
    mois,
    annee,
    formation: [],
    accidents: [],
    incidents: [],
    interpellations: [],
    equipements: { extincteurs: 0, ria: 0, portes: 0, issuesSecours: 0, skydomes: 0, cameras: 0, nvr: 0, ads: 0 }
  });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}`);
});
// ----------------------------------------------------
// Edit an instance (GET form)
// ----------------------------------------------------
router.get('/:id/instance/editer/:instanceId', async (req, res) => {
  const { id, instanceId } = req.params;
  const supermarket = await Supermarket.findById(id);
  if (!supermarket) {
    return res.status(404).send('Supermarché introuvable');
  }

  const instance = supermarket.instances.id(instanceId);
  if (!instance) {
    return res.status(404).send('Instance introuvable');
  }

  // Render the edit form
  res.render('editerInstance', {
    supermarketId: id,
    instance
  });
});

// ----------------------------------------------------
// Edit an instance (POST submit)
// ----------------------------------------------------
router.post('/:id/instance/editer/:instanceId', async (req, res) => {
  const { id, instanceId } = req.params;
  const { mois, annee } = req.body;

  const supermarket = await Supermarket.findById(id);
  if (!supermarket) {
    return res.status(404).send('Supermarché introuvable');
  }

  const instance = supermarket.instances.id(instanceId);
  if (!instance) {
    return res.status(404).send('Instance introuvable');
  }

  // Update only mois and annee
  instance.mois = mois;
  instance.annee = annee;

  await supermarket.save();
  res.redirect(`/supermarkets/${id}`);
});

// ----------------------------------------------------
// Delete an instance
// ----------------------------------------------------
router.get('/:id/instance/supprimer/:instanceId', async (req, res) => {
  const { id, instanceId } = req.params;
  const supermarket = await Supermarket.findById(id);
  if (!supermarket) {
    return res.status(404).send('Supermarché introuvable');
  }

  // Remove the instance subdocument
  supermarket.instances.pull({ _id: instanceId });
  await supermarket.save();

  res.redirect(`/supermarkets/${id}`);
});

// ------------------------------
// Formation Routes (CRUD)
// ------------------------------

// Affichage des formations pour une instance
router.get('/:id/instance/:instanceId/formation', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  res.render('formation', { supermarketId: req.params.id, instance, formation: instance.formation });
});

// Ajout d’une formation
router.post('/:id/instance/:instanceId/formation/ajouter', async (req, res) => {
  const { nombrePersonnes, type } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  instance.formation.push({ nombrePersonnes, type });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/formation`);
});

// Edition d’une formation
router.get('/:id/instance/:instanceId/formation/editer/:formationId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const formationItem = instance.formation.id(req.params.formationId);
  res.render('editerFormation', { supermarketId: req.params.id, instanceId: req.params.instanceId, formationItem });
});

router.post('/:id/instance/:instanceId/formation/editer/:formationId', async (req, res) => {
  const { nombrePersonnes, type } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const formationItem = instance.formation.id(req.params.formationId);
  formationItem.nombrePersonnes = nombrePersonnes;
  formationItem.type = type;
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/formation`);
});

// Suppression d’une formation
router.get('/:id/instance/:instanceId/formation/supprimer/:formationId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  instance.formation.pull({ _id: req.params.formationId });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/formation`);
});

// ------------------------------
// Accidents de Travail Routes (CRUD)
// ------------------------------
// LIST all accidents
router.get('/:id/instance/:instanceId/accidents', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);

  res.render('accident', {
    supermarketId: req.params.id,
    instance,
    accidents: instance.accidents
  });
});

// CREATE new accident
router.post('/:id/instance/:instanceId/accidents/ajouter', async (req, res) => {
  const { nombreAccidents, joursArret, accidentDeclare, cause, date } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);

  instance.accidents.push({
    nombreAccidents,
    joursArret,
    accidentDeclare: (accidentDeclare === 'on'),
    cause,
    date
  });

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/accidents`);
});

// READ single accident (not strictly necessary if you have an edit form)
router.get('/:id/instance/:instanceId/accidents/:accidentId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const accidentItem = instance.accidents.id(req.params.accidentId);

  // Example: show a single accident detail
  res.json(accidentItem);
});

// EDIT accident (Form)
router.get('/:id/instance/:instanceId/accidents/editer/:accidentId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const accidentItem = instance.accidents.id(req.params.accidentId);

  res.render('editerAccident', {
    supermarketId: req.params.id,
    instanceId: req.params.instanceId,
    accidentItem
  });
});

// EDIT accident (Submit)
router.post('/:id/instance/:instanceId/accidents/editer/:accidentId', async (req, res) => {
  const { nombreAccidents, joursArret, accidentDeclare, cause, date } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const accidentItem = instance.accidents.id(req.params.accidentId);

  accidentItem.nombreAccidents = nombreAccidents;
  accidentItem.joursArret = joursArret;
  accidentItem.accidentDeclare = (accidentDeclare === 'on');
  accidentItem.cause = cause;
  accidentItem.date = date;

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/accidents`);
});

// DELETE accident
router.get('/:id/instance/:instanceId/accidents/supprimer/:accidentId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);

  instance.accidents.pull({ _id: req.params.accidentId });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/accidents`);
});
// ------------------------------
// Autres Incidents Routes (CRUD)
// ------------------------------

// ===============================
//   Incidents - FULL CRUD
// ===============================

// Affichage des incidents pour une instance
router.get('/:id/instance/:instanceId/incidents', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  res.render('incident', {
    supermarketId: req.params.id,
    instance,
    incidents: instance.incidents
  });
});

// Ajout d'un incident
router.post('/:id/instance/:instanceId/incidents/ajouter', async (req, res) => {
  const { nombreIncidents, typeIncident, date, detail } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  instance.incidents.push({ nombreIncidents, typeIncident, date, detail });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/incidents`);
});

// Formulaire d'édition d'un incident
router.get('/:id/instance/:instanceId/incidents/editer/:incidentId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const incidentItem = instance.incidents.id(req.params.incidentId);
  res.render('editerIncident', {
    supermarketId: req.params.id,
    instanceId: req.params.instanceId,
    incidentItem
  });
});

// Traitement de l'édition d'un incident
router.post('/:id/instance/:instanceId/incidents/editer/:incidentId', async (req, res) => {
  const { nombreIncidents, typeIncident, date, detail } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const incidentItem = instance.incidents.id(req.params.incidentId);

  incidentItem.nombreIncidents = nombreIncidents;
  incidentItem.typeIncident = typeIncident;
  incidentItem.date = date;
  incidentItem.detail = detail;

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/incidents`);
});

// Suppression d'un incident
router.get('/:id/instance/:instanceId/incidents/supprimer/:incidentId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  instance.incidents.pull({ _id: req.params.incidentId });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/incidents`);
});

// ----- INTERPELLATIONS -----

// List all interpellations
router.get('/:id/instance/:instanceId/interpellations', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  res.render('interpellation', {
    supermarketId: req.params.id,
    instance,
    interpellations: instance.interpellations,
  });
});

// Add interpellation
router.post('/:id/instance/:instanceId/interpellations/ajouter', async (req, res) => {
  const { typePersonne, nombrePersonnes, poursuites, valeurMarchandise, rayon, date } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);

  instance.interpellations.push({
    typePersonne,
    nombrePersonnes,
    poursuites,
    valeurMarchandise,
    rayon,
    date
  });

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/interpellations`);
});

// Éditer une interpellation (formulaire)
router.get('/:id/instance/:instanceId/interpellations/editer/:interId', async (req, res) => {
  try {
    const supermarket = await Supermarket.findById(req.params.id);
    if (!supermarket) {
      return res.status(404).send('Supermarché introuvable');
    }

    const instance = supermarket.instances.id(req.params.instanceId);
    if (!instance) {
      return res.status(404).send('Instance introuvable');
    }

    // Retrieve the specific interpellation subdocument
    const interpellationItem = instance.interpellations.id(req.params.interId);
    if (!interpellationItem) {
      return res.status(404).send('Interpellation introuvable');
    }

    // Pass interpellationItem to the view
    res.render('editerInterpellation', {
      supermarketId: req.params.id,
      instanceId: req.params.instanceId,
      interpellationItem
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur serveur');
  }
});


// Edit interpellation (POST)
router.post('/:id/instance/:instanceId/interpellations/editer/:interId', async (req, res) => {
  const { typePersonne, nombrePersonnes, poursuites, valeurMarchandise, rayon, date } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const interItem = instance.interpellations.id(req.params.interId);

  interItem.typePersonne = typePersonne;
  interItem.nombrePersonnes = nombrePersonnes;
  interItem.poursuites = poursuites;
  interItem.valeurMarchandise = valeurMarchandise;
  interItem.rayon = rayon;
  interItem.date = date;

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/interpellations`);
});

// Delete interpellation
router.get('/:id/instance/:instanceId/interpellations/supprimer/:interId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  instance.interpellations.pull({ _id: req.params.interId });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/interpellations`);
});

// ------------------------------
// Équipements de Sécurité et Sûreté Routes (CRUD)
// ------------------------------

// Affichage de l'équipement
router.get('/:id/instance/:instanceId/equipements', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  res.render('equipement', { supermarketId: req.params.id, instance });
});

// Formulaire d'édition de l'équipement
router.get('/:id/instance/:instanceId/equipements/editer', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  res.render('editerEquipement', { supermarketId: req.params.id, instance, equipement: instance.equipements });
});

// Traitement de la mise à jour de l'équipement
router.post('/:id/instance/:instanceId/equipements/editer', async (req, res) => {
  const { extincteurs, ria, portes, issuesSecours, skydomes, cameras, nvr, ads } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  instance.equipements = { extincteurs, ria, portes, issuesSecours, skydomes, cameras, nvr, ads };
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/equipements`);
});

// Suppression de l'équipement (réinitialisation)
router.get('/:id/instance/:instanceId/equipements/supprimer', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  // Reset to default values
  instance.equipements = { extincteurs: 0, ria: 0, portes: 0, issuesSecours: 0, skydomes: 0, cameras: 0, nvr: 0, ads: 0 };
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/equipements`);
});

module.exports = router;
