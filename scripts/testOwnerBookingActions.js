/**
 * Focused owner booking action tests with mocked Prisma.
 */

const Module = require('module');

const state = {
  bookingStatus: 'requested',
  slotBooked: true,
  slotStatus: 'booked',
  updated: [],
  audits: [],
  notifications: []
};

const booking = {
  id: 'BK-1',
  userId: 'USER-1',
  spaceId: 'SPACE-1',
  slotDate: new Date('2026-10-31T00:00:00Z'),
  startTime: '10:00',
  endTime: '12:00',
  totalPaid: 2100,
  paymentStatus: 'paid',
  space: {
    id: 'SPACE-1',
    ownerId: 'OWNER-1',
    name: 'Owner Hall'
  },
  user: {
    name: 'Resident'
  }
};

const prismaMock = {
  async $transaction(callback) {
    return callback({
      booking: {
        async findUnique() {
          return {
            ...booking,
            status: state.bookingStatus
          };
        },
        async findFirst() {
          return null;
        },
        async update({ data }) {
          state.updated.push(data);
          state.bookingStatus = data.status;
        }
      },
      availabilitySlot: {
        async findFirst() {
          return {
            id: 'SLOT-1',
            spaceId: 'SPACE-1',
            slotDate: booking.slotDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            isBooked: state.slotBooked,
            status: state.slotStatus
          };
        },
        async update({ data }) {
          state.slotBooked = data.isBooked;
          state.slotStatus = data.status;
        }
      },
      auditLog: {
        async create({ data }) {
          state.audits.push(data);
        }
      },
      notification: {
        async create({ data }) {
          state.notifications.push(data);
        }
      },
      waitlist: {
        async findFirst() {
          return null;
        }
      }
    });
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === require.resolve('../lib/prisma')) return prismaMock;
  return originalLoad.apply(this, arguments);
};

const bookingService = require('../services/bookingService');

async function expectRejected(operation, expected, name) {
  try {
    await operation();
    throw new Error(`${name}: expected rejection`);
  } catch (error) {
    if (error.message !== expected) {
      throw new Error(`${name}: expected "${expected}", got "${error.message}"`);
    }
    console.log(`✓ ${name}`);
  }
}

async function run() {
  await bookingService.approve('BK-1', 'OWNER-1', 'Approved for community use.');
  if (state.bookingStatus !== 'approved' ||
      state.updated[0].status !== 'approved' ||
      state.slotBooked !== true ||
      state.slotStatus !== 'booked' ||
      state.audits[0].action !== 'approve_booking') {
    throw new Error('Owner approval did not preserve booking, slot, or audit state');
  }
  console.log('✓ Owner can approve an eligible booking');

  await expectRejected(
    () => bookingService.approve('BK-1', 'OWNER-1'),
    'This booking request is no longer pending.',
    'Repeated approval is rejected'
  );

  state.bookingStatus = 'requested';
  state.updated = [];
  state.audits = [];
  await bookingService.reject('BK-1', 'OWNER-1', 'The requested time is unavailable.');
  if (state.bookingStatus !== 'rejected' ||
      state.updated[0].status !== 'rejected' ||
      state.slotBooked !== false ||
      state.slotStatus !== 'available' ||
      state.audits[0].action !== 'reject_booking') {
    throw new Error('Owner rejection did not release slot or record audit');
  }
  console.log('✓ Owner can reject an eligible booking and release its slot');

  await expectRejected(
    () => bookingService.reject('BK-1', 'OWNER-1', 'Another valid reason.'),
    'This booking request is no longer pending.',
    'Repeated rejection is rejected'
  );

  state.bookingStatus = 'requested';
  await expectRejected(
    () => bookingService.approve('BK-1', 'OWNER-2'),
    'Booking not found or unauthorized.',
    'Another owner cannot approve the booking'
  );
  await expectRejected(
    () => bookingService.reject('BK-1', 'OWNER-2', 'Unauthorized action.'),
    'Booking not found or unauthorized.',
    'Another owner cannot reject the booking'
  );

  state.bookingStatus = 'cancelled';
  await expectRejected(
    () => bookingService.approve('BK-1', 'OWNER-1'),
    'This booking request is no longer pending.',
    'Cancelled booking cannot be approved'
  );
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
