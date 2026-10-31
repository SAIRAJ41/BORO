/**
 * Focused ownership-document storage tests with mocked Supabase Storage and Prisma.
 */

const Module = require('module');

const storageState = {
  uploadError: null,
  removeError: null,
  removed: [],
  uploads: []
};

const supabaseMock = {
  createClient() {
    return {
      storage: {
        from() {
          return {
            async upload(path, buffer, options) {
              if (storageState.uploadError) {
                return { data: null, error: storageState.uploadError };
              }
              storageState.uploads.push({ path, buffer, options });
              return { data: { path }, error: null };
            },
            async remove(paths) {
              storageState.removed.push(...paths);
              if (storageState.removeError) {
                return { data: null, error: storageState.removeError };
              }
              return { data: paths, error: null };
            },
            async createSignedUrl(path) {
              return { data: { signedUrl: `https://signed.test/${path}` }, error: null };
            }
          };
        }
      }
    };
  }
};

const state = {
  listingStatus: 'rejected',
  active: false,
  submittedAt: new Date('2026-10-01T00:00:00Z'),
  reviewedAt: new Date('2026-10-02T00:00:00Z'),
  reviewedBy: 'ADMIN-1',
  updatedAt: new Date('2026-10-02T00:00:00Z'),
  rejectionReason: 'Ownership document is incomplete.',
  documentPath: 'SP-1/old.pdf',
  name: 'Community Hall',
  description: 'A community hall.',
  address: '1 Main Street',
  locality: 'Central',
  city: 'New Delhi',
  spaceType: 'community_hall',
  indoorOutdoor: 'indoor',
  capacity: 50,
  sqft: 1000,
  pricePerHour: 300,
  depositAmount: 1500,
  allowedPurposes: ['meeting'],
  amenities: ['Chairs & Tables'],
  rules: 'Keep the space clean.',
  transactionError: null,
  concurrentStatus: null,
  pauseInitialRead: null,
  initialReadPaused: false,
  lastUpdate: null,
  audit: null
};

