'use strict';

const app = require('./app');
const { port } = require('./config');
const { initDb } = require('./db/init');

initDb();

app.listen(port, () => {
  console.log(`[target-app] listening on http://localhost:${port}`);
});
