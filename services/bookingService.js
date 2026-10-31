
const prisma = require('../lib/prisma');
const crypto = require('crypto');

const ACTIVE_STATUSES = ['requested', 'approved', 'checked_in', 'overdue'];
const COMPLETED_STATUSES = ['returned', 'closed'];

const makeId = prefix =>
  `${prefix}-${crypto.randomBytes(16).toString('hex')}`;

const toNumber = value => Number(value || 0);

function startOfWeek(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function addHours(value, hours) {
  const date = new Date(value);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date;
}

function timeDifferenceHours(start, end) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
}

function sameTime(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}

function normalizeBooking(booking) {
  if (!booking) return null;

  const showPin = ['approved', 'checked_in'].includes(booking.status);

  return {
    ...booking,
    slot_date: booking.slotDate,
    start_time: booking.startTime,
    end_time: booking.endTime,
    duration_hours: booking.durationHours,
    hourly_rate: toNumber(booking.hourlyRate),
    hourly_fee: toNumber(booking.hourlyFee),
    deposit_amount: toNumber(booking.depositAmount),
    total_amount: toNumber(booking.totalAmount),
    total_paid: toNumber(booking.totalPaid),
    platform_fee: toNumber(booking.platformFee),
    net_payout: toNumber(booking.netPayout),
    deposit_status: booking.depositStatus,
    payment_status: booking.paymentStatus,
    payment_method: booking.paymentMethod,
    pin_code: showPin ? booking.pinCode : null
  };
}

async function writeAudit(tx, actor, action, target, reason = null, details = {}) {
  await tx.auditLog.create({
    data: {
      id: makeId('AUD'),
      actor,
      action,
      target,
      reason,
      details
    }
  });
}

async function notify(tx, userId, type, title, message, actionUrl = null) {
  await tx.notification.create({
    data: {
      id: makeId('NTF'),
      userId,
      type,
      title,
      message,
      actionUrl,
      actions: []
    }
  });
}

// Booking has no slotId column. Find its availability slot
// using the fields actually present in the Prisma schema.
async function findAvailabilitySlot(tx, booking) {
  return tx.availabilitySlot.findFirst({
    where: {
      spaceId: booking.spaceId,
      slotDate: booking.slotDate,
      startTime: booking.startTime,
      endTime: booking.endTime
    }
  });
}

// Notify the first FIFO waitlist entry.
// The current Waitlist schema has no claim-expiry field or claim endpoint,
// so the two-hour claim window cannot be persisted/enforced here.
async function promoteWaitlist(tx, spaceId, slotDate, slotId = null) {
  const first = await tx.waitlist.findFirst({
    where: {
      spaceId,
      slotDate,
      ...(slotId ? { slotId } : {})
    },
    orderBy: [
      { createdAt: 'asc' },
      { position: 'asc' }
    ]
  });

  if (!first) return;

  await notify(
    tx,
    first.userId,
    'waitlist_available',
    'A space slot is available',
    'You are next in the FIFO waitlist. Please claim the available slot within 2 hours.',
    `/spaces/${spaceId}`
  );
}

