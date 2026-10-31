const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');
const userService = require('../services/userService');
const { isAuthenticated } = require('../middleware/auth');

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
// BACKEND: replace userService.authenticate with database query and bcrypt.compare
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Validate fields (non-empty, email format)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !password || !emailRegex.test(email.trim())) {
    req.flash('error', 'Invalid email or password');
    return res.redirect('/login');
  }

  try {
    // 2. Call userService.authenticate
    // BACKEND: replace mock lookup with database query and bcrypt.compare
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

// Also support GET /logout for convenience
router.get('/logout', (req, res) => {
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
router.post('/signup', async (req, res) => {
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

// GET /demo/:role - Instant role switcher (sets session through userService.getDemoUser)
router.get('/demo/:role', async (req, res) => {
  // BACKEND: remove demo fast-login endpoint in production (guarded by USE_MOCK)
  const role = req.params.role;

  try {
    const demoUser = await userService.getDemoUser(role);

    // Set session through the same canonical shape as normal login
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
  } catch (err) {
    req.flash('error', 'Unable to sign in as demo user.');
    res.redirect('/login');
  }
});

// GET /profile - User Profile & Verification
router.get('/profile', isAuthenticated, (req, res) => {
  const currentUser = req.session.user;
  
  // BACKEND: replace mockData.getUserById() with userService.getUserById(currentUser.id)
  const user = mockData.getUserById(currentUser.id) || currentUser;
  const userScoreEvents = mockData.scoreEvents.filter(e => e.user_id === user.id);
  const userBookings = mockData.bookings.filter(b => b.user_id === user.id);

  res.render('pages/user/profile', {
    title: 'My Profile & Verification - BORO',
    user,
    scoreEvents: userScoreEvents,
    activeBookingsCount: user.active_bookings_count || 1,
    totalBookingsCount: userBookings.length,
    helpers,
    activeNav: 'profile'
  });
});

// POST /profile/verify - Submit verification documents
router.post('/profile/verify', isAuthenticated, (req, res) => {
  // BACKEND TODO: save uploaded identity document and flag verificationStatus.pending
  req.flash('info', 'Not connected yet');
  res.redirect('/profile');
});

module.exports = router;
