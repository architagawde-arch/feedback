const jwt = require('jsonwebtoken');

// Verifies the JWT and attaches { id, roles } to req.user
exports.requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: p.id, roles: p.roles };
    next();
  } catch {
    res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
};

// Role guard: allow('Admin', 'Faculty')
exports.allow = (...roles) => (req, res, next) =>
  req.user.roles.some((r) => roles.includes(r)) ? next() : res.status(403).json({ message: 'You do not have access to this area.' });
