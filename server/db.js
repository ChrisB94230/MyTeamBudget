const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'budget.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables(db);
  }
  return db;
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      activite TEXT DEFAULT '',
      tribu TEXT DEFAULT '',
      statut TEXT DEFAULT 'Interne',
      etp REAL DEFAULT 1,
      repartition_run REAL DEFAULT 1,
      nb_jours_total REAL DEFAULT 206,
      nb_jours_run REAL DEFAULT 0,
      year INTEGER NOT NULL,
      is_fictive INTEGER DEFAULT 0,
      jan REAL DEFAULT 0, feb REAL DEFAULT 0, mar REAL DEFAULT 0,
      apr REAL DEFAULT 0, may REAL DEFAULT 0, jun REAL DEFAULT 0,
      jul REAL DEFAULT 0, aug REAL DEFAULT 0, sep REAL DEFAULT 0,
      oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec_ REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS consumption (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      resource_id INTEGER NOT NULL,
      consumed REAL DEFAULT 0,
      UNIQUE(year, month, resource_id)
    );

    CREATE TABLE IF NOT EXISTS previsions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'entree',
      name TEXT NOT NULL,
      activite TEXT DEFAULT '',
      tribu TEXT DEFAULT '',
      statut TEXT DEFAULT 'Interne',
      etp REAL DEFAULT 1,
      repartition_run REAL DEFAULT 1,
      date_effet TEXT DEFAULT '',
      motif TEXT DEFAULT '',
      year INTEGER NOT NULL,
      nb_jours_run REAL DEFAULT 0,
      jan REAL DEFAULT 0, feb REAL DEFAULT 0, mar REAL DEFAULT 0,
      apr REAL DEFAULT 0, may REAL DEFAULT 0, jun REAL DEFAULT 0,
      jul REAL DEFAULT 0, aug REAL DEFAULT 0, sep REAL DEFAULT 0,
      oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec_ REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER UNIQUE NOT NULL,
      budget_global_alloue REAL DEFAULT 0,
      reduction_jours REAL DEFAULT 0,
      label_reduction TEXT DEFAULT '',
      nb_jours_ouvrables_interne REAL DEFAULT 206,
      nb_jours_ouvrables_externe REAL DEFAULT 210,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS presence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      resource_id INTEGER NOT NULL,
      jours_travailles REAL DEFAULT 0,
      UNIQUE(year, month, resource_id)
    );
  `);
}

module.exports = { getDb, DB_PATH };
