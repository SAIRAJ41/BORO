const userService = require('../services/userService');

/**
 * Attaches the current session user after checking the persistent account state.
 */
exports.attachUser = async (req, res, next) => {
  const user = req.session && req.session.user;
  if (user) {
    try {
      const currentUser = await userService.getById(user.id);
      if (!currentUser || ['suspended', 'rejected'].includes(currentUser.status)) {
        if (req.session.destroy) {
          return req.session.destroy(() => res.redirect('/login'));
        }
        req.session.user = null;
        return res.redirect('/login');
      }
      req.session.user.status = currentUser.status;
      req.session.user.role = currentUser.role;
    } catch (error) {
      return next(error);
    }
  }
  res.locals.currentUser = user || null;
  next();
};

exports.isAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.user || ['suspended', 'rejected'].includes(req.session.user.status)) {
    if (req.session) req.session.returnTo = req.originalUrl;
    req.flash('error', 'Please sign in to continue');
    return res.redirect('/login');
  }
  next();
};

exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user || ['suspended', 'rejected'].includes(req.session.user.status)) {
      if (req.session) req.session.returnTo = req.originalUrl;
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
