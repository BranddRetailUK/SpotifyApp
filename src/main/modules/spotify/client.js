// src/main/modules/spotify/client.js
const fetch = require('node-fetch');
const { getAccessToken, API_BASE } = require('./auth');

async function api(path, init = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  if (!res.ok) throw new Error(`Spotify API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getTrackById(id) {
  return api(`/tracks/${encodeURIComponent(id)}`);
}

async function searchTrack(q, limit = 10) {
  const url = `/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`;
  return api(url).then(r => r.tracks?.items || []);
}

async function getAudioFeatures(ids) {
  const url = `/audio-features?ids=${ids.map(encodeURIComponent).join(',')}`;
  return api(url).then(r => r.audio_features || []);
}

async function recommendations({ seedTracks = [], seedArtists = [], seedGenres = [], targetTempo, targetKey, minEnergy, maxEnergy, limit = 20 }) {
  const p = new URLSearchParams();
  if (seedTracks.length) p.set('seed_tracks', seedTracks.join(','));
  if (seedArtists.length) p.set('seed_artists', seedArtists.join(','));
  if (seedGenres.length) p.set('seed_genres', seedGenres.join(','));
  if (targetTempo) p.set('target_tempo', String(targetTempo));
  if (typeof targetKey === 'number') p.set('target_key', String(targetKey));
  if (minEnergy != null) p.set('min_energy', String(minEnergy));
  if (maxEnergy != null) p.set('max_energy', String(maxEnergy));
  p.set('limit', String(limit));
  return api(`/recommendations?${p.toString()}`).then(r => r.tracks || []);
}

module.exports = { searchTrack, getAudioFeatures, recommendations, getTrackById };
