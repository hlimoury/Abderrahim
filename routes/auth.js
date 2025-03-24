const express = require('express');
const router = express.Router();

// GET login page
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// POST login: Check credentials and set session
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'M@rjane2025') {
    req.session.user = username;
    res.redirect('/');  // Redirect to home after login
  } else {
    res.render('login', { error: 'Identifiants incorrects' });
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
