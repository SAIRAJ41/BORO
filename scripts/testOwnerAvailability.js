/**
 * Focused owner availability CRUD tests with an isolated Prisma mock.
 */

const Module = require('module');

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);

const state = {
  spaces: {
    'SPACE-1': { id: 'SPACE-1', ownerId: 'OWNER-1', active: true, listingStatus: 'approved' },
    'SPACE-PENDING': { id: 'SPACE-PENDING', ownerId: 'OWNER-1', active: true, listingStatus: 'pending' }
  },
  slots: [],
  bookings: [],
  audits: [],
  mutateAfterRead: false
};

let transactionQueue = Promise.resolve();
const tx = {
  space: {
    async findUnique({ where }) {
      return state.spaces[where.id] || null;
    }
  },
  availabilitySlot: {
    async findMany({ where }) {
      return state.slots.filter(slot =>
        slot.spaceId === where.spaceId &&
        sameDate(slot.slotDate, where.slotDate) &&
        (!where.id || slot.id !== where.id.not)
      );
    },
    async findUnique({ where }) {
      const slot = state.slots.find(item => item.id === where.id);
      if (!slot) return null;
      const snapshot = { ...slot, space: state.spaces[slot.spaceId] };
      if (state.mutateAfterRead) {
        state.mutateAfterRead = false;
        slot.startTime = '20:30';
      }
      return snapshot;
    },
    async create({ data }) {
      const slot = {
        ...data,
        space: state.spaces[data.spaceId]
      };
      state.slots.push(slot);
      return slot;
    },
    async update({ where, data }) {
      const slot = state.slots.find(item => item.id === where.id);
      Object.assign(slot, data);
      return slot;
    },
    async updateMany({ where, data }) {
      const slot = state.slots.find(item =>
        item.id === where.id &&
        item.spaceId === where.spaceId &&
        sameDate(item.slotDate, where.slotDate) &&
        item.startTime === where.startTime &&
        item.endTime === where.endTime &&
        item.isBooked === where.isBooked &&
        item.status === where.status
      );
      if (!slot) return { count: 0 };
      Object.assign(slot, data);
      return { count: 1 };
    },
    async delete({ where }) {
      const index = state.slots.findIndex(item => item.id === where.id);
      state.slots.splice(index, 1);
    },
    async deleteMany({ where }) {
      const index = state.slots.findIndex(item =>
        item.id === where.id &&
        item.spaceId === where.spaceId &&
        sameDate(item.slotDate, where.slotDate) &&
        item.startTime === where.startTime &&
        item.endTime === where.endTime &&
        item.isBooked === where.isBooked &&
        item.status === where.status
      );
      if (index < 0) return { count: 0 };
      state.slots.splice(index, 1);
      return { count: 1 };
    }
  },
  booking: {
    async findMany({ where }) {
      return state.bookings.filter(booking =>
        booking.spaceId === where.spaceId &&
        sameDate(booking.slotDate, where.slotDate) &&
        !['cancelled', 'rejected', 'waitlisted'].includes(booking.status)
      );
    }
  },
  auditLog: {
    async create({ data }) {
      state.audits.push(data);
    }
  }
};

function sameDate(left, right) {
  return new Date(left).toISOString().slice(0, 10) ===
    new Date(right).toISOString().slice(0, 10);
}

