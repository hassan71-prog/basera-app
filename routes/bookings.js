const express = require('express');
const { sql } = require('../db/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/bookings — protected, create a booking request as the renter
router.post('/', requireAuth, async (req, res) => {
  try {
    const { listing_id, message } = req.body;
    const listingId = Number(listing_id);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'Invalid listing id.' });
    }

    const listing = await sql`SELECT user_id, title FROM listings WHERE id = ${listingId}`;
    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    if (listing.rows[0].user_id === req.user.id) {
      return res.status(400).json({ error: "You can't request your own listing." });
    }

    const result = await sql`
      INSERT INTO bookings (listing_id, renter_id, message)
      VALUES (${listingId}, ${req.user.id}, ${message ? message.trim() : ''})
      RETURNING id, listing_id, renter_id, message, status, created_at
    `;

    res.status(201).json({ booking: result.rows[0] });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Could not send booking request.' });
  }
});

// GET /api/bookings/mine — protected, requests the current user has sent
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await sql`
      SELECT bookings.id, bookings.message, bookings.status, bookings.created_at,
             listings.id AS listing_id, listings.title, listings.location, listings.image_data
      FROM bookings
      JOIN listings ON listings.id = bookings.listing_id
      WHERE bookings.renter_id = ${req.user.id}
      ORDER BY bookings.created_at DESC
    `;
    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Fetch sent bookings error:', err);
    res.status(500).json({ error: 'Could not load your booking requests.' });
  }
});

// GET /api/bookings/received — protected, requests made on the current user's listings
router.get('/received', requireAuth, async (req, res) => {
  try {
    const result = await sql`
      SELECT bookings.id, bookings.message, bookings.status, bookings.created_at,
             listings.id AS listing_id, listings.title, users.name AS renter_name, users.email AS renter_email
      FROM bookings
      JOIN listings ON listings.id = bookings.listing_id
      JOIN users ON users.id = bookings.renter_id
      WHERE listings.user_id = ${req.user.id}
      ORDER BY bookings.created_at DESC
    `;
    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Fetch received bookings error:', err);
    res.status(500).json({ error: 'Could not load booking requests.' });
  }
});

// PUT /api/bookings/:id — protected, only the listing owner can accept/decline
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid booking id.' });
    }
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or declined.' });
    }

    const existing = await sql`
      SELECT bookings.id, listings.user_id AS owner_id
      FROM bookings
      JOIN listings ON listings.id = bookings.listing_id
      WHERE bookings.id = ${id}
    `;
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (existing.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only manage requests on your own listings.' });
    }

    const result = await sql`
      UPDATE bookings SET status = ${status} WHERE id = ${id}
      RETURNING id, status
    `;
    res.json({ booking: result.rows[0] });
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({ error: 'Could not update booking.' });
  }
});

module.exports = router;
