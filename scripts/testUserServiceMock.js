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
