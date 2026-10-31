const Module = require('module');

const scoreServiceMock = {
  async getUserScore() { return { score: 100, tier: 1 }; },
  async getScoreAuditTrail() { return []; },
  async fileDispute() {},
  async rateBooking() {},
  async getDisputes() { return []; },
  async resolveDispute() {}
};

const notificationServiceMock = {
  async getUserNotifications() { return []; },
  async markRead() {},
  async markAllRead() {}
};

const paths = {
  score: require.resolve('../services/scoreService'),
  notification: require.resolve('../services/notificationService')
};
const originalLoad = Module._load;

Module._load = function load(request, parent, isMain) {
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolved = null;
  }
  if (resolved === paths.score) return scoreServiceMock;
  if (resolved === paths.notification) return notificationServiceMock;
  return originalLoad.apply(this, arguments);
};
