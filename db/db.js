const { sql } = require('@vercel/postgres');

// Runs on cold start. CREATE TABLE IF NOT EXISTS is safe to run every time.
async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'renter',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      image_data TEXT,
      images TEXT,
      contact_phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Safe to run every cold start — adds columns only if an older table exists without them.
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS images TEXT`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS contact_phone TEXT`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities TEXT`;
  await sql`ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false`;

  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (listing_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      renter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, listing_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

module.exports = { sql, initDb };
