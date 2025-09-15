/* routes/stats.js */
const express  = require('express');
const router   = express.Router();
const Supermarket = require('../models/Supermarket');
const ArchivedReport = require('../models/ArchivedReport');
const path     = require('path');
const fs       = require('fs');

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */
function ensureAdmin (req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/adminlogin');
}

function getMonthName (m) {
  const months = [ 'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
                   'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.' ];
  return months[m-1];
}
function getAdminRegionFilter(req) {
  if (!req.session || !req.session.isAdmin) return {};
  const allowed = req.session.adminRegions;
  if (!allowed || allowed === 'ALL') return {};
  if (Array.isArray(allowed)) return { ville: { $in: allowed } };
  return {};
}

/* ──────────────────────────────────────────────────────────
   ARCHIVES (inchangé)
   ────────────────────────────────────────────────────────── */
router.get('/admin/archived', ensureAdmin, async (req,res)=>{
  try {
    const list = await ArchivedReport.find({}).sort({createdAt:-1});
    const enriched = list.map(r=>({ ...r.toObject(),
                                    basename: path.basename(r.filePath||'') }));
    res.render('adminArchivedReports',{ archivedReports: enriched });
  } catch(err){ console.error(err); res.status(500).send('Erreur serveur');}
});

/* ──────────────────────────────────────────────────────────
   STATS DASHBOARD
   ────────────────────────────────────────────────────────── */
