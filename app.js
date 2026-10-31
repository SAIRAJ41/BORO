/**
 * BORO — Community Space Sharing Platform
 * Main Express Application
 */

const express = require('express');
const path = require('path');
const { expressEjsEngine } = require('./lib/ejsEngine');
const sessionMiddleware = require('./lib/sessionMiddleware');
const helpers = require('./lib/helpers');
const mockData = require('./data/mock');
const { attachUser, isAuthenticated, requireRole } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const ownerRoutes = require('./routes/owner');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine
app.engine('ejs', expressEjsEngine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body Parser Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Session & Flash Middleware
app.use(sessionMiddleware());

// Attach Session User to res.locals.currentUser
app.use(attachUser);

// Route helper to determine active navigation tab
function getActiveRoute(pathname) {
  if (pathname === '/' || pathname.startsWith('/search') || pathname.startsWith('/spaces')) return 'search';
  if (pathname.startsWith('/my-bookings')) return 'my-bookings';
  if (pathname.startsWith('/my-score')) return 'my-score';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/notifications')) return 'notifications';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/owner/requests')) return 'owner-requests';
  if (pathname.startsWith('/owner/spaces') || pathname.startsWith('/owner/my-spaces')) return 'owner-spaces';
  if (pathname.startsWith('/owner/calendar')) return 'owner-calendar';
  if (pathname.startsWith('/owner/today')) return 'owner-today';
  if (pathname.startsWith('/owner/incidents')) return 'owner-incidents';
  if (pathname.startsWith('/owner/history')) return 'owner-history';
  if (pathname.startsWith('/owner/earnings')) return 'owner-earnings';
  if (pathname.startsWith('/admin/overview')) return 'admin-overview';
  if (pathname.startsWith('/admin/verify-owners')) return 'admin-verify-owners';
  if (pathname.startsWith('/admin/users')) return 'admin-users';
  if (pathname.startsWith('/admin/disputes')) return 'admin-disputes';
  if (pathname.startsWith('/admin/audit-log')) return 'admin-audit-log';
  if (pathname.startsWith('/admin/settings')) return 'admin-settings';
  return '';
}

// Global View Context & User Hydration (No auto-setting Priya)
app.use((req, res, next) => {
  const user = req.session && req.session.user ? req.session.user : null;

  if (user) {
    const fullUser = mockData.getUserById ? (mockData.getUserById(user.id) || user) : user;
    res.locals.currentUser = {
      ...user,
      initials: user.initials || helpers.getUserInitials(user.name),
      active_bookings: fullUser.active_bookings_count !== undefined ? fullUser.active_bookings_count : 1,
      tier: helpers.getScoreTier(fullUser.score || 100).tier,
      score: fullUser.score || 100
    };
    res.locals.unreadNotificationsCount = mockData.notifications.filter(n => n.user_id === user.id && !n.read).length;
  } else {
    res.locals.currentUser = null;
    res.locals.unreadNotificationsCount = 0;
  }

  // BACKEND: wire a real CSRF check
  res.locals.csrfToken = 'demo-csrf-token-placeholder-xyz';

  res.locals.activeRoute = getActiveRoute(req.path);
  res.locals.helpers = helpers;
  res.locals.title = 'BORO';

  next();
});

// Mount Public & Authentication Routes
app.use('/', authRoutes);

// Protected User Routes (Require Authentication)
app.use(['/my-bookings', '/my-score', '/history', '/notifications', '/bookings', '/waitlist', '/disputes'], isAuthenticated);

// Protected Owner Routes (Require Authentication and Owner Role)
app.use('/owner', isAuthenticated, requireRole('owner'), ownerRoutes);

// Protected Admin Routes (Require Authentication and Admin Role)
app.use('/admin', isAuthenticated, requireRole('admin'), adminRoutes);

// Public User Browsing Routes (/ and /search and /spaces/:id)
app.use('/', userRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('pages/errors/404', {
    title: '404 - Space Not Found'
  });
});

// 500 Error Handler
app.use((err, req, res, next) => {
  console.error('BORO Server Error:', err);
  res.status(500).render('pages/errors/500', {
    title: '500 - Server Error',
    error: err
  });
});

// Start Server if directly executed
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 BORO frontend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
