// src/main/modules/rekordbox/db.js
// Optional: disabled until you’re ready to include better-sqlite3
let Database;
try { Database = require('better-sqlite3'); } catch { /* optional */ }

function openDb(dbPath) {
  if (!Database) throw new Error('better-sqlite3 not installed');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  return db;
}

function getCollection(db) {
  // Table names can vary by version; you’ll need to inspect your DB schema.
  // This is a placeholder to show the idea.
  const rows = db.prepare('SELECT id, title, artist, album, bpm, key, duration, path FROM tracks').all();
  return rows.map(r => ({
    id: r.id, title: r.title, artist: r.artist, album: r.album,
    bpm: r.bpm, key: r.key, duration: r.duration, path: r.path
  }));
}

module.exports = { openDb, getCollection };
