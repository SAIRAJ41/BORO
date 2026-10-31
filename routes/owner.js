const express = require('express');
const router = express.Router();
const mockData = require('../data/mock');
const helpers = require('../lib/helpers');
const spaceService = require('../services/spaceService');
const bookingService = require('../services/bookingService');
const incidentService = require('../services/incidentService');
const ownershipDocumentService = require('../services/ownershipDocumentService');
const propertyPhotoService = require('../services/propertyPhotoService');
const userService = require('../services/userService');
const { validateToken } = require('../middleware/csrf');

// Helper to get active session user or Rajesh Kumar (owner)
function getOwnerUser(req) {
  if (req.session.user && req.session.user.role === 'owner') {
    return req.session.user;
  }
  return mockData.users.find(u => u.id === 'USR-003'); // Rajesh Kumar
}

// Compute pending request count for all owner views and sidebars
router.use(async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const requests = await bookingService.getOwnerRequests(owner.id);
    res.locals.pendingRequestsCount = requests.length;
    next();
  } catch (error) {
    next(error);
  }
});

// GET /owner/requests - Incoming booking requests
router.get('/requests', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const requests = await bookingService.getOwnerRequests(owner.id);
    res.render('pages/owner/requests', {
      title: 'Booking Requests - BORO Owner',
      owner,
      requests,
      helpers,
      activeNav: 'owner-requests'
    });
  } catch (error) {
    next(error);
  }
});

// POST /owner/requests/:id/approve - Approve booking request
router.post('/requests/:id/approve', async (req, res) => {
  const owner = getOwnerUser(req);

  try {
    await bookingService.approve(req.params.id, owner.id, req.body.reason);
    req.flash('success', 'Booking request approved.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to approve booking request.');
  }
  res.redirect('/owner/requests');
});

// POST /owner/requests/:id/reject - Reject booking request
router.post('/requests/:id/reject', async (req, res) => {
  const owner = getOwnerUser(req);

  try {
    await bookingService.reject(req.params.id, owner.id, req.body.reason);
    req.flash('success', 'Booking request rejected.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to reject booking request.');
  }
  res.redirect('/owner/requests');
});

// POST /owner/requests/:id/waitlist - Move request to waitlist
router.post('/requests/:id/waitlist', (req, res) => {
  const owner = getOwnerUser(req);
  bookingService.waitlist(req.params.id, owner.id, req.body.reason)
    .then(() => req.flash('success', 'Booking moved to the waitlist.'))
    .catch(error => req.flash('error', error.message || 'Unable to move booking to the waitlist.'))
    .finally(() => res.redirect('/owner/requests'));
});

