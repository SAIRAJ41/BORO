const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');
const userService = require('../services/userService');
const { isAuthenticated } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

// GET /login - Login view with optional Quick Demo accounts panel
router.get('/login', (req, res) => {
  // BACKEND: replace mockData with userService.getDemoUsers() or disable panel in production
  res.render('pages/auth/login', {
    title: 'Sign In - BORO',
    layout: 'layouts/auth',
    useMock: mockData.USE_MOCK,
    csrfToken: res.locals.csrfToken,
    activeNav: 'login'
  });
});

// POST /login - Process authentication
// BACKEND: add rate limiting here (e.g. express-rate-limit 5 attempts / 15 minutes)
router.post('/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign-in attempts. Please try again later.'
}), async (req, res) => {
  const { email, password } = req.body;

  // 1. Validate fields (non-empty, email format)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !password || !emailRegex.test(email.trim())) {
    req.flash('error', 'Invalid email or password');
    return res.redirect('/login');
  }

  try {
    // 2. Authenticate against the database-backed user service.
    const user = await userService.authenticate(email, password);

    // If credentials are invalid
    if (!user) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }

    // If account is suspended
    if (user.status === 'suspended') {
      req.flash('error', 'Account suspended, contact admin');
      return res.redirect('/login');
    }

    // 3. Regenerate session to prevent fixation and set session user
    const setupSession = () => {
      // Session user shape: req.session.user = { id, name, email, role, initials, status }. Nothing else, and never the password.
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        status: user.status
      };

      const returnTo = req.session.returnTo;
      delete req.session.returnTo;

      if (returnTo) {
        return res.redirect(returnTo);
      }

      if (user.role === 'admin') return res.redirect('/admin/overview');
      if (user.role === 'owner') return res.redirect('/owner/requests');
      return res.redirect('/search');
    };

    if (req.session.regenerate) {
      req.session.regenerate(() => setupSession());
    } else {
      setupSession();
    }
  } catch (err) {
    req.flash('error', 'An error occurred during authentication');
    res.redirect('/login');
  }
});

// POST /logout - Sign out and terminate session
router.post('/logout', (req, res) => {
  // BACKEND: destroy session in Redis/DB store, clear authentication cookies
  if (req.session.destroy) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  } else {
    req.session.user = null;
    res.redirect('/login');
  }
});

// GET /signup - Registration view
router.get('/signup', (req, res) => {
  res.render('pages/auth/signup', {
    title: 'Create Account - BORO',
    layout: 'layouts/auth',
    csrfToken: res.locals.csrfToken,
    activeNav: 'signup'
  });
});

// POST /signup - Process registration
router.post('/signup', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts. Please try again later.'
}), async (req, res) => {
  // BACKEND: validate with schema validator (e.g. zod/joi), hash password with bcrypt, insert into DB
  const { name, email, phone, password, confirm_password, role, organisation } = req.body;

  if (!name || !email || !password) {
    req.flash('error', 'Please fill in all required fields.');
    return res.redirect('/signup');
  }

  if (password !== confirm_password) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/signup');
  }

  if (!['user', 'owner'].includes(role)) {
    req.flash('error', 'Invalid account role.');
    return res.redirect('/signup');
  }

  try {
    await userService.create({ name, email, phone, password, role, organisation });

    if (role === 'owner') {
      req.flash('info', 'Pending admin verification');
    } else {
      req.flash('success', 'Account created');
    }

    res.redirect('/login');
  } catch (err) {
    req.flash('error', 'Failed to create account.');
    res.redirect('/signup');
  }
});

// POST /demo/:role - Development-only demo login shortcut.
router.post('/demo/:role', async (req, res) => {
  if (!mockData.USE_MOCK || process.env.NODE_ENV === 'production') {
    return res.sendStatus(404);
  }
  const role = req.params.role;

  try {
    const demoUser = await userService.getDemoUser(role);

    const setupSession = () => {
      req.session.user = {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        initials: demoUser.initials,
        status: demoUser.status
      };

      req.flash('success', `Signed in as ${demoUser.name} (${demoUser.role})`);

      if (demoUser.role === 'admin') return res.redirect('/admin/overview');
      if (demoUser.role === 'owner') return res.redirect('/owner/requests');
      return res.redirect('/search');
    };
    if (req.session.regenerate) req.session.regenerate(setupSession);
    else setupSession();
  } catch (err) {
    req.flash('error', 'Unable to sign in as demo user.');
    res.redirect('/login');
  }
});

// GET /profile - User Profile & Verification
router.get('/profile', isAuthenticated, async (req, res, next) => {
  const currentUser = req.session.user;

  try {
    const profile = await userService.getProfile(currentUser.id);
    if (!profile) {
      return res.status(404).render('pages/errors/404', {
        title: 'Profile Not Found'
      });
    }

    res.render('pages/user/profile', {
      title: 'My Profile & Verification - BORO',
      user: profile.user,
      scoreEvents: profile.scoreEvents,
      activeBookingsCount: profile.user.active_bookings_count,
      totalBookingsCount: profile.totalBookingsCount,
      helpers,
      activeNav: 'profile'
    });
  } catch (err) {
    next(err);
  }
});

// POST /profile - Update editable fields on the authenticated user's own profile.
router.post('/profile', isAuthenticated, async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.session.user.id, {
      name: req.body.name,
      phone: req.body.phone
    });
    req.session.user = user;
    req.flash('success', 'Profile updated.');
    res.redirect('/profile');
  } catch (err) {
    req.flash('error', err.message || 'Unable to update profile.');
    res.redirect('/profile');
  }
});

// POST /profile/verify - Submit verification documents
router.post('/profile/verify', isAuthenticated, (req, res) => {
  // BACKEND TODO: save uploaded identity document and flag verificationStatus.pending
  req.flash('info', 'Not connected yet');
  res.redirect('/profile');
});

module.exports = router;
