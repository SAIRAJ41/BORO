
import "dotenv/config";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const require = createRequire(resolve(process.cwd(), "package.json"));
const mock = require("./data/mock.js") as any;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const toDate = (value: any, fallback = new Date()) =>
  value ? new Date(value) : fallback;

const toJson = (value: any) => value ?? [];

const getDateOnly = (value: any) => {
  const date = toDate(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

async function main() {
  console.log("Starting BORO database seed...");

  const passwordHash = await bcrypt.hash("demo123", 10);

  // 1. Users
  for (const user of mock.users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        name: user.name,
        email: user.email,
        passwordHash,
        phone: user.phone || "Not provided",
        role: user.role,
        score: user.score ?? 100,
        initials: user.initials || user.name.slice(0, 2).toUpperCase(),
        status: user.status || "active",
        joinedAt: toDate(user.joined_at),
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash,
        phone: user.phone || "Not provided",
        role: user.role,
        score: user.score ?? 100,
        initials: user.initials || user.name.slice(0, 2).toUpperCase(),
        status: user.status || "active",
        joinedAt: toDate(user.joined_at),
      },
    });
  }

  // 2. Owner verifications
  for (const user of mock.users) {
    const verification = user.verificationStatus;

    if (user.role !== "owner" || !verification) continue;

    const verificationId = `OV-${user.id}`;

    await prisma.ownerVerification.upsert({
      where: { id: verificationId },
      update: {
        documentType: verification.document_type || "Demo document",
        isVerified: Boolean(verification.is_verified),
        appliedAt: toDate(
          verification.applied_at,
          toDate(user.joined_at)
        ),
        verifiedAt: verification.verified_at
          ? toDate(verification.verified_at)
          : null,
        verifiedBy: verification.is_verified ? "USR-099" : null,
      },
      create: {
        id: verificationId,
        userId: user.id,
        documentType: verification.document_type || "Demo document",
        isVerified: Boolean(verification.is_verified),
        appliedAt: toDate(
          verification.applied_at,
          toDate(user.joined_at)
        ),
        verifiedAt: verification.verified_at
          ? toDate(verification.verified_at)
          : null,
        verifiedBy: verification.is_verified ? "USR-099" : null,
      },
    });
  }

  // 3. Spaces
  for (const space of mock.spaces) {
    const areaParts = (space.area || "").split(",");
    const locality = areaParts[0]?.trim() || "Not specified";
    const city = areaParts.slice(1).join(",").trim() || locality;

    await prisma.space.upsert({
      where: { id: space.id },
      update: {
        ownerId: space.owner_id,
        name: space.name,
        description: space.description || "",
        spaceType: space.space_type,
        indoorOutdoor: space.indoor_outdoor || "indoor",
        capacity: space.capacity || 0,
        sqft: 0,
        pricePerHour: space.price_per_hour || 0,
        depositAmount: space.deposit_amount || 0,
        locality,
        city,
        address: space.address || "",
        amenities: toJson(space.facilities),
        allowedPurposes: toJson(space.allowed_purposes),
        rules: Array.isArray(space.rules)
          ? space.rules.map((rule: any) => rule.text || "").join("\n")
          : space.rules || null,
        photos: toJson(space.photos),
        active: true,
        verified: Boolean(space.verified),
        weatherDependent: false,
      },
      create: {
        id: space.id,
        ownerId: space.owner_id,
        name: space.name,
        description: space.description || "",
        spaceType: space.space_type,
        indoorOutdoor: space.indoor_outdoor || "indoor",
        capacity: space.capacity || 0,
        sqft: 0,
        pricePerHour: space.price_per_hour || 0,
        depositAmount: space.deposit_amount || 0,
        locality,
        city,
        address: space.address || "",
        amenities: toJson(space.facilities),
        allowedPurposes: toJson(space.allowed_purposes),
        rules: Array.isArray(space.rules)
          ? space.rules.map((rule: any) => rule.text || "").join("\n")
          : space.rules || null,
        photos: toJson(space.photos),
        active: true,
        verified: Boolean(space.verified),
        weatherDependent: false,
      },
    });
  }

  // 4. Bookings
  for (const booking of mock.bookings) {
    const hourlyFee = booking.hourly_fee ?? booking.hourly_fee_total ?? 0;
    const deposit = booking.deposit_amount ?? 0;
    const totalAmount = booking.total_amount ?? hourlyFee + deposit;

    await prisma.booking.upsert({
      where: { id: booking.id },
      update: {
        ref: booking.ref || `#${booking.id}`,
        userId: booking.user_id,
        spaceId: booking.space_id,
        slotDate: getDateOnly(booking.slot_date),
        startTime: booking.start_time,
        endTime: booking.end_time,
        durationHours: booking.duration_hours || 0,
        status: booking.status,
        purpose: booking.purpose || "General",
        groupSize: booking.group_size || 1,
        hourlyRate: booking.hourly_rate ?? 0,
        hourlyFee,
        depositAmount: deposit,
        depositStatus: booking.deposit_status || "pending",
        totalAmount,
        totalPaid: booking.total_paid ?? 0,
        platformFee: booking.platform_fee ?? 0,
        netPayout: booking.net_payout ?? 0,
        paymentMethod: booking.payment_method || "unknown",
        paymentStatus: booking.payment_status || "pending",
        paidAt: booking.paid_at ? toDate(booking.paid_at) : null,
        decisionReason: booking.decision_reason || null,
        pinCode: booking.pin_code || booking.access_pin || null,
        cancellationDeadline: booking.cancellation_deadline
          ? toDate(booking.cancellation_deadline)
          : null,
        canCancel: booking.can_cancel ?? true,
        cancelWarning: booking.cancel_warning || null,
      },
      create: {
        id: booking.id,
        ref: booking.ref || `#${booking.id}`,
        userId: booking.user_id,
        spaceId: booking.space_id,
        slotDate: getDateOnly(booking.slot_date),
        startTime: booking.start_time,
        endTime: booking.end_time,
        durationHours: booking.duration_hours || 0,
        status: booking.status,
        purpose: booking.purpose || "General",
        groupSize: booking.group_size || 1,
        hourlyRate: booking.hourly_rate ?? 0,
        hourlyFee,
        depositAmount: deposit,
        depositStatus: booking.deposit_status || "pending",
        totalAmount,
        totalPaid: booking.total_paid ?? 0,
        platformFee: booking.platform_fee ?? 0,
        netPayout: booking.net_payout ?? 0,
        paymentMethod: booking.payment_method || "unknown",
        paymentStatus: booking.payment_status || "pending",
        paidAt: booking.paid_at ? toDate(booking.paid_at) : null,
        decisionReason: booking.decision_reason || null,
        pinCode: booking.pin_code || booking.access_pin || null,
        cancellationDeadline: booking.cancellation_deadline
          ? toDate(booking.cancellation_deadline)
          : null,
        canCancel: booking.can_cancel ?? true,
        cancelWarning: booking.cancel_warning || null,
      },
    });
  }

  // 5. Availability slot needed by the waitlist
  for (const entry of mock.waitlist) {
    const space = mock.spaces.find(
      (item: any) => item.id === entry.space_id
    );

    const slot = space?.slots?.[0];

    await prisma.availabilitySlot.upsert({
      where: { id: entry.slot_id },
      update: {
        spaceId: entry.space_id,
        slotDate: getDateOnly(entry.slot_date),
        startTime: slot?.start || "09:00",
        endTime: slot?.end || "13:00",
      },
      create: {
        id: entry.slot_id,
        spaceId: entry.space_id,
        slotDate: getDateOnly(entry.slot_date),
        startTime: slot?.start || "09:00",
        endTime: slot?.end || "13:00",
      },
    });
  }

  // 6. Waitlist
  for (const entry of mock.waitlist) {
    await prisma.waitlist.upsert({
      where: { id: entry.id },
      update: {
        spaceId: entry.space_id,
        slotId: entry.slot_id,
        slotDate: getDateOnly(entry.slot_date),
        userId: entry.user_id,
        position: entry.position,
        createdAt: toDate(entry.created_at),
      },
      create: {
        id: entry.id,
        spaceId: entry.space_id,
        slotId: entry.slot_id,
        slotDate: getDateOnly(entry.slot_date),
        userId: entry.user_id,
        position: entry.position,
        createdAt: toDate(entry.created_at),
      },
    });
  }

  // 7. Score events
  for (const event of mock.scoreEvents) {
    await prisma.scoreEvent.upsert({
      where: { id: event.id },
      update: {
        userId: event.user_id,
        bookingId: event.booking_id || null,
        delta: event.delta,
        action: event.delta >= 0 ? "positive_adjustment" : "penalty",
        reason: event.reason,
        createdAt: toDate(event.created_at),
      },
      create: {
        id: event.id,
        userId: event.user_id,
        bookingId: event.booking_id || null,
        delta: event.delta,
        action: event.delta >= 0 ? "positive_adjustment" : "penalty",
        reason: event.reason,
        createdAt: toDate(event.created_at),
      },
    });
  }

  // 8. Incidents
  for (const incident of mock.incidents) {
    const space = mock.spaces.find(
      (item: any) => item.id === incident.space_id
    );

    await prisma.incident.upsert({
      where: { id: incident.id },
      update: {
        bookingId: incident.booking_id,
        spaceId: incident.space_id,
        userId: incident.user_id,
        ownerId: space.owner_id,
        reason: incident.description || "Incident reported",
        severity: (incident.score_penalty ?? 0) <= -30 ? "high" : "medium",
        status: incident.status || "open",
        depositHeld: incident.deposit_held ?? 0,
        deductionTotal:
          incident.deduction_total ?? incident.total_deductions ?? 0,
        refundAmount: incident.refund_amount ?? 0,
        deductions: toJson(incident.deductions),
        photos: toJson(incident.photos),
        notes: JSON.stringify(incident.timeline || []),
        createdAt: toDate(incident.date),
      },
      create: {
        id: incident.id,
        bookingId: incident.booking_id,
        spaceId: incident.space_id,
        userId: incident.user_id,
        ownerId: space.owner_id,
        reason: incident.description || "Incident reported",
        severity: (incident.score_penalty ?? 0) <= -30 ? "high" : "medium",
        status: incident.status || "open",
        depositHeld: incident.deposit_held ?? 0,
        deductionTotal:
          incident.deduction_total ?? incident.total_deductions ?? 0,
        refundAmount: incident.refund_amount ?? 0,
        deductions: toJson(incident.deductions),
        photos: toJson(incident.photos),
        notes: JSON.stringify(incident.timeline || []),
        createdAt: toDate(incident.date),
      },
    });
  }

  // 9. Condition reports
  for (const report of mock.conditionReports) {
    const booking = mock.bookings.find(
      (item: any) => item.id === report.booking_id
    );

    await prisma.conditionReport.upsert({
      where: { id: report.id },
      update: {
        bookingId: report.booking_id,
        spaceId: report.space_id,
        type: report.stage || "inspection",
        reportedBy: booking?.user_id || "USR-099",
        checklist: { cleanliness: report.cleanliness || "not specified" },
        conditionNotes: report.notes || null,
        verifiedByOwner: false,
        createdAt: toDate(report.created_at),
      },
      create: {
        id: report.id,
        bookingId: report.booking_id,
        spaceId: report.space_id,
        type: report.stage || "inspection",
        reportedBy: booking?.user_id || "USR-099",
        checklist: { cleanliness: report.cleanliness || "not specified" },
        conditionNotes: report.notes || null,
        verifiedByOwner: false,
        createdAt: toDate(report.created_at),
      },
    });
  }

  // 10. Disputes and their required score events
  for (const dispute of mock.disputes) {
    let scoreEvent = mock.scoreEvents.find(
      (event: any) =>
        event.user_id === dispute.user_id &&
        event.booking_id === dispute.booking_id
    );

    const scoreEventId = scoreEvent?.id || `SE-${dispute.id}`;

    if (!scoreEvent) {
      await prisma.scoreEvent.upsert({
        where: { id: scoreEventId },
        update: {},
        create: {
          id: scoreEventId,
          userId: dispute.user_id,
          bookingId: dispute.booking_id,
          delta: dispute.score_impact ?? 0,
          action: "disputed_adjustment",
          reason: dispute.reason,
          createdAt: toDate(dispute.filed_at),
        },
      });
    }

    await prisma.dispute.upsert({
      where: { id: dispute.id },
      update: {
        userId: dispute.user_id,
        scoreEventId,
        bookingId: dispute.booking_id,
        reason: dispute.reason,
        status: dispute.status || "pending",
      },
      create: {
        id: dispute.id,
        userId: dispute.user_id,
        scoreEventId,
        bookingId: dispute.booking_id,
        reason: dispute.reason,
        status: dispute.status || "pending",
        createdAt: toDate(dispute.filed_at),
      },
    });
  }

  // 11. Notifications
  for (const notification of mock.notifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: {
        userId: notification.recipient_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: Boolean(notification.read),
        actionUrl: notification.actions?.[0]?.href || null,
        actions: toJson(notification.actions),
        createdAt: toDate(notification.created_at),
      },
      create: {
        id: notification.id,
        userId: notification.recipient_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: Boolean(notification.read),
        actionUrl: notification.actions?.[0]?.href || null,
        actions: toJson(notification.actions),
        createdAt: toDate(notification.created_at),
      },
    });
  }

  // 12. Audit logs
  for (const log of mock.auditLog) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {
        actor: log.actor,
        action: log.action,
        target: log.target,
        reason: log.reason || null,
        details: log.details ?? {},
        createdAt: toDate(log.timestamp),
      },
      create: {
        id: log.id,
        actor: log.actor,
        action: log.action,
        target: log.target,
        reason: log.reason || null,
        details: log.details ?? {},
        createdAt: toDate(log.timestamp),
      },
    });
  }

  // 13. Platform settings
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {
      maxActiveBookingsPerUser: mock.settings.max_active_bookings ?? 2,
      weeklySpaceBookingLimitPerUser: 3,
      platformFeePercent: mock.settings.platform_fee_pct ?? 8,
      pointsCleanReturn: mock.settings.clean_return_bonus ?? 5,
      pointsLateReturn: mock.settings.late_penalty ?? -10,
      pointsNoShow: mock.settings.noshow_penalty ?? -10,
      pointsDamage: mock.settings.damage_penalty ?? -30,
      pointsMin: mock.settings.score_min ?? 0,
      pointsMax: mock.settings.score_max ?? 120,
    },
    create: {
      id: 1,
      maxActiveBookingsPerUser: mock.settings.max_active_bookings ?? 2,
      weeklySpaceBookingLimitPerUser: 3,
      platformFeePercent: mock.settings.platform_fee_pct ?? 8,
      pointsCleanReturn: mock.settings.clean_return_bonus ?? 5,
      pointsLateReturn: mock.settings.late_penalty ?? -10,
      pointsNoShow: mock.settings.noshow_penalty ?? -10,
      pointsDamage: mock.settings.damage_penalty ?? -30,
      pointsMin: mock.settings.score_min ?? 0,
      pointsMax: mock.settings.score_max ?? 120,
    },
  });

  console.log("BORO database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
