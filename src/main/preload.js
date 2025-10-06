// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safe wrapper around ipcRenderer.invoke/receive to limit surface area.
 * All inputs are validated/coerced to primitives/known shapes before sending.
 */

function on(channel, listener) {
  ipcRenderer.on(channel, listener);
  // return an unsubscribe function
  return () => {
    try { ipcRenderer.off(channel, listener); } catch {}
  };
}

contextBridge.exposeInMainWorld('dj', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    /**
     * @param {object} patch - partial settings to merge
     */
    set: (patch = {}) => ipcRenderer.invoke('settings:set', patch),
  },

  spotify: {
    /**
     * Launches OAuth login (PKCE). You must pass your Spotify Client ID and desired scopes.
     * @param {{clientId: string, scopes?: string[]}} opts
     */
    login: (opts = {}) => {
      const clientId = String(opts.clientId || '').trim();
      const scopes = Array.isArray(opts.scopes) ? opts.scopes.map(String) : [];
      if (!clientId) throw new Error('spotify.login: clientId is required');
      return ipcRenderer.invoke('spotify:login', { clientId, scopes });
    },

    /**
     * Search for tracks on Spotify by query string.
     * @param {string} q
     * @param {number} [limit]
     */
    searchTrack: (q, limit) => {
      const query = String(q || '').trim();
      if (!query) return Promise.resolve([]);
      return ipcRenderer.invoke('spotify:searchTrack', limit ? `${query} limit:${Number(limit)}` : query);
    },

    /**
     * Fetch audio features for a list of track IDs.
     * @param {string[]} ids
     */
    audioFeatures: (ids = []) => {
      const arr = Array.isArray(ids) ? ids.map(String) : [];
      if (!arr.length) return Promise.resolve([]);
      return ipcRenderer.invoke('spotify:audioFeatures', arr);
    },

    /**
     * Get recommendations seeded by tracks/artists/genres and optional targets.
     * @param {{seedTracks?: string[], seedArtists?: string[], seedGenres?: string[],
     *          targetTempo?: number, targetKey?: number, minEnergy?: number, maxEnergy?: number, limit?: number}} params
     */
    recommend: (params = {}) => {
      const safe = {
        seedTracks: Array.isArray(params.seedTracks) ? params.seedTracks.map(String) : [],
        seedArtists: Array.isArray(params.seedArtists) ? params.seedArtists.map(String) : [],
        seedGenres: Array.isArray(params.seedGenres) ? params.seedGenres.map(String) : [],
        targetTempo: params.targetTempo != null ? Number(params.targetTempo) : undefined,
        targetKey: params.targetKey != null ? Number(params.targetKey) : undefined,
        minEnergy: params.minEnergy != null ? Number(params.minEnergy) : undefined,
        maxEnergy: params.maxEnergy != null ? Number(params.maxEnergy) : undefined,
        limit: params.limit != null ? Number(params.limit) : undefined,
      };
      return ipcRenderer.invoke('spotify:recommend', safe);
    },
  },

  rekordbox: {
    /**
     * Load and watch the Rekordbox XML export. If xmlPath is omitted,
     * the backend will guess a default path for the current OS.
     * @param {string} [xmlPath]
     * @returns {Promise<{ok:boolean,count:number}>}
     */
    loadXml: (xmlPath) => ipcRenderer.invoke('rekordbox:loadXml', xmlPath ? String(xmlPath) : undefined),

    /**
     * Search the local RB index by title/artist.
     * @param {{query:string, limit?:number}} args
     * @returns {Promise<Array>}
     */
    searchLocal: (args = {}) => {
      const query = String(args.query || '').trim();
      const limit = args.limit != null ? Number(args.limit) : 25;
      if (!query) return Promise.resolve([]);
      return ipcRenderer.invoke('rekordbox:searchLocal', { query, limit });
    },

    /**
     * Subscribe to library update events (triggered when XML changes).
     * Usage:
     *   const off = window.dj.rekordbox.onLibraryUpdated((ev, payload) => { ... });
     *   // later: off();
     * @param {(event: Electron.IpcRendererEvent, payload: {count:number}) => void} cb
     * @returns {() => void} unsubscribe
     */
    onLibraryUpdated: (cb) => {
      if (typeof cb !== 'function') throw new Error('rekordbox.onLibraryUpdated: callback required');
      return on('rekordbox:libraryUpdated', cb);
    },
  },

  /**
   * Simple utility: listen to any whitelisted channel from the UI if needed later.
   * Keep this list tight to avoid widening the attack surface.
   */
  events: {
    on: (channel, cb) => {
      const allowed = new Set([
        'rekordbox:libraryUpdated',
      ]);
      if (!allowed.has(channel)) throw new Error(`events.on: channel not allowed: ${channel}`);
      if (typeof cb !== 'function') throw new Error('events.on: callback required');
      return on(channel, cb);
    },
  },
});
