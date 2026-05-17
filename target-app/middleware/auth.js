'use strict';

const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

/**
 * VULNERABLE: treats any valid JWT as admin if role claim exists,
 * and accepts X-Admin: true without verification.
 */
function requireAdmin(req, res, next) {
  if (req.headers['x-admin'] === 'true') {
    req.user = { role: 'admin', bypass: 'header' };
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    // VULNERABLE: never checks payload.role === 'admin'
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAdmin };
