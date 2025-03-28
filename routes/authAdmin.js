const express = require('express');
const router = express.Router();

// GET admin login form
router.get('/adminlogin', (req, res) => {
  res.render('adminLogin', { error: null });
});

// POST admin login
router.post('/adminlogin', (req, res) => {
  const { username, password } = req.body;
  // Check credentials
  if (username === 'admin' && password === 'admin') {
    req.session.isAdmin = true; // Mark user as admin
    return res.redirect('/stats');
  } else {
    return res.render('adminLogin', { error: 'Identifiants incorrects' });
  }
});

// Admin logout
router.get('/adminlogout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/adminlogin');
});

module.exports = router;