// POST /bookings
exports.create = async (
  userId,
  spaceId,
  slotId,
  purpose,
  groupSize,
  paymentMethod
) => {
  return prisma.$transaction(async tx => {
    const [user, space, slot, settings] = await Promise.all([
      tx.user.findUnique({ where: { id: userId } }),
      tx.space.findUnique({ where: { id: spaceId } }),
      tx.availabilitySlot.findUnique({ where: { id: slotId } }),
      tx.setting.findUnique({ where: { id: 1 } })
    ]);

    if (!user || user.status !== 'active') {
      throw new Error('Your account is not active.');
    }

    if (!space || !space.active) {
      throw new Error('This space is unavailable.');
    }

    if (!slot || slot.spaceId !== spaceId) {
      throw new Error('Invalid availability slot.');
    }

    if (slot.isBooked || slot.status === 'booked') {
      throw new Error('This slot is already booked.');
    }

    const activeLimit = settings?.maxActiveBookingsPerUser ?? 2;

    const activeCount = await tx.booking.count({
      where: {
        userId,
        status: { in: ACTIVE_STATUSES }
      }
    });

    if (activeCount >= activeLimit) {
      throw new Error(
        `You can have a maximum of ${activeLimit} active bookings.`
      );
    }

    // Weekly limit per user, per space.
    // Default is 3, as specified by the group leader.
    const weeklyLimit =
      settings?.weeklySpaceBookingLimitPerUser ?? 3;

    const weekStart = startOfWeek(slot.slotDate);
    const weekEnd = addHours(weekStart, 168);

    const weeklyCount = await tx.booking.count({
      where: {
        userId,
        spaceId,
        slotDate: {
          gte: weekStart,
          lt: weekEnd
        },
        status: {
          notIn: ['cancelled', 'rejected']
        }
      }
    });

    if (weeklyCount >= weeklyLimit) {
      throw new Error(
        `You can book this space at most ${weeklyLimit} times per week.`
      );
    }

    const allowedPurposes = Array.isArray(space.allowedPurposes)
      ? space.allowedPurposes
      : [];

    if (!allowedPurposes.includes(purpose)) {
      throw new Error('This purpose is not allowed for this space.');
    }

    const groupCount = Number(groupSize);

    if (
      !Number.isInteger(groupCount) ||
      groupCount < 1 ||
      groupCount > space.capacity
    ) {
      throw new Error('Invalid group size for this space.');
    }

    // Strict overlap detection for the same space and date.
    const overlapping = await tx.booking.findFirst({
      where: {
        spaceId,
        slotDate: slot.slotDate,
        status: { in: ACTIVE_STATUSES },
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime }
      }
    });

    if (overlapping) {
      throw new Error('This time slot overlaps with another booking.');
    }

    const durationHours = timeDifferenceHours(
      slot.startTime,
      slot.endTime
    );

    if (durationHours <= 0) {
      throw new Error('Invalid booking duration.');
    }

    const hourlyRate = toNumber(space.pricePerHour);
    const hourlyFee = hourlyRate * durationHours;
    const depositAmount = toNumber(space.depositAmount);

    const platformFeePercent =
      toNumber(settings?.platformFeePercent ?? 8);

    const platformFee = hourlyFee * platformFeePercent / 100;
    const totalAmount = hourlyFee + depositAmount;
    const netPayout = hourlyFee - platformFee;

    const isPayAtVenue = paymentMethod === 'pay_at_venue';

    const id = makeId('BK');
    const ref = `#${id}`;

    const booking = await tx.booking.create({
      data: {
        id,
        ref,
        userId,
        spaceId,
        slotDate: slot.slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationHours,
        status: 'requested',
        purpose,
        groupSize: groupCount,
        hourlyRate,
        hourlyFee,
        depositAmount,
        depositStatus: isPayAtVenue ? 'pending' : 'held',
        totalAmount,
        totalPaid: isPayAtVenue ? 0 : totalAmount,
        platformFee,
        netPayout,
        paymentMethod,
        paymentStatus: isPayAtVenue ? 'pending' : 'paid',
        paidAt: isPayAtVenue ? null : new Date(),
        canCancel: false
      }
    });

    // Reserve the exact slot while its booking request is pending.
    await tx.availabilitySlot.update({
      where: { id: slotId },
      data: {
        isBooked: true,
        status: 'booked'
      }
    });

    await notify(
      tx,
      space.ownerId,
      'new_request',
      'New booking request',
      `${user.name} has requested ${space.name}.`,
      '/owner/requests'
    );

    await writeAudit(
      tx,
      userId,
      'create_booking',
      `booking:${id}`,
      null,
      { spaceId, slotId, paymentMethod }
    );

    return {
      id: booking.id,
      ref: booking.ref,
      status: booking.status
    };
  });
};

