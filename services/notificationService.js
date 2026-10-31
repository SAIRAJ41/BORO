/**
 * Notification Service (Stub)
 * Backend teammate: Implement push/SMS/in-app notifications delivery.
 */

// BACKEND TODO: getUserNotifications(userId, tab) -> { notifications: [...], unreadCount, alertSettings }
exports.getUserNotifications = async (userId, tab = 'all') => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: markRead(notifId) -> void
exports.markRead = async (notifId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: markAllRead(userId) -> void
exports.markAllRead = async (userId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: create(userId, type, title, message, actions) -> { id }
exports.create = async (userId, type, title, message, actions = []) => {
  throw new Error('Not implemented: backend database required');
};
