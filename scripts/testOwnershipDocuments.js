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
  documentPath: 'SP-1/old.pdf',
  transactionError: null,
  lastUpdate: null
};

const prismaMock = {
  user: {
    async findUnique() {
      return { id: 'OWNER-1', role: 'owner' };
    }
  },
  space: {
    async findUnique() {
      return {
        id: 'SP-1',
        ownerId: 'OWNER-1',
        listingStatus: state.listingStatus,
        ownershipDocumentPath: state.documentPath
      };
    }
  },
  async $transaction(callback) {
    if (state.transactionError) throw state.transactionError;
    return callback({
      space: {
        async update({ data }) {
          state.lastUpdate = data;
        }
      },
      auditLog: {
        async create() {}
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
  if (state.lastUpdate.listingStatus !== 'pending' || !state.lastUpdate.ownershipDocumentPath) {
    throw new Error('Rejected resubmission did not return listing to pending');
  }
  console.log('✓ Rejected listing resubmission replaces document and returns to pending');

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
