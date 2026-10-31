/**
 * Focused booking eligibility tests with an in-memory Prisma adapter.
 */

const Module = require('module');

const state = {
  activeBookings: 1,
  userStatus: 'active',
  space: {
    active: true,
    listingStatus: 'approved'
  }
};

const prismaMock = {
  setting: {
    async findUnique() {
      return { maxActiveBookingsPerUser: 2 };
    }
  },
  user: {
    async findUnique() {
      return { status: state.userStatus };
    }
  },
  booking: {
    async count() {
      return state.activeBookings;
    }
  },
  async $transaction(callback) {
    return callback({
      setting: prismaMock.setting,
      user: prismaMock.user,
      booking: prismaMock.booking,
      space: {
        async findUnique() {
          return state.space;
        }
      },
      availabilitySlot: {
        async findUnique() {
          return null;
        }
      }
    });
  }
};

const prismaPath = require.resolve('../lib/prisma');
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === prismaPath) {
    return prismaMock;
  }

  return originalLoad.apply(this, arguments);
};

const bookingService = require('../services/bookingService');

async function expectRejected(operation, expectedMessage, name) {
  try {
    await operation();
    throw new Error(`${name}: expected rejection`);
  } catch (error) {
    if (error.message !== expectedMessage) {
      throw new Error(
        `${name}: expected "${expectedMessage}", got "${error.message}"`
      );
    }
    console.log(`✓ ${name}`);
  }
}

async function run() {
  let eligibility = await bookingService.getEligibility('USR-001', state.space);
  if (!eligibility.canBook || eligibility.activeBookings !== 1) {
    throw new Error('User below active-booking limit should be eligible');
  }
  console.log('✓ User below active-booking limit is eligible');

  state.activeBookings = 2;
  eligibility = await bookingService.getEligibility('USR-001', state.space);
  if (eligibility.canBook || eligibility.activeBookings !== 2) {
    throw new Error('User at active-booking limit should not be eligible');
  }
  console.log('✓ User at active-booking limit is not eligible');

  state.activeBookings = 0;
  state.space = { active: true, listingStatus: 'pending' };
  await expectRejected(
    () => bookingService.create('USR-001', 'SP-001', 'SLOT-001', 'meeting', 2, 'upi'),
    'This space is unavailable.',
    'Unapproved listing is rejected by booking creation'
  );

  state.space = { active: false, listingStatus: 'approved' };
  await expectRejected(
    () => bookingService.create('USR-001', 'SP-001', 'SLOT-001', 'meeting', 2, 'upi'),
    'This space is unavailable.',
    'Inactive listing is rejected by booking creation'
  );

  state.space = { active: true, listingStatus: 'approved' };
  state.userStatus = 'active';
  eligibility = await bookingService.getEligibility(null, state.space);
  if (eligibility.canBook) {
    throw new Error('Unauthenticated user should not be eligible to book');
  }
  console.log('✓ Unauthenticated user cannot book');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
