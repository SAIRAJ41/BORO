const prisma = require('../lib/prisma');
const crypto = require('crypto');
const ownershipDocumentService = require('./ownershipDocumentService');

// Convert Prisma space fields to the field names used by the frontend.
function normalizeSpace(space) {
  if (!space) return null;

  const ratings = space.ratings || [];
  const ratingTotal = ratings.reduce(
    (total, item) => total + item.rating,
    0
  );

  const normalized = { ...space };
  delete normalized.ownershipDocumentPath;
  delete normalized.ownershipDocumentUrl;

  return {
    ...normalized,
    owner_id: space.ownerId,
    space_type: space.spaceType,
    indoor_outdoor: space.indoorOutdoor,
    price_per_hour: Number(space.pricePerHour),
    deposit_amount: Number(space.depositAmount),
    facilities: space.amenities || [],
    allowed_purposes: space.allowedPurposes || [],
    photos: space.photos || [],
    listing_status: space.listingStatus,
    submitted_at: space.submittedAt,
    reviewed_at: space.reviewedAt,
    reviewed_by: space.reviewedBy,
    rejection_reason: space.rejectionReason,
    ownership_document_type: space.ownershipDocumentType,
    ownership_document_name: space.ownershipDocumentName,
    ownership_document_size: space.ownershipDocumentSize,
    ownership_document_mime_type: space.ownershipDocumentMimeType,
    ownership_document_present: Boolean(space.ownershipDocumentPath),
    rating: ratings.length
      ? Number((ratingTotal / ratings.length).toFixed(1))
      : 0,
    review_count: ratings.length,
    locality: space.locality
  };
}

// Convert the documented space form fields to Prisma fields.
function normalizeSpaceInput(data) {
  return {
    name: data.name,
    description: data.description,
    spaceType: data.space_type,
    indoorOutdoor: data.indoor_outdoor,
    capacity: Number(data.capacity),
    sqft: Number(data.sqft || 0),
    pricePerHour: Number(data.price_per_hour),
    depositAmount: Number(data.deposit_amount || 0),
    locality: data.locality,
    city: data.city,
    address: data.address,
    amenities: Array.isArray(data.amenities)
      ? data.amenities
      : Array.isArray(data.facilities)
        ? data.facilities
        : [],
    allowedPurposes: Array.isArray(data.allowed_purposes)
      ? data.allowed_purposes
      : [],
    rules: data.rules || null
  };
}

// Record space actions in the audit log.
async function writeAudit(tx, actorId, action, spaceId, details = {}) {
  await tx.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      actor: actorId,
      action,
      target: `space:${spaceId}`,
      details
    }
  });
}

