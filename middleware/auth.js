/**
 * Authentication & Authorization Middleware
 * Provides session user hydration, authentication guard, and role verification.
 */

/**
 * Attaches authenticated session user to res.locals.currentUser (null when signed out).
 * BACKEND: replace session lookups with persistent session store (Redis) or JWT verification.
 */
exports.attachUser = (req, res, next) => {
  // BACKEND: replace with persistent session / JWT store check
  res.locals.currentUser = req.session && req.session.user ? req.session.user : null;

  // BACKEND: wire a real CSRF check
  res.locals.csrfToken = 'demo-csrf-token-xyz';

  next();
};

/**
 * Ensures user is authenticated.
 * If no session user exists, saves returnTo URL and redirects to /login.
 */
exports.isAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.user) {
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    req.flash('error', 'Please sign in to continue');
    return res.redirect('/login');
  }
  next();
};

/**
 * Ensures authenticated user has one of the required roles.
 * Renders 403 Forbidden page if unauthorized.
 * 
 * @param {...string} roles - e.g. 'owner', 'admin'
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.session) {
        req.session.returnTo = req.originalUrl;
      }
      req.flash('error', 'Please sign in to continue');
      return res.redirect('/login');
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('pages/errors/403', {
        title: '403 Forbidden - BORO',
        message: 'You do not have permission to access this page.'
      });
    }

    next();
  };
};
