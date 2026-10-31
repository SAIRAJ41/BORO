/**
 * Focused owner-private listing detail service tests with mocked Prisma and Storage.
 */

const Module = require('module');

const state = {
  status: 'pending',
  rejectionReason: null,
  documentPath: 'SP-1/document.pdf'
};

const baseRecord = {
  id: 'SP-1',
  ownerId: 'OWNER-1',
  name: 'Community Hall',
  description: 'A private owner listing.',
  spaceType: 'community_hall',
  indoorOutdoor: 'indoor',
  capacity: 50,
  sqft: 1000,
  pricePerHour: 300,
  depositAmount: 1500,
  locality: 'Central',
  city: 'New Delhi',
  address: '1 Main Street',
  amenities: ['Chairs & Tables'],
  allowedPurposes: ['meeting'],
  rules: 'Keep the space clean.',
  photos: [],
  active: false,
  listingStatus: 'pending',
  submittedAt: new Date('2026-10-01T00:00:00Z'),
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
  ownershipDocumentType: 'application/pdf',
  ownershipDocumentUrl: null,
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
  space: {
    async findFirst({ where }) {
      if (where.ownerId !== 'OWNER-1' || where.id !== 'SP-1') return null;
      return {
        ...baseRecord,
        listingStatus: state.status,
        rejectionReason: state.rejectionReason,
        ownershipDocumentPath: state.documentPath,
        active: state.status === 'approved',
        reviewedAt: state.status === 'approved' || state.status === 'rejected'
          ? new Date('2026-10-02T00:00:00Z')
          : null
      };
    },
    async findUnique({ where }) {
      if (where.id !== 'SP-1') return null;
      return {
        ownerId: 'OWNER-1',
        ownershipDocumentPath: state.documentPath
      };
    }
  }
};

const ownershipDocumentMock = {
  async getSignedUrl(path) {
    if (!path) throw new Error('Ownership document is not available.');
    return `https://signed.test/${path}`;
  },
  isAuthorized(requester, ownerId) {
    return Boolean(requester && (requester.role === 'admin' || requester.id === ownerId));
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
  if (resolvedRequest === require.resolve('../services/ownershipDocumentService')) {
    return ownershipDocumentMock;
  }
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
  for (const status of ['pending', 'approved', 'rejected']) {
    state.status = status;
    state.rejectionReason = status === 'rejected' ? 'Please update the document.' : null;
    const listing = await spaceService.getOwnerSpaceById('SP-1', 'OWNER-1');
    if (!listing || listing.listing_status !== status) {
      throw new Error(`Owner could not view ${status} listing`);
    }
    if (status === 'rejected' && listing.rejection_reason !== state.rejectionReason) {
      throw new Error('Rejected listing did not include its rejection reason');
    }
    console.log(`✓ Owner can view own ${status} listing`);
  }

  if (await spaceService.getOwnerSpaceById('SP-1', 'OWNER-2') !== null) {
    throw new Error('Another owner accessed the listing');
  }
  console.log('✓ Another owner cannot access the listing');

  if (await spaceService.getOwnerSpaceById('SP-404', 'OWNER-1') !== null) {
    throw new Error('Nonexistent listing was returned');
  }
  console.log('✓ Nonexistent listing is not returned');

  state.documentPath = null;
  const withoutDocument = await spaceService.getOwnerSpaceById('SP-1', 'OWNER-1');
  if (!withoutDocument || withoutDocument.ownership_document_present !== false) {
    throw new Error('Missing ownership document was not handled safely');
  }
  console.log('✓ Missing ownership document is handled safely');

  await expectRejected(
    () => spaceService.getDocumentAccess('SP-1', { id: 'OWNER-2', role: 'owner' }),
    'You are not authorized to access this document.',
    'Another owner cannot view the document'
  );

  state.documentPath = 'SP-1/document.pdf';
  const signedUrl = await spaceService.getDocumentAccess('SP-1', {
    id: 'OWNER-1',
    role: 'owner'
  });
  if (signedUrl !== 'https://signed.test/SP-1/document.pdf') {
    throw new Error('Owner document access did not use a signed URL');
  }
  console.log('✓ Owner document viewing uses the signed-URL service');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
