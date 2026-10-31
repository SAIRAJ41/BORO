/**
 * Space Service (Stub)
 * Backend teammate: Implement real database access for community spaces.
 */

// BACKEND TODO: getSpaces(filters, page, limit) -> { spaces: [...], total, totalPages }
exports.getSpaces = async (filters = {}, page = 1, limit = 12) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getSpaceById(id) -> Space object with photos, rules, facilities, allowed_purposes
exports.getSpaceById = async (id) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getOwnerSpaces(ownerId) -> { spaces: [...], stats, ownerVerified }
exports.getOwnerSpaces = async (ownerId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getConditionHistory(spaceId) -> [{ date, result, inspector, details, passed }]
exports.getConditionHistory = async (spaceId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getFormOptions() -> { spaceTypes, facilityList, purposeList }
exports.getFormOptions = async () => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: create(ownerId, data) -> { id } (requires verified owner) + auditService.log()
exports.create = async (ownerId, data) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: update(spaceId, ownerId, data) -> void (requires ownership check) + auditService.log()
exports.update = async (spaceId, ownerId, data) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: addRating(spaceId, bookingId, userId, rating, review) -> void
exports.addRating = async (spaceId, bookingId, userId, rating, review) => {
  throw new Error('Not implemented: backend database required');
};
