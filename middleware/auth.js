const jwt = require('jsonwebtoken');

// ── Verify JWT for admin routes ───────────────────────────────────────────────
const verifyAdmin = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ── Verify Slack secret (for Slack webhook calls) ─────────────────────────────
const verifySlackSecret = (req, res, next) => {
  const secret = req.headers['x-slack-secret'];
  if (secret !== process.env.SLACK_INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// ── Simple employee token (lighter, no DB check) ──────────────────────────────
const verifyEmployee = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { verifyAdmin, verifyEmployee, verifySlackSecret };
