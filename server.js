

// server.js
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config(); // optionnel si tu veux utiliser .env plus tard

const app = express();

/**
 * === MongoDB connection (KEEP THE PROVIDED MONGO URI) ===
 * You explicitly asked to keep the mongo_url here:
 */
const MONGO_URI = 'mongodb+srv://abderrahim:houmam2003@cluster0.scvas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Atlas connected'))
.catch(err => console.error('MongoDB Atlas connection error:', err));

// ========== Middlewares ==========
app.use(morgan('dev'));                    // request logger
app.use(express.json());                   // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse urlencoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // static assets

// Sessions with Mongo (connect-mongo)
app.use(session({
  secret: process.env.SESSION_SECRET || 'Houmam2003@@', // you can override with env
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    // secure: true -> only on HTTPS (enable in prod)
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// expose session to views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});
// ADD in app.js after session middleware
app.use((req, res, next) => {
  res.locals.anomaliesOnly = Boolean(req.session && req.session.anomaliesOnly);
  next();
});

// quick favicon route (avoid 404 noise)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ========== View engine (EJS + layouts) ==========
app.use(expressLayouts);
app.set('layout', 'layout'); // views/layout.ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========== Authentication gate (global) ==========
// Allow unauthenticated access to specific routes (login pages, static assets, API public endpoints)
const publicPrefixes = [
  '/login', '/logout', '/adminlogin', '/adminlogout',
  '/public', '/css', '/js', '/images', '/favicon.ico', '/assets',
  '/auth', '/api' // allow chat endpoints public if you want (remove '/chat' if chat should be protected)
];

app.use((req, res, next) => {
  // Allow requests that match any public prefix
  const isPublic = publicPrefixes.some(prefix => req.path === prefix || req.path.startsWith(prefix + '/') || req.path.startsWith(prefix));
  if (req.session && (req.session.user || req.session.isAdmin)) return next();
  if (isPublic) return next();
  // Otherwise redirect to login
  return res.redirect('/login');
});

// ========== Routes (import and mount) ==========
/**
 * Note: ensure these route files exist: ./routes/auth, ./routes/authAdmin, ./routes/index,
 * ./routes/supermarkets, ./routes/totals, ./routes/stats, ./routes/reports, ./routes/chat
 */
const authRoutes = require('./routes/auth');
const authAdminRoutes = require('./routes/authAdmin');
const indexRoutes = require('./routes/index');
const supermarketRoutes = require('./routes/supermarkets');
const totalsRoutes = require('./routes/totals');
const statsRoutes = require('./routes/stats');
const reportsRouter = require('./routes/reports');

// Mount routes (order matters for matching)
app.use('/', authRoutes);
app.use('/', authAdminRoutes);
app.use('/', statsRoutes);      // admin stats dashboard (protected by your session/isAdmin in routes if needed)
app.use('/reports', reportsRouter);
app.use('/totals', totalsRoutes);

app.use('/', indexRoutes);
app.use('/supermarkets', supermarketRoutes);


// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 404 handler
app.use((req, res) => {
  res.status(404);
  // If client expects JSON (API call)
  if (req.accepts('json')) return res.json({ error: 'Not found' });
  // Otherwise render a 404 page if exists
  return res.render('404', { url: req.originalUrl });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500);
  if (req.accepts('json')) return res.json({ error: err.message || 'Server error' });
  return res.render('error', { error: err });
});

// ========== Start server ==========
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));

// Graceful shutdown (optional)
process.on('SIGINT', () => {
  console.log('SIGINT received: closing server');
  server.close(async () => {
    try {
      await mongoose.disconnect();
      console.log('Mongo disconnected');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown', err);
      process.exit(1);
    }
  });
});































// const express = require('express');
// const expressLayouts = require('express-ejs-layouts');
// const mongoose = require('mongoose');
// const session = require('express-session');
// const MongoStore = require('connect-mongo'); // For storing sessions in Mongo
// const bodyParser = require('body-parser');
// const path = require('path');

// const app = express();

// // Connection to MongoDB Atlas
// const MONGO_URI = 'mongodb+srv://abderrahim:houmam2003@cluster0.scvas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// mongoose.connect(MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// })
// .then(() => console.log('MongoDB Atlas connected'))
// .catch(err => console.error('MongoDB Atlas connection error:', err));

// // Middleware to parse form data
// app.use(express.urlencoded({ extended: true }));

// // Configure sessions with connect-mongo
// app.use(session({
//   secret: 'Houmam2003@@', // Replace with a strong secret
//   resave: false,
//   saveUninitialized: false,
//   store: MongoStore.create({
//     mongoUrl: MONGO_URI,
//     collectionName: 'sessions'
//   })
// }));


// // After configuring sessions:
// app.use((req, res, next) => {
//   res.locals.session = req.session;
//   next();
// });

// app.get('/favicon.ico', (req, res) => res.status(204).end());
// // Additional middleware
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static(path.join(__dirname, 'public')));



// // Configure express-ejs-layouts and EJS
// app.use(expressLayouts);
// app.set('layout', 'layout'); // Uses views/layout.ejs as the default layout
// app.set('view engine', 'ejs');

// // Authentication middleware: allow access to /login, /logout, /adminlogin, and /adminlogout without authentication.
// app.use((req, res, next) => {
//   if (req.session.user || req.session.isAdmin ||
//       req.path === '/login' || req.path === '/logout' ||
//       req.path === '/adminlogin' || req.path === '/adminlogout') {
//     return next();
//   }
//   res.redirect('/login');
// });

// // Routes
// const authRoutes = require('./routes/auth');           // Regular authentication routes
// const authAdminRoutes = require('./routes/authAdmin');   // Admin authentication routes
// const indexRoutes = require('./routes/index');           // Homepage / search etc.
// const supermarketRoutes = require('./routes/supermarkets');
// const totalsRoutes = require('./routes/totals');
// const statsRoutes = require('./routes/stats');           // Admin stats dashboard
// const reportsRouter = require('./routes/reports');

// // Mount the routes in order
// app.use('/', authRoutes);
// app.use('/', authAdminRoutes);
// app.use('/', statsRoutes);
// app.use('/reports', reportsRouter);
// app.use('/totals', totalsRoutes);
// app.use('/', indexRoutes);
// app.use('/supermarkets', supermarketRoutes);




// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));