// POST /bookings/:id/edit
exports.edit = async (bookingId, userId, data = {}) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId }
  });

  if (!booking || booking.userId !== userId) {
    throw new Error('Booking not found.');
  }

  if (booking.status !== 'requested') {
    throw new Error('Only pending booking requests can be edited.');
  }

  const updateData = {};

  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }

  if (data.group_size !== undefined) {
    const groupSize = Number(data.group_size);

    const space = await prisma.space.findUnique({
      where: { id: booking.spaceId },
      select: { capacity: true }
    });

    if (
      !Number.isInteger(groupSize) ||
      groupSize < 1 ||
      groupSize > space.capacity
    ) {
      throw new Error('Invalid group size.');
    }

    updateData.groupSize = groupSize;
  }

  if (Object.keys(updateData).length === 0) return;

  await prisma.booking.update({
    where: { id: bookingId },
    data: updateData
  });
};

// GET /bookings/:id/receipt
exports.getBookingById = async id => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      space: true,
      user: true
    }
  });

  if (!booking) return null;

  const normalized = normalizeBooking(booking);

  // Payment information is derived from Booking because
  // the Prisma schema does not define a separate Payment model.
  const payments = [{
    payment_method: booking.paymentMethod,
    payment_status: booking.paymentStatus,
    total_paid: toNumber(booking.totalPaid),
    hourly_fee: toNumber(booking.hourlyFee),
    deposit_amount: toNumber(booking.depositAmount),
    deposit_status: booking.depositStatus,
    paid_at: booking.paidAt
  }];

  return {
    booking: normalized,
    space: booking.space,
    user: booking.user,
    payments
  };
};

// GET /my-bookings
exports.getUserBookings = async (
  userId,
  tab = 'upcoming',
  page = 1,
  limit = 10
) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Number(limit) || 10);

  if (tab === 'waitlisted') {
    const entries = await prisma.waitlist.findMany({
      where: { userId },
      include: { space: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    return entries.map(entry => ({
      id: entry.id,
      ref: entry.id,
      space: entry.space,
      slot_date: entry.slotDate,
      status: 'waitlisted',
      pin_code: null
    }));
  }

  const where = { userId };

  if (tab === 'past') {
    where.status = { in: [...COMPLETED_STATUSES, 'cancelled', 'rejected'] };
  } else {
    where.status = { in: ACTIVE_STATUSES };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { space: true },
    orderBy: [
      { slotDate: 'desc' },
      { startTime: 'desc' }
    ],
    skip: (page - 1) * limit,
    take: limit
  });

  return bookings.map(booking => ({
    ...normalizeBooking(booking),
    space: booking.space
  }));
};

// GET /history
exports.getUserHistory = async (userId, page = 1, limit = 10) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Number(limit) || 10);

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: { in: [...COMPLETED_STATUSES, 'cancelled', 'rejected'] }
    },
    include: { space: true },
    orderBy: { slotDate: 'desc' },
    skip: (page - 1) * limit,
    take: limit
  });

  return bookings.map(booking => ({
    id: booking.id,
    ref: booking.ref,
    space: booking.space,
    slot_date: booking.slotDate,
    status: booking.status,
    total_paid: toNumber(booking.totalPaid),
    deposit_status: booking.depositStatus
  }));
};

