const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { requireAuth };
