// routes/auth.js — signup/login/logout/me for the username/password account system.
// See server/lib/auth.js for the JWT/cookie helpers and requireAuth middleware, and
// server/routes/api.js for where this router gets mounted.
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const { ObjectId } = require('mongodb');

const { getDb } = require('../db');
const { signToken, COOKIE_NAME, cookieOptions, requireAuth } = require('../lib/auth');

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const BCRYPT_COST = 12;
// bcrypt silently truncates input past 72 bytes rather than hashing the full password — reject
// oversized passwords instead of letting two different long passwords hash identically.
const MAX_PASSWORD_BYTES = 72;

// Precomputed dummy hash (of a value nobody will ever type) so the login route always pays the
// same bcrypt.compare cost whether or not the username exists — otherwise a "found vs not found"
// timing gap leaks which usernames are registered.
const DUMMY_HASH = bcrypt.hashSync('ktw-dummy-password-for-timing-parity', BCRYPT_COST);

// Stacks under the generic 100/min '/api' limiter already applied in server/index.js — this one
// is stricter and scoped only to the credential-guessing surface (signup/login), not the whole API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function validateUsername(username) {
  if (typeof username !== 'string' || username.length < 3 || username.length > 24) {
    return 'username must be 3-24 characters';
  }
  if (!USERNAME_RE.test(username)) {
    return 'username may only contain letters, numbers, and underscores';
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'password must be at least 8 characters';
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return 'password must be 72 bytes or fewer';
  }
  return null;
}

router.post('/auth/signup', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  const usernameErr = validateUsername(username);
  if (usernameErr) return res.status(400).json({ error: usernameErr });
  const passwordErr = validatePassword(password);
  if (passwordErr) return res.status(400).json({ error: passwordErr });

  const db = getDb();
  if (!db) return res.status(503).json({ error: 'service unavailable' });

  const normalizedUsername = username.toLowerCase();

  // Sign the token before writing anything to the DB: if JWT_SECRET is unset (or signing
  // otherwise fails), we must fail before the insert, not after — otherwise the username is
  // permanently squatted by a row nobody can ever log into (a retry just hits the same row and
  // gets a 409), with no recovery path.
  const _id = new ObjectId();
  let token;
  try {
    token = signToken(_id.toString());
  } catch (err) {
    console.error('auth/signup: failed to sign token:', err.message);
    return res.status(500).json({ error: 'failed to create account' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const now = new Date();
    const doc = {
      _id,
      username: normalizedUsername,
      passwordHash,
      teamRepId: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('users').insertOne(doc);

    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(201).json({ username: normalizedUsername, teamRepId: null });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'username already taken' });
    }
    console.error('auth/signup:', err.message);
    res.status(500).json({ error: 'failed to create account' });
  }
});

router.post('/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const db = getDb();
  if (!db) return res.status(503).json({ error: 'service unavailable' });

  const normalizedUsername = username.toLowerCase();

  try {
    const user = await db.collection('users').findOne({ username: normalizedUsername });

    if (!user) {
      // Run the compare anyway against a fixed dummy hash so response time doesn't reveal
      // whether the username exists.
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'invalid username or password' });
    }

    let token;
    try {
      token = signToken(String(user._id));
    } catch (err) {
      console.error('auth/login: failed to sign token:', err.message);
      return res.status(500).json({ error: 'failed to log in' });
    }

    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(200).json({ username: user.username, teamRepId: user.teamRepId ?? null });
  } catch (err) {
    console.error('auth/login:', err.message);
    res.status(500).json({ error: 'failed to log in' });
  }
});

router.post('/auth/logout', (req, res) => {
  // Reuse cookieOptions() (the single source of truth for httpOnly/secure/sameSite/path) rather
  // than hand-writing a subset of it, so logout can't drift from signup/login on those attributes.
  // `maxAge` is deliberately dropped: in the installed express version, passing `maxAge` through
  // to clearCookie() sets a *future* Max-Age/Expires (the cookie's original 7-day one) instead of
  // clearing it — confirmed by testing directly against this express version — so it must be
  // stripped for clearCookie to actually expire the cookie immediately.
  const clearOptions = cookieOptions();
  delete clearOptions.maxAge;
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.status(204).end();
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.status(200).json({ username: req.user.username, teamRepId: req.user.teamRepId ?? null });
});

module.exports = router;
