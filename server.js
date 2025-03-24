const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const session = require('express-session');  // Added express-session
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Connection to MongoDB Atlas
const MONGO_URI = 'mongodb+srv://abderrahim:houmam2003@cluster0.scvas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Atlas connected'))
.catch(err => console.error('MongoDB Atlas connection error:', err));

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Configure sessions
app.use(session({
  secret: 'yourSecretKey', // Replace with a strong secret
  resave: false,
  saveUninitialized: false
}));

// Additional middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure express-ejs-layouts and EJS
app.use(expressLayouts);
app.set('layout', 'layout'); // Uses views/layout.ejs as the default layout
app.set('view engine', 'ejs');

// Authentication middleware: allow access to /login and /logout without authentication.
app.use((req, res, next) => {
  if (req.session.user || req.path === '/login' || req.path === '/logout') {
    return next();
  }
  res.redirect('/login');
});

// Routes
const authRoutes = require('./routes/auth');         // Authentication routes (login/logout)
const indexRoutes = require('./routes/index');         // Routes for the homepage/search etc.
const supermarketRoutes = require('./routes/supermarkets'); // Routes for supermarket operations
const totalsRoutes = require('./routes/totals');       // Routes for totals/reporting

// Mount the routes. Order matters: authentication routes are available before others.
app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/supermarkets', supermarketRoutes);
app.use('/totals', totalsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
