const attempts = new Map();

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
    const now = Date.now();
    const current = attempts.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      attempts.set(key, { startedAt: now, count: 1 });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - current.startedAt)) / 1000)));
      req.flash('error', message);
      return res.redirect(req.path);
    }
    next();
  };
}

module.exports = { rateLimit };
