const express = require('express');
const { sql } = require('../db/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

function isAdminEmail(email) {
  return !!process.env.ADMIN_EMAIL && email && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
}

// POST /api/reports — protected, body: { listing_id, reason }
router.post('/', requireAuth, async (req, res) => {
  try {
    const listingId = Number(req.body.listing_id);
    const reason = (req.body.reason || '').trim();
    if (!Number.isInteger(listingId) || !reason) {
      return res.status(400).json({ error: 'A listing and a reason are required.' });
    }
    await sql`INSERT INTO reports (listing_id, reporter_id, reason) VALUES (${listingId}, ${req.user.id}, ${reason})`;
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit report.' });
  }
});

// GET /api/reports — admin only
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isAdminEmail(req.user.email)) return res.status(403).json({ error: 'Admin only.' });
    const result = await sql`
      SELECT reports.id, reports.reason, reports.created_at, listings.id AS listing_id,
             listings.title, users.name AS reporter_name
      FROM reports
      JOIN listings ON listings.id = reports.listing_id
      JOIN users ON users.id = reports.reporter_id
      ORDER BY reports.created_at DESC
    `;
    res.json({ reports: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load reports.' });
  }
});

module.exports = router;
