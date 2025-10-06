// src/main/modules/spotify/auth.js
const crypto = require('crypto');
const fetch = require('node-fetch'); // v2 (CJS)
const { shell } = require('electron');

const { save, load } = require('../../config/settings');
const { encrypt, decrypt } = require('../../util/crypto');
const { startCallbackServer } = require('../../util/http-callback');

const AUTH_BASE = 'https://accounts.spotify.com';
const API_BASE = 'https://api.spotify.com/v1';
const REDIRECT = 'http://localhost:43563/callback';

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkcePair() {
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// Per-install secret to encrypt the refresh token at rest
function getOrInitCryptoSecret() {
  const s = load();
  if (!s.cryptoSecret) {
    const secret = b64url(crypto.randomBytes(32));
    save({ cryptoSecret: secret });
    return secret;
  }
  return s.cryptoSecret;
}

async function exchangeToken(params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error(`Spotify token error: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Launches Spotify OAuth (PKCE). Stores tokens in settings.
 * @param {string} clientId
 * @param {string[]} scopes
 * @returns {Promise<{access_token:string, access_expires_at:number, refresh_token_enc?:string, clientId:string}>}
 */
async function login(clientId, scopes = []) {
  if (!clientId) throw new Error('spotify.login: clientId is required');

  const { verifier, challenge } = pkcePair();
  const state = b64url(crypto.randomBytes(16));

  const authUrl = new URL(`${AUTH_BASE}/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scopes.join(' '));

  // Open system browser using Electron (CJS-safe)
  await shell.openExternal(authUrl.toString());

  // Wait for local callback
  const cb = await startCallbackServer('/callback', 43563);
  if (cb.state !== state) throw new Error('State mismatch in Spotify OAuth');

  // Exchange authorization code for tokens
  const token = await exchangeToken({
    grant_type: 'authorization_code',
    code: cb.code,
    redirect_uri: REDIRECT,
    client_id: clientId,
    code_verifier: verifier
  });

  const secret = getOrInitCryptoSecret();
  const stored = {
    spotify: {
      clientId,
      access_token: token.access_token,
      access_expires_at: Date.now() + (token.expires_in - 30) * 1000,
      refresh_token_enc: token.refresh_token
        ? encrypt(token.refresh_token, secret)
        : load()?.spotify?.refresh_token_enc
    }
  };
  save(stored);
  return stored.spotify;
}

/**
 * Returns a valid access token, refreshing if needed.
 */
async function getAccessToken() {
  const s = load();
  if (!s.spotify || !s.spotify.access_token) throw new Error('Not logged into Spotify');

  if (Date.now() < s.spotify.access_expires_at) {
    return s.spotify.access_token;
  }

  // Refresh flow
  const secret = getOrInitCryptoSecret();
  const refresh_token = decrypt(s.spotify.refresh_token_enc, secret);

  const res = await exchangeToken({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: s.spotify.clientId
  });

  const next = {
    ...s,
    spotify: {
      ...s.spotify,
      access_token: res.access_token,
      access_expires_at: Date.now() + (res.expires_in - 30) * 1000,
      // Spotify may or may not return a new refresh token
      refresh_token_enc: res.refresh_token ? encrypt(res.refresh_token, secret) : s.spotify.refresh_token_enc
    }
  };
  save(next);
  return next.spotify.access_token;
}

module.exports = { login, getAccessToken, API_BASE };
