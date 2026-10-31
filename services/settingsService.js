const prisma = require('../lib/prisma');

const SETTING_ID = 1;

function normalizeSettings(settings) {
  return {
    max_active_bookings_per_user: settings.maxActiveBookingsPerUser,
    weekly_space_booking_limit_per_user:
      settings.weeklySpaceBookingLimitPerUser,
    grace_period_mins: settings.gracePeriodMins,
    no_show_window_hours: settings.noShowWindowHours,
    platform_fee_pct: Number(settings.platformFeePercent),
    clean_return_bonus: settings.pointsCleanReturn,
    late_penalty: settings.pointsLateReturn,
    noshow_penalty: settings.pointsNoShow,
    damage_penalty: settings.pointsDamage,
    score_min: settings.pointsMin,
    score_max: settings.pointsMax
  };
}

// GET /admin/settings
exports.getAll = async () => {
  const settings = await prisma.setting.findUnique({
    where: { id: SETTING_ID }
  });

  if (!settings) {
    throw new Error('Platform settings not found.');
  }

  return normalizeSettings(settings);
};

// POST /admin/settings
exports.update = async (data) => {
  const fieldMap = {
    max_active_bookings_per_user: 'maxActiveBookingsPerUser',
    weekly_space_booking_limit_per_user: 'weeklySpaceBookingLimitPerUser',
    grace_period_mins: 'gracePeriodMins',
    no_show_window_hours: 'noShowWindowHours',
    platform_fee_pct: 'platformFeePercent',
    clean_return_bonus: 'pointsCleanReturn',
    late_penalty: 'pointsLateReturn',
    noshow_penalty: 'pointsNoShow',
    damage_penalty: 'pointsDamage',
    score_min: 'pointsMin',
    score_max: 'pointsMax'
  };

  const updateData = {};

  for (const [inputKey, dbKey] of Object.entries(fieldMap)) {
    if (data[inputKey] !== undefined) {
      updateData[dbKey] = Number(data[inputKey]);
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid settings provided.');
  }

  await prisma.setting.upsert({
    where: { id: SETTING_ID },
    create: {
      id: SETTING_ID,
      ...updateData
    },
    update: updateData
  });
};