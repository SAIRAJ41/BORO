const prisma = require('../lib/prisma');
const crypto = require('crypto');

const SETTING_ID = 1;
const PENALTY_FIELDS = new Set(['pointsLateReturn', 'pointsNoShow', 'pointsDamage']);

function signedPenalty(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return number;
  return number > 0 ? -number : number;
}

function parseSettingNumber(value, key, { integer = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid value for ${key}.`);
  if (integer && !Number.isInteger(number)) {
    throw new Error(`${key} must be a whole number.`);
  }
  return number;
}

function normalizeSettings(settings) {
  return {
    max_active_bookings_per_user: settings.maxActiveBookingsPerUser,
    max_active_bookings: settings.maxActiveBookingsPerUser,
    weekly_space_booking_limit_per_user: settings.weeklySpaceBookingLimitPerUser,
    weekly_booking_limit: settings.weeklySpaceBookingLimitPerUser,
    grace_period_mins: settings.gracePeriodMins,
    no_show_window_hours: settings.noShowWindowHours,
    platform_fee_pct: Number(settings.platformFeePercent),
    platform_fee_percent: Number(settings.platformFeePercent),
    clean_return_bonus: settings.pointsCleanReturn,
    late_penalty: settings.pointsLateReturn,
    late_return_penalty: Math.abs(settings.pointsLateReturn),
    noshow_penalty: Math.abs(settings.pointsNoShow),
    damage_penalty: Math.abs(settings.pointsDamage),
    score_min: settings.pointsMin,
    score_max: settings.pointsMax,
    max_score: settings.pointsMax
  };
}

async function requireAdmin(adminId) {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true, status: true }
  });
  if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
    throw new Error('Administrator access denied.');
  }
}

exports.getAll = async adminId => {
  await requireAdmin(adminId);
  const settings = await prisma.setting.findUnique({
    where: { id: SETTING_ID }
  });

  if (!settings) {
    throw new Error('Platform settings not found.');
  }

  return normalizeSettings(settings);
};

exports.update = async (data, adminId) => {
  await requireAdmin(adminId);

  const fieldMap = {
    max_active_bookings_per_user: 'maxActiveBookingsPerUser',
    max_active_bookings: 'maxActiveBookingsPerUser',
    weekly_space_booking_limit_per_user: 'weeklySpaceBookingLimitPerUser',
    weekly_booking_limit: 'weeklySpaceBookingLimitPerUser',
    grace_period_mins: 'gracePeriodMins',
    no_show_window_hours: 'noShowWindowHours',
    platform_fee_pct: 'platformFeePercent',
    platform_fee_percent: 'platformFeePercent',
    clean_return_bonus: 'pointsCleanReturn',
    late_penalty: 'pointsLateReturn',
    late_return_penalty: 'pointsLateReturn',
    noshow_penalty: 'pointsNoShow',
    damage_penalty: 'pointsDamage',
    score_min: 'pointsMin',
    score_max: 'pointsMax',
    max_score: 'pointsMax'
  };

  const integerFields = new Set([
    'maxActiveBookingsPerUser',
    'weeklySpaceBookingLimitPerUser',
    'gracePeriodMins',
    'noShowWindowHours',
    'pointsCleanReturn',
    'pointsLateReturn',
    'pointsNoShow',
    'pointsDamage',
    'pointsMin',
    'pointsMax'
  ]);
  const updateData = {};

  for (const [inputKey, dbKey] of Object.entries(fieldMap)) {
    if (data[inputKey] !== undefined && data[inputKey] !== '') {
      const value = parseSettingNumber(data[inputKey], inputKey, {
        integer: integerFields.has(dbKey)
      });
      updateData[dbKey] = PENALTY_FIELDS.has(dbKey) ? signedPenalty(value) : value;
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid settings provided.');
  }

  if (updateData.maxActiveBookingsPerUser !== undefined &&
      (updateData.maxActiveBookingsPerUser < 1 || updateData.maxActiveBookingsPerUser > 10)) {
    throw new Error('Active booking limit must be between 1 and 10.');
  }
  if (updateData.weeklySpaceBookingLimitPerUser !== undefined &&
      (updateData.weeklySpaceBookingLimitPerUser < 1 || updateData.weeklySpaceBookingLimitPerUser > 14)) {
    throw new Error('Weekly booking limit must be between 1 and 14.');
  }
  if (updateData.gracePeriodMins !== undefined &&
      (updateData.gracePeriodMins < 0 || updateData.gracePeriodMins > 120)) {
    throw new Error('Grace period must be between 0 and 120 minutes.');
  }
  if (updateData.noShowWindowHours !== undefined &&
      (updateData.noShowWindowHours < 1 || updateData.noShowWindowHours > 48)) {
    throw new Error('No-show window must be between 1 and 48 hours.');
  }
  if (updateData.platformFeePercent !== undefined &&
      (updateData.platformFeePercent < 0 || updateData.platformFeePercent > 20)) {
    throw new Error('Platform fee must be between 0 and 20 percent.');
  }
  if (updateData.pointsCleanReturn !== undefined &&
      (updateData.pointsCleanReturn < 0 || updateData.pointsCleanReturn > 50)) {
    throw new Error('Clean return bonus must be between 0 and 50.');
  }
  if (updateData.pointsMin !== undefined && (updateData.pointsMin < 0 || updateData.pointsMin > 120)) {
    throw new Error('Minimum score must be between 0 and 120.');
  }
  if (updateData.pointsMax !== undefined && (updateData.pointsMax < 1 || updateData.pointsMax > 200)) {
    throw new Error('Maximum score must be between 1 and 200.');
  }
  if (updateData.pointsMin !== undefined && updateData.pointsMax !== undefined &&
      updateData.pointsMin > updateData.pointsMax) {
    throw new Error('Minimum score cannot exceed maximum score.');
  }
  for (const key of ['pointsLateReturn', 'pointsNoShow', 'pointsDamage']) {
    if (updateData[key] !== undefined && Math.abs(updateData[key]) > 50) {
      throw new Error('Score penalties must be between 0 and 50 points.');
    }
  }

  await prisma.$transaction(async tx => {
    const existing = await tx.setting.findUnique({ where: { id: SETTING_ID } });
    if (!existing) throw new Error('Platform settings not found.');
    await tx.setting.update({
      where: { id: SETTING_ID },
      data: updateData
    });
    await tx.auditLog.create({
      data: {
        id: `AUD-${crypto.randomUUID()}`,
        actor: adminId,
        action: 'PLATFORM_SETTINGS_UPDATED',
        target: 'settings:1',
        details: { fields: Object.keys(updateData) }
      }
    });
  });
};