// GET /search
exports.getSpaces = async (filters = {}, page = 1, limit = 12) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Number(limit) || 12);

  const where = { active: true, listingStatus: 'approved' };

  if (filters.space_type) {
    where.spaceType = filters.space_type;
  }

  if (filters.indoor_outdoor) {
    where.indoorOutdoor = filters.indoor_outdoor;
  }

  if (filters.capacity_min) {
    where.capacity = {
      gte: Number(filters.capacity_min)
    };
  }

  if (filters.price_max) {
    where.pricePerHour = {
      lte: Number(filters.price_max)
    };
  }

  if (filters.purpose) {
    where.allowedPurposes = {
      array_contains: [filters.purpose]
    };
  }

  if (filters.facilities) {
    const facilities = Array.isArray(filters.facilities)
      ? filters.facilities
      : [filters.facilities];

    where.AND = facilities.map(facility => ({
      amenities: {
        array_contains: [facility]
      }
    }));
  }

  if (filters.search) {
    where.OR = [
      {
        name: {
          contains: filters.search,
          mode: 'insensitive'
        }
      },
      {
        description: {
          contains: filters.search,
          mode: 'insensitive'
        }
      },
      {
        locality: {
          contains: filters.search,
          mode: 'insensitive'
        }
      },
      {
        city: {
          contains: filters.search,
          mode: 'insensitive'
        }
      }
    ];
  }

  const [records, total] = await prisma.$transaction([
    prisma.space.findMany({
      where,
      include: {
        ratings: {
          select: { rating: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.space.count({ where })
  ]);

  return {
    spaces: records.map(normalizeSpace),
    total,
    totalPages: Math.ceil(total / limit)
  };
};

// GET /spaces/:id
exports.getSpaceById = async (id, { publicOnly = true } = {}) => {
  const query = publicOnly
    ? prisma.space.findFirst({
        where: { id, active: true, listingStatus: 'approved' },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              initials: true,
              phone: true,
              verifications: {
                select: {
                  isVerified: true
                }
              }
            }
          },
          ratings: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  initials: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          conditionReports: {
            include: {
              reporter: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      })
    : prisma.space.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              initials: true,
              phone: true,
              verifications: {
                select: {
                  isVerified: true
                }
              }
            }
          },
          ratings: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  initials: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          conditionReports: {
            include: {
              reporter: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

  const record = await query;

  if (!record) return null;

  const conditionReports = record.conditionReports.map(report => ({
    id: report.id,
    date: report.createdAt,
    type: report.type,
    inspector: report.reporter.name,
    details: report.conditionNotes,
    checklist: report.checklist,
    photos: report.photos,
    passed: report.verifiedByOwner
  }));

  return {
    space: normalizeSpace(record),
    owner: record.owner,
    conditionReports,
    eligibility: null
  };
};

// GET /owner/my-spaces
exports.getOwnerSpaces = async (ownerId) => {
  const records = await prisma.space.findMany({
    where: { ownerId },
    include: {
      ratings: {
        select: { rating: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return records.map(record => ({
    ...normalizeSpace(record),
    active: record.active,
    listing_status: record.listingStatus,
    submitted_at: record.submittedAt,
    reviewed_at: record.reviewedAt,
    rejection_reason: record.rejectionReason,
    ownership_document_type: record.ownershipDocumentType,
    ownership_document_name: record.ownershipDocumentName,
    ownership_document_size: record.ownershipDocumentSize,
    ownership_document_mime_type: record.ownershipDocumentMimeType,
    ownership_document_present: Boolean(record.ownershipDocumentPath)
  }));
};

// Get condition history for a space.
exports.getConditionHistory = async (spaceId) => {
  const reports = await prisma.conditionReport.findMany({
    where: { spaceId },
    include: {
      reporter: {
        select: {
          name: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return reports.map(report => ({
    id: report.id,
    date: report.createdAt,
    type: report.type,
    inspector: report.reporter.name,
    details: report.conditionNotes,
    checklist: report.checklist,
    photos: report.photos,
    passed: report.verifiedByOwner
  }));
};

// Form options are not specified in the database service contract.
exports.getFormOptions = async () => ({});

// POST /owner/spaces
exports.create = async (ownerId, data, documentFile) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
  });

  if (!owner || owner.role !== 'owner') {
    throw new Error('Owner not found.');
  }

  const id = `SP-${crypto.randomUUID()}`;
  const spaceData = normalizeSpaceInput(data);
  const document = await ownershipDocumentService.uploadForListing(id, documentFile);

  try {
    await prisma.$transaction(async tx => {
      await tx.space.create({
        data: {
          id,
          ownerId,
          active: false,
          listingStatus: 'pending',
          submittedAt: new Date(),
          ownershipDocumentType: data.ownership_document_type || document.mimeType,
          ownershipDocumentPath: document.path,
          ownershipDocumentName: document.name,
          ownershipDocumentSize: document.size,
          ownershipDocumentMimeType: document.mimeType,
          ...spaceData
        }
      });

      await writeAudit(
        tx,
        ownerId,
        'create_space',
        id,
        { name: spaceData.name }
      );
    });
  } catch (error) {
    try {
      await ownershipDocumentService.remove(document.path);
    } catch (cleanupError) {
      console.error('BORO Storage cleanup failed after listing creation error:', cleanupError.message);
    }
    throw error;
  }

  return { id };
};

// POST /owner/spaces/:id
exports.update = async (spaceId, ownerId, data) => {
  const existing = await prisma.space.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      ownerId: true,
      listingStatus: true,
      ownershipDocumentPath: true
    }
  });

  if (!existing) {
    throw new Error('Space not found.');
  }

  if (existing.ownerId !== ownerId) {
    throw new Error('You are not authorized to update this space.');
  }

  const spaceData = normalizeSpaceInput(data);
  const resubmitting = existing.listingStatus === 'rejected';
  if (resubmitting && !data.documentFile) {
    throw new Error('A replacement ownership document is required before resubmission.');
  }

  const document = data.documentFile
    ? await ownershipDocumentService.replaceForListing(
        spaceId,
        data.documentFile,
        existing.ownershipDocumentPath
      )
    : null;

  try {
    await prisma.$transaction(async tx => {
      await tx.space.update({
        where: { id: spaceId },
        data: {
          ...spaceData,
          ...(document
            ? {
                ownershipDocumentType: data.ownership_document_type || document.mimeType,
                ownershipDocumentPath: document.path,
                ownershipDocumentName: document.name,
                ownershipDocumentSize: document.size,
                ownershipDocumentMimeType: document.mimeType
              }
            : {}),
          ...(resubmitting
            ? {
                active: false,
                listingStatus: 'pending',
                submittedAt: new Date(),
                reviewedAt: null,
                reviewedBy: null,
                rejectionReason: null
              }
            : {})
        }
      });

      await writeAudit(
        tx,
        ownerId,
        'update_space',
        spaceId,
        { updatedFields: Object.keys(data).filter(key => key !== 'documentFile') }
      );
    });
    if (document && document.previousPath) {
      try {
        await ownershipDocumentService.remove(document.previousPath);
      } catch (cleanupError) {
        console.error('BORO Storage cleanup failed after listing replacement:', cleanupError.message);
      }
    }
  } catch (error) {
    if (document) {
      try {
        await ownershipDocumentService.remove(document.path);
      } catch (cleanupError) {
        console.error('BORO Storage cleanup failed after listing update error:', cleanupError.message);
      }
    }
    throw error;
  }
};

exports.getDocumentAccess = async (spaceId, requester) => {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: {
      ownerId: true,
      ownershipDocumentPath: true
    }
  });

  if (!space || !ownershipDocumentService.isAuthorized(requester, space.ownerId)) {
    throw new Error('You are not authorized to access this document.');
  }

  return ownershipDocumentService.getSignedUrl(space.ownershipDocumentPath);
};

// GET /admin/listings
exports.getListings = async (status) => {
  const allowedStatuses = ['pending', 'approved', 'rejected'];
  const where = status && allowedStatuses.includes(status)
    ? { listingStatus: status }
    : {};
  const records = await prisma.space.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      }
    },
    orderBy: { submittedAt: 'asc' }
  });

  return records.map(record => ({
    ...normalizeSpace(record),
    owner: record.owner
  }));
};

exports.getPendingListings = async () => exports.getListings('pending');

exports.getListingById = async (spaceId) => {
  const record = await prisma.space.findUnique({
    where: { id: spaceId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      }
    }
  });

  if (!record) return null;

  return {
    ...normalizeSpace(record),
    owner: record.owner
  };
};

// POST /admin/listings/:id/approve
exports.approveListing = async (spaceId, adminId) => {
  const reviewer = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true }
  });
  if (!reviewer || reviewer.role !== 'admin') {
    throw new Error('Only an admin can review listings.');
  }

  await prisma.$transaction(async tx => {
    const existing = await tx.space.findUnique({
      where: { id: spaceId },
      select: {
        id: true,
        listingStatus: true,
        name: true,
        ownershipDocumentPath: true
      }
    });

    if (!existing) throw new Error('Listing not found.');
    if (existing.listingStatus !== 'pending') {
      throw new Error('Only pending listings can be approved.');
    }
    if (!existing.ownershipDocumentPath) {
      throw new Error('An ownership document is required before approval.');
    }

    await tx.space.update({
      where: { id: spaceId },
      data: {
        listingStatus: 'approved',
        active: true,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: null
      }
    });

    await writeAudit(tx, adminId, 'approve_listing', spaceId, {
      listingName: existing.name,
      listingStatus: 'approved'
    });
  });
};

