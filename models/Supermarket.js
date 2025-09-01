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

// DRL - Demande de Règlement Litige
const DRLSchema = new Schema({
  valeur: Number,
  statut: { type: String, enum: ['Accepté', 'Refusé'] },
  date: Date
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
  drl: [DRLSchema],
  scoring: ScoringSchema
});

const SupermarketSchema = new Schema({
  nom: { type: String, required: true },
  ville: { type: String, required: true, default: 'Inconnue' },
  instances: [InstanceSchema]
});


module.exports = mongoose.model('Supermarket', SupermarketSchema);
