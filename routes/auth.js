const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../db/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,               // JS on the page can't read the cookie -> protects against XSS token theft
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAdminEmail(email) {
  return !!process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are all required.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name.trim()}, ${email.toLowerCase()}, ${passwordHash})
      RETURNING id, name, email
    `;
    const user = result.rows[0];
    const token = signToken(user);

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user: { ...user, is_admin: isAdminEmail(user.email) } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, name: user.name, email: user.email, is_admin: isAdminEmail(user.email) } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });
  res.json({ message: 'Logged out.' });
});

// GET /api/me (protected - confirms whether a session is currently valid)
router.get('/me', requireAuth, async (req, res) => {
  const result = await sql`SELECT id, name, email, created_at FROM users WHERE id = ${req.user.id}`;
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const isAdmin = isAdminEmail(user.email);
  res.json({ user: { ...user, is_admin: isAdmin } });
});

module.exports = router;
