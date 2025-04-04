const express = require('express');
const router = express.Router();

// Hard-coded accounts:
const accounts = {
  'REGION CENTRE 02': { password: 'M@rjane2003', region: 'REGION CENTRE 02' },
  'REGION SUD': { password: 'M@rjane2003', region: 'REGION SUD' },
  'REGION ORIENT': { password: 'M@rjane2003', region: 'REGION ORIENT' },
  'REGION CENTRE 1': { password: 'M@rjane2003', region: 'REGION CENTRE 1' },
  'REGION NORD': { password: 'M@rjane2003', region: 'REGION NORD' },
  'MAIN': { password: 'M@rjane2003', region: 'ALL' } // main account sees all markets
};

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (accounts[username] && accounts[username].password === password) {
    req.session.user = username;
    req.session.region = accounts[username].region;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Identifiants incorrects' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
