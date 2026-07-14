const express = require('express');
const { sql } = require('../db/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/favorites/mine — protected
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await sql`SELECT listing_id FROM favorites WHERE user_id = ${req.user.id}`;
    res.json({ favorite_ids: result.rows.map(r => r.listing_id) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load favorites.' });
  }
});

// POST /api/favorites — protected, body: { listing_id }
router.post('/', requireAuth, async (req, res) => {
  try {
    const listingId = Number(req.body.listing_id);
    if (!Number.isInteger(listingId)) return res.status(400).json({ error: 'Invalid listing id.' });
    await sql`
      INSERT INTO favorites (user_id, listing_id) VALUES (${req.user.id}, ${listingId})
      ON CONFLICT (user_id, listing_id) DO NOTHING
    `;
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not save favorite.' });
  }
});

// DELETE /api/favorites/:listingId — protected
router.delete('/:listingId', requireAuth, async (req, res) => {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isInteger(listingId)) return res.status(400).json({ error: 'Invalid listing id.' });
    await sql`DELETE FROM favorites WHERE user_id = ${req.user.id} AND listing_id = ${listingId}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not remove favorite.' });
  }
});

module.exports = router;
