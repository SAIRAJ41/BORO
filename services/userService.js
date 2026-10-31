
/**
 * BORO — User Service
 * PostgreSQL access through Prisma
 */

const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const helpers = require('../lib/helpers');

const DEMO_USERS = {
  user: 'USR-001',
  owner: 'USR-003',
  admin: 'USR-099'
};

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(16).toString('hex')}`;
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
    joined_at: user.joinedAt,
    created_at: user.createdAt
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

  if (!user || user.status !== 'active') return null;

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
  organisation
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
          documentType: 'Pending submission',
          isVerified: false,
          appliedAt: new Date()
        }
      });
    }

    return newUser;
  });

  return { id: user.id };
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
  const activeStatuses = ['requested', 'approved', 'checked_in', 'overdue'];

  return {
    user: {
      ...formatUser(user),
      verified: Boolean(verification && verification.isVerified),
      active_bookings_count: user.bookings.filter(booking =>
        activeStatuses.includes(booking.status)
      ).length
    },
    scoreEvents: user.scoreEvents.map(event => ({
      id: event.id,
      delta: event.delta,
      reason: event.reason,
      created_at: event.createdAt
    })),
    totalBookingsCount: user.bookings.length,

    verificationStatus: verification
      ? {
          is_verified: verification.isVerified,
          document_type: verification.documentType,
          document_url: verification.documentUrl,
          organisation: verification.organisation,
          applied_at: verification.appliedAt,
          verified_at: verification.verifiedAt
        }
      : null,

    payoutMethod: user.payoutMethod
      ? {
          type: user.payoutMethod.type,
          masked_details: user.payoutMethod.maskedDetails,
          ifsc_code: user.payoutMethod.ifscCode,
          upi_id: user.payoutMethod.upiId
        }
      : null
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
exports.updatePayoutMethod = async (ownerId, data) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId }
  });

  if (!owner || owner.role !== 'owner') {
    throw new Error('Owner account not found.');
  }

  const payoutData = {
    type: data.type,
    maskedDetails: data.masked_details || data.maskedDetails || '',
    accountNumberEnc: data.account_number_enc || data.accountNumberEnc || null,
    ifscCode: data.ifsc_code || data.ifscCode || null,
    upiId: data.upi_id || data.upiId || null
  };

  await prisma.payoutMethod.upsert({
    where: { ownerId },
    create: {
      ownerId,
      ...payoutData
    },
    update: payoutData
  });
};

/**
 * Get all users with optional search and pagination.
 */
exports.getAllUsers = async (query, page = 1, limit = 10) => {
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
      orderBy: { joinedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),

    prisma.user.count({ where })
  ]);

  return {
    users: users.map(formatUser),
    total,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get owners awaiting verification.
 */
exports.getPendingOwners = async () => {
  const verifications = await prisma.ownerVerification.findMany({
    where: {
      isVerified: false,
      user: {
        role: 'owner',
        status: { not: 'rejected' }
      }
    },
    include: {
      user: true
    },
    orderBy: {
      appliedAt: 'asc'
    }
  });

  return Promise.all(
    verifications.map(async (verification) => {
      const spacesProposed = await prisma.space.count({
        where: { ownerId: verification.userId }
      });

      return {
        id: verification.user.id,
        name: verification.user.name,
        email: verification.user.email,
        phone: verification.user.phone,
        organisation: verification.organisation,
        spaces_proposed: spacesProposed,
        applied_at: verification.appliedAt,
        documents: verification.documentUrl
          ? [verification.documentUrl]
          : [],
        document_type: verification.documentType
      };
    })
  );
};

/**
 * Approve an owner.
 */
exports.approveOwner = async (ownerId, reason) => {
  await prisma.$transaction(async (tx) => {
    const verification = await tx.ownerVerification.findFirst({
      where: {
        userId: ownerId,
        isVerified: false
      }
    });

    if (!verification) {
      throw new Error('Pending owner verification not found.');
    }

    await tx.ownerVerification.update({
      where: { id: verification.id },
      data: {
        isVerified: true,
        verifiedAt: new Date()
      }
    });

    await tx.user.update({
      where: { id: ownerId },
      data: { status: 'active' }
    });

    await tx.auditLog.create({
      data: {
        actor: 'admin',
        action: 'OWNER_APPROVED',
        target: ownerId,
        reason: reason || null
      }
    });
  });
};

/**
 * Reject an owner application.
 */
exports.rejectOwner = async (ownerId, reason) => {
  await prisma.$transaction(async (tx) => {
    const verification = await tx.ownerVerification.findFirst({
      where: {
        userId: ownerId,
        isVerified: false
      }
    });

    if (!verification) {
      throw new Error('Pending owner verification not found.');
    }

    await tx.user.update({
      where: { id: ownerId },
      data: { status: 'rejected' }
    });

    await tx.auditLog.create({
      data: {
        actor: 'admin',
        action: 'OWNER_REJECTED',
        target: ownerId,
        reason: reason || null
      }
    });
  });
};

/**
 * Suspend a user.
 */
exports.suspend = async (userId, reason) => {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: 'suspended' }
    });

    await tx.auditLog.create({
      data: {
        actor: 'admin',
        action: 'USER_SUSPENDED',
        target: userId,
        reason: reason || null
      }
    });
  });
};

/**
 * Unsuspend a user.
 */
exports.unsuspend = async (userId, reason) => {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: 'active' }
    });

    await tx.auditLog.create({
      data: {
        actor: 'admin',
        action: 'USER_UNSUSPENDED',
        target: userId,
        reason: reason || null
      }
    });
  });
};

/**
 * Get admin dashboard counts.
 */
exports.getAdminCounts = async () => {
  const [
    totalUsers,
    totalOwners,
    pendingOwners,
    totalSpaces,
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
          status: { not: 'rejected' }
        }
      }
    }),

    prisma.space.count(),

    // Active booking lifecycle statuses
    prisma.booking.count({
      where: {
        status: {
          in: ['requested', 'approved', 'overdue', 'damaged']
        }
      }
    }),

    // Returned and closed bookings are completed
    prisma.booking.count({
      where: {
        status: {
          in: ['returned', 'closed']
        }
      }
    }),

    prisma.dispute.count({
      where: { status: 'open' }
    }),

    prisma.incident.count({
      where: {
        status: {
          in: ['open', 'under_review']
        }
      }
    })
  ]);

  return {
    total_users: totalUsers,
    total_owners: totalOwners,
    pending_owners: pendingOwners,
    total_spaces: totalSpaces,
    active_bookings: activeBookings,
    completed_bookings: completedBookings,
    open_disputes: openDisputes,
    active_incidents: activeIncidents
  };
};
