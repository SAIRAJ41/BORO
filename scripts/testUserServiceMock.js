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
    role: 'user',
    initials: 'PM',
    status: 'active'
  },
  {
    id: 'USR-003',
    name: 'Rajesh Kumar',
    email: 'rajesh@demo.com',
    role: 'owner',
    initials: 'RK',
    status: 'active'
  },
  {
    id: 'USR-099',
    name: 'Amit Verma',
    email: 'admin@demo.com',
    role: 'admin',
    initials: 'AV',
    status: 'active'
  },
  {
    id: 'USR-098',
    name: 'Suspended Demo',
    email: 'suspended@demo.com',
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

    if (!user || password !== 'demo123' || user.status !== 'active') {
      return null;
    }

    return { ...user };
  },

  async getDemoUser(role) {
    const user = demoUsers[role] || demoUsers.user;
    return { ...user };
  },

  async create() {
    return { id: 'USR-TEST-CREATED' };
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

