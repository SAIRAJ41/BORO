const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');
const spaceService = require('../services/spaceService');

// Helper to get active session user or Rajesh Kumar (owner)
function getOwnerUser(req) {
  if (req.session.user && req.session.user.role === 'owner') {
    return req.session.user;
  }
  return mockData.users.find(u => u.id === 'USR-003'); // Rajesh Kumar
}

// Compute pending request count for all owner views and sidebars
router.use((req, res, next) => {
  const owner = getOwnerUser(req);
  const ownerSpaces = mockData.spaces.filter(s => s.owner_id === owner.id);
  const ownerSpaceIds = ownerSpaces.map(s => s.id);
  res.locals.pendingRequestsCount = mockData.bookings.filter(b => ownerSpaceIds.includes(b.space_id) && b.status === 'requested').length;
  next();
});

// GET /owner/requests - Incoming booking requests
router.get('/requests', (req, res) => {
  const owner = getOwnerUser(req);

  // BACKEND: replace mockData with spaceService.getOwnerRequests(owner.id)
  const ownerSpaces = mockData.spaces.filter(s => s.owner_id === owner.id);
  const ownerSpaceIds = ownerSpaces.map(s => s.id);
  
  // Requests for owner's spaces
  const requests = mockData.bookings
    .filter(b => ownerSpaceIds.includes(b.space_id) && b.status === 'requested')
    .map(b => {
      const requester = mockData.getUserById(b.user_id) || { name: 'Community Member', score: 90 };
      const space = mockData.getSpaceById(b.space_id);
      return {
        ...b,
        user: requester,
        space: space
      };
    });

  res.render('pages/owner/requests', {
    title: 'Booking Requests - BORO Owner',
    owner,
    requests,
    helpers,
    activeNav: 'owner-requests'
  });
});

// POST /owner/requests/:id/approve - Approve booking request
router.post('/requests/:id/approve', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { reason } = req.body;
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/requests');
});

// POST /owner/requests/:id/reject - Reject booking request
router.post('/requests/:id/reject', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { reason } = req.body;
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/requests');
});

// POST /owner/requests/:id/waitlist - Move request to waitlist
router.post('/requests/:id/waitlist', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { reason } = req.body;
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/requests');
});

// GET /owner/my-spaces - Manage owner's spaces
router.get('/my-spaces', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const spaces = await spaceService.getOwnerSpaces(owner.id);
    res.render('pages/owner/my-spaces', {
      title: 'My Listed Spaces - BORO Owner',
      owner,
      spaces,
      helpers,
      activeNav: 'owner-spaces'
    });
  } catch (error) {
    next(error);
  }
});

// GET /owner/spaces/add - Add new space form
router.get('/spaces/add', (req, res) => {
  const owner = getOwnerUser(req);

  res.render('pages/owner/space-form', {
    title: 'List a New Space - BORO Owner',
    owner,
    space: null,
    isEdit: false,
    helpers,
    activeNav: 'owner-spaces'
  });
});

// POST /owner/spaces - Create new space
router.post('/spaces', async (req, res) => {
  const owner = getOwnerUser(req);

  try {
    await spaceService.create(owner.id, req.body);
    req.flash('success', 'Space submitted for admin review.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to submit space.');
  }
  res.redirect('/owner/my-spaces');
});

// GET /owner/spaces/:id/edit - Edit space form
router.get('/spaces/:id/edit', async (req, res, next) => {
  const owner = getOwnerUser(req);
  const spaceId = req.params.id;

  // BACKEND: replace mockData with spaceService.getSpaceById(spaceId)
  try {
    const result = await spaceService.getSpaceById(spaceId, { publicOnly: false });
    const space = result && result.space;
    if (!space) return res.status(404).render('pages/errors/404');

  // Verify ownership
    if (space.owner_id !== owner.id && owner.role !== 'admin') {
      return res.status(403).render('pages/errors/403');
    }

    res.render('pages/owner/space-form', {
    title: `Edit ${space.name} - BORO Owner`,
    owner,
    space,
    isEdit: true,
    helpers,
    activeNav: 'owner-spaces'
    });
  } catch (error) {
    next(error);
  }
});

// POST /owner/spaces/:id - Update space
router.post('/spaces/:id', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await spaceService.update(req.params.id, owner.id, req.body);
    req.flash('success', 'Space updated.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update space.');
  }
  res.redirect('/owner/my-spaces');
});

// GET /owner/calendar - Weekly slot schedule & conflicts
router.get('/calendar', (req, res) => {
  const owner = getOwnerUser(req);

  // BACKEND: replace mockData with bookingService.getOwnerCalendar(owner.id)
  const ownerSpaces = mockData.spaces.filter(s => s.owner_id === owner.id);
  const ownerSpaceIds = ownerSpaces.map(s => s.id);

  const bookings = mockData.bookings.filter(b => ownerSpaceIds.includes(b.space_id));

  // Identify overlapping conflicts (e.g. BK-1009 and BK-1011)
  const conflicts = [
    {
      slot_desc: 'Tomorrow 10:00 AM - 01:00 PM',
      space_name: 'Shanti Niketan Community Hall',
      bookings: [
        mockData.getBookingById('BK-1009'),
        mockData.getBookingById('BK-1011')
      ].filter(Boolean)
    }
  ];

  res.render('pages/owner/calendar', {
    title: 'Space Calendar & Conflict Manager - BORO Owner',
    owner,
    spaces: ownerSpaces,
    bookings,
    conflicts,
    helpers,
    activeNav: 'owner-calendar'
  });
});

