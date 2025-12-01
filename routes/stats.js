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
<<<<<<< HEAD

=======
// Helper to get ISO week number and year
function getISOWeek(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Helper to get start of a week (Monday)
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date;
}
>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
// routes/stats.js — TIME FILTER HELPERS (ADD THIS BLOCK NEAR THE TOP)

// Safe date parsing
function parseDateSafe(x) {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d) ? null : d;
}
function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfMonth(d){ const x = new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0); return x; }
function endOfMonth(d)  { const x = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999); return x; }
function addDays(d, n)  { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addHours(d, n) { const x = new Date(d); x.setHours(x.getHours() + n); return x; }
function addMonths(d,n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function toMinutesOfDay(date) { return date.getHours() * 60 + date.getMinutes(); }

// Compose date + time "YYYY-MM-DD" + "HH:mm"
function composeDateTime(dateStr, timeStr, asEnd) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(v => parseInt(v, 10) || 0);
    d.setHours(hh, mm, asEnd ? 59 : 0, asEnd ? 999 : 0);
  } else {
    // If no time provided, set to start or end of day
    if (asEnd) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
  }
  return d;
}

// Decide if event dt is inside chosen range + within-day time window
function eventInRange(dt, absRange, timeWindow) {
  if (!dt) return false;
  if (absRange) {
    if (dt < absRange.start || dt > absRange.end) return false;
  }
  if (timeWindow) {
    const m = toMinutesOfDay(dt);
    if (timeWindow.wrap) {
      // e.g., 22:00 -> 06:00
      if (m < timeWindow.fromMin && m > timeWindow.toMin) return false;
    } else {
      if (m < timeWindow.fromMin || m > timeWindow.toMin) return false;
    }
  }
  return true;
}

