// routes/supermarketRoutes.js
const express = require('express');
const router = express.Router();

const Supermarket = require('../models/Supermarket');
const EquipementSecurite = require('../models/EquipementSecurite');
const EquipementSurete = require('../models/EquipementSurete');
const Interpellation = require('../models/Interpellation');
const AccidentTravail = require('../models/AccidentTravail');
const AutreIncident = require('../models/AutreIncident');
const Formation = require('../models/formation');  // Changed: capital F
const Scoring = require('../models/Scoring'); 

// ---------------------
// Supermarket Routes
// ---------------------

// List all supermarkets with search functionality
router.get('/', async (req, res) => {
  try {
    // Get search query from URL, default to empty string if not provided
    const search = req.query.search || "";
    let query = {};

    // If a search term is provided, perform a case-insensitive search on the name field
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const supermarkets = await Supermarket.find(query).sort({ _id: -1 });
    res.render('index', { supermarkets, search });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération des supermarchés");
  }
});

// Add a new supermarket (GET & POST)
router.get('/add', (req, res) => {
  res.render('addSupermarket');
});

router.post('/add', async (req, res) => {
  try {
    const { name, address, city, postalCode, phone } = req.body;
    await Supermarket.create({ name, address, city, postalCode, phone });
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'ajout du supermarché");
  }
});

// View a single supermarket (details)
// Also fetch related documents: equipment, interpellations, accidents, incidents, formations.
router.get('/supermarket/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const equipSec = await EquipementSecurite.findOne({ supermarket: id });
    const equipSurete = await EquipementSurete.findOne({ supermarket: id });
    const interpellations = await Interpellation.find({ supermarket: id }).sort({ dateInterpellation: -1 });
    const accidents = await AccidentTravail.find({ supermarket: id }).sort({ dateAccident: -1 });
    const incidents = await AutreIncident.find({ supermarket: id }).sort({ dateIncident: -1 });
    const formations = await Formation.find({ supermarket: id }).sort({ dateFormation: -1 });

    res.render('viewSupermarket', {
      supermarket,
      equipSec,
      equipSurete,
      interpellations,
      accidents,
      incidents,
      formations
    });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération du supermarché");
  }
});

// Edit supermarket
router.get('/supermarket/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");
    res.render('editSupermarket', { supermarket });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération du supermarché");
  }
});

router.post('/supermarket/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, city, postalCode, phone } = req.body;
    await Supermarket.findByIdAndUpdate(id, { name, address, city, postalCode, phone });
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour du supermarché");
  }
});

// Delete supermarket
router.post('/supermarket/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    await Supermarket.findByIdAndDelete(id);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la suppression du supermarché");
  }
});

// ---------------------
// Equipment Routes
// ---------------------

// Gérer Équipements de Sécurité
router.get('/supermarket/:id/securite', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const equipSec = await EquipementSecurite.findOne({ supermarket: id });
    res.render('manageEquipementSecurite', { supermarket, equipSec });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération de l'équipement de sécurité");
  }
});

router.post('/supermarket/:id/securite', async (req, res) => {
  try {
    const { id } = req.params;
    const { nbExtincteurs, nbRIA, nbPortesCoupeFeu, nbIssueSecours, nbSkydomes } = req.body;

    let equipSec = await EquipementSecurite.findOne({ supermarket: id });
    if (!equipSec) {
      equipSec = new EquipementSecurite({
        supermarket: id,
        nbExtincteurs,
        nbRIA,
        nbPortesCoupeFeu,
        nbIssueSecours,
        nbSkydomes
      });
    } else {
      equipSec.nbExtincteurs = nbExtincteurs;
      equipSec.nbRIA = nbRIA;
      equipSec.nbPortesCoupeFeu = nbPortesCoupeFeu;
      equipSec.nbIssueSecours = nbIssueSecours;
      equipSec.nbSkydomes = nbSkydomes;
    }
    await equipSec.save();
    res.redirect(`/supermarket/${id}`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour de l'équipement de sécurité");
  }
});

// Gérer Équipements de Sûreté
router.get('/supermarket/:id/surete', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const equipSurete = await EquipementSurete.findOne({ supermarket: id });
    res.render('manageEquipementSurete', { supermarket, equipSurete });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération de l'équipement de sûreté");
  }
});

