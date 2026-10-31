/**
 * Test-only incident service replacement for offline route tests.
 */

const Module = require('module');

const incidentServiceMock = {
  async getOwnerIncidents(ownerId) {
    if (ownerId === 'USR-004') return [];
    return [{
      id: 'INC-OWNER-1',
      status: 'open',
      booking_id: 'BK-HISTORY-1',
      space_name: 'Owner Hall',
      user_name: 'Resident',
      created_at: new Date('2026-10-20T12:00:00.000Z'),
      description: 'Broken chair',
      deductions: [{ item: 'Chair', amount: 100 }],
      deposit_held: 500,
      deduction_total: 100,
      refund_amount: 400
    }];
  }
};

const servicePath = require.resolve('../services/incidentService');
const originalLoad = Module._load;

Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === servicePath) {
    return incidentServiceMock;
  }

  return originalLoad.apply(this, arguments);
};
