const prisma = require('../lib/prisma');
const crypto = require('crypto');

exports.report = async (bookingId, actorId, actorRole, data = {}) => {
  const reason = String(data.reason || data.description || '').trim();
  if (!reason) throw new Error('Incident reason is required.');
  if (!['user', 'owner'].includes(actorRole)) {
    throw new Error('Incident reporter is unauthorized.');
  }

  return prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });
    if (!booking) throw new Error('Booking not found.');

    const authorized = actorRole === 'owner'
      ? booking.space.ownerId === actorId
      : booking.userId === actorId;
    if (!authorized) throw new Error('Booking not found or unauthorized.');
    if (!['approved', 'checked_in', 'overdue', 'returned', 'closed', 'damaged'].includes(booking.status)) {
      throw new Error('This booking cannot receive an incident report.');
    }

    const existing = await tx.incident.findFirst({
      where: { bookingId, status: 'pending' }
    });
    if (existing) throw new Error('An incident report is already pending for this booking.');

    const id = `INC-${crypto.randomBytes(16).toString('hex')}`;
    await tx.incident.create({
      data: {
        id,
        bookingId,
        spaceId: booking.spaceId,
        userId: booking.userId,
        ownerId: booking.space.ownerId,
        reason,
        severity: data.severity || 'moderate',
        status: 'pending',
        depositHeld: Number(booking.depositAmount),
        deductions: Array.isArray(data.deductions) ? data.deductions : [],
        photos: Array.isArray(data.photos) ? data.photos : [],
        notes: data.notes || null
      }
    });
    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomBytes(16).toString('hex')}`,
        actor: actorId,
        action: 'incident_reported',
        target: `incident:${id}`,
        reason,
        details: { bookingId, actorRole }
      }
    });
    await tx.notification.create({
      data: {
        id: `NTF-${crypto.randomBytes(16).toString('hex')}`,
        userId: actorRole === 'owner' ? booking.userId : booking.space.ownerId,
        type: 'incident_reported',
        title: 'Incident reported',
        message: reason,
        actionUrl: actorRole === 'owner' ? '/history' : '/owner/incidents',
        actions: []
      }
    });
    return { id };
  }, { isolationLevel: 'Serializable' });
};

// GET /owner/incidents
exports.getOwnerIncidents = async ownerId => {
  const incidents = await prisma.incident.findMany({
    where: { ownerId },
    include: {
      booking: true,
      user: {
        select: {
          id: true,
          name: true,
          initials: true,
          score: true
        }
      },
      space: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return incidents.map(incident => ({
    ...incident,
    booking_id: incident.bookingId,
    space_name: incident.space?.name || 'Community Space',
    user_name: incident.user?.name || 'Resident',
    created_at: incident.createdAt,
    description: incident.reason,
    deposit_held: Number(incident.depositHeld),
    deduction_total: Number(incident.deductionTotal),
    refund_amount: Number(incident.refundAmount),
    resolution_notes: incident.notes,
    status: incident.status === 'pending' ? 'open' : (
      ['confirmed', 'waived'].includes(incident.status)
        ? 'resolved'
        : incident.status
    )
  }));
};

// POST /owner/today/:id/flag
exports.createFromReturn = async (bookingId, ownerId, data = {}) => {
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

  if (!booking || booking.space.ownerId !== ownerId) {
    throw new Error('Booking not found.');
  }
  if (!['checked_in', 'overdue', 'returned', 'damaged'].includes(booking.status)) {
    throw new Error('This booking cannot receive a return incident.');
  }

  const id = `INC-${crypto.randomBytes(16).toString('hex')}`;

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
    const existing = await tx.incident.findFirst({
      where: { bookingId, status: 'pending' }
    });
    if (existing) {
      throw new Error('An incident report is already pending for this booking.');
    }

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
        id: `AUD-${crypto.randomBytes(16).toString('hex')}`,
        actor: booking.space.ownerId,
        action: 'incident_created',
        target: `incident:${id}`,
        reason: data.reason || data.description || 'Damage reported during return inspection.',
        details: { bookingId }
      }
    });
    await tx.notification.create({
      data: {
        id: `NTF-${crypto.randomBytes(16).toString('hex')}`,
        userId: booking.userId,
        type: 'incident_reported',
        title: 'Incident reported',
        message: data.reason || data.description || 'Damage reported during return inspection.',
        actionUrl: `/bookings/${bookingId}/receipt`,
        actions: []
      }
    });
  }, { isolationLevel: 'Serializable' });

  return { id };
};

// POST /owner/incidents/:id/confirm
exports.confirm = async (incidentId, ownerId, deductions = [], reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Confirmation reason is required.');
  }

  await prisma.$transaction(async tx => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident || incident.ownerId !== ownerId) {
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
          id: `SCR-${crypto.randomBytes(16).toString('hex')}`,
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

    await tx.notification.create({
      data: {
        id: `NTF-${crypto.randomBytes(16).toString('hex')}`,
        userId: incident.userId,
        type: 'incident_confirmed',
        title: 'Incident confirmed',
        message: reason.trim(),
        actionUrl: `/bookings/${incident.bookingId}/receipt`,
        actions: []
      }
    });

    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomBytes(16).toString('hex')}`,
        actor: ownerId,
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
exports.waive = async (incidentId, ownerId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Waiver reason is required.');
  }

  await prisma.$transaction(async tx => {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident || incident.ownerId !== ownerId) {
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

    await tx.notification.create({
      data: {
        id: `NTF-${crypto.randomBytes(16).toString('hex')}`,
        userId: incident.userId,
        type: 'incident_waived',
        title: 'Incident waived',
        message: reason.trim(),
        actionUrl: `/bookings/${incident.bookingId}/receipt`,
        actions: []
      }
    });

    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomBytes(16).toString('hex')}`,
        actor: ownerId,
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