router.get('/stats', ensureAdmin, async (req,res)=>{
  try{
    /* ── 1. Filtres de recherche ── */
    const searchParams = {
      nom   : req.query.nom   || '',
      ville : req.query.ville || '',
      mois  : req.query.mois  ? parseInt(req.query.mois)  : null,
      annee : req.query.annee ? parseInt(req.query.annee) : null
    };

    /* ── 2. Chargement des magasins ── */
    const adminFilter = getAdminRegionFilter(req); // {} or { ville: { $in: [...] } }
    const supermarkets = await Supermarket.find(adminFilter);
    

    /* ── 3. Accumulateurs globaux ── */
    const globalTotals = {
      formation      : 0,
      accidents      : { count:0, jours:0 },
      incidents      : 0,
      interpellations: { personnes:0, poursuites:0, valeur:0 }
    };

    const interpellationByType = {
      Client     : { personnes:0, poursuites:0, valeur:0 },
      Personnel  : { personnes:0, poursuites:0, valeur:0 },
      Prestataire: { personnes:0, poursuites:0, valeur:0 }
    };

    const formationByType = { Incendie:{total:0}, SST:{total:0}, Intégration:{total:0} };

    const incidentByType  = {
      'Départ de feu':{total:0}, 'Agression envers le personnel':{total:0},
      'Passage des autorités':{total:0}, 'Sinistre déclaré par un client':{total:0},
      'Acte de sécurisation':{total:0}, Autre:{total:0}
    };

    const filteredMarkets = [];

    /* ── 4. Boucle Supermarchés ── */
    for (const market of supermarkets) {

      /* → Filtres nom / ville */
      if ((searchParams.nom   && !market.nom.toLowerCase().includes(searchParams.nom.toLowerCase())) ||
          (searchParams.ville && !market.ville.toLowerCase().includes(searchParams.ville.toLowerCase())))
        continue;

      const marketTotals = {
        formation:0,
        accidents:{count:0, jours:0},
        incidents:0,
        interpellations:{ personnes:0, poursuites:0, valeur:0 }
      };

      /* tableau pour stocker stats instance */
      const instanceStats = [];

      /* → Boucle instances */
      market.instances.forEach(instance=>{
        /* filtre mois / année */
        if ((searchParams.mois  && instance.mois  !== searchParams.mois) ||
            (searchParams.annee && instance.annee !== searchParams.annee))
          return;

        /* Comptage section par instance */
        const instCounts = {
          formation       : 0,
          accidents       : 0,
          incidents       : 0,
          interpellations : 0,
          drl             : instance.drl ? instance.drl.length : 0
        };

        /* formation */
        instance.formation.forEach(f=>{
          const n = Number(f.nombrePersonnes)||0;
          instCounts.formation += n;
          marketTotals.formation += n;
          globalTotals.formation += n;
          if (formationByType[f.type]) formationByType[f.type].total += n;
        });

        /* accidents */
        instance.accidents.forEach(a=>{
          const n = Number(a.nombreAccidents)||0;
          const j = Number(a.joursArret)||0;
          instCounts.accidents += n;
          marketTotals.accidents.count += n;
          marketTotals.accidents.jours += j;
          globalTotals.accidents.count += n;
          globalTotals.accidents.jours += j;
        });

        /* incidents */
        instance.incidents.forEach(i=>{
          const n = Number(i.nombreIncidents)||0;
          instCounts.incidents += n;
          marketTotals.incidents += n;
          globalTotals.incidents += n;
          if (incidentByType[i.typeIncident]) incidentByType[i.typeIncident].total += n;
        });

        /* interpellations */
        instance.interpellations.forEach(inter=>{
          const type = inter.typePersonne;
          const p  = Number(inter.nombrePersonnes)||0;
          const pj = Number(inter.poursuites)||0;
          const v  = Number(inter.valeurMarchandise)||0;
          instCounts.interpellations += p;
          marketTotals.interpellations.personnes += p;
          marketTotals.interpellations.poursuites += pj;
          marketTotals.interpellations.valeur     += v;
          globalTotals.interpellations.personnes += p;
          globalTotals.interpellations.poursuites += pj;
          globalTotals.interpellations.valeur     += v;
          if (interpellationByType[type]){
            interpellationByType[type].personnes += p;
            interpellationByType[type].poursuites += pj;
            interpellationByType[type].valeur     += v;
          }
        });

        /* Push dans tableau instanceStats */
        instanceStats.push({
          id           : instance._id,
          mois         : instance.mois,
          annee        : instance.annee,
          moisName     : getMonthName(instance.mois),
          counts       : instCounts
        });
      });

      /* Push market */
      filteredMarkets.push({
        id           : market._id,
        marketName   : market.nom,
        marketVille  : market.ville,
        marketTotals,
        instances    : instanceStats           // <── nouveau
      });
    }

/* ─────────  PAGINATION  ───────── */
const limit      = 10;                                    // 10 magasins / page
const current    = parseInt(req.query.page) || 1;         // page actuelle
const totalItems = filteredMarkets.length;
const totalPages = Math.max(1, Math.ceil(totalItems / limit));

const paginated = filteredMarkets.slice((current - 1) * limit,
                                        current * limit);





 
/* GET /api/search
   ------------------------------------------------------------------ */
   router.get('/api/search', async (req, res) => {
    try {
      const query = (req.query.query || '').trim();
      if (!query) return res.json([]);
  
      const adminFilter = getAdminRegionFilter(req);
      const regex = new RegExp('^' + query, 'i');
  
      const results = await Supermarket.find({
        ...adminFilter,
        $or: [ { nom: { $regex: regex } },
               { ville: { $regex: regex } } ]
      }).limit(10);
  
      const formatted = results.map(m => ({
        id: m._id,
        nom: m.nom,
        ville: m.ville,
        count: (m.instances || []).length
      }));
  
      res.json(formatted);
    } catch (err) {
      console.error('Search API error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  });
  
  



    /* ── 5. Render ── */
    res.render('stats',{
      details           : filteredMarkets,
      globalTotals,
      interpellationByType,
      formationByType,
      incidentByType,
      searchParams,
      hasFilters : Boolean(searchParams.nom||searchParams.ville||
                           searchParams.mois||searchParams.annee)
    });

  }catch(err){
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});

// Suppression archive
router.post('/admin/archived/:id/delete', ensureAdmin, async (req, res) => {
  try {
    const arch = await ArchivedReport.findById(req.params.id);
    if (!arch) return res.status(404).send('Introuvable');
    if (fs.existsSync(arch.filePath)) fs.unlinkSync(arch.filePath);
    await arch.deleteOne();
    res.redirect('/admin/archived');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur suppression');
  }
});

// Téléchargement PDF par ID
router.get('/admin/pdf/:id', ensureAdmin, async (req, res) => {
  try {
    const arch = await ArchivedReport.findById(req.params.id);
    if (!arch || !fs.existsSync(arch.filePath)) {
      return res.status(404).send('PDF introuvable');
    }
    res.download(arch.filePath, path.basename(arch.filePath));
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur téléchargement');
  }
});





module.exports = router;
