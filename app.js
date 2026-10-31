/**
 * BORO — Community Space Sharing Platform
 * Main Express Application
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { expressEjsEngine } = require('./lib/ejsEngine');
const sessionMiddleware = require('./lib/sessionMiddleware');
const helpers = require('./lib/helpers');
const mockData = require('./data/mock');
const prisma = require('./lib/prisma');
const { attachUser, isAuthenticated, requireRole } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const ownerRoutes = require('./routes/owner');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');

// Setup View Engine
app.engine('ejs', expressEjsEngine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Body Parser Middleware
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

// Serve SVG files masquerading as .jpg with correct image/svg+xml MIME type
app.get('/images/spaces/:file', (req, res, next) => {
  const filePath = path.join(__dirname, 'public', 'images', 'spaces', req.params.file);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.trim().startsWith('<svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(content);
      }
    } catch (_) {}
  }
  next();
});

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Session & Flash Middleware
app.use(sessionMiddleware());
app.use(csrfProtection);

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
app.use(async (req, res, next) => {
  const user = req.session && req.session.user ? req.session.user : null;

  if (user) {
    let activeBookingsCount = user.active_bookings_count;
    let unreadCount = 0;
    try {
      const [bCount, nCount] = await Promise.all([
        prisma.booking.count({
          where: {
            userId: user.id,
            status: { in: ['pending', 'approved', 'checked_in'] }
          }
        }).catch(() => null),
        prisma.notification.count({
          where: {
            userId: user.id,
            read: false
          }
        }).catch(() => null)
      ]);
      if (bCount !== null) activeBookingsCount = bCount;
      if (nCount !== null) unreadCount = nCount;
      else unreadCount = (mockData.notifications || []).filter(n => n.user_id === user.id && !n.read).length;
    } catch (_) {
      unreadCount = (mockData.notifications || []).filter(n => n.user_id === user.id && !n.read).length;
    }

    if (activeBookingsCount === undefined || activeBookingsCount === null) {
      activeBookingsCount = 0;
    }

    res.locals.currentUser = {
      ...user,
      initials: user.initials || helpers.getUserInitials(user.name),
      active_bookings: activeBookingsCount,
      tier: helpers.getScoreTier(user.score || 100).tier,
      score: user.score || 100
    };
    res.locals.unreadNotificationsCount = unreadCount;
  } else {
    res.locals.currentUser = null;
    res.locals.unreadNotificationsCount = 0;
  }

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
    title: '500 - Server Error'
  });
});

// Start Server if directly executed
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 BORO frontend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
