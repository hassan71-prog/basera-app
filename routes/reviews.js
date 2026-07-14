const express = require('express');
const { sql } = require('../db/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/listings/:id/reviews — public
router.get('/:id/reviews', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'Invalid listing id.' });
    }

    const result = await sql`
      SELECT reviews.id, reviews.rating, reviews.comment, reviews.created_at,
             reviews.user_id, users.name AS reviewer_name
      FROM reviews
      JOIN users ON users.id = reviews.user_id
      WHERE reviews.listing_id = ${listingId}
      ORDER BY reviews.created_at DESC
    `;
    res.json({ reviews: result.rows });
  } catch (err) {
    console.error('Fetch reviews error:', err);
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

// POST /api/listings/:id/reviews — protected, one review per user per listing
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'Invalid listing id.' });
    }

    const { rating, comment } = req.body;
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const listing = await sql`SELECT user_id FROM listings WHERE id = ${listingId}`;
    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    if (listing.rows[0].user_id === req.user.id) {
      return res.status(400).json({ error: "You can't review your own listing." });
    }

    const result = await sql`
      INSERT INTO reviews (listing_id, user_id, rating, comment)
      VALUES (${listingId}, ${req.user.id}, ${ratingNum}, ${comment ? comment.trim() : ''})
      ON CONFLICT (listing_id, user_id)
      DO UPDATE SET rating = ${ratingNum}, comment = ${comment ? comment.trim() : ''}, created_at = now()
      RETURNING id, rating, comment, created_at, user_id
    `;

    res.status(201).json({ review: { ...result.rows[0], reviewer_name: req.user.name } });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Could not save your review.' });
  }
});

module.exports = router;
