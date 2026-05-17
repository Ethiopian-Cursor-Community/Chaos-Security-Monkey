'use strict';

const express = require('express');
const health = require('./routes/health');
const users = require('./routes/users');
const auth = require('./routes/auth');
const admin = require('./routes/admin');

const app = express();

app.use(express.json());
app.use(health);
app.use('/api/users', users);
app.use('/api/auth', auth);
app.use('/api/admin', admin);

module.exports = app;