// POST /bookings/:id/cancel
exports.cancel = async (bookingId, userId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Cancellation reason is required.');
  }

  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking || booking.userId !== userId) {
      throw new Error('Booking not found.');
    }

    if (!['requested', 'approved'].includes(booking.status)) {
      throw new Error('This booking cannot be cancelled.');
    }

    const startTime = new Date(booking.startTime);
    const hoursUntilStart =
      (startTime.getTime() - Date.now()) / 3600000;

    if (hoursUntilStart < 2) {
      throw new Error(
        'Bookings cannot be cancelled within 2 hours of their start time.'
      );
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        depositStatus: 'refunded',
        paymentStatus:
          toNumber(booking.totalPaid) > 0
            ? 'refunded'
            : booking.paymentStatus,
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
        canCancel: false
      }
    });

    const slot = await findAvailabilitySlot(tx, booking);

    if (slot) {
      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: {
          isBooked: false,
          status: 'available'
        }
      });
    }

    await writeAudit(
      tx,
      userId,
      'cancel_booking',
      `booking:${bookingId}`,
      reason.trim()
    );

    await notify(
      tx,
      booking.space.ownerId,
      'booking_cancelled',
      'Booking cancelled',
      `Booking ${booking.ref} has been cancelled.`
    );

    await promoteWaitlist(
      tx,
      booking.spaceId,
      booking.slotDate,
      slot?.id
    );
  });
};

// POST /bookings/:id/extend
exports.requestExtension = async (
  bookingId,
  userId,
  additionalHours
) => {
  additionalHours = Number(additionalHours);

  if (![1, 2].includes(additionalHours)) {
    throw new Error('Extension must be 1 or 2 hours.');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { space: true }
  });

  if (!booking || booking.userId !== userId) {
    throw new Error('Booking not found.');
  }

  if (booking.status !== 'checked_in') {
    throw new Error('An extension can only be requested during a session.');
  }

  if (booking.extensionStatus === 'requested') {
    throw new Error('An extension request is already pending.');
  }

  await prisma.$transaction(async tx => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        extensionHours: additionalHours,
        extensionStatus: 'requested'
      }
    });

    await notify(
      tx,
      booking.space.ownerId,
      'extension_request',
      'Extension requested',
      `The user has requested an additional ${additionalHours} hour(s).`,
      '/owner/today'
    );
  });
};

// POST /owner/requests/:id/approve
exports.approve = async (bookingId, ownerId, reason = null) => {
  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking || booking.space.ownerId !== ownerId) {
      throw new Error('Booking not found or unauthorized.');
    }

    if (booking.status !== 'requested') {
      throw new Error('This booking request is no longer pending.');
    }

    const overlap = await tx.booking.findFirst({
      where: {
        id: { not: bookingId },
        spaceId: booking.spaceId,
        slotDate: booking.slotDate,
        status: { in: ['approved', 'checked_in', 'overdue'] },
        startTime: { lt: booking.endTime },
        endTime: { gt: booking.startTime }
      }
    });

    if (overlap) {
      throw new Error('This time slot conflicts with another booking.');
    }

    const pinCode = String(crypto.randomInt(1000, 10000));

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'approved',
        pinCode,
        decisionReason: reason?.trim() || null,
        canCancel: true,
        cancellationDeadline: addHours(
          booking.startTime,
          -2
        )
      }
    });

    await writeAudit(
      tx,
      ownerId,
      'approve_booking',
      `booking:${bookingId}`,
      reason?.trim() || null
    );

    await notify(
      tx,
      booking.userId,
      'booking_approved',
      'Booking approved',
      `Your booking for ${booking.space.name} has been approved.`,
      `/bookings/${bookingId}/receipt`
    );
  });
};

// POST /owner/requests/:id/reject
exports.reject = async (bookingId, ownerId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is required.');
  }

  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking || booking.space.ownerId !== ownerId) {
      throw new Error('Booking not found or unauthorized.');
    }

    if (booking.status !== 'requested') {
      throw new Error('This booking request is no longer pending.');
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'rejected',
        decisionReason: reason.trim(),
        depositStatus: 'refunded',
        paymentStatus:
          toNumber(booking.totalPaid) > 0
            ? 'refunded'
            : booking.paymentStatus,
        canCancel: false
      }
    });

    const slot = await findAvailabilitySlot(tx, booking);

    if (slot) {
      await tx.availabilitySlot.update({
        where: { id: slot.id },
        data: {
          isBooked: false,
          status: 'available'
        }
      });
    }

    await writeAudit(
      tx,
      ownerId,
      'reject_booking',
      `booking:${bookingId}`,
      reason.trim()
    );

    await notify(
      tx,
      booking.userId,
      'booking_rejected',
      'Booking request rejected',
      reason.trim(),
      '/my-bookings'
    );

    await promoteWaitlist(
      tx,
      booking.spaceId,
      booking.slotDate,
      slot?.id
    );
  });
};

