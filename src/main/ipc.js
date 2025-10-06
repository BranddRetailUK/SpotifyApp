// src/main/ipc.js
const { ipcMain } = require('electron');
const { save, load } = require('./config/settings');
const { login, DEFAULT_CLIENT_ID } = require('./modules/spotify/auth');
const { searchTrack, getAudioFeatures, recommendations } = require('./modules/spotify/client');
const { guessDefaultXmlPath, buildIndexFromXml, watchXml } = require('./modules/rekordbox/xml');

let libraryIndex = null;
let xmlWatcher = null;

function initIpc() {
  // Settings
  ipcMain.handle('settings:get', () => load());
  ipcMain.handle('settings:set', (e, patch) => save(patch));

  // Spotify
  ipcMain.handle('spotify:login', async (e, opts = {}) => {
    const s = load();
    const clientId = String(opts.clientId || s?.spotify?.clientId || DEFAULT_CLIENT_ID).trim();
    const scopes = Array.isArray(opts.scopes) ? opts.scopes.map(String) : [
      // sane defaults; adjust later as needed
      'user-read-private',
      'user-library-read',
      'playlist-read-private',
      'user-read-playback-state',
      'user-modify-playback-state'
    ];
    const res = await login(clientId, scopes);
    return { ok: true, spotify: { hasToken: !!res.access_token, clientId: res.clientId, redirect_uri: res.redirect_uri } };
  });

  ipcMain.handle('spotify:searchTrack', async (e, q) => searchTrack(q));
  ipcMain.handle('spotify:audioFeatures', async (e, ids) => getAudioFeatures(ids));
  ipcMain.handle('spotify:recommend', async (e, params) => recommendations(params));

  // Rekordbox (XML)
  ipcMain.handle('rekordbox:loadXml', (e, xmlPath) => {
    const path = xmlPath || guessDefaultXmlPath();
    libraryIndex = buildIndexFromXml(path);
    // (Re)watch for changes
    if (xmlWatcher) xmlWatcher.close();
    xmlWatcher = watchXml(path, (ix) => {
      libraryIndex = ix;
      try { e.sender.send('rekordbox:libraryUpdated', { count: ix.count }); } catch (_) {}
    });
    return { ok: true, count: libraryIndex.count };
  });

  ipcMain.handle('rekordbox:searchLocal', (e, { query, limit = 25 }) => {
    if (!libraryIndex) return [];
    const q = String(query || '').toLowerCase();
    const out = [];
    for (const t of libraryIndex.index) {
      if (t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)) {
        out.push(t);
        if (out.length >= limit) break;
      }
    }
    return out;
  });
}

module.exports = { initIpc };