// GET /owner/my-spaces - Manage owner's spaces
router.get('/my-spaces', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const [spaces, verificationStatus] = await Promise.all([
      spaceService.getOwnerSpaces(owner.id),
      userService.getOwnerVerificationSummary(owner.id)
    ]);
    res.render('pages/owner/my-spaces', {
      title: 'My Listed Spaces - BORO Owner',
      owner: {
        ...owner,
        verificationStatus,
        verified: Boolean(verificationStatus && verificationStatus.is_verified)
      },
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
function handleDocumentUpload(req, res, next) {
  ownershipDocumentService.uploadMiddleware(req, res, error => {
    if (error) {
      req.flash('error', error.message || 'Invalid ownership document.');
      return res.redirect('/owner/my-spaces');
    }
    if (!validateToken(req, res)) return;
    next();
  });
}

router.post('/spaces', handleDocumentUpload, async (req, res) => {
  const owner = getOwnerUser(req);

  try {
    await spaceService.create(owner.id, req.body, req.file);
    req.flash('success', 'Space submitted for admin review.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to submit space.');
  }
  res.redirect('/owner/my-spaces');
});

// GET /owner/spaces/:id - Private owner listing detail
router.get('/spaces/:id', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const space = await spaceService.getOwnerSpaceById(req.params.id, owner.id);
    if (!space) {
      return res.status(404).render('pages/errors/404', {
        title: 'Space Not Found'
      });
    }

    res.render('pages/owner/space-detail', {
      title: `${space.name} - Owner Listing`,
      owner,
      space,
      helpers,
      activeNav: 'owner-spaces'
    });
  } catch (error) {
    next(error);
  }
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
router.post('/spaces/:id', handleDocumentUpload, async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await spaceService.update(req.params.id, owner.id, {
      ...req.body,
      documentFile: req.file
    });

    function handlePhotoUpload(req, res, next) {
      propertyPhotoService.uploadMiddleware(req, res, error => {
        if (error) {
          req.flash('error', error.message || 'Invalid property photo.');
          return res.redirect(`/owner/spaces/${req.params.id}`);
        }
        if (!validateToken(req, res)) return;
        next();
      });
    }

    router.post('/spaces/:id/photos', handlePhotoUpload, async (req, res) => {
      const owner = getOwnerUser(req);
      try {
        await propertyPhotoService.add(req.params.id, owner.id, req.files);
        req.flash('success', 'Property photos uploaded.');
      } catch (error) {
        req.flash('error', error.message || 'Unable to upload property photos.');
      }
      res.redirect(`/owner/spaces/${req.params.id}`);
    });

    router.post('/spaces/:id/photos/:photoId/replace', handlePhotoUpload, async (req, res) => {
      const owner = getOwnerUser(req);
      try {
        if (!req.files || req.files.length !== 1) {
          throw new Error('Select exactly one replacement photo.');
        }
        await propertyPhotoService.replace(
          req.params.id,
          owner.id,
          req.params.photoId,
          req.files[0]
        );
        req.flash('success', 'Property photo replaced.');
      } catch (error) {
        req.flash('error', error.message || 'Unable to replace property photo.');
      }
      res.redirect(`/owner/spaces/${req.params.id}`);
    });

    router.post('/spaces/:id/photos/:photoId/delete', async (req, res) => {
      const owner = getOwnerUser(req);
      try {
        await propertyPhotoService.remove(req.params.id, owner.id, req.params.photoId);
        req.flash('success', 'Property photo deleted.');
      } catch (error) {
        req.flash('error', error.message || 'Unable to delete property photo.');
      }
      res.redirect(`/owner/spaces/${req.params.id}`);
    });
    req.flash('success', 'Space updated.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update space.');
  }
  res.redirect('/owner/my-spaces');
});

// GET /owner/spaces/:id/document - Short-lived private document access
router.get('/spaces/:id/document', async (req, res, next) => {
  try {
    const url = await spaceService.getDocumentAccess(req.params.id, req.session.user);
    res.json({ url, expiresIn: 300 });
  } catch (error) {
    if (error.message.includes('not authorized')) {
      return res.status(403).render('pages/errors/403');
    }
    if (error.message.includes('not available')) {
      return res.status(404).render('pages/errors/404', {
        title: 'Ownership Document Not Found'
      });
    }
    next(error);
  }
});

// GET /owner/calendar - Weekly slot schedule & conflicts
router.get('/calendar', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const calendar = await bookingService.getOwnerCalendar(owner.id);
    const availability = await bookingService.getOwnerAvailability(owner.id);
    const spaces = (await spaceService.getOwnerSpaces(owner.id))
      .filter(space => space.active && space.listing_status === 'approved');
    const bookings = Object.values(calendar.bookingsByDay || {}).flat();

    res.render('pages/owner/calendar', {
      title: 'Space Calendar & Conflict Manager - BORO Owner',
      owner,
      spaces,
      availability,
      bookings,
      conflicts: [],
      helpers,
      activeNav: 'owner-calendar'
    });
  } catch (error) {
    next(error);
  }
});

// POST /owner/availability - Create an availability slot
router.post('/availability', async (req, res) => {
  const owner = getOwnerUser(req);

  try {
    await bookingService.createAvailabilitySlot(owner.id, req.body);
    req.flash('success', 'Availability slot created.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to create availability slot.');
  }
  res.redirect('/owner/calendar');
});

// POST /owner/availability/:id - Update an availability slot
router.post('/availability/:id', async (req, res) => {
  const owner = getOwnerUser(req);

  try {
    await bookingService.updateAvailabilitySlot(req.params.id, owner.id, req.body);
    req.flash('success', 'Availability slot updated.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update availability slot.');
  }
  res.redirect('/owner/calendar');
});

// POST /owner/availability/:id/delete - Delete an availability slot
router.post('/availability/:id/delete', async (req, res) => {
  const owner = getOwnerUser(req);

  try {
    await bookingService.deleteAvailabilitySlot(
      req.params.id,
      owner.id,
      req.body.reason
    );
    req.flash('success', 'Availability slot deleted.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to delete availability slot.');
  }
  res.redirect('/owner/calendar');
});

// GET /owner/today - Operational check-ins and returns
router.get('/today', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const operations = await bookingService.getOwnerToday(owner.id);
    res.render('pages/owner/today', {
      title: "Today's Check-ins & Returns - BORO Owner",
      owner,
      checkinsDue: operations.checkins,
      returnsDue: operations.returns,
      helpers,
      activeNav: 'owner-today'
    });
  } catch (error) {
    next(error);
  }
});

// POST /owner/checkin/:id - Complete check-in
router.post('/checkin/:id', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await bookingService.checkin(
      req.params.id,
      owner.id,
      req.body,
      req.body.condition_notes
    );
    req.flash('success', 'Check-in completed.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to complete check-in.');
  }
  res.redirect('/owner/today');
});

// POST /owner/return/:id - Complete return
router.post('/return/:id', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await bookingService.return(
      req.params.id,
      owner.id,
      req.body,
      req.body.condition_notes
    );
    req.flash('success', 'Return completed.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to complete return.');
  }
  res.redirect('/owner/today');
});

// POST /owner/today/:id/flag - Flag incident
router.post('/today/:id/flag', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await incidentService.createFromReturn(req.params.id, owner.id, req.body);
    req.flash('success', 'Incident reported.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to report incident.');
  }
  res.redirect('/owner/incidents');
});

