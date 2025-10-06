// src/main/config/settings.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = path.join(os.homedir(), '.dj-assistant'); // change to app.getPath('userData') after wiring Electron
const FILE = path.join(DIR, 'settings.json');

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({}, null, 2));
}

function load() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function save(patch) {
  const current = load();
  const next = { ...current, ...patch };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { load, save, DIR, FILE };
