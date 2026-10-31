const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');
const spaceService = require('../services/spaceService');
const scoreService = require('../services/scoreService');

// Helper to ensure admin context
function getAdminUser(req) {
  if (req.session.user && req.session.user.role === 'admin') {
    return req.session.user;
  }
  return mockData.users.find(u => u.id === 'USR-099'); // Amit Sharma (admin)
}

// GET /admin/listings - Listing approval queue
router.get('/listings', async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status)
      ? req.query.status
      : 'pending';
    const listings = await spaceService.getListings(status);
    res.render('pages/admin/listings', {
      title: 'Listing Review Queue - BORO Admin',
      admin: getAdminUser(req),
      listings,
      status,
      helpers,
      activeNav: 'admin-listings'
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/listings/:id - Listing review detail
router.get('/listings/:id', async (req, res, next) => {
  try {
    const listing = await spaceService.getListingById(req.params.id);
    if (!listing) {
      return res.status(404).render('pages/errors/404', { title: 'Listing Not Found' });
    }
    res.render('pages/admin/listing-review', {
      title: `Review ${listing.name} - BORO Admin`,
      admin: getAdminUser(req),
      listing,
      helpers,
      activeNav: 'admin-listings'
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/listings/:id/document - Short-lived private document access
router.get('/listings/:id/document', async (req, res, next) => {
  try {
    const url = await spaceService.getDocumentAccess(req.params.id, req.session.user);
    res.json({ url, expiresIn: 300 });
  } catch (error) {
    if (error.message.includes('not authorized')) {
      return res.status(403).render('pages/errors/403');
    }
    next(error);
  }
});

router.post('/listings/:id/approve', async (req, res) => {
  try {
    await spaceService.approveListing(req.params.id, req.session.user.id);
    req.flash('success', 'Listing approved.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to approve listing.');
  }
  res.redirect('/admin/listings');
});

router.post('/listings/:id/reject', async (req, res) => {
  try {
    await spaceService.rejectListing(
      req.params.id,
      req.session.user.id,
      req.body.reason
    );
    req.flash('success', 'Listing rejected.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to reject listing.');
  }
  res.redirect('/admin/listings');
});

// GET /admin/overview - Admin system dashboard
router.get('/overview', (req, res) => {
  const admin = getAdminUser(req);

  // BACKEND: replace mockData.computeAdminCounts() with auditService.getSystemCounts()
  const stats = mockData.computeAdminCounts();

  // Recent audit activity
  const recentAudits = mockData.auditLog.slice(-5).reverse();

  res.render('pages/admin/overview', {
    title: 'Platform Governance Overview - BORO Admin',
    admin,
    stats,
    recentAudits,
    helpers,
    activeNav: 'admin-overview'
  });
});

// GET /admin/verify-owners - Owner verification queue
router.get('/verify-owners', (req, res) => {
  const admin = getAdminUser(req);

  // BACKEND: replace mockData with userService.getPendingOwners()
  const pendingOwners = mockData.users.filter(u => u.role === 'owner' && !u.verified);

  res.render('pages/admin/verify-owners', {
    title: 'Owner Verification Queue - BORO Admin',
    admin,
    pendingOwners,
    helpers,
    activeNav: 'admin-owners'
  });
});

// POST /admin/owners/:id/verify - Approve owner verification
router.post('/owners/:id/verify', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/admin/verify-owners');
});

// POST /admin/owners/:id/reject - Reject owner verification
router.post('/owners/:id/reject', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { reason } = req.body;
  req.flash('info', 'Not connected yet');
  res.redirect('/admin/verify-owners');
});

// GET /admin/users - User directory & score management
router.get('/users', (req, res) => {
  const admin = getAdminUser(req);
  const q = (req.query.q || '').toLowerCase();

  // BACKEND: replace mockData.users with userService.getAllUsers(req.query)
  let users = mockData.users;
  if (q) {
    users = users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }

  res.render('pages/admin/users', {
    title: 'User & Stewardship Directory - BORO Admin',
    admin,
    users,
    q: req.query.q || '',
    helpers,
    activeNav: 'admin-users'
  });
});

// POST /admin/users/:id/suspend - Suspend or unsuspend user
router.post('/users/:id/suspend', (req, res) => {
  // BACKEND TODO: toggle user status, cancel active bookings if suspended, write audit log with reason
  const { reason } = req.body;
  req.flash('info', 'User account status updated (demo).');
  res.redirect('/admin/users');
});

// GET /admin/disputes - Open score disputes queue
router.get('/disputes', async (req, res, next) => {
  try {
    const disputes = await scoreService.getDisputes();
    res.render('pages/admin/disputes', {
      title: 'Score Disputes Resolution - BORO Admin',
      admin: getAdminUser(req),
      disputes,
      helpers,
      activeNav: 'admin-disputes'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/disputes/:id/resolve - Resolve score dispute
router.post('/disputes/:id/resolve', async (req, res) => {
  try {
    await scoreService.resolveDispute(
      req.params.id,
      req.body.resolution,
      req.body.reason,
      req.session.user.id
    );
    req.flash('success', 'Dispute resolved.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to resolve dispute.');
  }
  res.redirect('/admin/disputes');
});

// GET /admin/audit-log - Searchable append-only audit trail
router.get('/audit-log', (req, res) => {
  const admin = getAdminUser(req);
  const actionFilter = req.query.action || 'all';

  // BACKEND: replace mockData with auditService.getAuditTrail(req.query)
  let logs = mockData.auditLog.slice().reverse();
  if (actionFilter !== 'all') {
    logs = logs.filter(l => l.action.toLowerCase().includes(actionFilter.toLowerCase()));
  }

  res.render('pages/admin/audit-log', {
    title: 'Audit Log & Transparency Trail - BORO Admin',
    admin,
    logs,
    actionFilter,
    helpers,
    activeNav: 'admin-audit'
  });
});

// GET /admin/settings - Fairness parameters
router.get('/settings', (req, res) => {
  const admin = getAdminUser(req);

  // BACKEND: replace mockData with settingsService.getPlatformSettings()
  const settings = {
    max_active_bookings: 2,
    baseline_score: 100,
    max_score: 120,
    clean_return_bonus: 5,
    late_return_penalty: 10,
    untidy_penalty: 10,
    damage_penalty: 30,
    platform_fee_percent: 5,
    cancellation_deadline_hours: 2
  };

  res.render('pages/admin/settings', {
    title: 'Fairness & Platform Settings - BORO Admin',
    admin,
    settings,
    helpers,
    activeNav: 'admin-settings'
  });
});

// POST /admin/settings - Update settings
router.post('/settings', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/admin/settings');
});

module.exports = router;
