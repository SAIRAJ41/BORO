/**
 * Focused listing review service tests with mocked Prisma.
 */

const Module = require('module');

const state = {
  status: 'pending',
  updated: null,
  audit: null
};

const listing = {
  id: 'SP-1',
  ownerId: 'OWNER-1',
  name: 'Community Hall',
  listingStatus: 'pending',
  active: false,
  submittedAt: new Date('2026-10-01T00:00:00Z'),
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
  ownershipDocumentPath: 'SP-1/document.pdf',
  ownershipDocumentName: 'document.pdf',
  ownershipDocumentSize: 100,
  ownershipDocumentMimeType: 'application/pdf',
  owner: {
    id: 'OWNER-1',
    name: 'Owner',
    email: 'owner@example.test',
    phone: '123'
  },
  ratings: []
};

const prismaMock = {
  user: {
    async findUnique({ where }) {
      if (where.id === 'ADMIN-1') return { role: 'admin' };
      return { role: 'owner' };
    }
  },
  space: {
    async findMany({ where } = {}) {
      if (where && where.ownerId === 'OWNER-2') return [];
      return [{ ...listing, listingStatus: state.status, rejectionReason: state.rejectionReason }];
    },
    async findUnique() {
      return { ...listing, listingStatus: state.status };
    }
  },
  async $transaction(callback) {
    return callback({
      user: prismaMock.user,
      space: {
        async findUnique() {
          return {
            id: listing.id,
            name: listing.name,
            listingStatus: state.status,
            ownershipDocumentPath: listing.ownershipDocumentPath
          };
        },
        async update({ data }) {
          state.updated = data;
          state.status = data.listingStatus;
        }
      },
      auditLog: {
        async create({ data }) {
          state.audit = data;
        }
      }
    });
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }
  if (resolvedRequest === require.resolve('../lib/prisma')) return prismaMock;
  return originalLoad.apply(this, arguments);
};

const spaceService = require('../services/spaceService');

async function expectRejected(operation, expected, name) {
  try {
    await operation();
    throw new Error(`${name}: expected rejection`);
  } catch (error) {
    if (error.message !== expected) {
      throw new Error(`${name}: expected "${expected}", got "${error.message}"`);
    }
    console.log(`✓ ${name}`);
  }
}

async function run() {
  const pending = await spaceService.getPendingListings();
  if (pending.length !== 1 || pending[0].listing_status !== 'pending') {
    throw new Error('Pending listing queue did not return pending listings');
  }
  console.log('✓ Admin queue returns pending listings');

  const detail = await spaceService.getListingById('SP-1');
  if (!detail || detail.owner.id !== 'OWNER-1') {
    throw new Error('Listing review detail did not include owner information');
  }
  console.log('✓ Listing review detail includes property and owner data');

  await spaceService.approveListing('SP-1', 'ADMIN-1');
  if (state.status !== 'approved' || !state.updated.reviewedAt ||
      state.updated.reviewedBy !== 'ADMIN-1' || state.updated.rejectionReason !== null ||
      state.audit.actor !== 'ADMIN-1') {
    throw new Error('Approval transition or audit record is incomplete');
  }
  console.log('✓ Admin can approve a pending listing');

  await expectRejected(
    () => spaceService.approveListing('SP-1', 'ADMIN-1'),
    'Only pending listings can be approved.',
    'Approved listing cannot be approved again'
  );

  state.status = 'pending';
  state.updated = null;
  state.audit = null;
  listing.ownershipDocumentPath = null;
  await expectRejected(
    () => spaceService.approveListing('SP-1', 'ADMIN-1'),
    'An ownership document is required before approval.',
    'Listing without a document cannot be approved'
  );
  if (state.status !== 'pending') {
    throw new Error('Listing without a document changed status');
  }
  if (state.updated !== null || state.audit !== null) {
    throw new Error('Documentless approval attempt wrote an update or audit record');
  }
  listing.ownershipDocumentPath = 'SP-1/document.pdf';

  await expectRejected(
    () => spaceService.rejectListing('SP-1', 'ADMIN-1', 'short'),
    'A meaningful rejection reason is required.',
    'Rejection requires a meaningful reason'
  );

  await spaceService.rejectListing('SP-1', 'ADMIN-1', 'Ownership document is incomplete.');
  state.rejectionReason = 'Ownership document is incomplete.';
  if (state.status !== 'rejected' || state.updated.active !== false ||
      state.updated.rejectionReason !== 'Ownership document is incomplete.' ||
      state.audit.actor !== 'ADMIN-1') {
    throw new Error('Rejection transition or audit record is incomplete');
  }
  console.log('✓ Admin can reject a pending listing with a reason');

  const ownerListings = await spaceService.getOwnerSpaces('OWNER-1');
  if (ownerListings[0].rejection_reason !== state.rejectionReason) {
    throw new Error('Owner cannot see their listing rejection reason');
  }
  console.log('✓ Owner can see their own rejection reason');

  const otherOwnerListings = await spaceService.getOwnerSpaces('OWNER-2');
  if (otherOwnerListings.length !== 0) {
    throw new Error('Owner can see another owner rejection details');
  }
  console.log('✓ Owner cannot see another owner rejection details');

  await expectRejected(
    () => spaceService.rejectListing('SP-1', 'ADMIN-1', 'Another reason that is valid'),
    'Only pending listings can be rejected.',
    'Rejected listing cannot be rejected again'
  );

  await expectRejected(
    () => spaceService.approveListing('SP-1', 'OWNER-1'),
    'Only an admin can review listings.',
    'Non-admin cannot approve a listing'
  );
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
