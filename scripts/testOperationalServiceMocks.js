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

const settingsServiceMock = {
  async getAll() {
    return {
      max_active_bookings: 2,
      max_active_bookings_per_user: 2,
      weekly_booking_limit: 3,
      weekly_space_booking_limit_per_user: 3,
      grace_period_mins: 15,
      no_show_window_hours: 2,
      platform_fee_percent: 8,
      platform_fee_pct: 8,
      clean_return_bonus: 5,
      late_return_penalty: 10,
      late_penalty: -10,
      noshow_penalty: 10,
      damage_penalty: 30,
      score_min: 0,
      score_max: 120,
      max_score: 120
    };
  },
  async update() {}
};

const auditServiceMock = {
  async log() {},
  async getEntries() {
    return [];
  }
};

const paths = {
  score: require.resolve('../services/scoreService'),
  notification: require.resolve('../services/notificationService'),
  settings: require.resolve('../services/settingsService'),
  audit: require.resolve('../services/auditService')
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
  if (resolved === paths.settings) return settingsServiceMock;
  if (resolved === paths.audit) return auditServiceMock;
  return originalLoad.apply(this, arguments);
};
