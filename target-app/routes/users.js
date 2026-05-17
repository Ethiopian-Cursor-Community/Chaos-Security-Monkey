'use strict';

const express = require('express');
const { getDb } = require('../db/init');

const router = express.Router();

router.get('/search', (req, res) => {
  const raw = String(req.query.q ?? '').trim();
  if (!raw) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  const MAX_Q_LEN = 128;
  if (raw.length > MAX_Q_LEN) {
    res.status(400).json({
      error: `"q" must be at most ${MAX_Q_LEN} characters`,
    });
    return;
  }

  if (raw.includes('\0')) {
    res.status(400).json({ error: 'Invalid query parameter "q"' });
    return;
  }

  const db = getDb();
  const sql =
    `SELECT id, username, email, role FROM users WHERE username LIKE '%' || ? || '%'`;

  try {
    const users = db.prepare(sql).all(raw);
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