// POST /admin/listings/:id/reject
exports.rejectListing = async (spaceId, adminId, reason) => {
  const reviewer = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true }
  });
  if (!reviewer || reviewer.role !== 'admin') {
    throw new Error('Only an admin can review listings.');
  }

  const normalizedReason = String(reason || '').trim();
  if (normalizedReason.length < 10) {
    throw new Error('A meaningful rejection reason is required.');
  }

  await prisma.$transaction(async tx => {
    const existing = await tx.space.findUnique({
      where: { id: spaceId },
      select: { id: true, listingStatus: true, name: true }
    });

    if (!existing) throw new Error('Listing not found.');
    if (existing.listingStatus !== 'pending') {
      throw new Error('Only pending listings can be rejected.');
    }

    await tx.space.update({
      where: { id: spaceId },
      data: {
        listingStatus: 'rejected',
        active: false,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: normalizedReason
      }
    });

    await writeAudit(tx, adminId, 'reject_listing', spaceId, {
      reason: normalizedReason,
      listingName: existing.name,
      listingStatus: 'rejected'
    });
  });
};

// POST /bookings/:id/rate
exports.addRating = async (
  spaceId,
  bookingId,
  userId,
  rating,
  review
) => {
  rating = Number(rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      spaceId: true,
      status: true
    }
  });

  if (!booking) {
    throw new Error('Booking not found.');
  }

  if (booking.userId !== userId || booking.spaceId !== spaceId) {
    throw new Error('Invalid booking.');
  }

  if (!['returned', 'closed'].includes(booking.status)) {
    throw new Error('Booking must be completed before rating.');
  }

  await prisma.rating.create({
    data: {
      id: crypto.randomUUID(),
      spaceId,
      bookingId,
      userId,
      rating,
      review: review || null
    }
  });
};