const prismaMock = {
  $transaction(callback) {
    const next = transactionQueue.then(() => callback(tx));
    transactionQueue = next.catch(() => {});
    return next;
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  let resolvedRequest;
  try {
    resolvedRequest = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolvedRequest = null;
  }

  if (resolvedRequest === require.resolve('../lib/prisma')) return prismaMock;
  return originalLoad.apply(this, arguments);
};

const bookingService = require('../services/bookingService');

async function expectRejected(operation, expected, name) {
  try {
    await operation();
    throw new Error(`${name}: expected rejection`);
  } catch (error) {
    if (error.message !== expected) {
      throw new Error(`${name}: expected "${expected}", got "${error.message}"`);
    }
    console.log(`✓ ${name}`);
  }
}

async function run() {
  const first = await bookingService.createAvailabilitySlot('OWNER-1', {
    space_id: 'SPACE-1',
    slot_date: date,
    start_time: '10:00',
    end_time: '12:00'
  });
  if (!first || state.slots.length !== 1 || state.audits[0].action !== 'create_availability_slot') {
    throw new Error('Valid owner slot was not created and audited');
  }
  console.log('✓ Owner creates a valid slot');

  await expectRejected(
    () => bookingService.createAvailabilitySlot('OWNER-2', {
      space_id: 'SPACE-1', slot_date: date, start_time: '13:00', end_time: '14:00'
    }),
    'Space not found or unauthorized.',
    'Owner cannot manage another owner slot'
  );
  await expectRejected(
    () => bookingService.createAvailabilitySlot('OWNER-1', {
      space_id: 'SPACE-PENDING', slot_date: date, start_time: '13:00', end_time: '14:00'
    }),
    'Availability can only be managed for an approved active listing.',
    'Unapproved listing cannot receive slots'
  );
  await expectRejected(
    () => bookingService.createAvailabilitySlot('OWNER-1', {
      space_id: 'SPACE-1', slot_date: '2020-02-31', start_time: '13:00', end_time: '14:00'
    }),
    'A valid slot date is required.',
    'Invalid dates are rejected'
  );
  await expectRejected(
    () => bookingService.createAvailabilitySlot('OWNER-1', {
      space_id: 'SPACE-1', slot_date: date, start_time: '14:00', end_time: '14:00'
    }),
    'Slot start time must be before its end time.',
    'Invalid times are rejected'
  );
  await expectRejected(
    () => bookingService.createAvailabilitySlot('OWNER-1', {
      space_id: 'SPACE-1', slot_date: date, start_time: '11:00', end_time: '13:00'
    }),
    'This slot overlaps an existing availability slot.',
    'Overlapping slots are rejected'
  );

  state.bookings.push({
    spaceId: 'SPACE-1',
    slotDate: new Date(`${date}T00:00:00Z`),
    startTime: '15:00',
    endTime: '16:00',
    status: 'approved'
  });
  const reserved = await bookingService.createAvailabilitySlot('OWNER-1', {
    space_id: 'SPACE-1', slot_date: date, start_time: '15:00', end_time: '16:00'
  }).catch(error => error);
  if (!reserved || reserved.message !== 'This slot conflicts with an existing booking.') {
    throw new Error('Existing booking conflict was not rejected');
  }
  console.log('✓ Existing bookings prevent conflicting availability');

  state.slots[0].isBooked = true;
  state.slots[0].status = 'booked';
  await expectRejected(
    () => bookingService.deleteAvailabilitySlot(first.id, 'OWNER-1'),
    'Booked slots cannot be deleted.',
    'Booked slots cannot be deleted'
  );
  await expectRejected(
    () => bookingService.updateAvailabilitySlot(first.id, 'OWNER-1', {
      slot_date: date, start_time: '12:00', end_time: '13:00'
    }),
    'Booked slots cannot be modified.',
    'Booked slots cannot be modified'
  );
  state.slots[0].isBooked = false;
  state.slots[0].status = 'available';
  await bookingService.updateAvailabilitySlot(first.id, 'OWNER-1', {
    slot_date: date, start_time: '12:00', end_time: '13:00'
  });
  if (state.audits.at(-1).action !== 'update_availability_slot') {
    throw new Error('Successful slot update was not audited');
  }
  await bookingService.deleteAvailabilitySlot(first.id, 'OWNER-1');
  if (state.slots.length !== 0 || state.audits.at(-1).action !== 'delete_availability_slot') {
    throw new Error('Successful slot deletion was not audited');
  }
  console.log('✓ Eligible slots can be updated and deleted');

  const stale = await bookingService.createAvailabilitySlot('OWNER-1', {
    space_id: 'SPACE-1', slot_date: date, start_time: '20:00', end_time: '21:00'
  });
  const auditCount = state.audits.length;
  state.mutateAfterRead = true;
  await expectRejected(
    () => bookingService.updateAvailabilitySlot(stale.id, 'OWNER-1', {
      slot_date: date, start_time: '20:00', end_time: '21:00'
    }),
    'Availability slot changed; reload and retry.',
    'Stale slot edits are rejected'
  );
  if (state.audits.length !== auditCount) {
    throw new Error('Failed stale edit created an audit record');
  }
  state.slots.splice(state.slots.findIndex(slot => slot.id === stale.id), 1);

  const concurrent = await Promise.allSettled([
    bookingService.createAvailabilitySlot('OWNER-1', {
      space_id: 'SPACE-1', slot_date: date, start_time: '18:00', end_time: '19:00'
    }),
    bookingService.createAvailabilitySlot('OWNER-1', {
      space_id: 'SPACE-1', slot_date: date, start_time: '18:30', end_time: '19:30'
    })
  ]);
  if (concurrent.filter(result => result.status === 'fulfilled').length !== 1) {
    throw new Error('Concurrent overlapping slot creation was not serialized safely');
  }
  console.log('✓ Concurrent creation cannot create overlapping slots');
}

run().catch(error => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
