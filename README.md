# Basera — Rooms, Hostels & Homes Rental Platform

Real register/login system: Node.js + Express, bcrypt password hashing,
JWT sessions (httpOnly cookie), and **Vercel Postgres** as the database —
built to deploy directly on Vercel.

## What's inside

```
basera-app/
├── server.js              # Express app (works locally AND as a Vercel function)
├── vercel.json             # tells Vercel how to run server.js
├── package.json
├── .env.example             # copy to .env for local dev
├── db/
│   └── db.js                # Postgres connection + creates the users table
├── middleware/
│   └── authMiddleware.js    # verifies JWT on protected routes
├── routes/
│   └── auth.js              # /api/register, /api/login, /api/logout, /api/me
└── public/
    └── index.html            # the Basera site, with a working login/register modal
```

## How auth works

1. **Register** — hashes the password with bcrypt (never stored in plain
   text), saves the user in Postgres, signs a JWT.
2. **Login** — checks email + compares the password hash, signs a JWT.
3. JWT is set as an **httpOnly cookie** — page JavaScript can't read it,
   which protects against XSS token theft.
4. **`GET /api/me`** is protected — reads the cookie, verifies the JWT,
   returns the logged-in user. The frontend calls this on page load to
   decide whether to show "Log in" or "Hi, Name".
5. **Logout** clears the cookie.

---

## Part 1 — Deploy to Vercel (step by step)

### 1. Push this project to GitHub
Create a new GitHub repo and push the `basera-app` folder to it (Vercel
deploys from a git repo).

```bash
cd basera-app
git init
git add .
git commit -m "Basera app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/basera-app.git
git push -u origin main
```

### 2. Import the project into Vercel
- Go to [vercel.com](https://vercel.com) → **Add New → Project**
- Select your `basera-app` GitHub repo → **Import**
- Framework preset: leave as **Other** (don't change anything else yet) →
  click **Deploy** (it will fail on the first try because there's no
  database yet — that's expected, continue to step 3).

### 3. Add Vercel Postgres
- Inside your new project on Vercel → go to the **Storage** tab
- Click **Create Database → Postgres** → follow the prompts, then
  **Connect** it to this project
- Vercel automatically adds the database connection environment variables
  (`POSTGRES_URL`, etc.) to your project — you don't set these manually.

### 4. Add your remaining environment variables
Still in the project → **Settings → Environment Variables**, add:

| Key | Value |
|---|---|
| `JWT_SECRET` | a long random string (generate one below) |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | the email address of the account that should have admin rights (can delete *any* listing, not just their own) |

Generate a secret locally:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 5. Redeploy
Go to the **Deployments** tab → click **⋯** on the latest deployment →
**Redeploy**. This time it will succeed and give you a live URL like
`https://basera-app.vercel.app`.

Visit it, sign up, refresh the page — you'll stay logged in. Every person
who registers is now saved in your real Postgres database, viewable from
the **Storage** tab.

---

## Part 2 — Run it locally too (optional, for testing before you push)

Install the [Vercel CLI](https://vercel.com/docs/cli) once:
```bash
npm install -g vercel
```

Then, inside `basera-app`:
```bash
npm install
vercel link          # connects this folder to your Vercel project
vercel env pull .env.development.local   # pulls the real POSTGRES_URL etc.
```

Open `.env.development.local` and add your `JWT_SECRET` if it isn't there.
Then run:
```bash
npm start
```
Visit **http://localhost:3000** — this now talks to the same live Postgres
database as your deployed site.

---

## Before real users sign up

- Rate-limit `/api/login` and `/api/register` (e.g. `express-rate-limit`)
  to slow down brute-force attempts.
- Add email verification / password reset — this build covers core
  register/login only.
- Keep `JWT_SECRET` out of git — it's already only in `.env` /
  Vercel's environment variables, never committed.

## Extending it

- Add a `bookings` table (foreign key to `users.id`) for real reservations.
- Add a `listings` table so logged-in owners can post their own rooms/
  hostels/homes, replacing the hardcoded cards in `index.html`.
- Add roles (`renter` vs `owner`) — the `users` table already has a `role`
  column defaulted to `renter`, ready to use.
