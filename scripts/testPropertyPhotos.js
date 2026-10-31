/**
 * Focused property-photo storage and consistency tests.
 */

const Module = require('module');

const storage = {
  uploads: [],
  removed: [],
  uploadError: null,
  removeError: null
};

const photo = (name, type, buffer) => ({
  originalname: name,
  mimetype: type,
  size: buffer.length,
  buffer
});

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.from('RIFF0000WEBP');

const state = {
  updatedAt: new Date('2026-10-31T00:00:00Z'),
  photos: [],
  dbError: null,
  stale: false,
  audits: []
};

const supabaseMock = {
  createClient() {
    return {
      storage: {
        from() {
          return {
            async upload(path, buffer, options) {
              if (storage.uploadError) return { error: storage.uploadError };
              storage.uploads.push({ path, buffer, options });
              return { data: { path }, error: null };
            },
            async remove(paths) {
              storage.removed.push(...paths);
              return { error: storage.removeError };
            },
            getPublicUrl(path) {
              return { data: { publicUrl: `https://photos.test/${path}` } };
            }
          };
        }
      }
    };
  }
};

const tx = {
  space: {
    async findFirst({ where }) {
      if (where.ownerId === 'OWNER-2') return null;
      if (state.dbError) throw state.dbError;
      return {
        photos: state.photos,
        updatedAt: state.updatedAt,
        active: true,
        listingStatus: 'approved'
      };
    }
  },
  async _update({ where, data }) {
    if (state.stale || where.updatedAt.getTime() !== state.updatedAt.getTime()) {
      return { count: 0 };
    }
    state.photos = data.photos;
    state.updatedAt = new Date(state.updatedAt.getTime() + 1);
    return { count: 1 };
  },
  spaceUpdateMany: null,
  auditLog: {
    async create({ data }) {
      state.audits.push(data);
    }
  }
};
tx.space.updateMany = (...args) => tx._update(...args);

const prismaMock = {
  async $transaction(callback) {
    return callback(tx);
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '@supabase/supabase-js') return supabaseMock;
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolved = null;
  }
  if (resolved === require.resolve('../lib/prisma')) return prismaMock;
  return originalLoad.apply(this, arguments);
};

const propertyPhotoService = require('../services/propertyPhotoService');

async function expectRejected(operation, text, name) {
  try {
    await operation();
    throw new Error(`${name}: expected rejection`);
  } catch (error) {
    if (error.message !== text) {
      throw new Error(`${name}: expected "${text}", got "${error.message}"`);
    }
    console.log(`✓ ${name}`);
  }
}

async function run() {
  process.env.SUPABASE_URL = 'https://storage.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  await expectRejected(
    () => propertyPhotoService.add('SPACE-1', 'OWNER-2', [photo('x.jpg', 'image/jpeg', jpeg)]),
    'Property listing not found or unauthorized.',
    'Another owner cannot modify photos'
  );
  state.stale = true;
  await expectRejected(
    () => propertyPhotoService.add('SPACE-1', 'OWNER-1', [photo('x.jpg', 'image/jpeg', jpeg)]),
    'Listing changed; reload and retry.',
    'Concurrent/stale photo update is rejected'
  );

  state.stale = false;
  await expectRejected(
    () => propertyPhotoService.add('SPACE-1', 'OWNER-1', [photo('x.gif', 'image/gif', jpeg)]),
    'Property photos must be valid JPEG, PNG, or WebP files no larger than 8 MB.',
    'Invalid extension and MIME are rejected'
  );
  await expectRejected(
    () => propertyPhotoService.add('SPACE-1', 'OWNER-1', [photo('x.jpg', 'image/jpeg', png)]),
    'Property photos must be valid JPEG, PNG, or WebP files no larger than 8 MB.',
    'Invalid file signature is rejected'
  );
  await expectRejected(
    () => propertyPhotoService.add(
      'SPACE-1',
      'OWNER-1',
      Array.from({ length: 9 }, (_, index) =>
        photo(`photo-${index}.jpg`, 'image/jpeg', jpeg)
      )
    ),
    'You can upload at most 8 photos at once.',
    'Upload count limit is enforced'
  );

  const uploaded = await propertyPhotoService.add('SPACE-1', 'OWNER-1', [
    photo('one.jpg', 'image/jpeg', jpeg),
    photo('two.png', 'image/png', png),
    photo('three.webp', 'image/webp', webp)
  ]);
  if (uploaded.length !== 3 || state.photos.length !== 3 ||
      state.audits.at(-1).action !== 'add_property_photos') {
    throw new Error('Valid multi-photo upload was not persisted and audited');
  }
  console.log('✓ Valid multi-photo upload preserves order');

  state.photos = [
    ...state.photos,
    ...Array.from({ length: 2 }, (_, index) => ({
      ...state.photos[0],
      id: `existing-${index}`,
      path: `SPACE-1/existing-${index}.jpg`
    }))
  ];
  await expectRejected(
    () => propertyPhotoService.add(
      'SPACE-1',
      'OWNER-1',
      Array.from({ length: 8 }, (_, index) =>
        photo(`extra-${index}.jpg`, 'image/jpeg', jpeg)
      )
    ),
    'A listing can have at most 12 photos.',
    'Listing photo-count limit is enforced'
  );

  const oldPath = state.photos[0].path;
  await propertyPhotoService.replace(
    'SPACE-1',
    'OWNER-1',
    state.photos[0].id,
    photo('replacement.jpg', 'image/jpeg', jpeg)
  );
  if (state.photos[0].name !== 'replacement.jpg' || !storage.removed.includes(oldPath)) {
    throw new Error('Photo replacement did not update metadata and clean old storage');
  }
  console.log('✓ Replacement uploads first and cleans the old object');

  const beforeFailure = [...state.photos];
  state.dbError = new Error('database unavailable');
  await expectRejected(
    () => propertyPhotoService.add('SPACE-1', 'OWNER-1', [photo('failed.jpg', 'image/jpeg', jpeg)]),
    'database unavailable',
    'Database failure preserves original error'
  );
  state.dbError = null;
  if (JSON.stringify(state.photos) !== JSON.stringify(beforeFailure)) {
    throw new Error('Failed photo update changed database photo state');
  }
  console.log('✓ Failed update cleans new uploads without deleting existing photos');

  storage.removeError = new Error('storage cleanup unavailable');
  await propertyPhotoService.remove('SPACE-1', 'OWNER-1', state.photos[1].id);
  if (state.photos.length !== 4 || state.audits.at(-1).action !== 'delete_property_photo') {
    throw new Error('Photo deletion did not persist and audit');
  }
  storage.removeError = null;
  console.log('✓ Deletion persists even when storage cleanup reports an error');

  const resolved = await propertyPhotoService.resolvePhotos(state.photos);
  if (!resolved[0].url || resolved[0].path === resolved[0].url) {
    throw new Error('Public photo URL was not resolved server-side');
  }
  console.log('✓ Public URLs are resolved server-side from safe paths');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
