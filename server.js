require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const listingsRoutes = require('./routes/listings');
const reviewsRoutes = require('./routes/reviews');
const bookingsRoutes = require('./routes/bookings');
const favoritesRoutes = require('./routes/favorites');
const reportsRoutes = require('./routes/reports');
const { initDb } = require('./db/db');

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET — set it in .env locally, or in Vercel Project Settings > Environment Variables.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' })); // matches Vercel's ~4.5MB request body limit
app.use(cookieParser());

// Frontend (index.html, css, js) is served straight from /public
app.use(express.static(path.join(__dirname, 'public')));

// Make sure all tables exist before any API request touches the database.
// Cached as a single promise so warm invocations resolve instantly after the first cold start.
const dbReady = initDb().catch((err) => {
  console.error('Database init failed:', err);
  throw err;
});

app.use('/api', async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database is not ready yet. Please try again in a moment.' });
  }
});

// API routes
app.use('/api', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/listings', reviewsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/reports', reportsRoutes);

// Vercel runs this file as a serverless function and calls the exported app directly,
// so app.listen() should only happen when running locally with `npm start`.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Basera running at http://localhost:${PORT}`);
  });
}

module.exports = app;