// POST /owner/today/:id/no-show - Mark no-show
router.post('/today/:id/no-show', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await bookingService.markNoShow(req.params.id, owner.id, req.body.reason);
    req.flash('success', 'Booking marked as no-show.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to mark no-show.');
  }
  res.redirect('/owner/today');
});

// POST /owner/bookings/:id/mark-paid - Mark payment received (Pay at venue)
router.post('/bookings/:id/mark-paid', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await bookingService.markPaymentReceived(req.params.id, owner.id);
    req.flash('success', 'Payment marked as received.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to mark payment received.');
  }
  res.redirect('/owner/today');
});

// POST /owner/bookings/:id/approve-extension - Approve time extension
router.post('/bookings/:id/approve-extension', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await bookingService.approveExtension(req.params.id, owner.id);
    req.flash('success', 'Extension approved.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to approve extension.');
  }
  res.redirect('/owner/today');
});

// POST /owner/bookings/:id/reject-extension - Reject time extension
router.post('/bookings/:id/reject-extension', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await bookingService.rejectExtension(req.params.id, owner.id, req.body.reason || 'Extension not approved.');
    req.flash('success', 'Extension rejected.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to reject extension.');
  }
  res.redirect('/owner/today');
});

// GET /owner/incidents - Damage reports and deposit deductions
router.get('/incidents', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const incidents = await incidentService.getOwnerIncidents(owner.id);
    res.render('pages/owner/incidents', {
      title: 'Incidents & Deposit Deductions - BORO Owner',
      owner,
      incidents,
      helpers,
      activeNav: 'owner-incidents'
    });
  } catch (error) {
    next(error);
  }
});

// POST /owner/incidents/:id/confirm - Confirm deposit deduction
router.post('/incidents/:id/confirm', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await incidentService.confirm(
      req.params.id,
      owner.id,
      req.body.deductions || [],
      req.body.reason || 'Deposit deduction confirmed.'
    );
    req.flash('success', 'Incident confirmed and settled.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to confirm incident.');
  }
  res.redirect('/owner/incidents');
});

// POST /owner/incidents/:id/waive - Waive incident damages
router.post('/incidents/:id/waive', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await incidentService.waive(
      req.params.id,
      owner.id,
      req.body.reason || 'Incident waived by owner.'
    );
    req.flash('success', 'Incident waived and deposit refunded.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to waive incident.');
  }
  res.redirect('/owner/incidents');
});

// GET /owner/history - Custodial archives
router.get('/history', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const bookings = await bookingService.getOwnerHistory(owner.id);
    res.render('pages/owner/history', {
      title: 'Past Bookings & Custody Archives - BORO Owner',
      owner,
      bookings,
      helpers,
      activeNav: 'owner-history'
    });
  } catch (error) {
    next(error);
  }
});

// GET /owner/earnings - Revenue KPIs & Payout ledger
router.get('/earnings', async (req, res, next) => {
  const owner = getOwnerUser(req);

  try {
    const result = await bookingService.getOwnerEarnings(owner.id);
    const earnings = {
      gross: result.grossEarnings,
      netPayout: result.totalEarnings,
      platformFee: result.platformFees,
      completedBookings: result.completedBookings,
      utilizationRate: result.utilizationRate
    };
    const payouts = result.payoutHistory.length > 0
      ? result.payoutHistory
      : result.ledger.map(item => ({
        id: item.ref,
        date: item.date,
        amount: item.net_payout,
        method: item.payment_status || 'Recorded booking payment',
        status: 'earned'
      }));

    res.render('pages/owner/earnings', {
      title: 'Earnings & Payouts - BORO Owner',
      owner,
      earnings,
      payouts,
      payoutMethod: await userService.getPayoutMethod(owner.id, owner.id),
      helpers,
      activeNav: 'owner-earnings'
    });
  } catch (error) {
    next(error);
  }
});

// POST /owner/payout-method - Set payout method
router.post('/payout-method', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await userService.updatePayoutMethod(owner.id, req.body, owner.id);
    req.flash('success', 'Payout method updated.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to update payout method.');
  }
  res.redirect('/owner/earnings');
});

router.post('/payout-method/delete', async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await userService.deletePayoutMethod(owner.id, owner.id);
    req.flash('success', 'Payout method deleted.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to delete payout method.');
  }
  res.redirect('/owner/earnings');
});

router.get('/verification-document', async (req, res, next) => {
  const owner = getOwnerUser(req);
  try {
    const url = await userService.getOwnerVerificationDocument(owner.id, owner.id);
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

router.post('/verification-document', (req, res, next) => {
  ownershipDocumentService.createUploadMiddleware('id_proof')(req, res, error => {
    if (error) {
      req.flash('error', error.message || 'Invalid identity document.');
      return res.redirect('/owner/my-spaces');
    }
    if (!validateToken(req, res)) return;
    next();
  });
}, async (req, res) => {
  const owner = getOwnerUser(req);
  try {
    await userService.submitOwnerVerificationDocument(owner.id, req.file, owner.id);
    req.flash('success', 'Verification document submitted for review.');
  } catch (error) {
    req.flash('error', error.message || 'Unable to submit the verification document.');
  }
  res.redirect('/owner/my-spaces');
});

module.exports = router;
