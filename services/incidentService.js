const prisma = require('../lib/prisma');
const crypto = require('crypto');

// POST /owner/today/:id/flag
exports.createFromReturn = async (bookingId, data = {}) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      space: {
        select: {
          id: true,
          ownerId: true
        }
      }
    }
  });

  if (!booking) {
    throw new Error('Booking not found.');
  }

  const id = `INC-${crypto.randomUUID()}`;

  const depositHeld = Number(booking.depositAmount);
  const deductions = Array.isArray(data.deductions)
    ? data.deductions
    : [];

  const deductionTotal = deductions.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const refundAmount = Math.max(0, depositHeld - deductionTotal);

  await prisma.$transaction(async tx => {
    await tx.incident.create({
      data: {
        id,
        bookingId,
        spaceId: booking.spaceId,
        userId: booking.userId,
        ownerId: booking.space.ownerId,
        reason: data.reason || data.description || 'Damage reported during return inspection.',
        severity: data.severity || 'moderate',
        status: 'pending',
        depositHeld,
        deductionTotal,
        refundAmount,
        deductions,
        photos: Array.isArray(data.photos) ? data.photos : [],
        notes: data.notes || null
      }
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'damaged',
        depositStatus: 'held'
      }
    });

    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomUUID()}`,
        actor: booking.space.ownerId,
        action: 'incident_created',
        target: `incident:${id}`,
        reason: data.reason || data.description || 'Damage reported during return inspection.',
        details: { bookingId }
      }
    });
  });

  return { id };
};

// POST /owner/incidents/:id/confirm
exports.confirm = async (incidentId, deductions = [], reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Confirmation reason is required.');
  }

  await prisma.$transaction(async tx => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident) {
      throw new Error('Incident not found.');
    }

    if (incident.status !== 'pending') {
      throw new Error('Incident has already been processed.');
    }

    const deductionList = Array.isArray(deductions)
      ? deductions
      : incident.deductions;

    const deductionTotal = deductionList.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    if (deductionTotal > Number(incident.depositHeld)) {
      throw new Error('Deductions cannot exceed the held deposit.');
    }

    const refundAmount = Number(incident.depositHeld) - deductionTotal;

    const settings = await tx.setting.findUnique({
      where: { id: 1 }
    });

    const penalty = settings?.pointsDamage ?? -30;

    const user = await tx.user.findUnique({
      where: { id: incident.userId },
      select: { score: true }
    });

    if (!user) {
      throw new Error('User not found.');
    }

    const minScore = settings?.pointsMin ?? 0;
    const maxScore = settings?.pointsMax ?? 120;

    const newScore = Math.max(
      minScore,
      Math.min(maxScore, user.score + penalty)
    );

    const actualDelta = newScore - user.score;

    await tx.incident.update({
      where: { id: incidentId },
      data: {
        status: 'confirmed',
        deductions: deductionList,
        deductionTotal,
        refundAmount,
        notes: reason.trim()
      }
    });

    if (actualDelta !== 0) {
      await tx.user.update({
        where: { id: incident.userId },
        data: { score: newScore }
      });

      await tx.scoreEvent.create({
        data: {
          id: `SCR-${crypto.randomUUID()}`,
          userId: incident.userId,
          bookingId: incident.bookingId,
          delta: actualDelta,
          action: 'damage',
          reason: `Confirmed facility damage: ${reason.trim()}`
        }
      });
    }

    await tx.booking.update({
      where: { id: incident.bookingId },
      data: {
        depositStatus: refundAmount > 0 ? 'refunded' : 'deducted'
      }
    });

    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomUUID()}`,
        actor: incident.ownerId,
        action: 'incident_confirmed',
        target: `incident:${incidentId}`,
        reason: reason.trim(),
        details: {
          deductionTotal,
          refundAmount,
          scoreChange: actualDelta
        }
      }
    });
  });
};

// POST /owner/incidents/:id/waive
exports.waive = async (incidentId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Waiver reason is required.');
  }

  await prisma.$transaction(async tx => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident) {
      throw new Error('Incident not found.');
    }

    if (incident.status !== 'pending') {
      throw new Error('Incident has already been processed.');
    }

    await tx.incident.update({
      where: { id: incidentId },
      data: {
        status: 'waived',
        deductionTotal: 0,
        refundAmount: incident.depositHeld,
        notes: reason.trim()
      }
    });

    await tx.booking.update({
      where: { id: incident.bookingId },
      data: {
        depositStatus: 'refunded'
      }
    });

    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomUUID()}`,
        actor: incident.ownerId,
        action: 'incident_waived',
        target: `incident:${incidentId}`,
        reason: reason.trim(),
        details: {
          refundAmount: Number(incident.depositHeld)
        }
      }
    });
  });
};