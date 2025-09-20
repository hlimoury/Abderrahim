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


/* ──────────────────────────────────────────────────────────
   CATEGORY DETAILS DASHBOARD
   URL: /stats/category/:category
   :category ∈ ['formation','accidents','incidents','interpellations']
   ────────────────────────────────────────────────────────── */
   router.get('/stats/category/:category', ensureAdmin, async (req, res) => {
    try {
      const category = (req.params.category || '').toLowerCase();
      const allowed = ['formation', 'accidents', 'incidents', 'interpellations'];
      if (!allowed.includes(category)) return res.status(400).send('Catégorie invalide');
  
      const categoryLabel = {
        formation: 'Formation',
        accidents: 'Accidents',
        incidents: 'Incidents',
        interpellations: 'Interpellations'
      }[category];
  
      // 1) Filters
      const searchParams = {
        nom   : req.query.nom   || '',
        ville : req.query.ville || '',
        mois  : req.query.mois  ? parseInt(req.query.mois)  : null,
        annee : req.query.annee ? parseInt(req.query.annee) : null
      };
  
      // 2) Load markets with admin scope
      const adminFilter = getAdminRegionFilter(req); // {} or { ville: { $in: [...] } }
      const supermarkets = await Supermarket.find(adminFilter);
  
      // 3) Aggregate per market (respecting filters)
      const rows = [];
      const totalsAll = {
        // formation
        formationTotal: 0,
        formationByType: { Incendie:0, SST:0, Intégration:0 },
  
        // accidents
        accidentsCount: 0,
        accidentsJours: 0,
  
        // incidents
        incidentsTotal: 0,
        incidentByType: {
          'Départ de feu':0, 'Agression envers le personnel':0,
          'Passage des autorités':0, 'Sinistre déclaré par un client':0,
          'Acte de sécurisation':0, 'Autre':0
        },
  
        // interpellations
        interPersonnes: 0,
        interPoursuites: 0,
        interValeur: 0,
        interByType: {
          Client:{personnes:0,poursuites:0,valeur:0},
          Personnel:{personnes:0,poursuites:0,valeur:0},
          Prestataire:{personnes:0,poursuites:0,valeur:0}
        }
      };
  
      for (const m of supermarkets) {
        // name/ville filter
        if (searchParams.nom && !m.nom.toLowerCase().includes(searchParams.nom.toLowerCase())) continue;
        if (searchParams.ville && !m.ville.toLowerCase().includes(searchParams.ville.toLowerCase())) continue;
  
        // per-market accumulators
        const per = {
          id: m._id.toString(),
          nom: m.nom,
          ville: m.ville,
  
          // formation
          fTotal: 0,
          fTypes: { Incendie:0, SST:0, Intégration:0 },
  
          // accidents
          aCount: 0,
          aJours: 0,
  
          // incidents
          iTotal: 0,
          iTypes: {
            'Départ de feu':0, 'Agression envers le personnel':0,
            'Passage des autorités':0, 'Sinistre déclaré par un client':0,
            'Acte de sécurisation':0, 'Autre':0
          },
  
          // interpellations
          itPersonnes: 0,
          itPoursuites: 0,
          itValeur: 0,
          itTypes: {
            Client:{personnes:0,poursuites:0,valeur:0},
            Personnel:{personnes:0,poursuites:0,valeur:0},
            Prestataire:{personnes:0,poursuites:0,valeur:0}
          }
        };
  
        // iterate instances respecting mois/annee
        for (const inst of (m.instances || [])) {
          if ((searchParams.mois  && inst.mois  !== searchParams.mois) ||
              (searchParams.annee && inst.annee !== searchParams.annee)) continue;
  
          // FORMATION
          if (category === 'formation' || category === 'incidents' || category === 'accidents' || category === 'interpellations') {
            (inst.formation || []).forEach(f => {
              const n = Number(f.nombrePersonnes) || 0;
              per.fTotal += n;
              if (per.fTypes[f.type] !== undefined) per.fTypes[f.type] += n;
            });
          }
  
          // ACCIDENTS
          if (category === 'accidents' || category === 'incidents' || category === 'formation' || category === 'interpellations') {
            (inst.accidents || []).forEach(a => {
              per.aCount += Number(a.nombreAccidents) || 0;
              per.aJours += Number(a.joursArret) || 0;
            });
          }
  
          // INCIDENTS
          if (category === 'incidents' || category === 'accidents' || category === 'formation' || category === 'interpellations') {
            (inst.incidents || []).forEach(i => {
              const n = Number(i.nombreIncidents) || 0;
              per.iTotal += n;
              if (per.iTypes[i.typeIncident] !== undefined) per.iTypes[i.typeIncident] += n;
            });
          }
  
          // INTERPELLATIONS
          if (category === 'interpellations' || category === 'incidents' || category === 'accidents' || category === 'formation') {
            (inst.interpellations || []).forEach(it => {
              const p  = Number(it.nombrePersonnes) || 0;
              const pj = Number(it.poursuites) || 0;
              const v  = Number(it.valeurMarchandise) || 0;
              per.itPersonnes += p;
              per.itPoursuites += pj;
              per.itValeur     += v;
              if (per.itTypes[it.typePersonne]) {
                per.itTypes[it.typePersonne].personnes += p;
                per.itTypes[it.typePersonne].poursuites += pj;
                per.itTypes[it.typePersonne].valeur     += v;
              }
            });
          }
        }
  
        // push row and add to global totals for the selected category only
        rows.push(per);
  
        if (category === 'formation') {
          totalsAll.formationTotal += per.fTotal;
          Object.keys(per.fTypes).forEach(t => totalsAll.formationByType[t] += per.fTypes[t]);
        } else if (category === 'accidents') {
          totalsAll.accidentsCount += per.aCount;
          totalsAll.accidentsJours += per.aJours;
        } else if (category === 'incidents') {
          totalsAll.incidentsTotal += per.iTotal;
          Object.keys(per.iTypes).forEach(t => totalsAll.incidentByType[t] += per.iTypes[t]);
        } else if (category === 'interpellations') {
          totalsAll.interPersonnes += per.itPersonnes;
          totalsAll.interPoursuites += per.itPoursuites;
          totalsAll.interValeur += per.itValeur;
          ['Client','Personnel','Prestataire'].forEach(t=>{
            totalsAll.interByType[t].personnes += per.itTypes[t].personnes;
            totalsAll.interByType[t].poursuites += per.itTypes[t].poursuites;
            totalsAll.interByType[t].valeur += per.itTypes[t].valeur;
          });
        }
      }
  
      // 4) Pagination (10/page)
      const limit   = 10;
      const page    = parseInt(req.query.page) || 1;
      const totalItems = rows.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const start = (page - 1) * limit;
      const pageRows = rows.slice(start, start + limit);
  
      // compute page totals (initial "selected" totals on client)
      const pageTotals = {
        formationTotal: 0, formationByType: { Incendie:0, SST:0, Intégration:0 },
        accidentsCount: 0, accidentsJours: 0,
        incidentsTotal: 0, incidentByType: {
          'Départ de feu':0, 'Agression envers le personnel':0,
          'Passage des autorités':0, 'Sinistre déclaré par un client':0,
          'Acte de sécurisation':0, 'Autre':0
        },
        interPersonnes: 0, interPoursuites: 0, interValeur: 0,
        interByType: {
          Client:{personnes:0,poursuites:0,valeur:0},
          Personnel:{personnes:0,poursuites:0,valeur:0},
          Prestataire:{personnes:0,poursuites:0,valeur:0}
        }
      };
  
      pageRows.forEach(per=>{
        if (category === 'formation') {
          pageTotals.formationTotal += per.fTotal;
          Object.keys(per.fTypes).forEach(t => pageTotals.formationByType[t] += per.fTypes[t]);
        } else if (category === 'accidents') {
          pageTotals.accidentsCount += per.aCount;
          pageTotals.accidentsJours += per.aJours;
        } else if (category === 'incidents') {
          pageTotals.incidentsTotal += per.iTotal;
          Object.keys(per.iTypes).forEach(t => pageTotals.incidentByType[t] += per.iTypes[t]);
        } else if (category === 'interpellations') {
          pageTotals.interPersonnes += per.itPersonnes;
          pageTotals.interPoursuites += per.itPoursuites;
          pageTotals.interValeur += per.itValeur;
          ['Client','Personnel','Prestataire'].forEach(t=>{
            pageTotals.interByType[t].personnes += per.itTypes[t].personnes;
            pageTotals.interByType[t].poursuites += per.itTypes[t].poursuites;
            pageTotals.interByType[t].valeur += per.itTypes[t].valeur;
          });
        }
      });
  
      // 5) build dynamic region list limited to admin scope
      const availableRegions = [...new Set(supermarkets.map(s => s.ville))].sort();
  
      res.render('categoryDetails', {
        category, categoryLabel,
        searchParams,
        rows: pageRows,                // 10 per page
        currentPage: page,
        totalPages,
        totalsAll,                     // totals across all filtered markets
        pageTotals,                    // initial totals for this page (all checked)
        availableRegions
      });
  
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur serveur');
    }
  });
  
  module.exports = router;


module.exports = router;
