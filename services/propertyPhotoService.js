const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const prisma = require('../lib/prisma');
const storageClient = require('../lib/supabaseStorage');

const BUCKET = 'property-photos';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_PHOTOS = 12;
const MAX_UPLOAD_COUNT = 8;
const FILE_TYPES = {
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
  },
  '.webp': {
    mimeType: 'image/webp',
    signature: buffer => buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP'
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_UPLOAD_COUNT },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const definition = FILE_TYPES[extension];
    if (!definition || file.mimetype !== definition.mimeType) {
      return callback(new Error('Only JPEG, PNG, and WebP property photos are allowed.'));
    }
    callback(null, true);
  }
});

exports.uploadMiddleware = upload.array('photos', MAX_UPLOAD_COUNT);
exports.maxFileSize = MAX_FILE_SIZE;
exports.maxPhotos = MAX_PHOTOS;
exports.maxUploadCount = MAX_UPLOAD_COUNT;

function validateFile(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const definition = FILE_TYPES[extension];
  if (!file || file.size > MAX_FILE_SIZE ||
      !definition ||
      file.mimetype !== definition.mimeType ||
      !definition.signature(file.buffer)) {
    throw new Error('Property photos must be valid JPEG, PNG, or WebP files no larger than 8 MB.');
  }
  return { extension, mimeType: definition.mimeType };
}

function getPath(spaceId, extension) {
  return `${spaceId}/${crypto.randomUUID()}${extension}`;
}

function getClient() {
  return storageClient.getClient();
}

async function remove(paths) {
  const values = paths.filter(Boolean);
  if (!values.length) return;
  const { error } = await getClient().storage.from(BUCKET).remove(values);
  if (error) throw new Error('Unable to remove property photos from storage.');
}

async function uploadFile(spaceId, file) {
  const { extension, mimeType } = validateFile(file);
  const storagePath = getPath(spaceId, extension);
  const { error } = await getClient().storage.from(BUCKET).upload(
    storagePath,
    file.buffer,
    { contentType: mimeType, cacheControl: '3600', upsert: false }
  );
  if (error) throw new Error('Unable to upload property photo.');
  return {
    id: crypto.randomUUID(),
    path: storagePath,
    name: path.basename(file.originalname),
    size: file.size,
    mimeType
  };
}

exports.getPublicUrl = pathValue => {
  if (!pathValue) return null;
  const { data } = getClient().storage.from(BUCKET).getPublicUrl(pathValue);
  return data?.publicUrl || null;
};

exports.resolvePhotos = photos => Promise.all(
  (Array.isArray(photos) ? photos : []).map(async photo => {
    if (typeof photo === 'string') return photo;
    if (!photo || !photo.path) return null;
    return {
      ...photo,
      url: exports.getPublicUrl(photo.path)
    };
  })
).then(items => items.filter(Boolean));

exports.add = async (spaceId, ownerId, files) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('At least one property photo is required.');
  }
  if (files.length > MAX_UPLOAD_COUNT) {
    throw new Error(`You can upload at most ${MAX_UPLOAD_COUNT} photos at once.`);
  }

  const uploaded = [];
  try {
    for (const file of files) uploaded.push(await uploadFile(spaceId, file));

    await prisma.$transaction(async tx => {
      const current = await tx.space.findFirst({
        where: { id: spaceId, ownerId },
        select: { photos: true, updatedAt: true, active: true, listingStatus: true }
      });
      if (!current) {
        throw new Error('Property listing not found or unauthorized.');
      }
      if (!current.active || current.listingStatus !== 'approved') {
        throw new Error('Photos can only be managed for an approved active listing.');
      }
      const photos = Array.isArray(current.photos) ? current.photos : [];
      if (photos.length + uploaded.length > MAX_PHOTOS) {
        throw new Error(`A listing can have at most ${MAX_PHOTOS} photos.`);
      }
      const result = await tx.space.updateMany({
        where: { id: spaceId, ownerId, updatedAt: current.updatedAt },
        data: { photos: [...photos, ...uploaded] }
      });
      if (result.count !== 1) throw new Error('Listing changed; reload and retry.');
      await tx.auditLog.create({
        data: {
          id: `AUD-${crypto.randomUUID()}`,
          actor: ownerId,
          action: 'add_property_photos',
          target: `space:${spaceId}`,
          details: { photoIds: uploaded.map(photo => photo.id) }
        }
      });
    });
    return uploaded;
  } catch (error) {
    try {
      await remove(uploaded.map(photo => photo.path));
    } catch (cleanupError) {
      console.error('BORO Storage cleanup failed after property photo update:', cleanupError.message);
    }
    throw error;
  }
};

