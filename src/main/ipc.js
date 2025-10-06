// src/main/ipc.js
const { ipcMain } = require('electron');
const { save, load } = require('./config/settings');
const { login } = require('./modules/spotify/auth');
const { searchTrack, getAudioFeatures, recommendations } = require('./modules/spotify/client');
const { guessDefaultXmlPath, buildIndexFromXml, watchXml } = require('./modules/rekordbox/xml');

let libraryIndex = null;
let xmlWatcher = null;

function initIpc() {
  ipcMain.handle('settings:get', () => load());
  ipcMain.handle('settings:set', (e, patch) => save(patch));

  ipcMain.handle('spotify:login', async (e, { clientId, scopes }) => {
    const s = await login(clientId, scopes);
    return { ok: true, spotify: { hasToken: !!s.access_token }};
  });

  ipcMain.handle('spotify:searchTrack', async (e, q) => searchTrack(q));
  ipcMain.handle('spotify:audioFeatures', async (e, ids) => getAudioFeatures(ids));
  ipcMain.handle('spotify:recommend', async (e, params) => recommendations(params));

  ipcMain.handle('rekordbox:loadXml', (e, xmlPath) => {
    const path = xmlPath || guessDefaultXmlPath();
    libraryIndex = buildIndexFromXml(path);
    // (Re)watch
    if (xmlWatcher) xmlWatcher.close();
    xmlWatcher = watchXml(path, (ix) => { libraryIndex = ix; e.sender.send('rekordbox:libraryUpdated', { count: ix.count }); });
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
