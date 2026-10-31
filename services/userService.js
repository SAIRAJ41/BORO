
/**
 * BORO — User Service
 * PostgreSQL access through Prisma
 */

const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const helpers = require('../lib/helpers');
const ownershipDocumentService = require('./ownershipDocumentService');

const DEMO_USERS = {
  user: 'USR-001',
  owner: 'USR-003',
  admin: 'USR-099'
};

const ACTIVE_BOOKING_STATUSES = ['requested', 'approved', 'checked_in', 'overdue'];

function makeId(prefix, maxLen = 36) {
  const cleanPrefix = String(prefix || 'ID').toUpperCase();
  const hexBytes = Math.max(1, Math.floor((maxLen - 1 - cleanPrefix.length) / 2));
  return `${cleanPrefix}-${crypto.randomBytes(hexBytes).toString('hex')}`;
}

function getUserInitials(name) {
  return (name || 'User')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function getTier(score) {
  return helpers.getScoreTier(score || 100).tier;
}

function requireReason(reason) {
  const text = String(reason || '').trim();
  if (text.length < 10) {
    throw new Error('A meaningful reason is required.');
  }
  return text;
}

async function requireAdmin(adminId) {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, role: true, status: true }
  });
  if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
    throw new Error('Administrator access denied.');
  }
  return admin;
}

function formatSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    initials: user.initials || getUserInitials(user.name),
    status: user.status || 'active'
  };
}

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    score: user.score,
    tier: getTier(user.score),
    initials: user.initials || getUserInitials(user.name),
    status: user.status,
    suspended: user.status === 'suspended',
    verified: false,
    joined_at: user.joinedAt,
    created_at: user.createdAt
  };
}

function formatPayoutMethod(method) {
  if (!method) return null;
  return {
    id: method.id,
    type: method.type,
    masked_details: method.maskedDetails,
    ifsc_code: method.type === 'bank' ? method.ifscCode : null,
    updated_at: method.updatedAt
  };
}

function formatVerificationSummary(verification) {
  if (!verification) return null;
  return {
    is_verified: Boolean(verification.isVerified),
    document_available: Boolean(verification.documentUrl),
    document_type: verification.documentType,
    organisation: verification.organisation,
    applied_at: verification.appliedAt,
    verified_at: verification.verifiedAt
  };
}

/**
 * Authenticate user credentials.
 */
exports.authenticate = async (email, password) => {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) return null;

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordMatches) return null;

  return formatSessionUser(user);
};

/**
 * Create a new user.
 */
