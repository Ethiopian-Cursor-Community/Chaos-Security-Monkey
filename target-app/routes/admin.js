'use strict';

const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/secret', requireAdmin, (_req, res) => {
  res.json({
    flag: 'CHAOS_MONKEY_ADMIN_SECRET',
    message: 'Auth bypassed — this should require a real admin role check.',
  });
});

module.exports = router;
