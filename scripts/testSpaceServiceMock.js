/**
 * Test-only space service replacement for offline route tests.
 */

const Module = require('module');
const mockData = require('../data/mock');

const toSpace = space => ({
  ...space,
  owner_id: space.owner_id,
  listing_status: 'approved',
  active: true,
  submitted_at: new Date('2025-01-01T00:00:00.000Z'),
  reviewed_at: new Date('2025-01-02T00:00:00.000Z'),
  rejection_reason: null
});

const spaceServiceMock = {
  async getSpaces(filters = {}) {
    let spaces = mockData.spaces
      .filter(space => space.active !== false)
      .map(toSpace);
    if (filters.space_type) {
      spaces = spaces.filter(space => space.space_type === filters.space_type);
    }
    if (filters.indoor_outdoor) {
      spaces = spaces.filter(space => space.indoor_outdoor === filters.indoor_outdoor);
    }
    if (filters.capacity_min) {
      spaces = spaces.filter(space => space.capacity >= Number(filters.capacity_min));
    }
    if (filters.price_max) {
      spaces = spaces.filter(space => space.price_per_hour <= Number(filters.price_max));
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      spaces = spaces.filter(space =>
        space.name.toLowerCase().includes(term) ||
        space.locality.toLowerCase().includes(term)
      );
    }
    return {
      spaces,
      total: spaces.length,
      totalPages: 1
    };
  },

  async getSpaceById(id) {
    const space = mockData.getSpaceById(id);
    if (!space) return null;
    return {
      space: toSpace(space),
      owner: mockData.getUserById(space.owner_id) || { name: 'Community Caretaker' },
      conditionReports: mockData.conditionReports.filter(report => report.space_id === id),
      eligibility: null
    };
  },

  async getOwnerSpaces(ownerId) {
    return mockData.spaces
      .filter(space => space.owner_id === ownerId)
      .map(toSpace);
  },

  async getOwnerSpaceById(id, ownerId) {
    const space = mockData.getSpaceById(id);
    if (!space || space.owner_id !== ownerId) return null;
    return toSpace(space);
  },

  async create() {
    return { id: 'SP-TEST-PENDING' };
  },

  async update() {},

  async getPendingListings() {
    return [];
  },

  async getListings() {
    return [];
  },

  async getListingById(id) {
    const space = mockData.getSpaceById(id);
    if (!space) return null;
    return {
      ...toSpace(space),
      owner: mockData.getUserById(space.owner_id) || { name: 'Community Caretaker' }
    };
  },

  async approveListing() {},

  async rejectListing() {},
  async getDocumentAccess(id, requester) {
    const space = mockData.getSpaceById(id);
    if (!space || (requester.role !== 'admin' && requester.id !== space.owner_id)) {
      throw new Error('You are not authorized to access this document.');
    }
    return `https://signed.test/${id}`;
  }
};

const servicePath = require.resolve('../services/spaceService');
const originalLoad = Module._load;

Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === servicePath) {
    return spaceServiceMock;
  }

  return originalLoad.apply(this, arguments);
};