const prismaMock = {
  user: {
    async findUnique() {
      return { id: 'OWNER-1', role: 'owner' };
    }
  },
  space: {
    async findUnique() {
      const snapshot = {
        id: 'SP-1',
        ownerId: 'OWNER-1',
        listingStatus: state.listingStatus,
        active: state.active,
        submittedAt: state.submittedAt,
        reviewedAt: state.reviewedAt,
        reviewedBy: state.reviewedBy,
        updatedAt: state.updatedAt,
        rejectionReason: state.rejectionReason,
        ownershipDocumentPath: state.documentPath,
        name: state.name,
        description: state.description,
        address: state.address,
        locality: state.locality,
        city: state.city,
        spaceType: state.spaceType,
        indoorOutdoor: state.indoorOutdoor,
        capacity: state.capacity,
        sqft: state.sqft,
        pricePerHour: state.pricePerHour,
        depositAmount: state.depositAmount,
        allowedPurposes: state.allowedPurposes,
        amenities: state.amenities,
        rules: state.rules
      };
      if (state.pauseInitialRead && !state.initialReadPaused) {
        state.initialReadPaused = true;
        await state.pauseInitialRead;
      }
      return snapshot;
    }
  },
  async $transaction(callback) {
    if (state.transactionError) throw state.transactionError;
    if (state.concurrentStatus) {
      state.listingStatus = state.concurrentStatus;
      state.concurrentStatus = null;
    }
    return callback({
      space: {
        async findUnique() {
          return {
            ownerId: 'OWNER-1',
            listingStatus: state.listingStatus,
            active: state.active,
            submittedAt: state.submittedAt,
            reviewedAt: state.reviewedAt,
            reviewedBy: state.reviewedBy,
            rejectionReason: state.rejectionReason,
            ownershipDocumentPath: state.documentPath,
            updatedAt: state.updatedAt,
            name: state.name,
            description: state.description,
            address: state.address,
            locality: state.locality,
            city: state.city,
            spaceType: state.spaceType,
            indoorOutdoor: state.indoorOutdoor,
            capacity: state.capacity,
            sqft: state.sqft,
            pricePerHour: state.pricePerHour,
            depositAmount: state.depositAmount,
            allowedPurposes: state.allowedPurposes,
            amenities: state.amenities,
            rules: state.rules
          };
        },
        async updateMany({ where, data }) {
          if (where.updatedAt?.getTime() !== state.updatedAt?.getTime()) {
            return { count: 0 };
          }
          state.lastUpdate = data;
          if (data.name !== undefined) state.name = data.name;
          if (data.description !== undefined) state.description = data.description;
          if (data.address !== undefined) state.address = data.address;
          if (data.locality !== undefined) state.locality = data.locality;
          if (data.city !== undefined) state.city = data.city;
          if (data.spaceType !== undefined) state.spaceType = data.spaceType;
          if (data.indoorOutdoor !== undefined) state.indoorOutdoor = data.indoorOutdoor;
          if (Number.isFinite(data.capacity)) state.capacity = data.capacity;
          if (Number.isFinite(data.sqft)) state.sqft = data.sqft;
          if (Number.isFinite(data.pricePerHour)) state.pricePerHour = data.pricePerHour;
          if (Number.isFinite(data.depositAmount)) state.depositAmount = data.depositAmount;
          if (data.allowedPurposes !== undefined) state.allowedPurposes = data.allowedPurposes;
          if (data.amenities !== undefined) state.amenities = data.amenities;
          if (data.rules !== undefined) state.rules = data.rules;
          if (data.listingStatus) state.listingStatus = data.listingStatus;
          if (data.active !== undefined) state.active = data.active;
          if (data.submittedAt) state.submittedAt = data.submittedAt;
          if (data.reviewedAt !== undefined) state.reviewedAt = data.reviewedAt;
          if (data.reviewedBy !== undefined) state.reviewedBy = data.reviewedBy;
          if (data.rejectionReason !== undefined) {
            state.rejectionReason = data.rejectionReason;
          }
          if (data.ownershipDocumentPath) {
            state.documentPath = data.ownershipDocumentPath;
          }
          state.updatedAt = new Date(state.updatedAt.getTime() + 1);
          return { count: 1 };
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
  if (request === '@supabase/supabase-js') return supabaseMock;

  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === require.resolve('../lib/prisma')) {
    return prismaMock;
  }

  return originalLoad.apply(this, arguments);
};

process.env.SUPABASE_URL = 'https://storage.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-key';

const documents = require('../services/ownershipDocumentService');
const spaceService = require('../services/spaceService');

const validPdf = {
  originalname: 'ownership.pdf',
  mimetype: 'application/pdf',
  size: 12,
  buffer: Buffer.from('%PDF-1.7 test')
};

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
  const uploaded = await documents.uploadForListing('SP-1', validPdf);
  if (!uploaded.path.startsWith('SP-1/') || uploaded.path.endsWith('/old.pdf')) {
    throw new Error('Valid PDF did not receive a unique listing-scoped path');
  }
  console.log('✓ Valid PDF upload uses a unique listing-scoped path');

  const ownerUploaded = await documents.uploadForOwnerVerification('OWNER-1', validPdf);
  if (!ownerUploaded.path.startsWith('owners/OWNER-1/') || ownerUploaded.path.includes('..')) {
    throw new Error('Owner verification upload did not use a unique owner-scoped private path');
  }
  console.log('✓ Owner verification upload uses a unique private owner-scoped path');

  await expectRejected(
    () => documents.uploadForListing('SP-1', {
      ...validPdf,
      originalname: 'ownership.exe',
      mimetype: 'application/octet-stream'
    }),
    'The ownership document type or file contents are invalid.',
    'Invalid file type is rejected'
  );

  await expectRejected(
    () => documents.uploadForListing('SP-1', {
      ...validPdf,
      size: documents.maxFileSize + 1
    }),
    'Ownership documents must be 10 MB or smaller.',
    'Oversized file is rejected'
  );

  await expectRejected(
    () => spaceService.create('OWNER-1', {}, null),
    'An ownership document is required before submission.',
    'Missing document prevents listing submission'
  );

  await expectRejected(
    () => spaceService.getDocumentAccess('SP-1', null),
    'You are not authorized to access this document.',
    'Unauthenticated document access is rejected'
  );

  await expectRejected(
    () => spaceService.getDocumentAccess('SP-1', { id: 'OWNER-2', role: 'owner' }),
    'You are not authorized to access this document.',
    'Another owner cannot access the document'
  );

  await expectRejected(
    () => spaceService.update('SP-1', 'OWNER-2', { documentFile: validPdf }),
    'You are not authorized to update this space.',
    'Another owner cannot upload to the listing'
  );

  const adminUrl = await spaceService.getDocumentAccess('SP-1', {
    id: 'ADMIN-1',
    role: 'admin'
  });
  if (!adminUrl.includes('SP-1/old.pdf')) {
    throw new Error('Admin signed URL retrieval failed');
  }
  console.log('✓ Admin can retrieve a short-lived signed URL');

  state.transactionError = new Error('database failure');
  storageState.removed = [];
  const uploadCountBeforeCreateFailure = storageState.uploads.length;
  await expectRejected(
    () => spaceService.create('OWNER-1', {}, validPdf),
    'database failure',
    'Failed listing creation cleans up the new document'
  );
  const createdPath = storageState.uploads[uploadCountBeforeCreateFailure].path;
  if (!storageState.removed.includes(createdPath) ||
      storageState.removed.includes(state.documentPath)) {
    throw new Error('Listing creation failure removed the wrong storage object');
  }

  storageState.removed = [];
  await expectRejected(
    () => spaceService.update('SP-1', 'OWNER-1', { documentFile: validPdf }),
    'database failure',
    'Failed replacement leaves the existing document path intact'
  );
  if (storageState.removed.includes(state.documentPath)) {
    throw new Error('Failed replacement removed the existing document');
  }
  state.transactionError = null;

  state.transactionError = new Error('database failure');
  storageState.removeError = new Error('cleanup unavailable');
  await expectRejected(
    () => spaceService.create('OWNER-1', {}, validPdf),
    'database failure',
    'Cleanup failure does not hide the listing creation error'
  );
  storageState.removeError = null;
  state.transactionError = null;

  await spaceService.update('SP-1', 'OWNER-1', { documentFile: validPdf });
  if (state.lastUpdate.listingStatus !== 'pending' ||
      !state.lastUpdate.ownershipDocumentPath ||
      state.lastUpdate.reviewedAt !== null ||
      state.lastUpdate.reviewedBy !== null ||
      state.lastUpdate.rejectionReason !== null) {
    throw new Error('Rejected resubmission did not return listing to pending');
  }
  console.log('✓ Rejected listing resubmission replaces document and returns to pending');

  state.listingStatus = 'rejected';
  state.active = false;
  await expectRejected(
    () => spaceService.update('SP-1', 'OWNER-1', { name: 'Missing document resubmission' }),
    'A replacement ownership document is required before resubmission.',
    'Rejected listing still requires a replacement document'
  );

  state.listingStatus = 'pending';
  state.active = false;
  state.reviewedAt = null;
  state.reviewedBy = null;
  state.rejectionReason = null;
  await spaceService.update('SP-1', 'OWNER-1', {
    name: 'Pending listing edit'
  });
  if (state.listingStatus !== 'pending' || state.active !== false ||
      state.reviewedAt !== null || state.reviewedBy !== null ||
      state.rejectionReason !== null) {
    throw new Error('Pending listing edit changed review lifecycle metadata');
  }
  console.log('✓ Pending listing edit remains pending and inactive');

  state.listingStatus = 'approved';
  state.active = true;
  state.reviewedAt = new Date('2026-10-03T00:00:00Z');
  state.reviewedBy = 'ADMIN-1';
  state.rejectionReason = null;
  const unchangedData = {
    name: state.name,
    description: state.description,
    address: state.address,
    locality: state.locality,
    city: state.city,
    space_type: state.spaceType,
    indoor_outdoor: state.indoorOutdoor,
    capacity: String(state.capacity),
    sqft: String(state.sqft),
    price_per_hour: String(state.pricePerHour),
    deposit_amount: String(state.depositAmount),
    allowed_purposes: state.allowedPurposes,
    facilities: state.amenities,
    rules: state.rules
  };
  await spaceService.update('SP-1', 'OWNER-1', unchangedData);
  if (state.listingStatus !== 'approved' || state.active !== true) {
    throw new Error('Unchanged listing values triggered unnecessary re-review');
  }
  console.log('✓ Unchanged approved listing values remain approved');

  await spaceService.update('SP-1', 'OWNER-1', {
    ...unchangedData,
    name: 'Updated Community Hall'
  });
  if (state.listingStatus !== 'pending' || state.active !== false ||
      state.reviewedAt !== null || state.reviewedBy !== null ||
      state.rejectionReason !== null || state.audit.action !== 'resubmit_listing') {
    throw new Error('Material approved listing edit did not trigger re-review');
  }
  console.log('✓ Material approved listing edit returns to pending and inactive');

  state.listingStatus = 'approved';
  state.active = true;
  state.reviewedAt = new Date('2026-10-04T00:00:00Z');
  state.reviewedBy = 'ADMIN-1';
  state.rejectionReason = null;
  state.lastUpdate = null;
  state.audit = null;
  state.concurrentStatus = 'rejected';
  await expectRejected(
    () => spaceService.update('SP-1', 'OWNER-1', {
      ...unchangedData,
      description: 'Concurrent edit should fail.'
    }),
    'The listing changed while you were editing it. Please reload and try again.',
    'Concurrent listing update is rejected without a write'
  );
  if (state.lastUpdate !== null || state.audit !== null) {
    throw new Error('Concurrent listing update partially changed state');
  }

  state.listingStatus = 'pending';
  state.active = false;
  state.reviewedAt = null;
  state.reviewedBy = null;
  state.rejectionReason = null;
  state.name = 'Community Hall';
  state.description = 'A community hall.';
  state.updatedAt = new Date('2026-10-05T00:00:00Z');
  state.lastUpdate = null;
  state.audit = null;

  let releaseStaleRead;
  const staleRead = new Promise(resolve => {
    releaseStaleRead = resolve;
  });
  state.pauseInitialRead = staleRead;
  state.initialReadPaused = false;
  const staleEdit = spaceService.update('SP-1', 'OWNER-1', {
    description: 'Stale second edit.'
  });
  while (!state.initialReadPaused) {
    await new Promise(resolve => setImmediate(resolve));
  }

  await spaceService.update('SP-1', 'OWNER-1', {
    description: 'First edit wins.'
  });
  releaseStaleRead();
  await expectRejected(
    () => staleEdit,
    'The listing changed while you were editing it. Please reload and try again.',
    'Stale concurrent pending edit is rejected'
  );
  state.pauseInitialRead = null;
  if (state.description !== 'First edit wins.') {
    throw new Error('Stale concurrent edit overwrote the first pending edit');
  }
  console.log('✓ Stale pending edit does not overwrite the first edit');

  storageState.uploadError = new Error('storage unavailable');
  await expectRejected(
    () => documents.uploadForListing('SP-1', validPdf),
    'Unable to upload the ownership document.',
    'Storage upload failure is surfaced safely'
  );
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
