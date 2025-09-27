// SupermarketSchema.js models
const mongoose = require('mongoose');
const Schema   = mongoose.Schema;




const SousIndicateurSchema = new Schema({
  nom: String,
  niveau: Number,
  objectif: Number
});
const ScoringSchema = new Schema({
  securiteIncendie: [SousIndicateurSchema],
  sst: [SousIndicateurSchema],    // Sécurité et Santé au Travail
  surete: [SousIndicateurSchema],
  global: [SousIndicateurSchema]  // Niveau de Sécurité Global
});

// Formation
const FormationSchema = new Schema({
  nombrePersonnes: Number,
  type: { type: String, enum: ['Incendie', 'SST', 'Intégration'] }
});

// Accidents de travail
const AccidentSchema = new Schema({
  nombreAccidents: Number,
  joursArret: Number,
  accidentDeclare: Boolean,
  cause: String,
  date: Date
});

// Autres incidents
const IncidentSchema = new Schema({
  nombreIncidents: Number,
  typeIncident: { 
    type: String, 
    enum: ['Départ de feu', 'Agression envers le personnel', 'Passage des autorités', 'Sinistre déclaré par un client', 'Acte de sécurisation', 'Autre'] 
  },
  sousTypeFeu: {
    type: String,
    enum: ['Défauts électriques', 'Équipements de froid', 'Équipement de cuisson', 'Actes de malveillance', 'Accumulation de déchets', 'Travaux par point chaud', 'Autres']
  },
  date: Date,
  detail: String
});

// Interpellations
const InterpellationSchema = new Schema({
  typePersonne: { type: String, enum: ['Client', 'Personnel', 'Prestataire'] },
  nombrePersonnes: Number,
  poursuites: Number,
  valeurMarchandise: Number,
  rayon: String,
  date: Date
});

// Équipements de sécurité
const EquipementSchema = new Schema({
  extincteurs: Number,
  ria: Number,
  portes: Number,
  issuesSecours: Number,
  skydomes: Number,
  cameras: Number,
  nvr: Number,
  ads: Number
});

/* ───────── Reclamations (REMPLACE DRL) ───────── */
const ReclamationSchema = new Schema({
  motif: { 
    type: String, 
    enum: [
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
    ],
    required: true
  },
  sousMotif: { type: String, default: '' }, 
  designationProduit: { type: String, default: '' }, // optionnel
  dateHeure: { type: Date, required: true },
  action: { type: String, default: '' },             // action entreprise (texte libre)
  statut: { type: String, enum: ['Traité', 'En cours', 'Non traité'], default: 'Non traité' }
});

// Instance mensuelle (pour un mois et une année donnés)
const InstanceSchema = new Schema({
  mois: Number,
  annee: Number,
  formation: [FormationSchema],
  accidents: [AccidentSchema],
  incidents: [IncidentSchema],
  interpellations: [InterpellationSchema],
  equipements: EquipementSchema,
  reclamations: [ReclamationSchema],
  scoring: ScoringSchema
});

const SupermarketSchema = new Schema({
  nom: { type: String, required: true },
  ville: { type: String, required: true, default: 'Inconnue' },
  instances: [InstanceSchema]
});


module.exports = mongoose.model('Supermarket', SupermarketSchema);
