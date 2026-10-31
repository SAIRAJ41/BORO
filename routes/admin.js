const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');
const spaceService = require('../services/spaceService');
const scoreService = require('../services/scoreService');
const userService = require('../services/userService');
const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');

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
router.get('/overview', async (req, res, next) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;

  try {
    const [stats, recentAudits] = await Promise.all([
      userService.getAdminCounts(adminId),
      auditService.getEntries({}, 1, 5)
    ]);
    res.render('pages/admin/overview', {
      title: 'Platform Governance Overview - BORO Admin',
      admin,
      stats,
      recentAudits: Array.isArray(recentAudits) ? recentAudits : [],
      helpers,
      activeNav: 'admin-overview'
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/verify-owners - Owner verification queue
router.get('/verify-owners', async (req, res, next) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;

  try {
    const pendingOwners = await userService.getPendingOwners(adminId);
    res.render('pages/admin/verify-owners', {
      title: 'Owner Verification Queue - BORO Admin',
      admin,
      pendingOwners,
      helpers,
      activeNav: 'admin-owners'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/owners/:id/verify - Approve owner verification
router.post(['/owners/:id/verify', '/verify-owners/:id/approve'], async (req, res) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;
  try {
    await userService.approveOwner(
      req.params.id,
      adminId,
      req.body.reason
    );
    req.flash('success', 'Owner verification approved.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to approve owner verification.');
  }
  res.redirect('/admin/verify-owners');
});

// POST /admin/owners/:id/reject - Reject owner verification
router.post(['/owners/:id/reject', '/verify-owners/:id/reject'], async (req, res) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;
  try {
    await userService.rejectOwner(
      req.params.id,
      adminId,
      req.body.reason
    );
    req.flash('success', 'Owner verification rejected.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to reject owner verification.');
  }
  res.redirect('/admin/verify-owners');
});

router.get('/owners/:id/document', async (req, res, next) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;
  try {
    const url = await userService.getOwnerVerificationDocument(
      req.params.id,
      adminId
    );
    res.redirect(url);
  } catch (error) {
    if (error.message.includes('access denied')) {
      return res.status(403).render('pages/errors/403');
    }
    if (error.message.includes('not available')) {
      return res.status(404).render('pages/errors/404', {
        title: 'Identity Document Not Found'
      });
    }
    next(error);
  }
});

// GET /admin/users - User directory & score management
router.get('/users', async (req, res, next) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;

  try {
    const result = await userService.getAllUsers(adminId, req.query.q || '', 1, 100);
    res.render('pages/admin/users', {
      title: 'User & Stewardship Directory - BORO Admin',
      admin,
      users: result.users,
      q: req.query.q || '',
      helpers,
      activeNav: 'admin-users'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:id/suspend - Suspend or unsuspend user
router.post('/users/:id/suspend', async (req, res) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;
  try {
    const user = await userService.getById(req.params.id);
    if (!user || user.role === 'admin') throw new Error('User cannot be suspended.');
    if (user.status === 'suspended') {
      await userService.unsuspend(req.params.id, adminId, req.body.reason);
      req.flash('success', 'User account reactivated.');
    } else {
      await userService.suspend(req.params.id, adminId, req.body.reason);
      req.flash('success', 'User account suspended.');
    }
  } catch (error) {
    req.flash('error', error.message || 'Unable to update user account status.');
  }
  res.redirect('/admin/users');
});

// POST /admin/users/:id/unsuspend - Explicitly unsuspend user
router.post('/users/:id/unsuspend', async (req, res) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;
  try {
    await userService.unsuspend(req.params.id, adminId, req.body.reason);
    req.flash('success', 'User account reactivated.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to reactivate user account.');
  }
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
router.get('/settings', async (req, res, next) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;

  try {
    const settings = await settingsService.getAll(adminId);
    res.render('pages/admin/settings', {
      title: 'Fairness & Platform Settings - BORO Admin',
      admin,
      settings,
      helpers,
      activeNav: 'admin-settings'
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/settings - Update settings
router.post('/settings', async (req, res) => {
  const admin = getAdminUser(req);
  const adminId = (req.session && req.session.user && req.session.user.id) || admin.id;
  try {
    await settingsService.update(req.body, adminId);
    req.flash('success', 'Platform settings updated.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update platform settings.');
  }
  res.redirect('/admin/settings');
});

module.exports = router;
