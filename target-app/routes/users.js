'use strict';

const express = require('express');
const { getDb } = require('../db/init');

const router = express.Router();

// VULNERABLE: classic SQL injection via string concatenation (fix with parameterized queries).
router.get('/search', (req, res) => {
  const q = String(req.query.q ?? '');
  if (!q) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  const db = getDb();
  const sql = `SELECT id, username, email, role FROM users WHERE username LIKE '%${q}%'`;

  try {
    const users = db.prepare(sql).all();
    res.json({ count: users.length, users });
  } catch (err) {
    res.status(500).json({
      error: 'Search failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, username, email, role FROM users WHERE id = ?')
    .get(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});

module.exports = router;
