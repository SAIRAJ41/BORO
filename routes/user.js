const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');

// Helper to get active session user or null
function getSessionUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

// GET / or /search - Space discovery
router.get(['/', '/search'], (req, res) => {
  const { space_type, indoor_outdoor, capacity, price_max, purpose, q } = req.query;

  // BACKEND: replace mockData.getSpaces() with spaceService.getSpaces(req.query)
  let spaces = mockData.spaces.filter(s => s.active);

  if (space_type && space_type !== 'all') {
    spaces = spaces.filter(s => s.space_type === space_type);
  }
  if (indoor_outdoor && indoor_outdoor !== 'all') {
    spaces = spaces.filter(s => s.indoor_outdoor === indoor_outdoor);
  }
  if (capacity) {
    const minCap = parseInt(capacity);
    if (!isNaN(minCap)) spaces = spaces.filter(s => s.capacity >= minCap);
  }
  if (price_max) {
    const maxP = parseInt(price_max);
    if (!isNaN(maxP)) spaces = spaces.filter(s => s.price_per_hour <= maxP);
  }
  if (purpose && purpose !== 'all') {
    spaces = spaces.filter(s => s.allowed_purposes && s.allowed_purposes.includes(purpose));
  }
  if (q) {
    const term = q.toLowerCase();
    spaces = spaces.filter(s => s.name.toLowerCase().includes(term) || s.locality.toLowerCase().includes(term));
  }

  res.render('pages/user/search', {
    title: 'Find Community Spaces - BORO',
    spaces,
    filters: req.query,
    helpers,
    activeNav: 'search'
  });
});

// GET /spaces/:id - Space detail page
router.get('/spaces/:id', (req, res) => {
  const spaceId = req.params.id;
  const user = getSessionUser(req);

  // BACKEND: replace mockData.getSpaceById() with spaceService.getSpaceById(spaceId)
  const space = mockData.getSpaceById(spaceId);
  if (!space) {
    return res.status(404).render('pages/errors/404', { title: 'Space Not Found' });
  }

  // BACKEND: replace mockData.getOwnerById() with userService.getUserById(space.owner_id)
  const owner = mockData.getUserById(space.owner_id) || { name: 'Community Caretaker', verified: true };

  // BACKEND: replace mockData.getConditionReports() with incidentService.getReportsBySpace(spaceId)
  const conditionReports = mockData.conditionReports.filter(c => c.space_id === spaceId);

  // User eligibility calculation
  const userActiveBookings = user ? mockData.bookings.filter(b => 
    b.user_id === user.id && ['requested', 'approved', 'checked_in', 'overdue'].includes(b.status)
  ).length : 0;

  const userScore = user ? user.score : 100;
  const eligibility = {
    canBook: user ? userActiveBookings < 2 : true,
    activeBookings: userActiveBookings,
    maxActiveBookings: 2,
    score: userScore,
    tier: helpers.getScoreTier(userScore).tier,
    isUnverifiedOwnerNotice: false
  };

  res.render('pages/user/space-detail', {
    title: `${space.name} - BORO`,
    space,
    owner,
    conditionReports,
    eligibility,
    helpers,
    activeNav: 'search'
  });
});

// POST /bookings - Submit a booking request with demo payment
router.post('/bookings', (req, res) => {
  // BACKEND TODO: validate slot availability, check active bookings count <= 2, verify purpose in allowed_purposes, record demo payment transaction, insert booking in 'requested' state, dispatch notification to owner
  const { space_id, purpose, payment_method } = req.body;
  req.flash('success', 'Payment successful (demo). Saving connects with the backend.');
  res.redirect('/my-bookings');
});

// POST /waitlist/:spaceId/:slotId - Join slot waitlist
router.post('/waitlist/:spaceId/:slotId', (req, res) => {
  // BACKEND TODO: append user to FIFO waitlist queue for this slot
  req.flash('info', 'Not connected yet');
  res.redirect('/my-bookings?tab=waitlisted');
});

// POST /waitlist/:id/leave - Leave slot waitlist
router.post('/waitlist/:id/leave', (req, res) => {
  // BACKEND TODO: remove user from waitlist
  req.flash('info', 'Not connected yet');
  res.redirect('/my-bookings?tab=waitlisted');
});

// GET /bookings/:id/receipt - View booking receipt
router.get('/bookings/:id/receipt', (req, res) => {
  const bookingId = req.params.id;
  const currentUser = getSessionUser(req);

  // BACKEND: replace mockData.getBookingById() with bookingService.getBookingById(bookingId)
  const booking = mockData.getBookingById(bookingId);
  if (!booking) {
    return res.status(404).render('pages/errors/404', { title: 'Booking Not Found' });
  }

  // BACKEND: ownership and authorization check
  const isBookingOwner = booking.user_id === currentUser.id;
  const isSpaceOwner = booking.space && booking.space.owner_id === currentUser.id;
  const isAdmin = currentUser.role === 'admin';

  if (!isBookingOwner && !isSpaceOwner && !isAdmin) {
    return res.status(403).render('pages/errors/403', { title: 'Access Denied' });
  }

  res.render('pages/user/receipt', {
    title: `Receipt for ${booking.id} - BORO`,
    booking,
    helpers,
    activeNav: 'my-bookings'
  });
});

