const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');

// Helper to ensure admin context
function getAdminUser(req) {
  if (req.session.user && req.session.user.role === 'admin') {
    return req.session.user;
  }
  return mockData.users.find(u => u.id === 'USR-099'); // Amit Sharma (admin)
}

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
router.get('/disputes', (req, res) => {
  const admin = getAdminUser(req);

  // BACKEND: replace mockData with scoreService.getOpenDisputes()
  const disputes = mockData.disputes;

  res.render('pages/admin/disputes', {
    title: 'Score Disputes Resolution - BORO Admin',
    admin,
    disputes,
    helpers,
    activeNav: 'admin-disputes'
  });
});

// POST /admin/disputes/:id/resolve - Resolve score dispute
router.post('/disputes/:id/resolve', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { resolution, points_delta, reason } = req.body;
  req.flash('info', 'Not connected yet');
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
