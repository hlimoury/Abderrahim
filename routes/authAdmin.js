// authAdmin.js
const express = require('express');
const router = express.Router();

// Hard-coded admin accounts with scopes
const ADMIN_ACCOUNTS = {
  // Full access admin
  admin:      { password: 'admin', regions: 'ALL' },

  // NEW: City-only admin (stats on City 1 + City 2)
  cityadmin:  { password: 'admin', regions: ['REGION CITY 1', 'REGION CITY 2'] }
};

// GET admin login form
router.get('/adminlogin', (req, res) => {
  res.render('adminLogin', { error: null });
});

// POST admin login
router.post('/adminlogin', (req, res) => {
  const { username, password } = req.body;
  const acc = ADMIN_ACCOUNTS[username];
  if (acc && acc.password === password) {
    req.session.isAdmin = true;
    req.session.adminRegions = acc.regions; // 'ALL' or array of regions
    return res.redirect('/stats');
  }
  return res.render('adminLogin', { error: 'Identifiants incorrects' });
});

// Admin logout
router.get('/adminlogout', (req, res) => {
  req.session.isAdmin = false;
  req.session.adminRegions = null;
  res.redirect('/adminlogin');
});

module.exports = router;