// POST /owner/requests/:id/waitlist
exports.waitlist = async (bookingId, ownerId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Waitlist reason is required.');
  }

  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking || booking.space.ownerId !== ownerId) {
      throw new Error('Booking not found or unauthorized.');
    }

    if (booking.status !== 'requested') {
      throw new Error('This booking request is no longer pending.');
    }

    const slot = await findAvailabilitySlot(tx, booking);

    if (!slot) {
      throw new Error('Availability slot not found.');
    }

    const last = await tx.waitlist.findFirst({
      where: {
        spaceId: booking.spaceId,
        slotId: slot.id,
        slotDate: booking.slotDate
      },
      orderBy: { position: 'desc' }
    });

    await tx.waitlist.create({
      data: {
        id: makeId('WL'),
        spaceId: booking.spaceId,
        slotId: slot.id,
        slotDate: booking.slotDate,
        userId: booking.userId,
        position: (last?.position || 0) + 1
      }
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'waitlisted',
        decisionReason: reason.trim()
      }
    });

    await tx.availabilitySlot.update({
      where: { id: slot.id },
      data: {
        isBooked: false,
        status: 'available'
      }
    });

    await writeAudit(
      tx,
      ownerId,
      'waitlist_booking',
      `booking:${bookingId}`,
      reason.trim()
    );

    await notify(
      tx,
      booking.userId,
      'booking_waitlisted',
      'Booking moved to waitlist',
      reason.trim()
    );
  });
};

// POST /waitlist/:spaceId/:slotId
exports.joinWaitlist = async (userId, spaceId, slotId) => {
  return prisma.$transaction(async tx => {
    const [slot, user] = await Promise.all([
      tx.availabilitySlot.findUnique({ where: { id: slotId } }),
      tx.user.findUnique({ where: { id: userId } })
    ]);

    if (!user || user.status !== 'active') {
      throw new Error('Your account is not active.');
    }

    if (!slot || slot.spaceId !== spaceId) {
      throw new Error('Availability slot not found.');
    }

    if (!slot.isBooked && slot.status !== 'booked') {
      throw new Error('This slot is currently available for booking.');
    }

    const existing = await tx.waitlist.findFirst({
      where: {
        userId,
        spaceId,
        slotId,
        slotDate: slot.slotDate
      }
    });

    if (existing) {
      throw new Error('You are already on this waitlist.');
    }

    const last = await tx.waitlist.findFirst({
      where: {
        spaceId,
        slotId,
        slotDate: slot.slotDate
      },
      orderBy: { position: 'desc' }
    });

    const entry = await tx.waitlist.create({
      data: {
        id: makeId('WL'),
        userId,
        spaceId,
        slotId,
        slotDate: slot.slotDate,
        position: (last?.position || 0) + 1
      }
    });

    return {
      id: entry.id,
      position: entry.position
    };
  });
};

// POST /waitlist/:id/leave
exports.leaveWaitlist = async (waitlistId, userId) => {
  await prisma.$transaction(async tx => {
    const entry = await tx.waitlist.findUnique({
      where: { id: waitlistId }
    });

    if (!entry || entry.userId !== userId) {
      throw new Error('Waitlist entry not found.');
    }

    await tx.waitlist.delete({
      where: { id: waitlistId }
    });

    const remaining = await tx.waitlist.findMany({
      where: {
        spaceId: entry.spaceId,
        slotId: entry.slotId,
        slotDate: entry.slotDate
      },
      orderBy: [
        { createdAt: 'asc' },
        { position: 'asc' }
      ]
    });

    for (let index = 0; index < remaining.length; index++) {
      await tx.waitlist.update({
        where: { id: remaining[index].id },
        data: { position: index + 1 }
      });
    }
  });
};

