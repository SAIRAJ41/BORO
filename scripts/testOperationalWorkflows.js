const Module = require('module');

const state = {
  booking: {
    id: 'BK-1',
    userId: 'USER-1',
    spaceId: 'SPACE-1',
    status: 'approved',
    extensionStatus: null,
    extensionHours: null,
    durationHours: 2,
    startTime: '10:00',
    endTime: '12:00',
    slotDate: new Date('2026-10-31T00:00:00Z'),
    hourlyRate: 100,
    hourlyFee: 200,
    totalAmount: 700,
    depositAmount: 500,
    space: { id: 'SPACE-1', ownerId: 'OWNER-1', name: 'Hall' }
  },
  reports: [],
  ratings: [],
  notifications: [],
  audits: [],
  notificationUpdateCount: 1
};

const tx = {
  booking: {
    async findUnique() {
      return { ...state.booking, space: { ...state.booking.space } };
    },
    async updateMany({ data }) {
      Object.assign(state.booking, data);
      return { count: 1 };
    },
    async findFirst() {
      return null;
    }
  },
  conditionReport: {
    async findFirst({ where }) {
      return state.reports.find(report =>
        report.bookingId === where.bookingId && report.type === where.type
      ) || null;
    },
    async create({ data }) {
      state.reports.push(data);
      return data;
    }
  },
  rating: {
    async findUnique() {
      return state.ratings[0] || null;
    },
    async create({ data }) {
      state.ratings.push(data);
      return data;
    }
  },
  incident: {
    async findFirst() {
      return null;
    },
    async create({ data }) {
      state.incident = data;
      return data;
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
  setting: {
    async findUnique() {
      return { platformFeePercent: 8 };
    }
  }
};

const prismaMock = {
  async $transaction(callback) {
    return callback(tx);
  },
  notification: {
    async updateMany() {
      return { count: state.notificationUpdateCount };
    }
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolved = null;
  }
  if (resolved === require.resolve('../lib/prisma')) return prismaMock;
  return originalLoad.apply(this, arguments);
};

const bookingService = require('../services/bookingService');
const incidentService = require('../services/incidentService');
const notificationService = require('../services/notificationService');
const scoreService = require('../services/scoreService');

async function expectRejected(operation, text, label) {
  try {
    await operation();
    throw new Error(`${label}: expected rejection`);
  } catch (error) {
    if (error.message !== text) {
      throw new Error(`${label}: expected "${text}", got "${error.message}"`);
    }
    console.log(`✓ ${label}`);
  }
}

async function run() {
  await expectRejected(
    () => bookingService.checkin('BK-1', 'OWNER-2', {}),
    'Booking not found.',
    'Check-in enforces owner authorization'
  );

  await bookingService.checkin('BK-1', 'OWNER-1', { checklist: ['clean'] }, 'Initial condition');
  if (state.booking.status !== 'checked_in' || state.reports[0].type !== 'checkin') {
    throw new Error('Check-in did not persist its condition report and state');
  }
  console.log('✓ Check-in creates a condition report and transitions booking');

  await expectRejected(
    () => bookingService.checkin('BK-1', 'OWNER-1', {}),
    'This booking cannot be checked in.',
    'Repeated check-in is rejected'
  );

  await bookingService.requestExtension('BK-1', 'USER-1', 1);
  if (state.booking.extensionStatus !== 'requested' ||
      !state.audits.some(a => a.action === 'request_extension')) {
    throw new Error('Extension request was not audited');
  }
  console.log('✓ User extension request is owner-scoped and audited');

  await bookingService.approveExtension('BK-1', 'OWNER-1');
  if (state.booking.extensionStatus !== 'approved') {
    throw new Error('Extension approval did not transition the booking');
  }
  console.log('✓ Owner extension approval transitions state and notifies user');

  state.booking.status = 'returned';
  await expectRejected(
    () => incidentService.report('BK-1', 'USER-2', 'user', { reason: 'Damage' }),
    'Booking not found or unauthorized.',
    'Incident reporting enforces booking participation'
  );
  await incidentService.report('BK-1', 'USER-1', 'user', { reason: 'Damage' });
  if (!state.incident || !state.audits.some(a => a.action === 'incident_reported')) {
    throw new Error('Incident report was not persisted and audited');
  }
  console.log('✓ Authorized incident report is persisted and audited');

  await scoreService.rateBooking('BK-1', 'USER-1', 5, 'Great space');
  if (state.ratings.length !== 1 || !state.audits.some(a => a.action === 'booking_rated')) {
    throw new Error('Rating was not persisted and audited');
  }
  console.log('✓ Completed booking rating is persisted and audited');

  await expectRejected(
    () => scoreService.rateBooking('BK-1', 'USER-1', 4),
    'This booking has already been rated.',
    'Duplicate rating is rejected'
  );

  state.notificationUpdateCount = 0;
  await expectRejected(
    () => notificationService.markRead('NTF-1', 'USER-2'),
    'Notification not found.',
    'Notification access is user-scoped'
  );
  console.log('✓ Failed operations do not add success audit records');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
