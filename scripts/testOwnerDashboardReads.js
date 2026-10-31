/**
 * Focused owner dashboard read tests with an isolated Prisma mock.
 */

const Module = require('module');

const calls = [];
const ownerBooking = {
  id: 'BK-OWNER-1',
  ref: 'BORO-OWNER-1',
  slotDate: new Date('2026-10-31T00:00:00.000Z'),
  startTime: '10:00',
  endTime: '12:00',
  durationHours: 2,
  status: 'approved',
  hourlyFee: 900,
  platformFee: 72,
  netPayout: 828,
  totalPaid: 900,
  totalAmount: 1000,
  depositAmount: 100,
  depositStatus: 'held',
  paymentStatus: 'paid',
  paymentMethod: 'upi',
  space: { id: 'SPACE-OWNER', ownerId: 'OWNER-1', name: 'Owner Hall' },
  user: { id: 'USER-1', name: 'Resident', initials: 'R', score: 100 }
};

const prismaMock = {
  booking: {
    async findMany(args) {
      calls.push({ model: 'booking', args });
      if (args.where.space.ownerId === 'OWNER-2') return [];
      return [{ ...ownerBooking }];
    }
  },
  availabilitySlot: {
    async count(args) {
      calls.push({ model: 'availabilitySlot', args });
      if (args.where.space.ownerId === 'OWNER-2') return 0;
      return args.where.isBooked ? 1 : 2;
    }
  },
  incident: {
    async findMany(args) {
      calls.push({ model: 'incident', args });
      if (args.where.ownerId === 'OWNER-2') return [];
      return [{
        id: 'INC-1',
        bookingId: 'BK-OWNER-1',
        ownerId: 'OWNER-1',
        reason: 'Broken chair',
        status: 'pending',
        depositHeld: 500,
        deductionTotal: 100,
        refundAmount: 400,
        deductions: [{ item: 'Chair', amount: 100 }],
        notes: null,
        createdAt: new Date('2026-10-31T12:00:00.000Z'),
        booking: ownerBooking,
        space: ownerBooking.space,
        user: ownerBooking.user
      }];
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

  if (resolvedRequest === require.resolve('../lib/prisma')) {
    return prismaMock;
  }
  return originalLoad.apply(this, arguments);
};

const bookingService = require('../services/bookingService');
const incidentService = require('../services/incidentService');

function assertOwnerScopes(model, ownerId) {
  const matching = calls.filter(call => call.model === model);
  if (!matching.length) throw new Error(`No ${model} query was recorded`);
  for (const call of matching) {
    const scopedOwner = model === 'incident'
      ? call.args.where.ownerId
      : call.args.where.space.ownerId;
    if (scopedOwner !== ownerId) {
      throw new Error(`${model} query was not scoped to ${ownerId}`);
    }
  }
}

async function expect(name, operation) {
  await operation();
  console.log(`✓ ${name}`);
}

async function run() {
  const today = await bookingService.getOwnerToday('OWNER-1');
  if (today.checkins.length !== 1 || today.checkins[0].space.ownerId !== 'OWNER-1') {
    throw new Error('Operations dashboard did not return the owner booking');
  }
  assertOwnerScopes('booking', 'OWNER-1');
  await expect('Operations dashboard is owner-scoped', async () => {});

  calls.length = 0;
  const history = await bookingService.getOwnerHistory('OWNER-1');
  if (history.length !== 1 || history[0].space.ownerId !== 'OWNER-1') {
    throw new Error('Booking history did not return the owner booking');
  }
  assertOwnerScopes('booking', 'OWNER-1');
  await expect('Booking history is owner-scoped', async () => {});

  calls.length = 0;
  const earnings = await bookingService.getOwnerEarnings('OWNER-1');
  if (
    earnings.grossEarnings !== 900 ||
    earnings.totalEarnings !== 828 ||
    earnings.platformFees !== 72 ||
    earnings.completedBookings !== 1
  ) {
    throw new Error('Earnings did not use stored booking amounts');
  }
  assertOwnerScopes('booking', 'OWNER-1');
  assertOwnerScopes('availabilitySlot', 'OWNER-1');
  await expect('Earnings are owner-scoped and data-derived', async () => {});

  calls.length = 0;
  const incidents = await incidentService.getOwnerIncidents('OWNER-1');
  if (incidents.length !== 1 || incidents[0].space_name !== 'Owner Hall') {
    throw new Error('Incident read did not return the owner incident');
  }
  assertOwnerScopes('incident', 'OWNER-1');
  await expect('Incidents are owner-scoped', async () => {});

  calls.length = 0;
  const [emptyHistory, emptyIncidents] = await Promise.all([
    bookingService.getOwnerHistory('OWNER-2'),
    incidentService.getOwnerIncidents('OWNER-2')
  ]);
  if (emptyHistory.length !== 0 || emptyIncidents.length !== 0) {
    throw new Error('Empty owner results were not safe');
  }
  assertOwnerScopes('booking', 'OWNER-2');
  assertOwnerScopes('incident', 'OWNER-2');
  console.log('✓ Empty owner results are safe and isolated');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