exports.create = async ({
  name,
  email,
  phone,
  password,
  role,
  organisation,
  documentFile
}) => {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!name || !normalizedEmail || !password) {
    throw new Error('Name, email and password are required.');
  }

  const normalizedRole = role === 'owner' ? 'owner' : 'user';

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    throw new Error('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const userId = `USR-${crypto.randomUUID()
    .replace(/-/g, '')
    .slice(0, 10)
    .toUpperCase()}`;

  let uploadedDocument = null;
  try {
    if (normalizedRole === 'owner' && documentFile) {
      uploadedDocument = await ownershipDocumentService.uploadForOwnerVerification(
        userId,
        documentFile
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          phone: (phone || '').trim(),
          passwordHash,
          role: normalizedRole,
          initials: getUserInitials(name),
          status: 'active'
        }
      });

      if (normalizedRole === 'owner') {
        await tx.ownerVerification.create({
          data: {
            id: makeId('VER'),
            userId: newUser.id,
            organisation: organisation || null,
            documentType: uploadedDocument ? uploadedDocument.mimeType : 'Pending submission',
            documentUrl: uploadedDocument ? uploadedDocument.path : null,
            isVerified: false,
            appliedAt: new Date()
          }
        });
      }

      return newUser;
    });

    return { id: user.id };
  } catch (error) {
    if (uploadedDocument) {
      try {
        await ownershipDocumentService.remove(uploadedDocument.path);
      } catch (cleanupError) {
        console.error('BORO Storage cleanup failed after owner registration error:', cleanupError.message);
      }
    }
    throw error;
  }
};

/**
 * Get a demo account by role.
 */
exports.getDemoUser = async (role) => {
  const userId = DEMO_USERS[role] || DEMO_USERS.user;

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error(`Demo account not found for role: ${role}`);
  }

  return formatSessionUser(user);
};

/**
 * Get user by ID.
 */
exports.getById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) return null;

  return formatUser(user);
};

/**
 * Get complete user profile.
 */
exports.getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      verifications: {
        orderBy: { appliedAt: 'desc' },
        take: 1
      },
      payoutMethod: true,
      bookings: {
        select: { status: true }
      },
      scoreEvents: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!user) return null;

  const verification = user.verifications[0] || null;

  return {
    user: {
      ...formatUser(user),
      verified: user.role === 'owner' ? Boolean(verification && verification.isVerified) : (user.status === 'active'),
      active_bookings_count: user.bookings.filter(booking =>
        ACTIVE_BOOKING_STATUSES.includes(booking.status)
      ).length
    },
    scoreEvents: user.scoreEvents.map(event => ({
      id: event.id,
      delta: event.delta,
      reason: event.reason,
      created_at: event.createdAt
    })),
    totalBookingsCount: user.bookings.length,
    verificationStatus: formatVerificationSummary(verification),
    payoutMethod: formatPayoutMethod(user.payoutMethod)
  };
};

/**
 * Update editable fields on the authenticated user's own profile.
 */
exports.updateProfile = async (userId, { name, phone }) => {
  const data = {};

  if (name !== undefined) {
    const normalizedName = String(name).trim();
    if (!normalizedName) throw new Error('Name is required.');
    data.name = normalizedName;
    data.initials = getUserInitials(normalizedName);
  }

  if (phone !== undefined) {
    data.phone = String(phone).trim();
  }

  if (Object.keys(data).length === 0) {
    throw new Error('No profile changes provided.');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data
  });

  return formatSessionUser(user);
};

/**
 * Create or update owner payout method.
 */
function normalizePayoutInput(data = {}) {
  const type = String(data.type || data.payout_type || '').trim().toLowerCase();
  const value = String(data.payout_value || '').trim();
  if (!['upi', 'bank'].includes(type)) throw new Error('Invalid payout method.');
  if (!value || value.length > 100) throw new Error('Payout details are required.');

  if (type === 'upi') {
    if (!/^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,64}$/.test(value)) {
      throw new Error('Enter a valid UPI ID.');
    }
    return {
      type,
      maskedDetails: `${value.slice(0, 2)}***@${value.split('@')[1]}`,
      accountNumberEnc: null,
      ifscCode: null,
      upiId: value
    };
  }

  const accountNumber = value.replace(/\s+/g, '');
  if (!/^\d{9,18}$/.test(accountNumber)) {
    throw new Error('Enter a valid bank account number.');
  }
  const ifscCode = String(data.ifsc_code || '').trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
    throw new Error('Enter a valid IFSC code.');
  }
  return {
    type,
    maskedDetails: `Bank account ending ${accountNumber.slice(-4)}`,
    accountNumberEnc: accountNumber,
    ifscCode,
    upiId: null
  };
}

async function requireOwnerActor(ownerId, actorId, errorMessage) {
  if (!ownerId || ownerId !== actorId) throw new Error(errorMessage);
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true, status: true }
  });
  if (!owner || owner.role !== 'owner') throw new Error('Owner account not found.');
  if (owner.status !== 'active') throw new Error('Owner account is not active.');
  return owner;
}

exports.getPayoutMethod = async (ownerId, actorId = ownerId) => {
  await requireOwnerActor(ownerId, actorId, 'Payout method access denied.');
  const method = await prisma.payoutMethod.findUnique({ where: { ownerId } });
  return formatPayoutMethod(method);
};

exports.updatePayoutMethod = async (ownerId, data, actorId = ownerId) => {
  await requireOwnerActor(ownerId, actorId, 'Payout method access denied.');

  const payoutData = normalizePayoutInput(data);
  await prisma.$transaction(async tx => {
    await tx.payoutMethod.upsert({
      where: { ownerId },
      create: { id: makeId('PAY'), ownerId, ...payoutData },
      update: payoutData
    });
    await tx.auditLog.create({
      data: {
        id: makeId('AUD'),
        actor: actorId,
        action: 'PAYOUT_METHOD_UPDATED',
        target: `user:${ownerId}`,
        details: { type: payoutData.type }
      }
    });
  });
};

exports.deletePayoutMethod = async (ownerId, actorId = ownerId) => {
  await requireOwnerActor(ownerId, actorId, 'Payout method access denied.');
  await prisma.$transaction(async tx => {
    const deleted = await tx.payoutMethod.deleteMany({ where: { ownerId } });
    if (!deleted.count) throw new Error('Payout method not found.');
    await tx.auditLog.create({
      data: {
        id: makeId('AUD'),
        actor: actorId,
        action: 'PAYOUT_METHOD_DELETED',
        target: `user:${ownerId}`
      }
    });
  });
};

/**
 * Get all users with optional search and pagination.
 */
exports.getAllUsers = async (adminId, query, page = 1, limit = 10) => {
  await requireAdmin(adminId);
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.max(1, parseInt(limit, 10) || 10);

  const search = (query || '').trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ]
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        bookings: {
          select: { status: true }
        },
        verifications: {
          orderBy: { appliedAt: 'desc' },
          take: 1,
          select: { isVerified: true }
        }
      },
      orderBy: { joinedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),

    prisma.user.count({ where })
  ]);

  return {
    users: users.map(user => ({
      ...formatUser(user),
      verified: user.role === 'owner'
        ? Boolean(user.verifications && user.verifications[0] && user.verifications[0].isVerified)
        : false,
      active_bookings_count: user.bookings.filter(booking =>
        ACTIVE_BOOKING_STATUSES.includes(booking.status)
      ).length
    })),
    total,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get owners awaiting verification.
 */
exports.getPendingOwners = async adminId => {
  await requireAdmin(adminId);
  const verifications = await prisma.ownerVerification.findMany({
    where: {
      isVerified: false,
      user: {
        role: 'owner',
        status: { not: 'rejected' }
      }
    },
    include: {
      user: {
        include: {
          _count: { select: { ownedSpaces: true } }
        }
      }
    },
    orderBy: {
      appliedAt: 'asc'
    }
  });

  return verifications.map(verification => ({
    id: verification.user.id,
    name: verification.user.name,
    email: verification.user.email,
    phone: verification.user.phone,
    organisation: verification.organisation,
    spaces_proposed: verification.user._count.ownedSpaces,
    applied_at: verification.appliedAt,
    created_at: verification.appliedAt,
    document_available: Boolean(verification.documentUrl),
    document_type: verification.documentType
  }));
};

exports.getOwnerVerificationSummary = async ownerId => {
  const verification = await prisma.ownerVerification.findFirst({
    where: { userId: ownerId },
    orderBy: { appliedAt: 'desc' }
  });
  return formatVerificationSummary(verification);
};

exports.getOwnerVerificationDocument = async (ownerId, requesterId) => {
  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { id: true, role: true, status: true }
  });
  if (!requester || requester.status !== 'active') {
    throw new Error('Verification access denied.');
  }
  if (requester.role !== 'admin' && requester.id !== ownerId) {
    throw new Error('Verification access denied.');
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { role: true }
  });
  if (!owner || owner.role !== 'owner') {
    throw new Error('Identity document is not available.');
  }

  const verification = await prisma.ownerVerification.findFirst({
    where: { userId: ownerId },
    orderBy: { appliedAt: 'desc' },
    select: { documentUrl: true }
  });
  if (!verification || !verification.documentUrl) {
    throw new Error('Identity document is not available.');
  }
  return ownershipDocumentService.getSignedUrl(verification.documentUrl);
};

exports.submitOwnerVerificationDocument = async (ownerId, file, actorId = ownerId) => {
  if (ownerId !== actorId) throw new Error('Verification access denied.');
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true, status: true }
  });
  if (!owner || owner.role !== 'owner') throw new Error('Owner account not found.');
  if (owner.status === 'rejected' || owner.status === 'suspended') {
    throw new Error('This owner account cannot submit verification documents.');
  }

  const existing = await prisma.ownerVerification.findFirst({
    where: { userId: ownerId },
    orderBy: { appliedAt: 'desc' }
  });
  if (existing && existing.isVerified) {
    throw new Error('Owner verification is already approved.');
  }

  const uploadedDocument = await ownershipDocumentService.uploadForOwnerVerification(
    ownerId,
    file
  );

  try {
    await prisma.$transaction(async tx => {
      if (existing) {
        await tx.ownerVerification.update({
          where: { id: existing.id },
          data: {
            documentType: uploadedDocument.mimeType,
            documentUrl: uploadedDocument.path,
            isVerified: false,
            appliedAt: new Date(),
            verifiedAt: null,
            verifiedBy: null
          }
        });
      } else {
        await tx.ownerVerification.create({
          data: {
            id: makeId('VER'),
            userId: ownerId,
            documentType: uploadedDocument.mimeType,
            documentUrl: uploadedDocument.path,
            isVerified: false,
            appliedAt: new Date()
          }
        });
      }

      await tx.auditLog.create({
        data: {
          id: makeId('AUD'),
          actor: actorId,
          action: 'OWNER_VERIFICATION_DOCUMENT_SUBMITTED',
          target: `user:${ownerId}`
        }
      });
    });
  } catch (error) {
    try {
      await ownershipDocumentService.remove(uploadedDocument.path);
    } catch (cleanupError) {
      console.error('BORO Storage cleanup failed after verification upload error:', cleanupError.message);
    }
    throw error;
  }

  if (existing && existing.documentUrl && existing.documentUrl !== uploadedDocument.path) {
    try {
      await ownershipDocumentService.remove(existing.documentUrl);
    } catch (cleanupError) {
      console.error('BORO Storage cleanup failed for replaced verification document:', cleanupError.message);
    }
  }
};

/**
 * Approve an owner.
 */
exports.approveOwner = async (ownerId, adminId, reason) => {
  await requireAdmin(adminId);
  const normalizedReason = reason ? requireReason(reason) : null;

  await prisma.$transaction(async (tx) => {
    const verification = await tx.ownerVerification.findFirst({
      where: {
        userId: ownerId,
        isVerified: false,
        user: { role: 'owner', status: { notIn: ['rejected', 'suspended'] } }
      }
    });

    if (!verification) {
      throw new Error('Pending owner verification not found.');
    }
    if (!verification.documentUrl) {
      throw new Error('An identity document is required before approval.');
    }

    await tx.ownerVerification.update({
      where: { id: verification.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: adminId
      }
    });

    await tx.user.update({
      where: { id: ownerId },
      data: { status: 'active' }
    });

    await tx.auditLog.create({
      data: {
        id: makeId('AUD'),
        actor: adminId,
        action: 'OWNER_APPROVED',
        target: ownerId,
        reason: normalizedReason
      }
    });

    if (tx.notification && typeof tx.notification.create === 'function') await tx.notification.create({
      data: {
        id: makeId('NTF'),
        userId: ownerId,
        type: 'owner_verified',
        title: 'Owner Verification Approved',
        message: 'Your owner identity verification has been approved. You can now list and manage community spaces.',
        actionUrl: '/owner/my-spaces'
      }
    });
  });
};

/**
 * Reject an owner application.
 */
exports.rejectOwner = async (ownerId, adminId, reason) => {
  await requireAdmin(adminId);
  const normalizedReason = requireReason(reason);

  await prisma.$transaction(async (tx) => {
    const verification = await tx.ownerVerification.findFirst({
      where: {
        userId: ownerId,
        isVerified: false,
        user: { role: 'owner', status: { not: 'rejected' } }
      }
    });

    if (!verification) {
      throw new Error('Pending owner verification not found.');
    }

    await tx.ownerVerification.update({
      where: { id: verification.id },
      data: {
        isVerified: false,
        verifiedAt: new Date(),
        verifiedBy: adminId
      }
    });

    await tx.user.update({
      where: { id: ownerId },
      data: { status: 'rejected' }
    });

    await tx.auditLog.create({
      data: {
        id: makeId('AUD'),
        actor: adminId,
        action: 'OWNER_REJECTED',
        target: ownerId,
        reason: normalizedReason
      }
    });

    if (tx.notification && typeof tx.notification.create === 'function') await tx.notification.create({
      data: {
        id: makeId('NTF'),
        userId: ownerId,
        type: 'owner_rejected',
        title: 'Owner Verification Rejected',
        message: `Your owner verification was not approved: ${normalizedReason}`,
        actionUrl: '/owner/my-spaces'
      }
    });
  });
};

/**
 * Suspend a user.
 */
exports.suspend = async (userId, adminId, reason) => {
  await requireAdmin(adminId);
  if (userId === adminId) throw new Error('Administrators cannot suspend themselves.');
  const normalizedReason = requireReason(reason);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'admin') throw new Error('User cannot be suspended.');
    if (user.status === 'suspended') throw new Error('User is already suspended.');
    if (user.status !== 'active') throw new Error('Only active users can be suspended.');

    await tx.user.update({
      where: { id: userId },
      data: { status: 'suspended' }
    });

    await tx.auditLog.create({
      data: {
        id: makeId('AUD'),
        actor: adminId,
        action: 'USER_SUSPENDED',
        target: userId,
        reason: normalizedReason
      }
    });

    if (tx.notification && typeof tx.notification.create === 'function') await tx.notification.create({
      data: {
        id: makeId('NTF'),
        userId,
        type: 'account_suspended',
        title: 'Account Suspended',
        message: `Your account has been suspended: ${normalizedReason}`,
        actionUrl: '/profile'
      }
    });
  });
};

/**
 * Unsuspend a user.
 */
exports.unsuspend = async (userId, adminId, reason) => {
  await requireAdmin(adminId);
  const normalizedReason = requireReason(reason);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.role === 'admin') throw new Error('User cannot be reactivated.');
    if (user.status !== 'suspended') throw new Error('User is not suspended.');

    await tx.user.update({
      where: { id: userId },
      data: { status: 'active' }
    });

    await tx.auditLog.create({
      data: {
        id: makeId('AUD'),
        actor: adminId,
        action: 'USER_UNSUSPENDED',
        target: userId,
        reason: normalizedReason
      }
    });

    if (tx.notification && typeof tx.notification.create === 'function') await tx.notification.create({
      data: {
        id: makeId('NTF'),
        userId,
        type: 'account_reactivated',
        title: 'Account Reactivated',
        message: 'Your account has been reactivated.',
        actionUrl: '/profile'
      }
    });
  });
};

/**
 * Get admin dashboard counts.
 */
exports.getAdminCounts = async adminId => {
  await requireAdmin(adminId);
  const [
    totalUsers,
    totalOwners,
    pendingOwners,
    totalSpaces,
    totalVolume,
    totalIncidents,
    activeBookings,
    completedBookings,
    openDisputes,
    activeIncidents
  ] = await Promise.all([
    prisma.user.count(),

    prisma.user.count({
      where: { role: 'owner' }
    }),

    prisma.ownerVerification.count({
      where: {
        isVerified: false,
        user: {
          role: 'owner',
          status: { not: 'rejected' }
        }
      }
    }),

    prisma.space.count({
      where: { active: true, listingStatus: 'approved' }
    }),

    prisma.booking.aggregate({
      _sum: { totalAmount: true }
    }),

    prisma.incident.count(),

    prisma.booking.count({
      where: {
        status: {
          in: ACTIVE_BOOKING_STATUSES
        }
      }
    }),

    prisma.booking.count({
      where: {
        status: {
          in: ['returned', 'closed']
        }
      }
    }),

    prisma.dispute.count({
      where: {
        status: {
          in: ['pending', 'open', 'under_review']
        }
      }
    }),

    prisma.incident.count({
      where: {
        status: {
          in: ['pending', 'open', 'under_review']
        }
      }
    })
  ]);

  const volume = Number((totalVolume && totalVolume._sum && totalVolume._sum.totalAmount) || 0);

  return {
    total_users: totalUsers || 0,
    total_owners: totalOwners || 0,
    pending_owners: pendingOwners || 0,
    pending_verifications: pendingOwners || 0,
    total_spaces: totalSpaces || 0,
    active_bookings: activeBookings || 0,
    completed_bookings: completedBookings || 0,
    open_disputes: openDisputes || 0,
    active_incidents: activeIncidents || 0,
    total_volume: Number.isFinite(volume) ? volume : 0,
    total_incidents: totalIncidents || 0
  };
};