// Build axis labels/keys for evolution chart
function buildTimeAxis(start, end, groupBy) {
  const labels = [];
  const keys = [];
  const keyToIndex = new Map();
  let idx = 0;

<<<<<<< HEAD
=======
  if (groupBy === 'period') {
    const periods = [
      { key: '08-12', label: '08h - 12h' },
      { key: '12-14', label: '12h - 14h' },
      { key: '14-17', label: '14h - 17h' },
      { key: '17-22', label: '17h - 22h' },
      { key: 'other', label: 'Hors créneau' } // Optional: for times outside 8-22
    ];

    periods.forEach(p => {
      labels.push(p.label);
      keys.push(p.key);
      keyToIndex.set(p.key, idx++);
    });

    return { labels, keys, keyToIndex, groupBy };
  }

>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
  if (groupBy === 'month') {
    let cursor = startOfMonth(start);
    const last = endOfMonth(end);
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth()+1)}`;
      const label = cursor.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      labels.push(label);
      keys.push(key);
      keyToIndex.set(key, idx++);
      cursor = addMonths(cursor, 1);
    }
<<<<<<< HEAD
=======
  } else if (groupBy === 'week') {
    // NEW: Week Logic
    let cursor = startOfWeek(start);
    const last = endOfDay(end);
    while (cursor <= last) {
        const w = getISOWeek(cursor);
        const y = cursor.getFullYear();
        // Handle end of year edge case for ISO weeks
        const key = `${y}-W${pad2(w)}`; 
        const label = `Sem ${w} (${cursor.getDate()}/${cursor.getMonth()+1})`;
        labels.push(label);
        keys.push(key);
        keyToIndex.set(key, idx++);
        cursor.setDate(cursor.getDate() + 7);
    }
>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
  } else if (groupBy === 'day') {
    let cursor = startOfDay(start);
    const last = startOfDay(end);
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth()+1)}-${pad2(cursor.getDate())}`;
      labels.push(key);
      keys.push(key);
      keyToIndex.set(key, idx++);
      cursor = addDays(cursor, 1);
    }
  } else { // hour
    let cursor = new Date(start);
    cursor.setMinutes(0,0,0);
    const last = new Date(end);
    last.setMinutes(0,0,0);
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth()+1)}-${pad2(cursor.getDate())} ${pad2(cursor.getHours())}`;
      const label = `${pad2(cursor.getDate())}/${pad2(cursor.getMonth()+1)} ${pad2(cursor.getHours())}h`;
      labels.push(label);
      keys.push(key);
      keyToIndex.set(key, idx++);
      cursor = addHours(cursor, 1);
    }
  }

  return { labels, keys, keyToIndex, groupBy };
}

function bucketKeyForDate(dt, groupBy) {
  const y = dt.getFullYear(), m = pad2(dt.getMonth()+1), d = pad2(dt.getDate()), h = pad2(dt.getHours());
<<<<<<< HEAD
  if (groupBy === 'month') return `${y}-${m}`;
  if (groupBy === 'day') return `${y}-${m}-${d}`;
=======
  
  if (groupBy === 'month') return `${y}-${m}`;
  if (groupBy === 'week')  return `${y}-W${pad2(getISOWeek(dt))}`; // Assuming you added the week helper
  if (groupBy === 'day')   return `${y}-${m}-${d}`;
  
  // NEW: Period Logic
  if (groupBy === 'period') {
    const hour = dt.getHours();
    if (hour >= 8  && hour < 12) return '08-12';
    if (hour >= 12 && hour < 14) return '12-14';
    if (hour >= 14 && hour < 17) return '14-17';
    if (hour >= 17 && hour < 22) return '17-22';
    return 'other';
  }

>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
  return `${y}-${m}-${d} ${h}`; // hour
}

// Parse URL time filters + decide groupBy
function parseTimeFilters(q, searchParams) {
  const fromDateStr = (q.fromDate || '').trim();
  const toDateStr   = (q.toDate   || '').trim();
  const fromTimeStr = (q.fromTime || '').trim();
  const toTimeStr   = (q.toTime   || '').trim();

  let start = null, end = null;

  if (fromDateStr) start = composeDateTime(fromDateStr, fromTimeStr, false);
  if (toDateStr)   end   = composeDateTime(toDateStr,   toTimeStr,   true);

  // If no explicit from/to date, fallback to month/year filters or last 30 days
  if (!start && !end) {
    if (searchParams && searchParams.annee && searchParams.mois) {
      const d = new Date(searchParams.annee, searchParams.mois - 1, 1);
      start = startOfMonth(d);
      end   = endOfMonth(d);
    } else if (searchParams && searchParams.annee) {
      start = new Date(searchParams.annee, 0, 1, 0,0,0,0);
      end   = new Date(searchParams.annee, 11, 31, 23,59,59,999);
    } else {
      end   = endOfDay(new Date());
      start = startOfDay(addDays(end, -29)); // last 30 days
    }
  } else {
    // One bound missing → infer from the other day
    if (start && !end) end = endOfDay(start);
    if (!start && end) start = startOfDay(end);
  }

  // If same date + same hour, consider exactly that hour window
  if (fromDateStr && toDateStr && fromDateStr === toDateStr &&
      fromTimeStr && toTimeStr && fromTimeStr === toTimeStr) {
    start = composeDateTime(fromDateStr, fromTimeStr, false);
    end   = addHours(start, 1);
    end   = new Date(end.getTime() - 1); // inclusive up to hh:59:59
  }

  // Within-day window (applies to each day across the range)
  let timeWindow = null;
  if (fromTimeStr || toTimeStr) {
    const fm = fromTimeStr ? (parseInt(fromTimeStr.split(':')[0])||0)*60 + (parseInt(fromTimeStr.split(':')[1])||0) : 0;
    const tm = toTimeStr   ? (parseInt(toTimeStr.split(':')[0])  ||0)*60 + (parseInt(toTimeStr.split(':')[1])  ||0) : 1439;
    timeWindow = { fromMin: fm, toMin: tm, wrap: tm < fm };
  }

  // groupBy selection
  let groupBy = (q.groupBy || 'auto').toLowerCase();
  const daysSpan = Math.max(1, Math.ceil((end - start) / 86400000));
<<<<<<< HEAD
  if (groupBy === 'auto') {
    if (daysSpan > 92) groupBy = 'month';
    else if (daysSpan > 1) groupBy = 'day';
    else groupBy = 'hour';
  } else if (!['month','day','hour'].includes(groupBy)) {
=======
  
  if (groupBy === 'auto') {
    if (daysSpan > 92) groupBy = 'month';
    else if (daysSpan > 31) groupBy = 'week';
    else if (daysSpan > 1) groupBy = 'day';
    else groupBy = 'hour';
  } 
  // ADD 'period' to this list
  else if (!['month','week','day','hour','period'].includes(groupBy)) { 
>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
    groupBy = 'day';
  }

  const active = Boolean(q.fromDate || q.toDate || q.fromTime || q.toTime || q.groupBy);

  return {
    start, end, timeWindow, groupBy, active,
    raw: {
      fromDate: fromDateStr, toDate: toDateStr,
      fromTime: fromTimeStr, toTime: toTimeStr
    }
  };
}

// Extract actual event Date for each category (uses item fields)
function getAccidentDate(a)        { return parseDateSafe(a?.date); }
function getIncidentDate(i)        { return parseDateSafe(i?.date); }
function getInterpellationDate(it) { return parseDateSafe(it?.date); }
function getAnomalyDate(a) {
  const d0 = a?.dateDetection ? parseDateSafe(a.dateDetection) : null;
  if (!d0) return null;
  const hhmm = (a.heureDetection || '').slice(0,5);
  if (/^\d{2}:\d{2}$/.test(hhmm)) {
    const [hh, mm] = hhmm.split(':').map(n=>parseInt(n,10)||0);
    d0.setHours(hh, mm, 0, 0);
  } else {
    d0.setHours(0,0,0,0);
  }
  return d0;
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
    
// ADD after formationByType / incidentByType declarations
const anomaliesByType = ANOMALIE_TYPES.reduce((acc, t)=>{ acc[t] = { total: 0 }; return acc; }, {});
    /* ── 3. Accumulateurs globaux ── */
    const globalTotals = {
      formation      : 0,
      accidents      : { count:0, jours:0 },
      incidents      : 0,
      interpellations: { personnes:0, poursuites:0, valeur:0 },
      anomalies      : 0  // <-- NEW
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
          interpellations:{ personnes:0, poursuites:0, valeur:0 },
          anomalies:0 // <-- NEW
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
          reclamations    : instance.reclamations ? instance.reclamations.length : 0,
          anomalies       : instance.anomaliesMarche ? instance.anomaliesMarche.length : 0 // <-- NEW
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
// ADD inside the instance loop, after interpellations counting
(instance.anomaliesMarche || []).forEach(a => {
  instCounts.anomalies += 1;
  marketTotals.anomalies += 1;
  globalTotals.anomalies += 1;
  if (a.anomalieDetectee && anomaliesByType[a.anomalieDetectee]) {
    anomaliesByType[a.anomalieDetectee].total += 1;
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



/* ──────────────────────────────────────────────────────────
   ADMIN: Réclamations list with filters
   URL: GET /admin/reclamations
   ────────────────────────────────────────────────────────── */

   const SUB_MOTIFS = {
    'Produit impropre (abîmé, moisi, odeur suspecte, rupture de la chaîne du froid)': [
      'Abîmé', 'Moisi', 'Odeur suspecte', 'Rupture de la chaîne du froid', 'Autre'
    ],
    'Produits endommagés (emballage déchiré, boîte cabossée, etc.)': [
      'Emballage déchiré', 'Boîte cabossée', 'Scellé endommagé', 'Autre'
    ],
    'Produits non conformes (étiquette, poids indiqué, etc.)': [
      'Étiquette', 'Poids indiqué', 'Autre'
    ],
    'Problème avec les moyens de paiement (CB, chèques, bons d’achat, cartes de fidélité…)': [
      'Carte bancaire (CB)', 'Chèque', 'Bon d’achat', 'Carte de fidélité', 'Autre'
    ],
    'Hygiène insuffisante (sol, odeurs, toilettes, etc.)': [
      'Sol', 'Odeurs', 'Toilettes', 'Autre'
    ],
    'Hygiène et nuisibles (présence de cafards, moucherons, charançons, rats, souris)': [
      'Cafards', 'Moucherons', 'Charançons', 'Rats', 'Souris', 'Autre'
    ],
    'Problèmes de stationnement (parking plein, sécurité, produits manquants)': [
      'Parking plein', 'Sécurité du parking', 'Signalisation', 'Autre'
    ],
    'Nuisances sonores (musique trop forte, annonces trop fréquentes)': [
      'Musique trop forte', 'Annonces trop fréquentes', 'Autre'
    ],
    'Manque d’accueil (courtoisie, indifférence)': [
      'Courtoisie', 'Indifférence', 'Autre'
    ],
    'Sécurité du magasin (vols, sentiment d’insécurité)': [
      'vols', 'sentiment d’insécurité', 'Autre'
    ],
    'Erreur de prix en caisse (écart entre prix affiché et facturé)': [
      'Écart entre prix affiché et facturé'
    ]
  };
  router.get('/admin/reclamations', ensureAdmin, async (req, res) => {
    try {
      const adminFilter = getAdminRegionFilter(req);
      const q         = (req.query.q || '').trim();
      const motif     = req.query.motif || '';
      const sousMotif = req.query.sousMotif || '';
      const statut    = req.query.statut || '';
      const from      = req.query.from ? new Date(req.query.from) : null;
      const to        = req.query.to   ? new Date(req.query.to)   : null;
  
      const supermarkets = await Supermarket.find(adminFilter);
  
      let results = [];
      for (const sm of supermarkets) {
        for (const inst of sm.instances) {
          for (const rec of (inst.reclamations || [])) {
            if (motif && rec.motif !== motif) continue;
            if (sousMotif && (rec.sousMotif || '') !== sousMotif) continue;
            if (statut && rec.statut !== statut) continue;
            if (from && (!rec.dateHeure || new Date(rec.dateHeure) < from)) continue;
            if (to   && (!rec.dateHeure || new Date(rec.dateHeure) > to)) continue;
  
            if (q) {
              const hay = (sm.nom + ' ' + sm.ville + ' ' + (rec.designationProduit||'') + ' ' + (rec.action||'') + ' ' + (rec.motif||'') + ' ' + (rec.sousMotif||'')).toLowerCase();
              if (!hay.includes(q.toLowerCase())) continue;
            }
  
            results.push({
              supermarketId: sm._id,
              supermarketName: sm.nom,
              ville: sm.ville,
              instanceId: inst._id,
              mois: inst.mois,
              annee: inst.annee,
              rec
            });
          }
        }
      }
  
      results.sort((a,b)=> new Date(b.rec.dateHeure||0) - new Date(a.rec.dateHeure||0));
  
      // flat motifs list for the dropdown
      const motifs = [
        'Produit périmé',
        'Produit impropre (abîmé, moisi, odeur suspecte, rupture de la chaîne du froid)',
        'Produits endommagés (emballage déchiré, boîte cabossée, etc.)',
        'Produits non conformes (étiquette, poids indiqué, etc.)',
        'Produit manquant dans un pack ou une boîte',
        'Erreur de prix en caisse (écart entre prix affiché et facturé)',
        'Promotions non appliquées ou mal expliquées',
        'Attente trop longue aux caisses',
        'Erreur de rendu monnaie',
        'Problème avec les moyens de paiement (CB, chèques, bons d’achat, cartes de fidélité…)',
        'Double facturation ou oubli d’annulation d’un article',
        'Manque d’accueil (courtoisie, indifférence)',
        'Comportement inapproprié d’un employé ou agent de sécurité',
        'Manque de disponibilité du personnel pour aider',
        'Hygiène insuffisante (sol, odeurs, toilettes, etc.)',
        'Hygiène et nuisibles (présence de cafards, moucherons, charançons, rats, souris)',
        'Sécurité du magasin (vols, sentiment d’insécurité)',
        'Problèmes de stationnement (parking plein, sécurité, produits manquants)',
        'Nuisances sonores (musique trop forte, annonces trop fréquentes)'
      ];
  
      res.render('adminReclamations', {
        items: results,
        filters: { q, motif, sousMotif, statut, from: req.query.from || '', to: req.query.to || '' },
        motifs,
        subMotifsMap: SUB_MOTIFS
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur serveur');
    }
  });
  

 
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

const ANOMALIE_TYPES = [
  'Moucherons',
  'Sol mal nettoyé',
  'Cagettes sales',
  'Qualité dégradée',
  'Produit abîmé',
  'Rupture',
  'Comportement inadapté',
  "Non respect règles d'hygiène",
  'Présence des insectes'
];

/* routes/stats.js  — REPLACE the whole /stats/category/:category route with this (no pagination) */
const INCIDENT_TYPES = [
  { key: 'departFeu',       label: 'Départ de feu' },
  { key: 'agression',       label: 'Agression envers le personnel' },
  { key: 'autorites',       label: 'Passage des autorités' },
  { key: 'sinistreClient',  label: 'Sinistre déclaré par un client' },
  { key: 'acteSecurisation',label: 'Acte de sécurisation' },
  { key: 'autre',           label: 'Autre' }
];
const INCIDENT_LABEL_TO_KEY = INCIDENT_TYPES.reduce((acc,t)=>{ acc[t.label]=t.key; return acc; },{});
const INTER_TYPES = ['Client','Personnel','Prestataire'];

function zeroIncidentMap(){
  const o={}; INCIDENT_TYPES.forEach(t=>o[t.key]=0); return o;
}




/* Category details (Formation, Accidents, Incidents, Interpellations) */
router.get('/stats/category/:category', ensureAdmin, async (req, res) => {
  try {
    const category = (req.params.category || '').toLowerCase();
    const allowed = ['formation','accidents','incidents','interpellations','anomalies'];
    if (!allowed.includes(category)) return res.status(400).send('Catégorie invalide');

    const categoryLabel = {
      formation:'Formation',
      accidents:'Accidents',
      incidents:'Incidents',
      interpellations:'Interpellations',
      anomalies:'Anomalies Marché'
    }[category];

    // Existing filters
    const searchParams = {
      nom   : req.query.nom   || '',
      ville : req.query.ville || '',
      mois  : req.query.mois  ? parseInt(req.query.mois)  : null,
      annee : req.query.annee ? parseInt(req.query.annee) : null
    };

    // NEW: anomalies filters
    const amOnly = ['1','true','yes'].includes(String(req.query.amOnly || '').toLowerCase());
    const amTypeRaw = (req.query.amType || '').trim();
    const amType = ANOMALIE_TYPES.includes(amTypeRaw) ? amTypeRaw : null;

    const adminFilter = getAdminRegionFilter(req);
    const supermarkets = await Supermarket.find(adminFilter);

    const totalsAll = {
      formationTotal: 0,
      formationByType: { Incendie:0, SST:0, Intégration:0 },

      accidentsCount: 0,
      accidentsJours: 0,
      accidentByCause: {},

      incidentsTotal: 0,
      incidentByType: { departFeu:0, agression:0, autorites:0, sinistreClient:0, acteSecurisation:0, autre:0 },

      interPersonnes: 0,
      interPoursuites: 0,
      interValeur: 0,
      interByType: {
        Client:{personnes:0,poursuites:0,valeur:0},
        Personnel:{personnes:0,poursuites:0,valeur:0},
        Prestataire:{personnes:0,poursuites:0,valeur:0}
      },

      anomaliesTotal: 0,
      anomaliesByType: ANOMALIE_TYPES.reduce((acc,t)=>{ acc[t]=0; return acc; },{})
    };

    let rows = []; // CHANGED to let

    for (const m of supermarkets) {
      if (searchParams.nom && !m.nom.toLowerCase().includes(searchParams.nom.toLowerCase())) continue;
      if (searchParams.ville && !m.ville.toLowerCase().includes(searchParams.ville.toLowerCase())) continue;

      const per = {
        id: m._id.toString(),
        nom: m.nom,
        ville: m.ville,

        fTotal: 0,
        fTypes: { Incendie:0, SST:0, Intégration:0 },

        aCount: 0,
        aJours: 0,
        aCauses: {},

        iTotal: 0,
        iTypes: { departFeu:0, agression:0, autorites:0, sinistreClient:0, acteSecurisation:0, autre:0 },

        itPersonnes: 0,
        itPoursuites: 0,
        itValeur: 0,
        itTypes: {
          Client:{personnes:0,poursuites:0,valeur:0},
          Personnel:{personnes:0,poursuites:0,valeur:0},
          Prestataire:{personnes:0,poursuites:0,valeur:0}
        },

        amTotal: 0,
        amByType: ANOMALIE_TYPES.reduce((acc,t)=>{ acc[t]=0; return acc; },{})
      };

      for (const inst of (m.instances || [])) {
        if ((searchParams.mois  && inst.mois  !== searchParams.mois) ||
            (searchParams.annee && inst.annee !== searchParams.annee)) continue;

        (inst.formation || []).forEach(f=>{
          const n = Number(f.nombrePersonnes)||0;
          per.fTotal += n;
          if (per.fTypes[f.type] !== undefined) per.fTypes[f.type] += n;
          totalsAll.formationTotal += n;
          if (totalsAll.formationByType[f.type] !== undefined) totalsAll.formationByType[f.type] += n;
        });

        (inst.accidents || []).forEach(a=>{
          const n = Number(a.nombreAccidents)||0;
          const j = Number(a.joursArret)||0;
          per.aCount += n;
          per.aJours += j;
          totalsAll.accidentsCount += n;
          totalsAll.accidentsJours += j;
          const cause = (a.cause || '').trim();
          if (cause) {
            per.aCauses[cause] = (per.aCauses[cause]||0) + n;
            totalsAll.accidentByCause[cause] = (totalsAll.accidentByCause[cause]||0) + n;
          }
        });

        (inst.incidents || []).forEach(i=>{
          const n = Number(i.nombreIncidents)||0;
          per.iTotal += n;
          totalsAll.incidentsTotal += n;
          const key = INCIDENT_LABEL_TO_KEY[i.typeIncident] || 'autre';
          per.iTypes[key] = (per.iTypes[key]||0) + n;
          totalsAll.incidentByType[key] = (totalsAll.incidentByType[key]||0) + n;
        });

        (inst.interpellations || []).forEach(it=>{
          const p  = Number(it.nombrePersonnes)||0;
          const pj = Number(it.poursuites)||0;
          const v  = Number(it.valeurMarchandise)||0;
          per.itPersonnes += p;
          per.itPoursuites += pj;
          per.itValeur     += v;
          totalsAll.interPersonnes += p;
          totalsAll.interPoursuites += pj;
          totalsAll.interValeur     += v;
          if (['Client','Personnel','Prestataire'].includes(it.typePersonne)) {
            per.itTypes[it.typePersonne].personnes += p;
            per.itTypes[it.typePersonne].poursuites += pj;
            per.itTypes[it.typePersonne].valeur     += v;
            totalsAll.interByType[it.typePersonne].personnes += p;
            totalsAll.interByType[it.typePersonne].poursuites += pj;
            totalsAll.interByType[it.typePersonne].valeur     += v;
          }
        });

        (inst.anomaliesMarche || []).forEach(a=>{
          per.amTotal += 1;
          totalsAll.anomaliesTotal += 1;
          const t = a.anomalieDetectee || '';
          if (t && per.amByType[t] !== undefined) per.amByType[t] += 1;
          if (t && totalsAll.anomaliesByType[t] !== undefined) totalsAll.anomaliesByType[t] += 1;
        });
      }

      rows.push(per);
    }

    // APPLY FILTERS for anomalies
    if (category === 'anomalies' && (amOnly || amType)) {
      rows = rows.filter(r => {
        if (amType) return (r.amByType[amType] || 0) > 0;
        return (r.amTotal || 0) > 0;
      });

      // Recompute anomalies totals (for "Tous cochés" and initial selection)
      const newByType = ANOMALIE_TYPES.reduce((acc,t)=>{ acc[t]=0; return acc; }, {});
      let newTotal = 0;
      rows.forEach(r => {
        newTotal += r.amTotal || 0;
        ANOMALIE_TYPES.forEach(t => newByType[t] += r.amByType[t] || 0);
      });
      totalsAll.anomaliesTotal = newTotal;
      totalsAll.anomaliesByType = newByType;
    }

    // selectedInit
    let selectedInit = {};
    if (category === 'formation') {
      selectedInit = { formationTotal: totalsAll.formationTotal, formationByType: totalsAll.formationByType };
    } else if (category === 'accidents') {
      selectedInit = { accidentsCount: totalsAll.accidentsCount, accidentsJours: totalsAll.accidentsJours, accidentByCause: totalsAll.accidentByCause };
    } else if (category === 'incidents') {
      selectedInit = { incidentsTotal: totalsAll.incidentsTotal, incidentByType: totalsAll.incidentByType };
    } else if (category === 'interpellations') {
      selectedInit = { interPersonnes: totalsAll.interPersonnes, interPoursuites: totalsAll.interPoursuites, interValeur: totalsAll.interValeur, interByType: totalsAll.interByType };
    } else if (category === 'anomalies') {
      selectedInit = { anomaliesTotal: totalsAll.anomaliesTotal, anomaliesByType: totalsAll.anomaliesByType };
    }

    const availableRegions = [...new Set(supermarkets.map(s => s.ville))].sort();

    res.render('categoryDetails', {
      category, categoryLabel,
      searchParams,
      rows,
      totalsAll,
      selectedInit,
      availableRegions,
      incidentTypes: INCIDENT_TYPES,
      anomalieTypes: ANOMALIE_TYPES,
      amFilter: { amOnly, amType }  // NEW: to show a banner/clear link
    });
  } catch(err) {
    console.error(err);
    res.status(500).send('Erreur serveur');
  }
});


// routes/stats.js (additions for the Dashboard)

// Adjust paths as needed for your project


function incidentKeyFrom(value) {
  if (!value) return 'autre';
  // if it's already a key
  if (INCIDENT_TYPES.some(t => t.key === value)) return value;
  // if it's a label
  if (value in INCIDENT_LABEL_TO_KEY) return INCIDENT_LABEL_TO_KEY[value];
  return 'autre';
}

function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function makeZeroMap(keys) {
  return keys.reduce((acc, k) => { acc[k] = 0; return acc; }, {});
}

function uniqueSorted(arr) {
  return [...new Set(arr)].filter(Boolean).sort((a, b) => ('' + a).localeCompare('' + b));
}

<<<<<<< HEAD
=======

>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
function buildBaseQs(searchParams) {
  const parts = [];
  if (searchParams.nom) parts.push('nom=' + encodeURIComponent(searchParams.nom));
  if (searchParams.ville) parts.push('ville=' + encodeURIComponent(searchParams.ville));
  if (searchParams.mois) parts.push('mois=' + encodeURIComponent(searchParams.mois));
  if (searchParams.annee) parts.push('annee=' + encodeURIComponent(searchParams.annee));
<<<<<<< HEAD
  return parts.join('&');
}

=======
  // NEW
  if (searchParams.anomalieType) parts.push('anomalieType=' + encodeURIComponent(searchParams.anomalieType));
  return parts.join('&');
}


>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
function summarizeFilters(searchParams) {
  const seg = [];
  if (searchParams.nom) seg.push(`Nom contient "${searchParams.nom}"`);
  if (searchParams.ville) seg.push(`Ville = ${searchParams.ville}`);
<<<<<<< HEAD
=======
  if (searchParams.anomalieType) seg.push(`Type = ${searchParams.anomalieType}`); // NEW
>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
  if (searchParams.mois) seg.push(`Mois = ${searchParams.mois}`);
  if (searchParams.annee) seg.push(`Année = ${searchParams.annee}`);
  return seg.length ? 'Filtre: ' + seg.join(' · ') : 'Aucun filtre';
}

const monthLabelsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// routes/stats.js — REPLACE the whole /stats/dashboard handler with this

router.get('/stats/dashboard', ensureAdmin, async (req, res) => {
  try {
    const searchParams = {
      nom: (req.query.nom || '').trim(),
      ville: (req.query.ville || '').trim(),
      mois: req.query.mois ? parseInt(req.query.mois, 10) : null,
<<<<<<< HEAD
      annee: req.query.annee ? parseInt(req.query.annee, 10) : null
=======
      annee: req.query.annee ? parseInt(req.query.annee, 10) : null,
      // NEW: Catch the anomaly filter
      anomalieType: (req.query.anomalieType || '').trim() 
>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046
    };

    // NEW: Parse time filters (tranche horaire) and groupBy for evolution chart
    const timeFilters = parseTimeFilters(req.query, searchParams); // {start,end,timeWindow,groupBy,active,raw}

    const adminFilter = getAdminRegionFilter ? getAdminRegionFilter(req) : {};
    const supermarkets = await Supermarket.find(adminFilter);

    const totals = {
      formation: {
        total: 0,
        byType: { Incendie: 0, SST: 0, Intégration: 0 }
      },
      accidents: {
        count: 0,
        jours: 0,
        byCause: {}
      },
      incidents: {
        total: 0,
        byType: { departFeu: 0, agression: 0, autorites: 0, sinistreClient: 0, acteSecurisation: 0, autre: 0 }
      },
      interpellations: {
        personnes: 0,
        poursuites: 0,
        valeur: 0,
        byType: {
          Client: { personnes: 0, poursuites: 0, valeur: 0 },
          Personnel: { personnes: 0, poursuites: 0, valeur: 0 },
          Prestataire: { personnes: 0, poursuites: 0, valeur: 0 }
        }
      },
      anomalies: {
        total: 0,
        byType: ANOMALIE_TYPES.reduce((acc, t) => { acc[t] = 0; return acc; }, {})
      }
    };

    // Kept monthly timeseries if a full year was selected (existing behavior)
    const timeseries = {
      hasYear: !!searchParams.annee,
      labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
      formation: Array(12).fill(0),
      accidentsCount: Array(12).fill(0),
      accidentsJours: Array(12).fill(0),
      incidentsTotal: Array(12).fill(0),
      interPersonnes: Array(12).fill(0),
      anomaliesTotal: Array(12).fill(0)
    };

    // NEW: dynamic evolution axis for anomalies (hour/day/month)
    const evoAxis = buildTimeAxis(timeFilters.start, timeFilters.end, timeFilters.groupBy);
    const evo = {
      labels: evoAxis.labels,
      groupBy: evoAxis.groupBy,
      anomalies: Array(evoAxis.labels.length).fill(0)
    };

    const timeActive = !!timeFilters.active; // Only apply date/hour window if user provided any

    const stores = [];
    const availableCities = [];

    for (const m of supermarkets) {
      availableCities.push(m.ville);
      if (searchParams.nom && !String(m.nom || '').toLowerCase().includes(searchParams.nom.toLowerCase())) continue;
      if (searchParams.ville && String(m.ville || '') !== searchParams.ville) continue;

      const per = {
        id: String(m._id),
        nom: m.nom,
        ville: m.ville,

        formation: {
          total: 0,
          byType: { Incendie: 0, SST: 0, Intégration: 0 },
          list: []
        },
        accidents: {
          count: 0,
          jours: 0,
          byCause: {},
          list: []
        },
        incidents: {
          total: 0,
          byType: { departFeu: 0, agression: 0, autorites: 0, sinistreClient: 0, acteSecurisation: 0, autre: 0 },
          list: []
        },
        interpellations: {
          personnes: 0,
          poursuites: 0,
          valeur: 0,
          byType: {
            Client: { personnes: 0, poursuites: 0, valeur: 0 },
            Personnel: { personnes: 0, poursuites: 0, valeur: 0 },
            Prestataire: { personnes: 0, poursuites: 0, valeur: 0 }
          },
          list: []
        },
        anomalies: {
          total: 0,
          byType: ANOMALIE_TYPES.reduce((acc, t) => { acc[t] = 0; return acc; }, {}),
          list: []
        }
      };

      const instances = Array.isArray(m.instances) ? m.instances : [];
      for (const inst of instances) {
        // Respect month/year filters first (existing)
        if (searchParams.annee && inst.annee !== searchParams.annee) continue;
        if (searchParams.mois && inst.mois !== searchParams.mois) continue;

        // FORMATION (no event date: not filtered by time window)
        (inst.formation || []).forEach(f => {
          const n = num(f.nombrePersonnes);
          per.formation.total += n;
          totals.formation.total += n;

          const type = f.type && per.formation.byType.hasOwnProperty(f.type) ? f.type : null;
          if (type) {
            per.formation.byType[type] += n;
            totals.formation.byType[type] += n;
          }

          per.formation.list.push({
            type: f.type || 'Autre',
            nombrePersonnes: n,
            mois: inst.mois,
            annee: inst.annee
          });

          if (timeseries.hasYear && inst.annee === searchParams.annee && inst.mois >= 1 && inst.mois <= 12) {
            timeseries.formation[inst.mois - 1] += n;
          }
        });

        // ACCIDENTS (filter by time if active)
        (inst.accidents || []).forEach(a => {
          const evt = getAccidentDate(a);
          if (timeActive && !eventInRange(evt, { start: timeFilters.start, end: timeFilters.end }, timeFilters.timeWindow)) return;

          const n = num(a.nombreAccidents);
          const j = num(a.joursArret);
          per.accidents.count += n;
          per.accidents.jours += j;
          totals.accidents.count += n;
          totals.accidents.jours += j;

          const cause = (a.cause || 'Autre').trim();
          per.accidents.byCause[cause] = (per.accidents.byCause[cause] || 0) + n;
          totals.accidents.byCause[cause] = (totals.accidents.byCause[cause] || 0) + n;

          per.accidents.list.push({
            cause,
            nombreAccidents: n,
            joursArret: j,
            remarque: a.remarque || '',
            mois: inst.mois,
            annee: inst.annee
          });

          if (timeseries.hasYear && inst.annee === searchParams.annee && inst.mois >= 1 && inst.mois <= 12) {
            timeseries.accidentsCount[inst.mois - 1] += n;
            timeseries.accidentsJours[inst.mois - 1] += j;
          }
        });

        // INCIDENTS (filter by time if active)
        (inst.incidents || []).forEach(i => {
          const evt = getIncidentDate(i);
          if (timeActive && !eventInRange(evt, { start: timeFilters.start, end: timeFilters.end }, timeFilters.timeWindow)) return;

          const n = num(i.nombreIncidents);
          const key = incidentKeyFrom(i.typeIncident);
          per.incidents.total += n;
          totals.incidents.total += n;

          per.incidents.byType[key] = (per.incidents.byType[key] || 0) + n;
          totals.incidents.byType[key] = (totals.incidents.byType[key] || 0) + n;

          per.incidents.list.push({
            type: key,
            nombreIncidents: n,
            detail: i.detail || '',
            mois: inst.mois,
            annee: inst.annee
          });

          if (timeseries.hasYear && inst.annee === searchParams.annee && inst.mois >= 1 && inst.mois <= 12) {
            timeseries.incidentsTotal[inst.mois - 1] += n;
          }
        });

        // INTERPELLATIONS (filter by time if active)
        (inst.interpellations || []).forEach(it => {
          const evt = getInterpellationDate(it);
          if (timeActive && !eventInRange(evt, { start: timeFilters.start, end: timeFilters.end }, timeFilters.timeWindow)) return;

          const p = num(it.nombrePersonnes);
          const pj = num(it.poursuites);
          const v = num(it.valeurMarchandise);

          per.interpellations.personnes += p;
          per.interpellations.poursuites += pj;
          per.interpellations.valeur += v;

          totals.interpellations.personnes += p;
          totals.interpellations.poursuites += pj;
          totals.interpellations.valeur += v;

          const t = ['Client', 'Personnel', 'Prestataire'].includes(it.typePersonne) ? it.typePersonne : 'Client';
          per.interpellations.byType[t].personnes += p;
          per.interpellations.byType[t].poursuites += pj;
          per.interpellations.byType[t].valeur += v;

          totals.interpellations.byType[t].personnes += p;
          totals.interpellations.byType[t].poursuites += pj;
          totals.interpellations.byType[t].valeur += v;

          per.interpellations.list.push({
            typePersonne: t,
            nombrePersonnes: p,
            poursuites: pj,
            valeurMarchandise: v,
            produit: it.produit || '',
            mois: inst.mois,
            annee: inst.annee
          });

          if (timeseries.hasYear && inst.annee === searchParams.annee && inst.mois >= 1 && inst.mois <= 12) {
            timeseries.interPersonnes[inst.mois - 1] += p;
          }
        });

        // ANOMALIES (filter by time if active) + build evolution buckets
        (inst.anomaliesMarche || []).forEach(a => {
          const evt = getAnomalyDate(a);
          if (timeActive && !eventInRange(evt, { start: timeFilters.start, end: timeFilters.end }, timeFilters.timeWindow)) return;
<<<<<<< HEAD
=======
          if (searchParams.anomalieType && a.anomalieDetectee !== searchParams.anomalieType) return;
>>>>>>> 2714f1e015e7aff7d3b79c06e5301ea2f8c82046

          const t = a.anomalieDetectee && ANOMALIE_TYPES.includes(a.anomalieDetectee) ? a.anomalieDetectee : null;
          per.anomalies.total += 1;
          totals.anomalies.total += 1;

          if (t) {
            per.anomalies.byType[t] += 1;
            totals.anomalies.byType[t] += 1;
          }

          per.anomalies.list.push({
            anomalieDetectee: a.anomalieDetectee || 'Non spécifié',
            commentaire: a.commentaire || '',
            action: a.actionCorrective || a.action || '',
            mois: inst.mois,
            annee: inst.annee
          });

          // Evolution by chosen granularity
          if (evt) {
            const key = bucketKeyForDate(evt, evoAxis.groupBy);
            const idx = evoAxis.keyToIndex.get(key);
            if (idx !== undefined) evo.anomalies[idx] += 1;
          }

          if (timeseries.hasYear && inst.annee === searchParams.annee && inst.mois >= 1 && inst.mois <= 12) {
            timeseries.anomaliesTotal[inst.mois - 1] += 1;
          }
        });
      }

      stores.push(per);
    }

    // Top lists (unchanged)
    const topAnomalies = stores
      .map(s => ({ id: s.id, nom: s.nom, ville: s.ville, total: s.anomalies.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const topAccidents = stores
      .map(s => ({ id: s.id, nom: s.nom, ville: s.ville, count: s.accidents.count, jours: s.accidents.jours }))
      .sort((a, b) => (b.count - a.count) || (b.jours - a.jours))
      .slice(0, 5);

    const topInterValeur = stores
      .map(s => ({ id: s.id, nom: s.nom, ville: s.ville, valeur: s.interpellations.valeur }))
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 5);

    // Top accident causes
    const topAccidentCauses = Object.entries(totals.accidents.byCause || {})
      .map(([cause, n]) => ({ cause, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);

    const hasFilters = !!(searchParams.nom || searchParams.ville || searchParams.mois || searchParams.annee);
    const filterSummary = summarizeFilters(searchParams);
    const baseQs = buildBaseQs(searchParams);

    res.render('adminDashboard', {
      searchParams,
      hasFilters,
      filterSummary,
      baseQs,
      totals,
      stores,
      anomalieTypes: ANOMALIE_TYPES,
      incidentTypes: INCIDENT_TYPES,
      topAnomalies,
      topAccidents,
      topInterValeur,
      topAccidentCauses,
      availableCities: uniqueSorted(availableCities),
      timeseries,

      // NEW
      timeFilters,
      evo
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur (dashboard)');
  }
});




module.exports = router;