// GET /owner/today - Operational check-ins and returns
router.get('/today', (req, res) => {
  const owner = getOwnerUser(req);

  // BACKEND: replace mockData with bookingService.getTodayOperations(owner.id)
  const ownerSpaces = mockData.spaces.filter(s => s.owner_id === owner.id);
  const ownerSpaceIds = ownerSpaces.map(s => s.id);

  const checkinsDue = mockData.bookings.filter(b => 
    ownerSpaceIds.includes(b.space_id) && b.status === 'approved'
  );

  const returnsDue = mockData.bookings.filter(b => 
    ownerSpaceIds.includes(b.space_id) && ['checked_in', 'overdue'].includes(b.status)
  );

  res.render('pages/owner/today', {
    title: "Today's Check-ins & Returns - BORO Owner",
    owner,
    checkinsDue,
    returnsDue,
    helpers,
    activeNav: 'owner-today'
  });
});

// POST /owner/checkin/:id - Complete check-in
router.post('/owner/checkin/:id', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/today');
});

// POST /owner/return/:id - Complete return
router.post('/owner/return/:id', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/today');
});

// POST /owner/today/:id/flag - Flag incident
router.post('/owner/today/:id/flag', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/incidents');
});

// POST /owner/today/:id/no-show - Mark no-show
router.post('/owner/today/:id/no-show', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/today');
});

// POST /owner/bookings/:id/mark-paid - Mark payment received (Pay at venue)
router.post('/owner/bookings/:id/mark-paid', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/today');
});

// POST /owner/bookings/:id/approve-extension - Approve time extension
router.post('/owner/bookings/:id/approve-extension', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/today');
});

// POST /owner/bookings/:id/reject-extension - Reject time extension
router.post('/owner/bookings/:id/reject-extension', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/today');
});

// GET /owner/incidents - Damage reports and deposit deductions
router.get('/incidents', (req, res) => {
  const owner = getOwnerUser(req);

  // BACKEND: replace mockData with incidentService.getIncidentsByOwner(owner.id)
  const incidents = mockData.incidents;

  res.render('pages/owner/incidents', {
    title: 'Incidents & Deposit Deductions - BORO Owner',
    owner,
    incidents,
    helpers,
    activeNav: 'owner-incidents'
  });
});

// POST /owner/incidents/:id/confirm - Confirm deposit deduction
router.post('/owner/incidents/:id/confirm', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/incidents');
});

// POST /owner/incidents/:id/waive - Waive incident damages
router.post('/owner/incidents/:id/waive', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/incidents');
});

// GET /owner/history - Custodial archives
router.get('/history', (req, res) => {
  const owner = getOwnerUser(req);

  // BACKEND: replace mockData with bookingService.getOwnerCompletedBookings(owner.id)
  const ownerSpaces = mockData.spaces.filter(s => s.owner_id === owner.id);
  const ownerSpaceIds = ownerSpaces.map(s => s.id);

  const pastBookings = mockData.bookings.filter(b => 
    ownerSpaceIds.includes(b.space_id) && ['completed', 'cancelled', 'closed'].includes(b.status)
  );

  res.render('pages/owner/history', {
    title: 'Past Bookings & Custody Archives - BORO Owner',
    owner,
    bookings: pastBookings,
    helpers,
    activeNav: 'owner-history'
  });
});

// GET /owner/earnings - Revenue KPIs & Payout ledger
router.get('/earnings', (req, res) => {
  const owner = getOwnerUser(req);

  // BACKEND: replace mockData with settingsService.getOwnerEarnings(owner.id)
  const earnings = {
    gross: 18400,
    netPayout: 17480,
    platformFee: 920,
    completedBookings: 8,
    utilizationRate: '78%'
  };

  const payouts = [
    { id: 'PAY-801', date: new Date().toISOString(), amount: 7200, method: 'UPI (rajesh@oksbi)', status: 'paid' },
    { id: 'PAY-792', date: new Date(Date.now() - 7 * 86400000).toISOString(), amount: 10280, method: 'UPI (rajesh@oksbi)', status: 'paid' }
  ];

  res.render('pages/owner/earnings', {
    title: 'Earnings & Payouts - BORO Owner',
    owner,
    earnings,
    payouts,
    helpers,
    activeNav: 'owner-earnings'
  });
});

// POST /owner/payout-method - Set payout method
router.post('/payout-method', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/owner/earnings');
});

module.exports = router;
