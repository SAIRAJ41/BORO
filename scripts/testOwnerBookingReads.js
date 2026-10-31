/**
 * Focused owner booking read tests with mocked Prisma.
 */

const Module = require('module');

const requestedBooking = {
  id: 'BK-OWNER-1',
  ref: '#BK-OWNER-1',
  userId: 'USER-1',
  spaceId: 'SPACE-1',
  slotDate: new Date(),
  startTime: '10:00',
  endTime: '12:00',
  durationHours: 2,
  status: 'requested',
  purpose: 'meeting',
  groupSize: 5,
  hourlyRate: 300,
  hourlyFee: 600,
  depositAmount: 1500,
  totalAmount: 2100,
  totalPaid: 2100,
  platformFee: 48,
  netPayout: 552,
  paymentMethod: 'upi',
  paymentStatus: 'paid',
  depositStatus: 'held',
  pinCode: null,
  user: {
    id: 'USER-1',
    name: 'Resident',
    initials: 'R',
    score: 95
  },
  space: {
    id: 'SPACE-1',
    ownerId: 'OWNER-1',
    name: 'Owner Hall'
  }
};

const calendarBooking = {
  ...requestedBooking,
  id: 'BK-OWNER-2',
  status: 'approved'
};

const prismaMock = {
  booking: {
    async findMany({ where }) {
      if (where.space.ownerId === 'OWNER-2') return [];
      if (where.status === 'requested') return [requestedBooking];
      return [calendarBooking];
    }
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

async function run() {
  const requests = await bookingService.getOwnerRequests('OWNER-1');
  if (requests.length !== 1 ||
      requests[0].space.ownerId !== 'OWNER-1' ||
      requests[0].start_time !== '10:00' ||
      requests[0].end_time !== '12:00' ||
      requests[0].total_amount !== 2100) {
    throw new Error('Owner request read returned incomplete or incorrectly scoped data');
  }
  console.log('✓ Owner sees requests for their own spaces');

  const otherOwnerRequests = await bookingService.getOwnerRequests('OWNER-2');
  if (otherOwnerRequests.length !== 0) {
    throw new Error('Owner saw another owner booking request');
  }
  console.log('✓ Owner cannot see another owner requests');

  const calendar = await bookingService.getOwnerCalendar('OWNER-1');
  const bookings = Object.values(calendar.bookingsByDay).flat();
  if (bookings.length !== 1 ||
      bookings[0].space.ownerId !== 'OWNER-1' ||
      bookings[0].start_time !== '10:00' ||
      bookings[0].end_time !== '12:00' ||
      bookings[0].status !== 'approved') {
    throw new Error('Owner calendar returned incorrect booking or slot data');
  }
  console.log('✓ Calendar shows the owner booking and slot information');

  const emptyCalendar = await bookingService.getOwnerCalendar('OWNER-2');
  if (Object.values(emptyCalendar.bookingsByDay).some(day => day.length > 0)) {
    throw new Error('Empty owner calendar contained bookings');
  }
  console.log('✓ Empty owner calendar is safe');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