// POST /owner/checkin/:id
// Owner authorization is enforced by the route middleware.
// The service signature follows database.md.
exports.checkin = async (
  bookingId,
  conditionData = {},
  conditionNotes = null
) => {
  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking) {
      throw new Error('Booking not found.');
    }

    if (booking.status !== 'approved') {
      throw new Error('This booking cannot be checked in.');
    }

    await tx.conditionReport.create({
      data: {
        id: makeId('CR'),
        bookingId,
        spaceId: booking.spaceId,
        type: 'checkin',
        reportedBy: booking.space.ownerId,
        checklist: conditionData,
        conditionNotes,
        photos: []
      }
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'checked_in' }
    });
  });
};

// POST /owner/return/:id
exports.return = async (
  bookingId,
  conditionData = {},
  conditionNotes = null
) => {
  return prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking) {
      throw new Error('Booking not found.');
    }

    if (!['checked_in', 'overdue'].includes(booking.status)) {
      throw new Error('This booking cannot be returned.');
    }

    const requiredChecks = [
      'cleanliness_verified',
      'sound_system_working',
      'lights_fans_functional',
      'furniture_arranged',
      'waste_disposed'
    ];

    const clean = requiredChecks.every(
      key => conditionData[key] === true || conditionData[key] === 'true'
    );

    await tx.conditionReport.create({
      data: {
        id: makeId('CR'),
        bookingId,
        spaceId: booking.spaceId,
        type: 'checkout',
        reportedBy: booking.space.ownerId,
        checklist: conditionData,
        conditionNotes,
        photos: [],
        verifiedByOwner: clean
      }
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: clean ? 'returned' : 'damaged',
        depositStatus: clean ? 'refunded' : 'held'
      }
    });

    if (clean) {
      const settings = await tx.setting.findUnique({
        where: { id: 1 }
      });

      const user = await tx.user.findUnique({
        where: { id: booking.userId },
        select: { score: true }
      });

      const bonus = settings?.pointsCleanReturn ?? 5;
      const minScore = settings?.pointsMin ?? 0;
      const maxScore = settings?.pointsMax ?? 120;

      const newScore = Math.max(
        minScore,
        Math.min(maxScore, user.score + bonus)
      );

      const actualDelta = newScore - user.score;

      if (actualDelta !== 0) {
        await tx.user.update({
          where: { id: booking.userId },
          data: { score: newScore }
        });

        await tx.scoreEvent.create({
          data: {
            id: makeId('SCR'),
            userId: booking.userId,
            bookingId,
            delta: actualDelta,
            action: 'clean_return',
            reason: 'Clean return confirmed by owner.'
          }
        });
      }
    }

    return { clean };
  });
};

// POST /owner/today/:id/no-show
exports.markNoShow = async (bookingId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('No-show reason is required.');
  }

  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking) {
      throw new Error('Booking not found.');
    }

    if (booking.status !== 'approved') {
      throw new Error('This booking cannot be marked as a no-show.');
    }

    const settings = await tx.setting.findUnique({
      where: { id: 1 }
    });

    const user = await tx.user.findUnique({
      where: { id: booking.userId },
      select: { score: true }
    });

    const penalty = settings?.pointsNoShow ?? -10;
    const minScore = settings?.pointsMin ?? 0;
    const maxScore = settings?.pointsMax ?? 120;

    const newScore = Math.max(
      minScore,
      Math.min(maxScore, user.score + penalty)
    );

    const actualDelta = newScore - user.score;

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelReason: reason.trim(),
        cancelledAt: new Date(),
        canCancel: false
      }
    });

    if (actualDelta !== 0) {
      await tx.user.update({
        where: { id: booking.userId },
        data: { score: newScore }
      });

      await tx.scoreEvent.create({
        data: {
          id: makeId('SCR'),
          userId: booking.userId,
          bookingId,
          delta: actualDelta,
          action: 'no_show',
          reason: reason.trim()
        }
      });
    }

    await writeAudit(
      tx,
      booking.space.ownerId,
      'mark_no_show',
      `booking:${bookingId}`,
      reason.trim()
    );
  });
};

