/**
 * Booking Service (Stub)
 * Backend teammate: Implement booking lifecycles, slot validation, and schedule checks.
 */

// BACKEND TODO: create(userId, spaceId, slotId, purpose, groupSize, paymentMethod) -> { id }
// Rules: max 2 active bookings, purpose in space.allowed_purposes, weekly limit per space, overlap check
exports.create = async (userId, spaceId, slotId, purpose, groupSize, paymentMethod) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: edit(bookingId, userId, { purpose, groupSize }) -> void
exports.edit = async (bookingId, userId, data) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: cancel(bookingId, userId, reason) -> void + auditService.log()
// Rule: if cancellation is < 2 hours before start, warn user and record penalty note
exports.cancel = async (bookingId, userId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: requestExtension(bookingId, userId, additionalHours) -> void
exports.requestExtension = async (bookingId, userId, additionalHours) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: approveExtension(bookingId, ownerId) -> void + auditService.log()
exports.approveExtension = async (bookingId, ownerId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: rejectExtension(bookingId, ownerId, reason) -> void + auditService.log()
exports.rejectExtension = async (bookingId, ownerId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: approve(bookingId, ownerId, reason) -> void + auditService.log()
// Rule: Mandatory reason. Block overlapping approved bookings on same slot.
exports.approve = async (bookingId, ownerId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: reject(bookingId, ownerId, reason) -> void + auditService.log()
// Rule: Mandatory reason. Triggers full payment & deposit refund.
exports.reject = async (bookingId, ownerId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: waitlist(bookingId, ownerId, reason) -> void + auditService.log()
exports.waitlist = async (bookingId, ownerId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: joinWaitlist(userId, spaceId, slotId) -> { position }
// Rule: FIFO sequential queue by request timestamp.
exports.joinWaitlist = async (userId, spaceId, slotId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: leaveWaitlist(waitlistId, userId) -> void
exports.leaveWaitlist = async (waitlistId, userId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: checkin(bookingId, conditionData, conditionNotes) -> void + auditService.log()
exports.checkin = async (bookingId, conditionData, conditionNotes) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: return(bookingId, conditionData, conditionNotes) -> void + scoreService.adjust(+5 if on time/clean) + auditService.log()
exports.return = async (bookingId, conditionData, conditionNotes) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: markNoShow(bookingId, reason) -> void + scoreService.adjust(-10) + auditService.log()
exports.markNoShow = async (bookingId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: markPaymentReceived(bookingId, ownerId) -> void + auditService.log()
exports.markPaymentReceived = async (bookingId, ownerId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getBookingById(bookingId) -> Booking object with space details
exports.getBookingById = async (bookingId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getUserBookings(userId, tab, page, limit) -> { bookings: [...], total, totalPages }
exports.getUserBookings = async (userId, tab = 'all', page = 1, limit = 10) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getUserBookingStats(userId) -> { active_count, max_active, deposit_held, next_checkin, score }
exports.getUserBookingStats = async (userId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getUserHistory(userId, page, limit) -> { stats, completedBookings: [...], total, totalPages }
exports.getUserHistory = async (userId, page = 1, limit = 10) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getAvailableSlots(spaceId, date) -> [{ id, date, start_time, end_time, duration_hours, status, hourly_fee, deposit_amount, total_payable, booked_by, waitlist_count }]
exports.getAvailableSlots = async (spaceId, date) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getOwnerRequests(ownerId) -> { stats, requests: [...] }
exports.getOwnerRequests = async (ownerId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getOwnerCalendar(ownerId, week) -> { stats, week, events: [...], conflicts: [...], spaces: [...] }
exports.getOwnerCalendar = async (ownerId, week) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getOwnerToday(ownerId) -> { checkins: [...], returns: [...], activeAudit }
exports.getOwnerToday = async (ownerId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getOwnerHistory(ownerId, page, limit) -> { stats, archivedBookings: [...], total, totalPages }
exports.getOwnerHistory = async (ownerId, page = 1, limit = 10) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getOwnerEarnings(ownerId) -> { stats, facilities: [...], satisfaction: [...], payouts: [...], payoutMethod }
exports.getOwnerEarnings = async (ownerId) => {
  throw new Error('Not implemented: backend database required');
};
