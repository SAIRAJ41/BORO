const prisma = require('../lib/prisma');

// GET /notifications
exports.getUserNotifications = async (userId, filter = 'all') => {
  const where = { userId };

  if (filter === 'unread') {
    where.read = false;
  } else if (filter === 'read') {
    where.read = true;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return notifications.map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    read: item.read,
    created_at: item.createdAt,
    actions: item.actions || []
  }));
};

// POST /notifications/:id/read
exports.markRead = async (notifId, userId) => {
  const result = await prisma.notification.updateMany({
    where: { id: notifId, userId },
    data: { read: true }
  });
  if (result.count !== 1) throw new Error('Notification not found.');
};

// POST /notifications/read-all
exports.markAllRead = async (userId) => {
  await prisma.notification.updateMany({
    where: {
      userId,
      read: false
    },
    data: {
      read: true
    }
  });
};