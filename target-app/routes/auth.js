'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/init');
const { jwtSecret } = require('../config');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, username, email, role, password FROM users WHERE username = ?')
    .get(String(username));

  if (!user || user.password !== String(password)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    jwtSecret,
    { expiresIn: '1h' },
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});

module.exports = router;