// POST /owner/bookings/:id/mark-paid
exports.markPaymentReceived = async (bookingId, ownerId) => {
  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking || booking.space.ownerId !== ownerId) {
      throw new Error('Booking not found or unauthorized.');
    }

    if (booking.paymentMethod !== 'pay_at_venue') {
      throw new Error('This booking does not use pay-at-venue.');
    }

    if (booking.paymentStatus === 'paid') {
      throw new Error('Payment has already been recorded.');
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'paid',
        totalPaid: booking.totalAmount,
        paidAt: new Date(),
        depositStatus: 'held'
      }
    });

    await writeAudit(
      tx,
      ownerId,
      'mark_payment_received',
      `booking:${bookingId}`,
      'Pay-at-venue payment recorded.'
    );
  });
};

// Owner approves an extension request.
exports.approveExtension = async (bookingId, ownerId) => {
  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking || booking.space.ownerId !== ownerId) {
      throw new Error('Booking not found or unauthorized.');
    }

    if (booking.extensionStatus !== 'requested') {
      throw new Error('No extension request is pending.');
    }

    const extraHours = Number(booking.extensionHours || 0);

    if (![1, 2].includes(extraHours)) {
      throw new Error('Invalid extension duration.');
    }

    const newEndTime = addHours(booking.endTime, extraHours);

    const overlap = await tx.booking.findFirst({
      where: {
        id: { not: bookingId },
        spaceId: booking.spaceId,
        slotDate: booking.slotDate,
        status: { in: ['approved', 'checked_in', 'overdue'] },
        startTime: { lt: newEndTime },
        endTime: { gt: booking.endTime }
      }
    });

    if (overlap) {
      throw new Error('The requested extension conflicts with another booking.');
    }

    const extraFee = toNumber(booking.hourlyRate) * extraHours;
    const newHourlyFee = toNumber(booking.hourlyFee) + extraFee;

    const settings = await tx.setting.findUnique({
      where: { id: 1 }
    });

    const feePercent = toNumber(settings?.platformFeePercent ?? 8);
    const newPlatformFee = newHourlyFee * feePercent / 100;

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        endTime: newEndTime,
        durationHours: booking.durationHours + extraHours,
        hourlyFee: newHourlyFee,
        totalAmount: toNumber(booking.totalAmount) + extraFee,
        platformFee: newPlatformFee,
        netPayout: newHourlyFee - newPlatformFee,
        extensionStatus: 'approved'
      }
    });

    await notify(
      tx,
      booking.userId,
      'extension_approved',
      'Extension approved',
      `Your ${extraHours}-hour extension has been approved.`
    );
  });
};

// Owner rejects an extension request.
exports.rejectExtension = async (bookingId, ownerId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is required.');
  }

  await prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { space: true }
    });

    if (!booking || booking.space.ownerId !== ownerId) {
      throw new Error('Booking not found or unauthorized.');
    }

    if (booking.extensionStatus !== 'requested') {
      throw new Error('No extension request is pending.');
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        extensionStatus: 'rejected',
        decisionReason: reason.trim()
      }
    });

    await writeAudit(
      tx,
      ownerId,
      'reject_extension',
      `booking:${bookingId}`,
      reason.trim()
    );

    await notify(
      tx,
      booking.userId,
      'extension_rejected',
      'Extension rejected',
      reason.trim()
    );
  });
};

