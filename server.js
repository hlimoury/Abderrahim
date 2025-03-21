// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// (Optional) Disable strict query mode in Mongoose 7+
mongoose.set('strictQuery', false);

// Check if MONGO_URI is provided
if (!process.env.MONGO_URI) {
  console.error('Avertissement: MONGO_URI n\'est pas défini dans .env');
}

// Connect to MongoDB (Atlas or local) via MONGO_URI from .env
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connecté'))
.catch(err => console.error('Erreur de connexion MongoDB:', err));

const app = express();

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Use body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Import your routes
const supermarketRoutes = require('./routes/supermarketRoutes');
app.use('/', supermarketRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
