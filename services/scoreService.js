const prisma = require('../lib/prisma');
const crypto = require('crypto');

function getTier(score) {
  if (score >= 80) return 1;
  if (score >= 50) return 2;
  return 3;
}

// GET /my-score
exports.getUserScore = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { score: true }
  });

  if (!user) {
    throw new Error('User not found.');
  }

  return {
    score: user.score,
    tier: getTier(user.score)
  };
};

// GET /my-score
exports.getScoreAuditTrail = async (userId) => {
  const events = await prisma.scoreEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return events.map(event => ({
    id: event.id,
    delta: event.delta,
    reason: event.reason,
    created_at: event.createdAt
  }));
};

// POST /disputes
exports.fileDispute = async (userId, auditEntryId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Dispute reason is required.');
  }

  const event = await prisma.scoreEvent.findFirst({
    where: {
      id: auditEntryId,
      userId
    }
  });

  if (!event) {
    throw new Error('Score entry not found.');
  }

  const existing = await prisma.dispute.findFirst({
    where: {
      userId,
      scoreEventId: auditEntryId,
      status: { in: ['open', 'under_review'] }
    }
  });

  if (existing) {
    throw new Error('A dispute already exists for this score entry.');
  }

  const id = `DISP-${crypto.randomUUID()}`;

  await prisma.dispute.create({
    data: {
      id,
      userId,
      scoreEventId: event.id,
      bookingId: event.bookingId,
      reason: reason.trim(),
      status: 'open'
    }
  });

  return { id };
};

// GET /admin/disputes
exports.getDisputes = async () => {
  const disputes = await prisma.dispute.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return disputes.map(dispute => ({
    id: dispute.id,
    user: dispute.user,
    reason: dispute.reason,
    status: dispute.status,
    created_at: dispute.createdAt
  }));
};

// POST /admin/disputes/:id/resolve
exports.resolveDispute = async (disputeId, decision, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Resolution reason is required.');
  }

  if (!['accept', 'dismiss'].includes(decision)) {
    throw new Error('Invalid dispute decision.');
  }

  await prisma.$transaction(async tx => {
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
      include: {
        scoreEvent: true,
        user: true
      }
    });

    if (!dispute) {
      throw new Error('Dispute not found.');
    }

    if (!['open', 'under_review'].includes(dispute.status)) {
      throw new Error('This dispute has already been resolved.');
    }

    // Accepting a dispute reverses the disputed score change.
    if (decision === 'accept' && dispute.scoreEvent) {
      const settings = await tx.setting.findUnique({
        where: { id: 1 }
      });

      const minScore = settings?.pointsMin ?? 0;
      const maxScore = settings?.pointsMax ?? 120;

      const newScore = Math.max(
        minScore,
        Math.min(
          maxScore,
          dispute.user.score - dispute.scoreEvent.delta
        )
      );

      const actualDelta = newScore - dispute.user.score;

      if (actualDelta !== 0) {
        await tx.user.update({
          where: { id: dispute.userId },
          data: { score: newScore }
        });

        await tx.scoreEvent.create({
          data: {
            id: `SCR-${crypto.randomUUID()}`,
            userId: dispute.userId,
            bookingId: dispute.bookingId,
            delta: actualDelta,
            action: 'dispute_resolution',
            reason: `Dispute accepted: ${reason.trim()}`
          }
        });
      }
    }

    await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: decision === 'accept' ? 'resolved' : 'rejected',
        resolutionNotes: reason.trim(),
        resolvedAt: new Date()
      }
    });
  });
};