// GET /owner/requests
exports.getOwnerRequests = async ownerId => {
  const bookings = await prisma.booking.findMany({
    where: {
      space: { ownerId },
      status: 'requested'
    },
    include: {
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
    orderBy: { createdAt: 'asc' }
  });

  return bookings.map(booking => ({
    id: booking.id,
    user: booking.user,
    space: booking.space,
    total_amount: toNumber(booking.totalAmount),
    payment_status: booking.paymentStatus,
    payment_method: booking.paymentMethod
  }));
};

// GET /owner/calendar
exports.getOwnerCalendar = async (ownerId, week = new Date()) => {
  const firstDay = startOfWeek(week);
  const lastDay = addHours(firstDay, 168);

  const bookings = await prisma.booking.findMany({
    where: {
      space: { ownerId },
      slotDate: {
        gte: firstDay,
        lt: lastDay
      },
      status: {
        notIn: ['cancelled', 'rejected', 'waitlisted']
      }
    },
    include: {
      space: true,
      user: true
    },
    orderBy: [
      { slotDate: 'asc' },
      { startTime: 'asc' }
    ]
  });

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(date.getDate() + index);
    return date;
  });

  const bookingsByDay = {};

  for (const day of days) {
    const key = day.toISOString().slice(0, 10);

    bookingsByDay[key] = bookings
      .filter(booking =>
        new Date(booking.slotDate).toISOString().slice(0, 10) === key
      )
      .map(normalizeBooking);
  }

  return { days, bookingsByDay };
};

// GET /owner/today
exports.getOwnerToday = async ownerId => {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      space: { ownerId },
      slotDate: {
        gte: start,
        lt: end
      },
      status: {
        in: ['approved', 'checked_in', 'overdue', 'returned', 'damaged']
      }
    },
    include: {
      space: true,
      user: true
    },
    orderBy: { startTime: 'asc' }
  });

  const normalized = bookings.map(booking => ({
    ...normalizeBooking(booking),
    space: booking.space,
    user: booking.user
  }));

  return {
    checkins: normalized.filter(item => item.status === 'approved'),
    returns: normalized.filter(item =>
      ['checked_in', 'overdue'].includes(item.status)
    ),
    activeSessions: normalized.filter(item =>
      ['checked_in', 'overdue'].includes(item.status)
    )
  };
};

// GET /owner/history
exports.getOwnerHistory = async (ownerId, page = 1, limit = 10) => {
  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Number(limit) || 10);

  const bookings = await prisma.booking.findMany({
    where: {
      space: { ownerId },
      status: { in: COMPLETED_STATUSES }
    },
    include: {
      space: true,
      user: true
    },
    orderBy: { slotDate: 'desc' },
    skip: (page - 1) * limit,
    take: limit
  });

  return bookings.map(booking => ({
    id: booking.id,
    ref: booking.ref,
    space: booking.space,
    user: booking.user,
    slot_date: booking.slotDate,
    duration_hours: booking.durationHours,
    net_payout: toNumber(booking.netPayout)
  }));
};

// GET /owner/earnings
exports.getOwnerEarnings = async ownerId => {
  const bookings = await prisma.booking.findMany({
    where: {
      space: { ownerId },
      status: { in: COMPLETED_STATUSES }
    },
    include: { space: true },
    orderBy: { updatedAt: 'desc' }
  });

  const ledger = bookings.map(booking => ({
    booking_id: booking.id,
    ref: booking.ref,
    space: booking.space.name,
    date: booking.slotDate,
    gross: toNumber(booking.hourlyFee),
    platform_fee: toNumber(booking.platformFee),
    net_payout: toNumber(booking.netPayout),
    payment_status: booking.paymentStatus
  }));

  const totalEarnings = ledger.reduce(
    (total, item) => total + item.net_payout,
    0
  );

  // The current Prisma schema has no payout transaction/history model.
  // These are completed earnings not yet represented by a payout record.
  return {
    totalEarnings,
    pendingPayouts: totalEarnings,
    payoutHistory: [],
    ledger
  };
};

// GET /owner/incidents
exports.getOwnerIncidents = async ownerId => {
  return prisma.incident.findMany({
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
};