router.post('/supermarket/:id/surete', async (req, res) => {
  try {
    const { id } = req.params;
    const { nbCameras, nbNvrDvr, nbAds } = req.body;

    let equipSurete = await EquipementSurete.findOne({ supermarket: id });
    if (!equipSurete) {
      equipSurete = new EquipementSurete({
        supermarket: id,
        nbCameras,
        nbNvrDvr,
        nbAds
      });
    } else {
      equipSurete.nbCameras = nbCameras;
      equipSurete.nbNvrDvr = nbNvrDvr;
      equipSurete.nbAds = nbAds;
    }
    await equipSurete.save();
    res.redirect(`/supermarket/${id}`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour de l'équipement de sûreté");
  }
});

// ---------------------
// Interpellation Routes
// ---------------------

// Display all interpellations and the add form
router.get('/supermarket/:id/interpellations', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const interpellations = await Interpellation.find({ supermarket: id }).sort({ dateInterpellation: -1 });
    res.render('manageInterpellations', { supermarket, interpellations });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération des interpellations");
  }
});

// Add a new interpellation
router.post('/supermarket/:id/interpellations', async (req, res) => {
  try {
    const { id } = req.params;
    const { typePersonne, nombrePersonnes, poursuitesJudiciaires, valeurMarchandiseRecuperee, rayonConcerne, dateInterpellation } = req.body;
    await Interpellation.create({
      supermarket: id,
      typePersonne,
      nombrePersonnes: parseInt(nombrePersonnes) || 1,
      poursuitesJudiciaires: parseInt(poursuitesJudiciaires) || 0,
      valeurMarchandiseRecuperee,
      rayonConcerne,
      dateInterpellation: dateInterpellation || new Date()
    });
    res.redirect(`/supermarket/${id}/interpellations`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'ajout d'une interpellation");
  }
});

// Edit interpellation page (GET)
router.get('/supermarket/:id/interpellations/:interId/edit', async (req, res) => {
  try {
    const { id, interId } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const interpellation = await Interpellation.findById(interId);
    if (!interpellation) return res.send("Interpellation introuvable");

    res.render('editInterpellation', { supermarket, interpellation });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération de l'interpellation");
  }
});

// Update interpellation (POST)
router.post('/supermarket/:id/interpellations/:interId/edit', async (req, res) => {
  try {
    const { id, interId } = req.params;
    const { typePersonne, nombrePersonnes, poursuitesJudiciaires, valeurMarchandiseRecuperee, rayonConcerne, dateInterpellation } = req.body;
    await Interpellation.findByIdAndUpdate(interId, {
      typePersonne,
      nombrePersonnes: parseInt(nombrePersonnes) || 1,
      poursuitesJudiciaires: parseInt(poursuitesJudiciaires) || 0,
      valeurMarchandiseRecuperee,
      rayonConcerne,
      dateInterpellation
    });
    res.redirect(`/supermarket/${id}/interpellations`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour de l'interpellation");
  }
});

// Delete interpellation
router.post('/supermarket/:id/interpellations/:interId/delete', async (req, res) => {
  try {
    const { id, interId } = req.params;
    await Interpellation.findByIdAndDelete(interId);
    res.redirect(`/supermarket/${id}/interpellations`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la suppression de l'interpellation");
  }
});

// ---------------------
// Accidents & Incidents Routes
// ---------------------

// Display accidents and incidents (and formations if needed)
router.get('/supermarket/:id/accidents', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");
    
    const accidents = await AccidentTravail.find({ supermarket: id }).sort({ dateAccident: -1 });
    const incidents = await AutreIncident.find({ supermarket: id }).sort({ dateIncident: -1 });
    const formations = await Formation.find({ supermarket: id }).sort({ dateFormation: -1 });
    
    res.render('manageAccidents', { supermarket, accidents, incidents, formations });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération des accidents/incidents/formations");
  }
});

// Add a new accident de travail
router.post('/supermarket/:id/accidents/travail', async (req, res) => {
  try {
    const { id } = req.params;
    const { numeroAccident, estDeclare, nombreJoursArret, cause, dateAccident } = req.body;
    await AccidentTravail.create({
      supermarket: id,
      numeroAccident: parseInt(numeroAccident) || 1,
      estDeclare: estDeclare === 'on',
      nombreJoursArret,
      cause,
      dateAccident: dateAccident || new Date()
    });
    res.redirect(`/supermarket/${id}/accidents`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'ajout d'un accident de travail");
  }
});

// Add a new autre incident
router.post('/supermarket/:id/accidents/incident', async (req, res) => {
  try {
    const { id } = req.params;
    const { numeroIncident, typeIncident, dateIncident, details } = req.body;
    await AutreIncident.create({
      supermarket: id,
      numeroIncident: parseInt(numeroIncident) || 1,
      typeIncident,
      dateIncident: dateIncident || new Date(),
      details
    });
    res.redirect(`/supermarket/${id}/accidents`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'ajout d'un autre incident");
  }
});

// Edit accident de travail (GET)
router.get('/supermarket/:id/accidents/travail/:accidentId/edit', async (req, res) => {
  try {
    const { id, accidentId } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const accident = await AccidentTravail.findById(accidentId);
    if (!accident) return res.send("Accident de travail introuvable");

    res.render('editAccidentTravail', { supermarket, accident });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération de l'accident de travail");
  }
});

// Update accident de travail (POST)
router.post('/supermarket/:id/accidents/travail/:accidentId/edit', async (req, res) => {
  try {
    const { id, accidentId } = req.params;
    const { numeroAccident, estDeclare, nombreJoursArret, cause, dateAccident } = req.body;
    await AccidentTravail.findByIdAndUpdate(accidentId, {
      numeroAccident: parseInt(numeroAccident) || 1,
      estDeclare: estDeclare === 'on',
      nombreJoursArret,
      cause,
      dateAccident
    });
    res.redirect(`/supermarket/${id}/accidents`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour de l'accident de travail");
  }
});

// Delete accident de travail
router.post('/supermarket/:id/accidents/travail/:accidentId/delete', async (req, res) => {
  try {
    const { id, accidentId } = req.params;
    await AccidentTravail.findByIdAndDelete(accidentId);
    res.redirect(`/supermarket/${id}/accidents`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la suppression de l'accident de travail");
  }
});

// Edit autre incident (GET)
router.get('/supermarket/:id/accidents/incident/:incidentId/edit', async (req, res) => {
  try {
    const { id, incidentId } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const incident = await AutreIncident.findById(incidentId);
    if (!incident) return res.send("Incident introuvable");

    res.render('editIncident', { supermarket, incident });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération de l'incident");
  }
});

// Update autre incident (POST)
router.post('/supermarket/:id/accidents/incident/:incidentId/edit', async (req, res) => {
  try {
    const { id, incidentId } = req.params;
    const { numeroIncident, typeIncident, dateIncident, details } = req.body;
    await AutreIncident.findByIdAndUpdate(incidentId, {
      numeroIncident: parseInt(numeroIncident) || 1,
      typeIncident,
      dateIncident,
      details
    });
    res.redirect(`/supermarket/${id}/accidents`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour de l'incident");
  }
});

// Delete autre incident
router.post('/supermarket/:id/accidents/incident/:incidentId/delete', async (req, res) => {
  try {
    const { id, incidentId } = req.params;
    await AutreIncident.findByIdAndDelete(incidentId);
    res.redirect(`/supermarket/${id}/accidents`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la suppression de l'incident");
  }
});

// Display all formations
router.get('/supermarket/:id/formations', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const formations = await Formation.find({ supermarket: id }).sort({ dateFormation: -1 });
    res.render('manageFormation', { supermarket, formations });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération des formations");
  }
});

// Add a new formation
router.post('/supermarket/:id/formations', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombreFormation, typeFormation, dateFormation } = req.body;
    await Formation.create({
      supermarket: id,
      nombreFormation: parseInt(nombreFormation) || 1,
      typeFormation,
      dateFormation: dateFormation || new Date()
    });
    res.redirect(`/supermarket/${id}/formations`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'ajout d'une formation");
  }
});

// Edit Formation page (GET)
router.get('/supermarket/:id/formations/:formationId/edit', async (req, res) => {
  try {
    const { id, formationId } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const formation = await Formation.findById(formationId);
    if (!formation) return res.send("Formation introuvable");

    res.render('editFormation', { supermarket, formation });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la récupération de la formation");
  }
});

// Update Formation (POST)
router.post('/supermarket/:id/formations/:formationId/edit', async (req, res) => {
  try {
    const { id, formationId } = req.params;
    const { nombreFormation, typeFormation, dateFormation } = req.body;
    await Formation.findByIdAndUpdate(formationId, {
      nombreFormation: parseInt(nombreFormation) || 1,
      typeFormation,
      dateFormation: dateFormation || new Date()
    });
    res.redirect(`/supermarket/${id}/formations`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour de la formation");
  }
});

// Delete formation
router.post('/supermarket/:id/formations/:formationId/delete', async (req, res) => {
  try {
    const { id, formationId } = req.params;
    await Formation.findByIdAndDelete(formationId);
    res.redirect(`/supermarket/${id}/formations`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la suppression de la formation");
  }
});


// ---------------------
// Totals Routes
// ---------------------

// Totaux par Magasin (per-store totals) with search functionality
router.get('/totals/supermarkets', async (req, res) => {
  try {
    // Read the search query (if any) from the URL query parameters
    const search = req.query.search || "";

    // Fetch all supermarkets
    const supermarkets = await Supermarket.find({});
    const totalSupermarkets = supermarkets.length;

    // Array for per-supermarket totals
    let supermarketTotals = [];

    for (let sm of supermarkets) {
      const interpellations = await Interpellation.find({ supermarket: sm._id });
      const formations = await Formation.find({ supermarket: sm._id });
      const accidents = await AccidentTravail.find({ supermarket: sm._id });
      const incidents = await AutreIncident.find({ supermarket: sm._id });

      const totalInterpellations = interpellations.length;
      let clientsCount = 0;
      let personnelCount = 0;
      let prestataireCount = 0;
      let recoveredValue = 0;

      for (let i of interpellations) {
        recoveredValue += i.valeurMarchandiseRecuperee;
        if (i.typePersonne === 'client') {
          clientsCount += i.nombrePersonnes;
        } else if (i.typePersonne === 'personnel') {
          personnelCount += i.nombrePersonnes;
        } else if (i.typePersonne === 'prestataire') {
          prestataireCount += i.nombrePersonnes;
        }
      }

      const totalFormations = formations.length;
      const totalAccidents = accidents.length;
      const totalIncidents = incidents.length;

      supermarketTotals.push({
        name: sm.name,
        totalInterpellations,
        clientsCount,
        personnelCount,
        prestataireCount,
        recoveredValue,
        totalFormations,
        totalAccidents,
        totalIncidents,
      });
    }

    // Filter the supermarketTotals by search term (if provided)
    let filteredSupermarketTotals = supermarketTotals;
    if (search) {
      filteredSupermarketTotals = supermarketTotals.filter(st =>
        st.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.render('totalsSupermarkets', {
      supermarketTotals: filteredSupermarketTotals,
      totalSupermarkets,
      search
    });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors du calcul des totaux par magasin");
  }
});

// Totaux Globaux (global totals)
router.get('/totals/global', async (req, res) => {
  try {
    // Fetch all supermarkets
    const supermarkets = await Supermarket.find({});

    let grandTotalInterpellations = 0;
    let grandTotalClients = 0;
    let grandTotalPersonnel = 0;
    let grandTotalPrestataire = 0;
    let grandTotalRecoveredValue = 0;
    let grandTotalFormations = 0;
    let grandTotalAccidents = 0;
    let grandTotalIncidents = 0;

    for (let sm of supermarkets) {
      const interpellations = await Interpellation.find({ supermarket: sm._id });
      const formations = await Formation.find({ supermarket: sm._id });
      const accidents = await AccidentTravail.find({ supermarket: sm._id });
      const incidents = await AutreIncident.find({ supermarket: sm._id });

      const totalInterpellations = interpellations.length;
      let clientsCount = 0;
      let personnelCount = 0;
      let prestataireCount = 0;
      let recoveredValue = 0;

      for (let i of interpellations) {
        recoveredValue += i.valeurMarchandiseRecuperee;
        if (i.typePersonne === 'client') {
          clientsCount += i.nombrePersonnes;
        } else if (i.typePersonne === 'personnel') {
          personnelCount += i.nombrePersonnes;
        } else if (i.typePersonne === 'prestataire') {
          prestataireCount += i.nombrePersonnes;
        }
      }

      grandTotalInterpellations += totalInterpellations;
      grandTotalClients += clientsCount;
      grandTotalPersonnel += personnelCount;
      grandTotalPrestataire += prestataireCount;
      grandTotalRecoveredValue += recoveredValue;
      grandTotalFormations += formations.length;
      grandTotalAccidents += accidents.length;
      grandTotalIncidents += incidents.length;
    }

    res.render('totalsGlobal', {
      grandTotalInterpellations,
      grandTotalClients,
      grandTotalPersonnel,
      grandTotalPrestataire,
      grandTotalRecoveredValue,
      grandTotalFormations,
      grandTotalAccidents,
      grandTotalIncidents,
    });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors du calcul des totaux globaux");
  }
});

// ---------------------
// Scoring Routes
// ---------------------

// Display the scoring page (averages for each section + global)
router.get('/supermarket/:id/scoring', async (req, res) => {
  try {
    const { id } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    // Fetch all scoring rows for this supermarket
    const allRows = await Scoring.find({ supermarketId: id });

    // Separate them by section
    const incendieRows = allRows.filter(r => r.sectionType === 'incendie');
    const sstRows = allRows.filter(r => r.sectionType === 'sst');
    const sureteRows = allRows.filter(r => r.sectionType === 'surete');

    // A helper to compute average of .niveau or .objectif in an array of rows
    function computeAverage(rows, field) {
      if (rows.length === 0) return 0; // avoid divide-by-zero
      const sum = rows.reduce((acc, r) => acc + r[field], 0);
      return sum / rows.length;
    }

    // 1) Per-section averages
    const incendieNiveau = computeAverage(incendieRows, 'niveau');
    const incendieObjectif = computeAverage(incendieRows, 'objectif');

    const sstNiveau = computeAverage(sstRows, 'niveau');
    const sstObjectif = computeAverage(sstRows, 'objectif');

    const sureteNiveau = computeAverage(sureteRows, 'niveau');
    const sureteObjectif = computeAverage(sureteRows, 'objectif');

    // 2) Global average across all sub-indicators
    const allCount = allRows.length;
    let globalNiveau = 0;
    let globalObjectif = 0;
    if (allCount > 0) {
      globalNiveau = allRows.reduce((acc, r) => acc + r.niveau, 0) / allCount;
      globalObjectif = allRows.reduce((acc, r) => acc + r.objectif, 0) / allCount;
    }

    res.render('scoring', {
      supermarket,
      // pass the sub-indicator rows for display
      incendieRows,
      sstRows,
      sureteRows,
      // pass each section's average
      incendieNiveau,
      incendieObjectif,
      sstNiveau,
      sstObjectif,
      sureteNiveau,
      sureteObjectif,
      // pass the global average
      globalNiveau,
      globalObjectif
    });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'affichage de la page scoring");
  }
});


// Add a new sub-indicator row
router.post('/supermarket/:id/scoring/add', async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionType, indicatorName, niveau, objectif } = req.body;

    await Scoring.create({
      supermarketId: id,
      sectionType,
      indicatorName,
      niveau: parseFloat(niveau) || 0,
      objectif: parseFloat(objectif) || 0
    });

    // Redirect back to the scoring page
    res.redirect(`/supermarket/${id}/scoring`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'ajout du scoring");
  }
});

// Show edit form for a specific scoring row
router.get('/supermarket/:id/scoring/:scoringId/edit', async (req, res) => {
  try {
    const { id, scoringId } = req.params;
    const supermarket = await Supermarket.findById(id);
    if (!supermarket) return res.send("Supermarché introuvable");

    const scoringRow = await Scoring.findById(scoringId);
    if (!scoringRow) return res.send("Scoring row introuvable");

    res.render('editScoring', { supermarket, scoringRow });
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de l'édition du scoring");
  }
});

// Update a scoring row
router.post('/supermarket/:id/scoring/:scoringId/edit', async (req, res) => {
  try {
    const { id, scoringId } = req.params;
    const { indicatorName, niveau, objectif } = req.body;

    await Scoring.findByIdAndUpdate(scoringId, {
      indicatorName,
      niveau: parseFloat(niveau) || 0,
      objectif: parseFloat(objectif) || 0
    });

    res.redirect(`/supermarket/${id}/scoring`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la mise à jour du scoring");
  }
});

// Delete a scoring row
router.post('/supermarket/:id/scoring/:scoringId/delete', async (req, res) => {
  try {
    const { id, scoringId } = req.params;
    await Scoring.findByIdAndDelete(scoringId);
    res.redirect(`/supermarket/${id}/scoring`);
  } catch (err) {
    console.error(err);
    res.send("Erreur lors de la suppression du scoring");
  }
});

module.exports = router;
