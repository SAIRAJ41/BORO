const express = require('express');
const router = express.Router();
const helpers = require('../lib/helpers');
const spaceService = require('../services/spaceService');
const bookingService = require('../services/bookingService');
const incidentService = require('../services/incidentService');
const notificationService = require('../services/notificationService');
const scoreService = require('../services/scoreService');

// Helper to get active session user or null
function getSessionUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

// GET / or /search - Space discovery
router.get(['/', '/search'], async (req, res, next) => {
  const { space_type, indoor_outdoor, capacity, price_max, purpose, q } = req.query;

  try {
    const result = await spaceService.getSpaces({
      space_type: space_type === 'all' ? undefined : space_type,
      indoor_outdoor: indoor_outdoor === 'all' ? undefined : indoor_outdoor,
      capacity_min: capacity,
      price_max,
      purpose: purpose === 'all' ? undefined : purpose,
      search: q
    });

    res.render('pages/user/search', {
      title: 'Find Community Spaces - BORO',
      spaces: result.spaces,
      filters: req.query,
      helpers,
      activeNav: 'search'
    });
  } catch (error) {
    next(error);
  }
});

// GET /spaces/:id - Space detail page
router.get('/spaces/:id', async (req, res, next) => {
  const spaceId = req.params.id;
  const user = getSessionUser(req);

  try {
    const result = await spaceService.getSpaceById(spaceId);
    if (!result) {
      return res.status(404).render('pages/errors/404', { title: 'Space Not Found' });
    }

    const eligibility = await bookingService.getEligibility(
      user && user.id,
      result.space
    );
    const userScore = user ? user.score : 100;
    res.render('pages/user/space-detail', {
      title: `${result.space.name} - BORO`,
      space: { ...result.space, availability_slots: result.availability_slots || [] },
      owner: result.owner,
      conditionReports: result.conditionReports,
      eligibility: {
        ...eligibility,
        score: userScore,
        tier: helpers.getScoreTier(userScore).tier,
        isUnverifiedOwnerNotice: false
      },
      helpers,
      activeNav: 'search'
    });
  } catch (error) {
    next(error);
  }
});

// POST /bookings - Submit a booking request with demo payment
router.post('/bookings', async (req, res) => {
  const currentUser = getSessionUser(req);
  try {
    await bookingService.create(
      currentUser.id,
      req.body.space_id,
      req.body.slot_id,
      req.body.purpose,
      req.body.group_size || 1,
      req.body.payment_method
    );
    req.flash('success', 'Booking request submitted.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to submit booking request.');
  }
  res.redirect('/my-bookings');
});

// POST /waitlist/:spaceId/:slotId - Join slot waitlist
router.post('/waitlist/:spaceId/:slotId', async (req, res) => {
  try {
    await bookingService.joinWaitlist(
      getSessionUser(req).id,
      req.params.spaceId,
      req.params.slotId
    );
    req.flash('success', 'You joined the waitlist.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to join the waitlist.');
  }
  res.redirect('/my-bookings?tab=waitlisted');
});

// POST /waitlist/:id/leave - Leave slot waitlist
router.post('/waitlist/:id/leave', async (req, res) => {
  try {
    await bookingService.leaveWaitlist(req.params.id, getSessionUser(req).id);
    req.flash('success', 'You left the waitlist.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to leave the waitlist.');
  }
  res.redirect('/my-bookings?tab=waitlisted');
});

// GET /bookings/:id/receipt - View booking receipt
router.get('/bookings/:id/receipt', async (req, res, next) => {
  const bookingId = req.params.id;
  const currentUser = getSessionUser(req);

  try {
    const result = await bookingService.getBookingById(bookingId);
    if (!result) return res.status(404).render('pages/errors/404', { title: 'Booking Not Found' });
    const isBookingOwner = result.booking.userId === currentUser.id;
    const isSpaceOwner = result.space && result.space.ownerId === currentUser.id;
    if (!isBookingOwner && !isSpaceOwner && currentUser.role !== 'admin') {
      return res.status(403).render('pages/errors/403', { title: 'Access Denied' });
    }
    res.render('pages/user/receipt', {
      title: `Receipt for ${result.booking.id} - BORO`,
      booking: { ...result.booking, space: result.space, payments: result.payments },
      helpers,
      activeNav: 'my-bookings'
    });
  } catch (error) {
    next(error);
  }
});

