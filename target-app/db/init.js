'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'chaos.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDb() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);

  const count = database.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (count.n === 0) {
    const insert = database.prepare(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    );
    insert.run('alice', 'alice@example.com', 'password123', 'user');
    insert.run('bob', 'bob@example.com', 'password123', 'user');
    insert.run('admin', 'admin@chaos.local', 'super-secret-admin', 'admin');
  }

  return database;
}

module.exports = { initDb, getDb, DB_PATH };
