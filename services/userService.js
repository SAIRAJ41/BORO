/**
 * User Service
 * Backend teammate: Implement real database access and user authentication logic here.
 * 
 * Session user shape:
 * req.session.user = { id, name, email, role, initials, status }
 * (Nothing else, and never the password).
 */

const mockData = require('../data/mock');

/**
 * Authenticates user credentials.
 * BACKEND: replace with database lookup and bcrypt compare.
 * 
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ id: string, name: string, email: string, role: string, initials: string, status: string } | null>}
 */
exports.authenticate = async (email, password) => {
  // BACKEND: replace with database lookup and bcrypt compare
  if (mockData.USE_MOCK) {
    const seededAccounts = {
      'priya@demo.com': { id: 'USR-001', pass: 'demo123' },
      'rajesh@demo.com': { id: 'USR-003', pass: 'demo123' },
      'admin@demo.com': { id: 'USR-099', pass: 'demo123' }
    };

    const normEmail = (email || '').trim().toLowerCase();
    const account = seededAccounts[normEmail];

    if (!account || password !== account.pass) {
      return null;
    }

    const user = mockData.getUserById(account.id);
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials || 'U',
      status: user.status || 'active'
    };
  }

  throw new Error('Not implemented: backend database required');
};

/**
 * Creates a new user record.
 * BACKEND: hash password with bcrypt, insert into database.
 * 
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} data.phone
 * @param {string} data.password
 * @param {string} data.role
 * @param {string} [data.organisation]
 * @returns {Promise<{ id: string }>}
 */
exports.create = async ({ name, email, phone, password, role, organisation }) => {
  // BACKEND: hash password with bcrypt, insert into database
  if (mockData.USE_MOCK) {
    const newId = `USR-${String(mockData.users.length + 1).padStart(3, '0')}`;
    return { id: newId };
  }

  throw new Error('Not implemented: backend database required');
};

/**
 * Retrieves the mock user corresponding to the specified demo role.
 * 
 * @param {string} role - 'user' | 'owner' | 'admin'
 * @returns {Promise<{ id: string, name: string, email: string, role: string, initials: string, status: string }>}
 */
exports.getDemoUser = async (role) => {
  let user;
  if (role === 'owner') {
    user = mockData.users.find(u => u.id === 'USR-003'); // Rajesh Kumar
  } else if (role === 'admin') {
    user = mockData.users.find(u => u.id === 'USR-099'); // Amit Verma
  } else {
    user = mockData.users.find(u => u.id === 'USR-001'); // Priya Mehta
  }

  if (!user) user = mockData.users[0];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    initials: user.initials || 'U',
    status: user.status || 'active'
  };
};

// Additional service signatures for backend teammates
// BACKEND TODO: getById(userId) -> { id, name, email, role, score, tier, status, initials, joined_at }
exports.getById = async (userId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getProfile(userId) -> { user, verificationStatus, payoutMethod }
exports.getProfile = async (userId) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: updatePayoutMethod(ownerId, { type, masked_details }) -> void
exports.updatePayoutMethod = async (ownerId, data) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getAllUsers(query, page, limit) -> { users: [...], total, totalPages }
exports.getAllUsers = async (query, page = 1, limit = 10) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getPendingOwners() -> [{ id, name, email, phone, spaces_proposed, applied_at, documents }]
exports.getPendingOwners = async () => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: approveOwner(ownerId, reason) -> void + auditService.log()
exports.approveOwner = async (ownerId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: rejectOwner(ownerId, reason) -> void + auditService.log()
exports.rejectOwner = async (ownerId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: suspend(userId, reason) -> void + auditService.log()
exports.suspend = async (userId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: unsuspend(userId, reason) -> void + auditService.log()
exports.unsuspend = async (userId, reason) => {
  throw new Error('Not implemented: backend database required');
};

// BACKEND TODO: getAdminCounts() -> { total_users, total_owners, pending_owners, total_spaces, active_bookings, completed_bookings, open_disputes, active_incidents }
exports.getAdminCounts = async () => {
  throw new Error('Not implemented: backend database required');
};
