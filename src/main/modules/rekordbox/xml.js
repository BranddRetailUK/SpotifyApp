// src/main/modules/rekordbox/xml.js
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { XMLParser } = require('fast-xml-parser');

function guessDefaultXmlPath() {
  // Common defaults; let user override in settings UI
  const home = process.env.HOME || process.env.USERPROFILE;
  const mac = path.join(home, 'Library', 'Pioneer', 'rekordbox', 'export.xml'); // RB5/6 export path when enabled
  const win = path.join(home, 'AppData', 'Roaming', 'Pioneer', 'rekordbox', 'export.xml');
  return process.platform === 'win32' ? win : mac;
}

function toCamelotKey(musicalKey = '') {
  // Very rough placeholder; replace with real key→Camelot map
  // Examples: "C#m" -> "12A", "E" -> "12B"
  const map = {
    'C': '8B','G': '9B','D': '10B','A':'11B','E':'12B','B':'1B','F#':'2B','C#':'3B','G#':'4B','D#':'5B','A#':'6B','F':'7B',
    'Cm':'5A','Gm':'6A','Dm':'7A','Am':'8A','Em':'9A','Bm':'10A','F#m':'11A','C#m':'12A','G#m':'1A','D#m':'2A','A#m':'3A','Fm':'4A'
  };
  const cleaned = musicalKey.replace(/\s+/g, '');
  return map[cleaned] || null;
}

function normalize(str) {
  return String(str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildIndexFromXml(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true
  });
  const doc = parser.parse(xml);
  // Rekordbox XML shape: DJ_PLAYLISTS > COLLECTION > TRACK (attrs) + PLAYLISTS...
  const tracks = doc?.DJ_PLAYLISTS?.COLLECTION?.TRACK || [];
  const list = Array.isArray(tracks) ? tracks : [tracks];
  const index = [];
  for (const t of list) {
    index.push({
      id: t?.Key || t?.TrackID || null,
      title: t?.Name || '',
      artist: t?.Artist || '',
      album: t?.Album || '',
      duration: Number(t?.TotalTime || 0), // seconds
      bpm: t?.AverageBpm ? Number(t.AverageBpm) : (t?.Bpm ? Number(t.Bpm) : null),
      key: t?.Tonality || '',
      camelot: toCamelotKey(t?.Tonality || ''),
      path: t?.Location ? decodeURIComponent(String(t.Location).replace(/^file:\/\//, '')) : null
    });
  }
  // Simple search helpers
  const byId = new Map(index.map(x => [x.id, x]));
  return { index, byId, count: index.length };
}

function watchXml(xmlPath, onUpdate) {
  const watcher = chokidar.watch(xmlPath, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }});
  watcher.on('change', () => {
    try {
      const ix = buildIndexFromXml(xmlPath);
      onUpdate(ix);
    } catch (e) {
      console.error('[RekordboxXML] parse error', e);
    }
  });
  return watcher;
}

module.exports = { guessDefaultXmlPath, buildIndexFromXml, watchXml };
