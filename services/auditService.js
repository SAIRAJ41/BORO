/**
 * Audit Service (Stub)
 * Backend teammate: Implement append-only immutable audit logging for all critical platform events.
 */

// BACKEND TODO: log(actor, action, target, reason, details) -> { id }
// Rule: Mandatory reason on approve, reject, waitlist, cancel, dispute resolution, deduction confirmation, suspension.
exports.log = async (actor, action, target, reason, details = '') => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getEntries(filters, page, limit) -> { entries: [...], total, totalPages }
exports.getEntries = async (filters = {}, page = 1, limit = 10) => {
  throw new Error('Not implemented: backend database required');
};
