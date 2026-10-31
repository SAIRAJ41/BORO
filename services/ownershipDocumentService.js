const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const storageClient = require('../lib/supabaseStorage');

const BUCKET = 'ownership-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FILE_TYPES = {
  '.pdf': {
    mimeType: 'application/pdf',
    signature: buffer => buffer.subarray(0, 5).toString() === '%PDF-'
  },
  '.jpg': {
    mimeType: 'image/jpeg',
    signature: buffer => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  },
  '.jpeg': {
    mimeType: 'image/jpeg',
    signature: buffer => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  },
  '.png': {
    mimeType: 'image/png',
    signature: buffer => buffer.subarray(0, 8).equals(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]))
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const definition = FILE_TYPES[extension];
    if (!definition || file.mimetype !== definition.mimeType) {
      return callback(new Error('Only PDF, JPEG, and PNG ownership documents are allowed.'));
    }
    callback(null, true);
  }
});

exports.uploadMiddleware = upload.single('ownership_document');
exports.maxFileSize = MAX_FILE_SIZE;

function validateFile(file) {
  if (!file || file.size > MAX_FILE_SIZE) {
    throw new Error('Ownership documents must be 10 MB or smaller.');
  }

  const extension = path.extname(file.originalname || '').toLowerCase();
  const definition = FILE_TYPES[extension];

  if (!definition || file.mimetype !== definition.mimeType || !definition.signature(file.buffer)) {
    throw new Error('The ownership document type or file contents are invalid.');
  }

  return {
    extension,
    mimeType: definition.mimeType
  };
}

function getClient() {
  return storageClient.getClient();
}

function getPath(spaceId, extension) {
  return `${spaceId}/${crypto.randomUUID()}${extension}`;
}

async function remove(pathname) {
  if (!pathname) return;
  const { error } = await getClient().storage.from(BUCKET).remove([pathname]);
  if (error) throw new Error('Unable to remove the ownership document from storage.');
}

exports.uploadForListing = async (spaceId, file) => {
  if (!file) throw new Error('An ownership document is required before submission.');

  const { extension, mimeType } = validateFile(file);
  const storagePath = getPath(spaceId, extension);
  const { error } = await getClient().storage.from(BUCKET).upload(
    storagePath,
    file.buffer,
    {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    }
  );

  if (error) throw new Error('Unable to upload the ownership document.');

  return {
    path: storagePath,
    name: path.basename(file.originalname),
    size: file.size,
    mimeType
  };
};

exports.replaceForListing = async (spaceId, file, previousPath) => {
  return {
    ...(await exports.uploadForListing(spaceId, file)),
    previousPath
  };
};

exports.getSignedUrl = async (storagePath) => {
  if (!storagePath) throw new Error('Ownership document is not available.');
  const { data, error } = await getClient().storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) {
    throw new Error('Unable to generate ownership document access.');
  }
  return data.signedUrl;
};

exports.isAuthorized = (requester, ownerId) =>
  Boolean(requester && (requester.role === 'admin' || requester.id === ownerId));

exports.remove = remove;