exports.replace = async (spaceId, ownerId, photoId, file) => {
  const uploaded = await uploadFile(spaceId, file);
  let previousPath;
  try {
    await prisma.$transaction(async tx => {
      const current = await tx.space.findFirst({
        where: { id: spaceId, ownerId },
        select: { photos: true, updatedAt: true, active: true, listingStatus: true }
      });
      if (!current) {
        throw new Error('Property listing not found or unauthorized.');
      }
      if (!current.active || current.listingStatus !== 'approved') {
        throw new Error('Photos can only be managed for an approved active listing.');
      }
      const photos = Array.isArray(current.photos) ? current.photos : [];
      const index = photos.findIndex(photo => photo && photo.id === photoId);
      if (index < 0) throw new Error('Property photo not found or unauthorized.');
      previousPath = photos[index].path;
      const replacement = [...photos];
      replacement[index] = { ...uploaded, id: photoId };
      const result = await tx.space.updateMany({
        where: { id: spaceId, ownerId, updatedAt: current.updatedAt },
        data: { photos: replacement }
      });
      if (result.count !== 1) throw new Error('Listing changed; reload and retry.');
      await tx.auditLog.create({
        data: {
          id: `AUD-${crypto.randomUUID()}`,
          actor: ownerId,
          action: 'replace_property_photo',
          target: `space:${spaceId}`,
          details: { photoId }
        }
      });
    });
    try {
      await remove([previousPath]);
    } catch (cleanupError) {
      console.error('BORO Storage cleanup failed after property photo replacement:', cleanupError.message);
    }
  } catch (error) {
    try {
      await remove([uploaded.path]);
    } catch (cleanupError) {
      console.error('BORO Storage cleanup failed after property photo replacement error:', cleanupError.message);
    }
    throw error;
  }
};

exports.remove = async (spaceId, ownerId, photoId) => {
  let previousPath;
  await prisma.$transaction(async tx => {
    const current = await tx.space.findFirst({
      where: { id: spaceId, ownerId },
      select: { photos: true, updatedAt: true, active: true, listingStatus: true }
    });
    if (!current) {
      throw new Error('Property listing not found or unauthorized.');
    }
    if (!current.active || current.listingStatus !== 'approved') {
      throw new Error('Photos can only be managed for an approved active listing.');
    }
    const photos = Array.isArray(current.photos) ? current.photos : [];
    const index = photos.findIndex(photo => photo && photo.id === photoId);
    if (index < 0) throw new Error('Property photo not found or unauthorized.');
    previousPath = photos[index].path;
    const result = await tx.space.updateMany({
      where: { id: spaceId, ownerId, updatedAt: current.updatedAt },
      data: { photos: photos.filter((_, itemIndex) => itemIndex !== index) }
    });
    if (result.count !== 1) throw new Error('Listing changed; reload and retry.');
    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomUUID()}`,
        actor: ownerId,
        action: 'delete_property_photo',
        target: `space:${spaceId}`,
        details: { photoId }
      }
    });
  });
  try {
    await remove([previousPath]);
  } catch (cleanupError) {
    console.error('BORO Storage cleanup failed after property photo deletion:', cleanupError.message);
  }
};
