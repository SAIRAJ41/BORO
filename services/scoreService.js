/**
 * Score Service (Stub)
 * Backend teammate: Implement community reliability scoring logic.
 */

// BACKEND TODO: getUserScore(userId) -> { score, tiers, penalties, auditTrail }
// Rule: score is advisory only; humans make all decisions.
exports.getUserScore = async (userId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getScoreAuditTrail(userId) -> [{ id, impact, date, reason, booking_ref, space_name, status }]
exports.getScoreAuditTrail = async (userId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: adjust(userId, points, reason, bookingRef) -> void + auditService.log()
// Rule: Clamp between 0 and 120. Multipliers: +5 clean on-time, -10 late, -10 no-show, -30 damage.
exports.adjust = async (userId, points, reason, bookingRef) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: fileDispute(userId, auditEntryId, reason) -> { id }
exports.fileDispute = async (userId, auditEntryId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getDisputes() -> [{ id, booking_id, user_id, user_name, space_name, score_impact, reason, filed_at, status }]
exports.getDisputes = async () => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: resolveDispute(disputeId, decision, reason) -> void + auditService.log()
exports.resolveDispute = async (disputeId, decision, reason) => {
  throw new Error('Not implemented: backend database required');
};
