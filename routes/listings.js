const express = require('express');
const { sql } = require('../db/db');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

function isAdminEmail(email) {
  return !!process.env.ADMIN_EMAIL && email && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
}

const VALID_TYPES = ['Room', 'Hostel', 'Home'];
const MAX_IMAGES = 5;
const MAX_TOTAL_IMAGE_CHARS = 3.5 * 1024 * 1024;

function validateListingInput(body) {
  const { title, type, location, price, phone, images } = body;
  if (!title || !type || !location || !price || !phone) {
    return 'Title, type, location, price and a WhatsApp number are all required.';
  }
  if (!VALID_TYPES.includes(type)) return 'Invalid listing type.';
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return 'Enter a valid price.';
  if (!/^[0-9]{10,15}$/.test(String(phone))) {
    return 'Enter a valid WhatsApp number with country code (digits only).';
  }
  if (images) {
    if (!Array.isArray(images) || images.length > MAX_IMAGES) {
      return 'You can upload up to ' + MAX_IMAGES + ' photos.';
    }
    const totalChars = images.reduce((sum, img) => sum + (img ? img.length : 0), 0);
    if (totalChars > MAX_TOTAL_IMAGE_CHARS) return 'Total photo size is too large.';
    for (const img of images) {
      if (typeof img !== 'string' || !img.startsWith('data:image/')) return 'One of the uploaded photos is invalid.';
    }
  }
  return null;
}

// GET /api/listings — public, all listings with rating + favorite count
router.get('/', async (req, res) => {
  try {
    const result = await sql`
      SELECT listings.id, listings.title, listings.type, listings.location,
             listings.price, listings.description, listings.image_data, listings.images,
             listings.contact_phone, listings.created_at, listings.user_id, listings.views,
             listings.amenities, listings.is_verified, users.name AS owner_name,
             COALESCE(AVG(reviews.rating), 0)::float AS avg_rating,
             COUNT(DISTINCT reviews.id)::int AS review_count
      FROM listings
      JOIN users ON listings.user_id = users.id
      LEFT JOIN reviews ON reviews.listing_id = listings.id
      GROUP BY listings.id, users.name
      ORDER BY listings.created_at DESC
    `;
    res.json({ listings: result.rows });
  } catch (err) {
    console.error('Fetch listings error:', err);
    res.status(500).json({ error: 'Could not load listings.' });
  }
});

// POST /api/listings/:id/view — public, increments the view counter (best-effort, fire-and-forget from client)
router.post('/:id/view', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid listing id.' });
    await sql`UPDATE listings SET views = views + 1 WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not record view.' });
  }
});

// POST /api/listings — protected
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, type, location, price, description, phone, images, amenities } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Please add at least one real photo.' });
    }
    const validationError = validateListingInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const priceNum = Number(price);
    const imagesJson = JSON.stringify(images);
    const coverImage = images[0];
    const amenitiesJson = JSON.stringify(Array.isArray(amenities) ? amenities : []);

    const result = await sql`
      INSERT INTO listings (user_id, title, type, location, price, description, image_data, images, contact_phone, amenities)
      VALUES (${req.user.id}, ${title.trim()}, ${type}, ${location.trim()}, ${priceNum}, ${description ? description.trim() : ''}, ${coverImage}, ${imagesJson}, ${String(phone)}, ${amenitiesJson})
      RETURNING id, title, type, location, price, description, image_data, images, contact_phone, amenities, views, is_verified, created_at, user_id
    `;

    res.status(201).json({ listing: { ...result.rows[0], owner_name: req.user.name } });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Could not save your listing. Please try again.' });
  }
});

// PUT /api/listings/:id — protected, owner only
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid listing id.' });

    const existing = await sql`SELECT user_id, image_data, images FROM listings WHERE id = ${id}`;
    const current = existing.rows[0];
    if (!current) return res.status(404).json({ error: 'Listing not found.' });
    if (current.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own listings.' });

    const { title, type, location, price, description, phone, images, amenities } = req.body;
    const validationError = validateListingInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const priceNum = Number(price);
    const hasNewImages = Array.isArray(images) && images.length > 0;
    const imagesJson = hasNewImages ? JSON.stringify(images) : current.images;
    const coverImage = hasNewImages ? images[0] : current.image_data;
    const amenitiesJson = JSON.stringify(Array.isArray(amenities) ? amenities : []);

    const result = await sql`
      UPDATE listings
      SET title = ${title.trim()}, type = ${type}, location = ${location.trim()}, price = ${priceNum},
          description = ${description ? description.trim() : ''}, contact_phone = ${String(phone)},
          image_data = ${coverImage}, images = ${imagesJson}, amenities = ${amenitiesJson}
      WHERE id = ${id}
      RETURNING id, title, type, location, price, description, image_data, images, contact_phone, amenities, views, is_verified, created_at, user_id
    `;
    res.json({ listing: { ...result.rows[0], owner_name: req.user.name } });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Could not update listing.' });
  }
});

// PATCH /api/listings/:id/verify — admin only, toggles the verified badge
router.patch('/:id/verify', requireAuth, async (req, res) => {
  try {
    if (!isAdminEmail(req.user.email)) return res.status(403).json({ error: 'Admin only.' });
    const id = Number(req.params.id);
    const { verified } = req.body;
    const result = await sql`UPDATE listings SET is_verified = ${!!verified} WHERE id = ${id} RETURNING id, is_verified`;
    if (result.rows.length === 0) return res.status(404).json({ error: 'Listing not found.' });
    res.json({ listing: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Could not update verification.' });
  }
});

// DELETE /api/listings/:id — owner or admin
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid listing id.' });

    const result = await sql`SELECT user_id FROM listings WHERE id = ${id}`;
    const listing = result.rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (listing.user_id !== req.user.id && !isAdminEmail(req.user.email)) {
      return res.status(403).json({ error: 'You can only delete your own listings.' });
    }

    await sql`DELETE FROM listings WHERE id = ${id}`;
    res.json({ message: 'Listing deleted.' });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ error: 'Could not delete listing.' });
  }
});

module.exports = router;
