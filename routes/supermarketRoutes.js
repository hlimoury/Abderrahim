// routes/supermarketRoutes.js
const express = require('express');
const router = express.Router();

const Supermarket = require('../models/Supermarket');
const EquipementSecurite = require('../models/EquipementSecurite');
const EquipementSurete = require('../models/EquipementSurete');
const Interpellation = require('../models/Interpellation');
const AccidentTravail = require('../models/AccidentTravail');
const AutreIncident = require('../models/AutreIncident');
const Formation = require('../models/formation');

// ---------------------
// Supermarket Routes
// ---------------------

// List all supermarkets
router.get('/', async (req, res) => {
  try {
    const supermarkets = await Supermarket.find({}).sort({ _id: -1 });
    res.render('index', { supermarkets });
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

// ---------------------
// Formation Routes
// ---------------------

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

// ---------------------
// Totals Route
// ---------------------

router.get('/totals', async (req, res) => {
  try {
    // Fetch all supermarkets
    const supermarkets = await Supermarket.find({});
    const totalSupermarkets = supermarkets.length;

    // Prepare grand totals
    let grandTotalInterpellations = 0;
    let grandTotalClients = 0;
    let grandTotalPersonnel = 0;
    let grandTotalPrestataire = 0;
    let grandTotalRecoveredValue = 0;
    let grandTotalFormations = 0;
    let grandTotalAccidents = 0;
    let grandTotalIncidents = 0;

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

      grandTotalInterpellations += totalInterpellations;
      grandTotalClients += clientsCount;
      grandTotalPersonnel += personnelCount;
      grandTotalPrestataire += prestataireCount;
      grandTotalRecoveredValue += recoveredValue;
      grandTotalFormations += totalFormations;
      grandTotalAccidents += totalAccidents;
      grandTotalIncidents += totalIncidents;

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

    res.render('totals', {
      supermarketTotals,
      totalSupermarkets,
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
    res.send("Erreur lors du calcul des totaux");
  }
});

module.exports = router;
