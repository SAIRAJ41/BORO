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
  },

  async getBookingById(id) {
    return {
      booking: {
        id,
        userId: 'USR-001',
        status: 'returned',
        total_amount: 900,
        deposit_amount: 500,
        payment_status: 'paid',
        payment_method: 'upi',
        deposit_status: 'refunded'
      },
      space: { id: 'SP-001', ownerId: 'USR-003', name: 'Owner Hall' },
      user: { id: 'USR-001', name: 'Priya Mehta' },
      payments: []
    };
  },

  async getUserBookings(userId, tab) {
    if (tab === 'waitlisted') return [];
    return [{
      id: 'BK-USER-1',
      userId,
      status: tab === 'past' ? 'returned' : 'approved',
      space: { id: 'SP-001', name: 'Owner Hall' },
      slot_date: new Date('2026-10-31T00:00:00Z'),
      start_time: '10:00',
      end_time: '12:00'
    }];
  },

  async getUserHistory(userId) {
    return [{
      id: 'BK-USER-PAST',
      userId,
      status: 'returned',
      space: { id: 'SP-001', name: 'Owner Hall' },
      slot_date: new Date('2026-10-20T00:00:00Z'),
      deposit_status: 'refunded'
    }];
  },

  async getOwnerRequests(ownerId) {
    if (ownerId === 'USR-004') return [];
    return [{
      id: 'BK-OWNER-1',
      user: {
        id: 'USR-001',
        name: 'Priya Mehta',
        initials: 'PM',
        score: 95
      },
      space: {
        id: 'SP-001',
        name: 'Shanti Niketan Community Hall',
        ownerId
      },
      slot_date: new Date('2026-10-31T00:00:00Z'),
      start_time: '10:00',
      end_time: '12:00',
      purpose: 'meeting',
      total_amount: 900,
      payment_status: 'paid',
      payment_method: 'upi',
      status: 'requested'
    }];
  },

  async getOwnerCalendar(ownerId) {
    if (ownerId === 'USR-004') {
      return { days: [], bookingsByDay: {} };
    }

    return {
      days: [new Date('2026-10-27T00:00:00Z')],
      bookingsByDay: {
        '2026-10-27': [{
          id: 'BK-OWNER-2',
          slot_date: new Date('2026-10-27T00:00:00Z'),
          start_time: '10:00',
          end_time: '12:00',
          purpose: 'meeting',
          status: 'approved',
          space: { id: 'SP-001', name: 'Shanti Niketan Community Hall', ownerId },
          user: { id: 'USR-001', name: 'Priya Mehta', score: 95 }
        }]
      }
    };
  },

  async getOwnerAvailability(ownerId) {
    if (ownerId === 'USR-004') return [];
    return [{
      id: 'SLOT-OWNER-1',
      spaceId: 'SP-001',
      slotDate: new Date('2026-11-02T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '12:00',
      isBooked: false,
      status: 'available',
      space: { id: 'SP-001', name: 'Owner Hall', ownerId }
    }];
  },

  async getOwnerToday(ownerId) {
    if (ownerId === 'USR-004') {
      return { checkins: [], returns: [], activeSessions: [] };
    }

    return {
      checkins: [{
        id: 'BK-TODAY-1',
        status: 'approved',
        start_time: '10:00',
        end_time: '12:00',
        space: { id: 'SP-001', name: 'Owner Hall', ownerId }
      }],
      returns: [],
      activeSessions: []
    };
  },

  async getOwnerHistory(ownerId) {
    if (ownerId === 'USR-004') return [];
    return [{
      id: 'BK-HISTORY-1',
      status: 'closed',
      slot_date: new Date('2026-10-20T00:00:00.000Z'),
      start_time: new Date('2026-10-20T10:00:00.000Z'),
      end_time: new Date('2026-10-20T12:00:00.000Z'),
      hourly_fee_total: 900,
      net_payout: 828,
      space: { id: 'SP-001', name: 'Owner Hall', ownerId }
    }];
  },

  async getOwnerEarnings(ownerId) {
    if (ownerId === 'USR-004') {
      return {
        totalEarnings: 0,
        grossEarnings: 0,
        platformFees: 0,
        completedBookings: 0,
        utilizationRate: 'N/A',
        payoutHistory: [],
        ledger: []
      };
    }

    return {
      totalEarnings: 828,
      grossEarnings: 900,
      platformFees: 72,
      completedBookings: 1,
      utilizationRate: '50%',
      payoutHistory: [],
      ledger: [{
        ref: 'BK-HISTORY-1',
        date: new Date('2026-10-20T00:00:00.000Z'),
        net_payout: 828,
        payment_status: 'paid'
      }]
    };
  },

  async approve() {},

  async reject() {}
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
