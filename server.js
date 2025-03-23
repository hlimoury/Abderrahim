const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Connexion à MongoDB (adapter la chaîne de connexion si nécessaire)

const MONGO_URI = 'mongodb+srv://abderrahim:houmam2003@cluster0.scvas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Atlas connected'))
.catch(err => console.error('MongoDB Atlas connection error:', err));
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration d'Express-EJS-Layouts
app.use(expressLayouts);
app.set('layout', 'layout'); // Utilise views/layout.ejs comme layout par défaut
app.set('view engine', 'ejs');

// Routes
const indexRoutes       = require('./routes/index');
const supermarketRoutes = require('./routes/supermarkets');
const totalsRoutes      = require('./routes/totals');

app.use('/', indexRoutes);
app.use('/supermarkets', supermarketRoutes);
app.use('/totals', totalsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
