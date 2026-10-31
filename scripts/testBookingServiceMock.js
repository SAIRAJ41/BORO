/**
 * Test-only booking service replacement for offline route tests.
 */

const Module = require('module');

const bookingServiceMock = {
  async getEligibility(userId, space) {
    const activeBookings = userId === 'USR-LIMIT' ? 2 : 0;
    const maxActiveBookings = 2;
    return {
      canBook: Boolean(
        userId &&
        space.active &&
        space.listingStatus === 'approved' &&
        activeBookings < maxActiveBookings
      ),
      activeBookings,
      maxActiveBookings
    };
  }
};

const servicePath = require.resolve('../services/bookingService');
const originalLoad = Module._load;

Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === servicePath) {
    return bookingServiceMock;
  }

  return originalLoad.apply(this, arguments);
};
