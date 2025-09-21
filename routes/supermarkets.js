// supermarkets.js routes
const express = require('express');
const router = express.Router();
const Supermarket = require('../models/Supermarket');





function parseNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(',', '.'));
}
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
  const fromPage = req.query.fromPage || 1;

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
    totalObjAvg,
    fromPage
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
    
    // Pass fromPage directly instead of the req object
    res.render('supermarket', { 
      supermarket, 
      instances, 
      mois, 
      annee,
      fromPage,
      searchQuery
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});


// ======================
// Edit a Supermarket
// ======================

// GET: Render the edit form for a supermarket
router.get('/:id/editer', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');
  res.render('editerSupermarket', { supermarket });
});

// POST: Update the supermarket's data
router.post('/:id/editer', async (req, res) => {
  const { nom, region } = req.body; // region is sent from the form when applicable
  const supermarket = await Supermarket.findById(req.params.id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  supermarket.nom = nom;
  // If the logged-in user's region is "ALL" (main account), use the value submitted in the form.
  // Otherwise, force the region to the user's region stored in the session.
  if (req.session.region === 'ALL') {
    supermarket.ville = region;
  } else {
    supermarket.ville = req.session.region;
  }
  
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

// Update the route for adding a new instance in supermarkets.js

router.post('/:id/ajouter-instance', async (req, res) => {
  const { mois, annee } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);

  // Initialize with defaults
  let equipementsToCopy = {
    extincteurs: 0,
    ria: 0,
    portes: 0,
    issuesSecours: 0,
    skydomes: 0,
    cameras: 0,
    nvr: 0,
    ads: 0
  };

  let scoringToCopy = {
    securiteIncendie: [],
    sst: [],
    surete: [],
    global: []
  };

  if (supermarket.instances.length > 0) {
    // Find the most recent instance (you might want to sort by year/month)
    const lastInstance = supermarket.instances[supermarket.instances.length - 1];
    
    // Copy equipements from last instance
    if (lastInstance.equipements) {
      equipementsToCopy = { ...lastInstance.equipements };
    }
    
    // Copy scoring from last instance if it exists
    if (lastInstance.scoring) {
      // Deep copy the scoring to avoid reference issues
      scoringToCopy = {
        securiteIncendie: lastInstance.scoring.securiteIncendie ? 
          lastInstance.scoring.securiteIncendie.map(item => ({
            nom: item.nom,
            niveau: item.niveau,
            objectif: item.objectif
          })) : [],
        sst: lastInstance.scoring.sst ? 
          lastInstance.scoring.sst.map(item => ({
            nom: item.nom,
            niveau: item.niveau,
            objectif: item.objectif
          })) : [],
        surete: lastInstance.scoring.surete ? 
          lastInstance.scoring.surete.map(item => ({
            nom: item.nom,
            niveau: item.niveau,
            objectif: item.objectif
          })) : [],
        global: lastInstance.scoring.global ? 
          lastInstance.scoring.global.map(item => ({
            nom: item.nom,
            niveau: item.niveau,
            objectif: item.objectif
          })) : []
      };
    }
  }

  // Create the new instance with copied scoring and equipements
  supermarket.instances.push({
    mois,
    annee,
    formation: [],
    accidents: [],
    incidents: [],
    interpellations: [],
    reclamations: [], 
    equipements: equipementsToCopy,
    scoring: scoringToCopy  // Include the copied scoring
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
  const fromPage = req.query.fromPage || 1;
  res.render('formation', { supermarketId: req.params.id, instance, formation: instance.formation, fromPage });
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
  const fromPage = req.query.fromPage || 1;

  res.render('accident', {
    supermarketId: req.params.id,
    instance,
    accidents: instance.accidents,
    fromPage
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
  const fromPage = req.query.fromPage || 1;
  res.render('incident', {
    supermarketId: req.params.id,
    instance,
    incidents: instance.incidents,
    fromPage
  });
});


// Ajout d'un incident
router.post('/:id/instance/:instanceId/incidents/ajouter', async (req, res) => {
  const { nombreIncidents, typeIncident, sousTypeFeu, date, detail } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  
  // Ne stocker sousTypeFeu que si le type est "Départ de feu"
  const incidentData = { nombreIncidents, typeIncident, date, detail };
  if (typeIncident === 'Départ de feu' && sousTypeFeu) {
    incidentData.sousTypeFeu = sousTypeFeu;
  }
  
  instance.incidents.push(incidentData);
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
  const { nombreIncidents, typeIncident, sousTypeFeu, date, detail } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const incidentItem = instance.incidents.id(req.params.incidentId);

  incidentItem.nombreIncidents = nombreIncidents;
  incidentItem.typeIncident = typeIncident;
  
  // Gérer le sous-type de feu: ajouter si présent et applicable, ou supprimer si non applicable
  if (typeIncident === 'Départ de feu' && sousTypeFeu) {
    incidentItem.sousTypeFeu = sousTypeFeu;
  } else {
    // Supprimer le champ s'il n'est plus applicable
    incidentItem.sousTypeFeu = undefined;
  }
  
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
  const fromPage = req.query.fromPage || 1;
  res.render('interpellation', {
    supermarketId: req.params.id,
    instance,
    interpellations: instance.interpellations,
    fromPage
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
    valeurMarchandise: parseNumber(valeurMarchandise),  // Convert value with comma
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
  interItem.valeurMarchandise = parseNumber(valeurMarchandise); // Convert value with comma
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
  const fromPage = req.query.fromPage || 1;
  res.render('equipement', { supermarketId: req.params.id, instance, fromPage });
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

  instance.equipements = { 
    extincteurs: parseNumber(extincteurs),
    ria: parseNumber(ria),
    portes: parseNumber(portes),
    issuesSecours: parseNumber(issuesSecours),
    skydomes: parseNumber(skydomes),
    cameras: parseNumber(cameras),
    nvr: parseNumber(nvr),
    ads: parseNumber(ads)
  };

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/equipements`);
});

// Suppression de l'équipement (réinitialisation)
router.get('/:id/instance/:instanceId/equipements/supprimer', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  // Reset to default values (all set to zero)
  instance.equipements = { extincteurs: 0, ria: 0, portes: 0, issuesSecours: 0, skydomes: 0, cameras: 0, nvr: 0, ads: 0 };
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/equipements`);
});






/* ──────────────────────────────────────────────────────────
   RECLAMATIONS - FULL CRUD (REPLACES DRL ROUTES)
   ────────────────────────────────────────────────────────── */

// List reclamations for an instance
router.get('/:id/instance/:instanceId/reclamations', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const fromPage = req.query.fromPage || 1;
  res.render('reclamation', { supermarketId: req.params.id, instance, reclamations: instance.reclamations, fromPage });
});

// Add reclamation
router.post('/:id/instance/:instanceId/reclamations/ajouter', async (req, res) => {
  const { motif, designationProduit, dateHeure, action, statut } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);

  instance.reclamations.push({
    motif,
    designationProduit: designationProduit || '',
    dateHeure: dateHeure ? new Date(dateHeure) : new Date(),
    action: action || '',
    statut: statut || 'Non traité'
  });

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/reclamations`);
});

// Edit form
router.get('/:id/instance/:instanceId/reclamations/editer/:recId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const recItem = instance.reclamations.id(req.params.recId);
  res.render('editerReclamation', {
    supermarketId: req.params.id,
    instanceId: req.params.instanceId,
    recItem
  });
});

// Edit submit
router.post('/:id/instance/:instanceId/reclamations/editer/:recId', async (req, res) => {
  const { motif, designationProduit, dateHeure, action, statut } = req.body;
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  const recItem = instance.reclamations.id(req.params.recId);

  recItem.motif = motif;
  recItem.designationProduit = designationProduit || '';
  recItem.dateHeure = dateHeure ? new Date(dateHeure) : recItem.dateHeure;
  recItem.action = action || '';
  recItem.statut = statut || 'Non traité';

  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/reclamations`);
});

// Delete reclamation
router.get('/:id/instance/:instanceId/reclamations/supprimer/:recId', async (req, res) => {
  const supermarket = await Supermarket.findById(req.params.id);
  const instance = supermarket.instances.id(req.params.instanceId);
  instance.reclamations.pull({ _id: req.params.recId });
  await supermarket.save();
  res.redirect(`/supermarkets/${req.params.id}/instance/${req.params.instanceId}/reclamations`);
});




// Totaux pour toutes les instances d'un supermarché
router.get('/:id/instances/totaux', async (req, res) => {
  const { id } = req.params;
  const supermarket = await Supermarket.findById(id);
  if (!supermarket) return res.status(404).send('Supermarché introuvable');

  // Initialize totals for sections
  let totals = {
    formation: 0,
    accidents: { count: 0, jours: 0 },
    incidents: 0,
    interpellations: { personnes: 0, poursuites: 0, valeur: 0 }
  };

  // Object to hold interpellation totals grouped by type
  let interByType = {
    Client: { personnes: 0, poursuites: 0, valeur: 0 },
    Personnel: { personnes: 0, poursuites: 0, valeur: 0 },
    Prestataire: { personnes: 0, poursuites: 0, valeur: 0 }
  };

  // Iterate over each instance of the supermarket
  supermarket.instances.forEach(instance => {
    // Formation totals
    instance.formation.forEach(f => {
      totals.formation += Number(f.nombrePersonnes);
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
    
    // Interpellations totals and grouping by type
    instance.interpellations.forEach(inter => {
      totals.interpellations.personnes += Number(inter.nombrePersonnes);
      totals.interpellations.poursuites += Number(inter.poursuites);
      totals.interpellations.valeur += Number(inter.valeurMarchandise);

      // If the type matches one of our keys, add to group totals
      const type = inter.typePersonne;
      if (interByType[type]) {
        interByType[type].personnes += Number(inter.nombrePersonnes);
        interByType[type].poursuites += Number(inter.poursuites);
        interByType[type].valeur += Number(inter.valeurMarchandise);
      }
    });
  });
  
  res.render('instanceTotal', { supermarket, totals, interByType });
});






module.exports = router;
