// lib/auth.js — JWT signing, cookie config, and the requireAuth middleware for the
// username/password account system (server/routes/auth.js, server/routes/users.js).
//
// Fail-closed on JWT_SECRET, mirroring adminAuth.js's ADMIN_TOKEN pattern: an unset
// secret must refuse to issue or validate tokens rather than fall back to a default
// (a default secret would make every previously-issued/forged token trivially valid).
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const COOKIE_NAME = 'ktw_token';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days — matches cookie maxAge, no refresh flow

// Single source of truth for the cookie's security attributes so signup/login/logout can't drift
// on any one of them (e.g. one route forgetting `secure` in production).
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: JWT_EXPIRY_SECONDS * 1000,
  };
}

// Throws if JWT_SECRET is unset — callers (signup/login handlers) catch this and respond 500,
// logging server-side so the missing env var is visible in Heroku logs without leaking to clients.
function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return jwt.sign({ sub: userId }, secret, { expiresIn: JWT_EXPIRY_SECONDS });
}

// Protects routes that require a logged-in user. Re-fetches the user doc on every request
// (rather than trusting the token payload alone) so a token outliving a deleted account is
// rejected, and so req.user reflects current DB state (e.g. teamRepId) without a stale JWT claim.
async function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('requireAuth: JWT_SECRET is not set — refusing to validate any token');
    return res.status(401).json({ error: 'not authenticated' });
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'not authenticated' });
  }

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    // Same generic message/status for expired, malformed, or tampered tokens — no signal about which.
    return res.status(401).json({ error: 'not authenticated' });
  }

  const db = getDb();
  if (!db) {
    // Distinguish "DB unreachable" from "not logged in" so the client doesn't wrongly redirect to login.
    return res.status(503).json({ error: 'service unavailable' });
  }

  try {
    let user;
    try {
      user = await db.collection('users').findOne({ _id: new ObjectId(payload.sub) });
    } catch {
      // Malformed sub (shouldn't happen for tokens we issued, but a forged/corrupt token could hit this).
      user = null;
    }
    if (!user) {
      return res.status(401).json({ error: 'not authenticated' });
    }

    const safeUser = { ...user };
    delete safeUser.passwordHash;
    req.userId = String(user._id);
    req.user = safeUser;
    next();
  } catch (err) {
    console.error('requireAuth: user lookup failed:', err.message);
    res.status(503).json({ error: 'service unavailable' });
  }
}

module.exports = { signToken, COOKIE_NAME, cookieOptions, requireAuth };