// GET /my-bookings - Active & upcoming bookings
router.get('/my-bookings', async (req, res, next) => {
  const currentUser = getSessionUser(req);
  const activeTab = req.query.tab || 'upcoming';

  try {
    const tab = activeTab === 'completed' ? 'past' : activeTab;
    const [upcoming, completed, allUserBookings, waitlisted] = await Promise.all([
      bookingService.getUserBookings(currentUser.id, 'upcoming'),
      bookingService.getUserBookings(currentUser.id, 'past'),
      bookingService.getUserBookings(currentUser.id, 'all'),
      bookingService.getUserBookings(currentUser.id, 'waitlisted')
    ]);
    const bookings = tab === 'past'
      ? completed
      : tab === 'all'
        ? allUserBookings
        : tab === 'waitlisted'
          ? waitlisted
          : upcoming;
    res.render('pages/user/my-bookings', {
      title: 'My Bookings - BORO',
      bookings,
      waitlist: waitlisted,
      tabs: [
        { id: 'upcoming', label: 'Upcoming / Active', count: upcoming.length, href: '/my-bookings?tab=upcoming' },
        { id: 'waitlisted', label: 'Waitlist', count: waitlisted.length, href: '/my-bookings?tab=waitlisted' },
        { id: 'completed', label: 'Past Bookings', count: completed.length, href: '/my-bookings?tab=completed' },
        { id: 'all', label: 'All', count: allUserBookings.length, href: '/my-bookings?tab=all' }
      ],
      activeTab,
      helpers,
      activeNav: 'my-bookings'
    });
  } catch (error) {
    next(error);
  }
});

// POST /bookings/:id/cancel - Cancel booking with reason
router.post('/bookings/:id/cancel', async (req, res) => {
  try {
    await bookingService.cancel(req.params.id, getSessionUser(req).id, req.body.reason);
    req.flash('success', 'Booking cancelled.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to cancel booking.');
  }
  res.redirect('/my-bookings');
});

// POST /bookings/:id/extend - Request extension
router.post('/bookings/:id/extend', async (req, res) => {
  try {
    await bookingService.requestExtension(
      req.params.id,
      getSessionUser(req).id,
      req.body.additional_hours
    );
    req.flash('success', 'Extension request submitted.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to request extension.');
  }
  res.redirect('/my-bookings');
});

router.post('/bookings/:id/incident', async (req, res) => {
  try {
    await incidentService.report(
      req.params.id,
      getSessionUser(req).id,
      getSessionUser(req).role,
      req.body
    );
    req.flash('success', 'Incident report submitted.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to submit incident report.');
  }
  res.redirect('/history');
});

// POST /bookings/:id/edit - Edit booking
router.post('/bookings/:id/edit', async (req, res) => {
  try {
    await bookingService.edit(req.params.id, getSessionUser(req).id, req.body);
    req.flash('success', 'Booking updated.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update booking.');
  }
  res.redirect('/my-bookings');
});

// GET /my-score - Reliability score view
router.get('/my-score', async (req, res, next) => {
  const currentUser = getSessionUser(req);

  try {
    const score = await scoreService.getUserScore(currentUser.id);
    const scoreEvents = await scoreService.getScoreAuditTrail(currentUser.id);
    res.render('pages/user/my-score', {
      title: 'My Reliability Score - BORO',
      user: { ...currentUser, score: score.score },
      scoreEvents,
      helpers,
      activeNav: 'my-score'
    });
  } catch (error) {
    next(error);
  }
});

// POST /disputes - Submit dispute
router.post('/disputes', async (req, res) => {
  try {
    await scoreService.fileDispute(
      getSessionUser(req).id,
      req.body.score_event_id,
      req.body.reason
    );
    req.flash('success', 'Dispute submitted.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to submit dispute.');
  }
  res.redirect('/my-score');
});

// GET /history - Custodial history with 5-stage lifecycle
router.get('/history', async (req, res, next) => {
  const currentUser = getSessionUser(req);

  try {
    const bookings = await bookingService.getUserHistory(currentUser.id);
    res.render('pages/user/history', {
      title: 'Booking & Custody History - BORO',
      bookings,
      helpers,
      activeNav: 'history'
    });
  } catch (error) {
    next(error);
  }
});

// POST /bookings/:id/rate - Rate space and owner
router.post('/bookings/:id/rate', async (req, res) => {
  try {
    await scoreService.rateBooking(
      req.params.id,
      getSessionUser(req).id,
      req.body.rating,
      req.body.review
    );
    req.flash('success', 'Rating submitted.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to submit rating.');
  }
  res.redirect('/history');
});

// GET /notifications - Notification center
router.get('/notifications', async (req, res, next) => {
  const currentUser = getSessionUser(req);
  const filter = req.query.filter || 'all';

  try {
    const notifications = await notificationService.getUserNotifications(currentUser.id, filter);
    res.render('pages/user/notifications', {
      title: 'Notifications - BORO',
      notifications,
      filter,
      helpers,
      activeNav: 'notifications'
    });
  } catch (error) {
    next(error);
  }
});

// POST /notifications/:id/read - Mark notification read
router.post('/notifications/:id/read', async (req, res) => {
  try {
    await notificationService.markRead(req.params.id, getSessionUser(req).id);
    req.flash('success', 'Notification marked as read.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update notification.');
  }
  res.redirect('/notifications');
});

// POST /notifications/read-all - Mark all read
router.post('/notifications/read-all', async (req, res) => {
  try {
    await notificationService.markAllRead(getSessionUser(req).id);
    req.flash('success', 'All notifications marked as read.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update notifications.');
  }
  res.redirect('/notifications');
});

module.exports = router;
