/**
 * Test-only user service replacement.
 *
 * This module is installed before app.js is loaded so the route tests never
 * load the production Prisma-backed user service.
 */

const Module = require('module');

const users = [
  {
    id: 'USR-001',
    name: 'Priya Mehta',
    email: 'priya@demo.com',
    password: 'demo123',
    role: 'user',
    initials: 'PM',
    status: 'active'
  },
  {
    id: 'USR-003',
    name: 'Rajesh Kumar',
    email: 'rajesh@demo.com',
    password: 'demo123',
    role: 'owner',
    initials: 'RK',
    status: 'active'
  },
  {
    id: 'USR-099',
    name: 'Amit Verma',
    email: 'admin@demo.com',
    password: 'demo123',
    role: 'admin',
    initials: 'AV',
    status: 'active'
  },
  {
    id: 'USR-098',
    name: 'Suspended Demo',
    email: 'suspended@demo.com',
    password: 'demo123',
    role: 'user',
    initials: 'SD',
    status: 'suspended'
  }
];

const demoUsers = {
  user: users[0],
  owner: users[1],
  admin: users[2]
};

const userServiceMock = {
  async authenticate(email, password) {
    const user = users.find(
      candidate => candidate.email === (email || '').trim().toLowerCase()
    );

    if (!user || password !== user.password || user.status !== 'active') {
      return null;
    }

    const { password: ignoredPassword, ...sessionUser } = user;
    return { ...sessionUser };
  },

  async getDemoUser(role) {
    const user = demoUsers[role] || demoUsers.user;
    return { ...user };
  },

  async getProfile(userId) {
    const user = users.find(candidate => candidate.id === userId);
    if (!user) return null;

    return {
      user: {
        ...user,
        score: 100,
        phone: '+91 90000 00000',
        verified: user.role !== 'owner',
        active_bookings_count: 0,
        created_at: new Date('2025-01-01T00:00:00.000Z')
      },
      scoreEvents: [],
      totalBookingsCount: 0,
      verificationStatus: null,
      payoutMethod: null
    };
  },

  async updateProfile(userId, data) {
    const user = users.find(candidate => candidate.id === userId);
    if (!user) throw new Error('User not found.');
    return {
      ...user,
      name: data.name || user.name,
      initials: data.name ? data.name.split(/\s+/).map(part => part[0]).join('').toUpperCase() : user.initials,
      phone: data.phone || '+91 90000 00000'
    };
  },

  async create({ name, email, phone, password, role }) {
    const user = {
      id: `USR-TEST-${users.length + 1}`,
      name,
      email: email.trim().toLowerCase(),
      phone: phone || '',
      password,
      role: role === 'owner' ? 'owner' : 'user',
      initials: name.split(/\s+/).map(part => part[0]).join('').toUpperCase(),
      status: 'active'
    };
    users.push(user);
    return { id: user.id, status: user.status };
  },

  async getById(userId) {
    const user = users.find(candidate => candidate.id === userId);
    return user ? { ...user, suspended: user.status === 'suspended' } : null;
  },

  async getAdminCounts() {
    return {
      total_users: users.length,
      total_owners: users.filter(user => user.role === 'owner').length,
      pending_owners: 0,
      pending_verifications: 0,
      total_spaces: 0,
      active_bookings: 0,
      completed_bookings: 0,
      open_disputes: 0,
      active_incidents: 0,
      total_volume: 0,
      total_incidents: 0
    };
  },

  async getPendingOwners() {
    return [];
  },

  async getAllUsers(adminId, query) {
    const search = (query || '').toLowerCase();
    const matched = users.filter(user =>
      !search || user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search)
    );
    return { users: matched, total: matched.length, totalPages: 1 };
  },

  payoutMethods: {},
  async getPayoutMethod(ownerId) {
    return this.payoutMethods[ownerId] || null;
  },

  async updatePayoutMethod(ownerId, data) {
    const type = data.payout_type || data.type;
    const value = data.payout_value || '';
    this.payoutMethods[ownerId] = {
      id: 'PAY-1',
      type,
      masked_details: type === 'upi' ? `${value.slice(0, 2)}***@${value.split('@')[1]}` : `Bank account ending ${value.slice(-4)}`,
      ifsc_code: data.ifsc_code || null,
      updated_at: new Date()
    };
  },
  async deletePayoutMethod(ownerId) {
    delete this.payoutMethods[ownerId];
  },
  async getOwnerVerificationSummary() {
    return { is_verified: true, document_available: false };
  },
  async getOwnerVerificationDocument() {
    return 'https://signed.test/owner-document';
  },
  async submitOwnerVerificationDocument() {},
  async approveOwner(ownerId) {
    const user = users.find(candidate => candidate.id === ownerId);
    if (user) user.status = 'active';
  },
  async rejectOwner(ownerId) {
    const user = users.find(candidate => candidate.id === ownerId);
    if (user) user.status = 'rejected';
  },
  async suspend(userId) {
    const user = users.find(candidate => candidate.id === userId);
    if (user) user.status = 'suspended';
  },
  async unsuspend(userId) {
    const user = users.find(candidate => candidate.id === userId);
    if (user) user.status = 'active';
  }
};

const userServicePath = require.resolve('../services/userService');
const originalLoad = Module._load;

Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === userServicePath) {
    return userServiceMock;
  }

  return originalLoad.apply(this, arguments);
};
