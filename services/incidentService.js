/**
 * Incident Service (Stub)
 * Backend teammate: Implement deposit deductions, incident logs, and evidence tracking.
 */

// BACKEND TODO: getOwnerIncidents(ownerId) -> { stats, activeIncident, ledger: [...] }
exports.getOwnerIncidents = async (ownerId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: createFromReturn(bookingId, data) -> { id } + auditService.log()
exports.createFromReturn = async (bookingId, data) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: confirm(incidentId, deductions, reason) -> void + scoreService.adjust(-30) + auditService.log()
// Rule: Deposit reconciliation: deposit_held = total_deductions + refund_amount.
exports.confirm = async (incidentId, deductions, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: waive(incidentId, reason) -> void + auditService.log()
exports.waive = async (incidentId, reason) => {
  throw new Error('Not implemented: backend database required');
};