// GET /my-bookings - Active & upcoming bookings
router.get('/my-bookings', (req, res) => {
  const currentUser = getSessionUser(req);
  const activeTab = req.query.tab || 'upcoming';

  // BACKEND: replace mockData.getBookingsByUser() with bookingService.getUserBookings(currentUser.id)
  const allUserBookings = mockData.bookings.filter(b => b.user_id === currentUser.id);

  const upcoming = allUserBookings.filter(b => ['requested', 'approved', 'checked_in', 'overdue'].includes(b.status));
  const completed = allUserBookings.filter(b => ['completed', 'cancelled', 'closed'].includes(b.status));
  const waitlisted = mockData.waitlist.filter(w => w.user_id === currentUser.id);

  let displayedBookings = upcoming;
  if (activeTab === 'all') displayedBookings = allUserBookings;
  if (activeTab === 'completed') displayedBookings = completed;

  const tabs = [
    { id: 'upcoming', label: 'Upcoming / Active', count: upcoming.length, href: '/my-bookings?tab=upcoming' },
    { id: 'waitlisted', label: 'Waitlist', count: waitlisted.length, href: '/my-bookings?tab=waitlisted' },
    { id: 'completed', label: 'Past Bookings', count: completed.length, href: '/my-bookings?tab=completed' },
    { id: 'all', label: 'All', count: allUserBookings.length, href: '/my-bookings?tab=all' }
  ];

  res.render('pages/user/my-bookings', {
    title: 'My Bookings - BORO',
    bookings: displayedBookings,
    waitlist: waitlisted,
    tabs,
    activeTab,
    helpers,
    activeNav: 'my-bookings'
  });
});

// POST /bookings/:id/cancel - Cancel booking with reason
router.post('/bookings/:id/cancel', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { reason } = req.body;
  req.flash('info', 'Not connected yet');
  res.redirect('/my-bookings');
});

// POST /bookings/:id/extend - Request extension
router.post('/bookings/:id/extend', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { additional_hours } = req.body;
  req.flash('info', 'Not connected yet');
  res.redirect('/my-bookings');
});

// POST /bookings/:id/edit - Edit booking
router.post('/bookings/:id/edit', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/my-bookings');
});

// GET /my-score - Reliability score view
router.get('/my-score', (req, res) => {
  const currentUser = getSessionUser(req);

  // BACKEND: replace mockData.getUserScoreEvents() with scoreService.getUserScoreLedger(currentUser.id)
  const scoreEvents = mockData.scoreEvents.filter(e => e.user_id === currentUser.id);

  res.render('pages/user/my-score', {
    title: 'My Reliability Score - BORO',
    user: currentUser,
    scoreEvents,
    helpers,
    activeNav: 'my-score'
  });
});

// POST /disputes - Submit dispute
router.post('/disputes', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  const { score_event_id, reason } = req.body;
  req.flash('info', 'Not connected yet');
  res.redirect('/my-score');
});

// GET /history - Custodial history with 5-stage lifecycle
router.get('/history', (req, res) => {
  const currentUser = getSessionUser(req);

  // BACKEND: replace mockData with bookingService.getCompletedBookings(currentUser.id)
  const pastBookings = mockData.bookings.filter(b => 
    b.user_id === currentUser.id && ['completed', 'cancelled', 'closed'].includes(b.status)
  );

  res.render('pages/user/history', {
    title: 'Booking & Custody History - BORO',
    bookings: pastBookings,
    helpers,
    activeNav: 'history'
  });
});

// POST /bookings/:id/rate - Rate space and owner
router.post('/bookings/:id/rate', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/history');
});

// GET /notifications - Notification center
router.get('/notifications', (req, res) => {
  const currentUser = getSessionUser(req);
  const filter = req.query.filter || 'all';

  // BACKEND: replace mockData with notificationService.getNotifications(currentUser.id)
  let notifications = mockData.notifications.filter(n => n.user_id === currentUser.id);
  if (filter === 'unread') {
    notifications = notifications.filter(n => !n.read);
  }

  res.render('pages/user/notifications', {
    title: 'Notifications - BORO',
    notifications,
    filter,
    helpers,
    activeNav: 'notifications'
  });
});

// POST /notifications/:id/read - Mark notification read
router.post('/notifications/:id/read', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/notifications');
});

// POST /notifications/read-all - Mark all read
router.post('/notifications/read-all', (req, res) => {
  // BACKEND TODO: implement action, write audit log entry with reason
  req.flash('info', 'Not connected yet');
  res.redirect('/notifications');
});

module.exports = router;
