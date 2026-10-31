const prisma = require('../lib/prisma');
const crypto = require('crypto');

// Record a platform action.
exports.log = async (actor, action, target, reason = null, details = {}) => {
  await prisma.auditLog.create({
    data: {
      id: `AUD-${crypto.randomBytes(16).toString('hex')}`,
      actor,
      action,
      target,
      reason: reason || null,
      details: details || {}
    }
  });
};

// GET /admin/audit-log
exports.getEntries = async (filters = {}, page = 1, limit = 10) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Number(limit) || 10);

  const where = {};

  if (filters.action) {
    where.action = {
      contains: filters.action,
      mode: 'insensitive'
    };
  }

  if (filters.actor) {
    where.actor = {
      contains: filters.actor,
      mode: 'insensitive'
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};

    if (filters.dateFrom) {
      where.createdAt.gte = new Date(filters.dateFrom);
    }

    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  if (filters.search) {
    where.OR = [
      { actor: { contains: filters.search, mode: 'insensitive' } },
      { action: { contains: filters.search, mode: 'insensitive' } },
      { target: { contains: filters.search, mode: 'insensitive' } },
      { reason: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  const records = await prisma.auditLog.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    },
    skip: (page - 1) * limit,
    take: limit
  });

  return records.map(entry => ({
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    reason: entry.reason,
    details: entry.details,
    created_at: entry.createdAt
  }));
};