const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getToken(req) {
  const token = req.body && req.body._csrf
    ? req.body._csrf
    : req.get('x-csrf-token') || req.get('x-xsrf-token');
  return typeof token === 'string' ? token : '';
}

function ensureToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function tokensMatch(expected, actual) {
  if (!expected || !actual || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function csrfProtection(req, res, next) {
  const expected = ensureToken(req);
  res.locals.csrfToken = expected;

  if (SAFE_METHODS.has(req.method)) return next();

  // Multipart bodies are parsed by route-specific multer middleware.
  // Those routes call validateToken after parsing the form.
  if (req.is('multipart/form-data')) return next();

  if (!tokensMatch(expected, getToken(req))) {
    return res.status(403).render('pages/errors/403', {
      title: '403 Forbidden - BORO',
      message: 'Invalid or missing security token.'
    });
  }

  next();
}

function validateToken(req, res) {
  const expected = ensureToken(req);
  if (!tokensMatch(expected, getToken(req))) {
    res.status(403).render('pages/errors/403', {
      title: '403 Forbidden - BORO',
      message: 'Invalid or missing security token.'
    });
    return false;
  }
  return true;
}

module.exports = { csrfProtection, validateToken, ensureToken };
