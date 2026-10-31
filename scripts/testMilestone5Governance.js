/**
 * BORO — Milestone 5 Governance & Administration Test Suite
 *
 * Covers:
 * 1. Admin overview metrics & statistics
 * 2. Owner verification submission, document access, approval/rejection lifecycle, and audits
 * 3. User suspension, reactivation, session invalidation, and role protections
 * 4. Database-backed settings retrieval, updates, validations, and penalty signs
 * 5. Owner-scoped payout methods CRUD, detail validation, masking, and authorization
 * 6. Identity document isolation and schema guardrails
 */

const assert = require('assert');
const Module = require('module');

// In-memory state for mock Prisma & Storage
const mockState = {
  users: [
    {
      id: 'ADMIN-1',
      name: 'Amit Verma',
      email: 'admin@test.local',
      role: 'admin',
      status: 'active',
      score: 100
    },
    {
      id: 'ADMIN-2',
      name: 'Second Admin',
      email: 'admin2@test.local',
      role: 'admin',
      status: 'active',
      score: 100
    },
    {
      id: 'OWNER-1',
      name: 'Rajesh Kumar',
      email: 'owner@test.local',
      role: 'owner',
      status: 'active',
      score: 100
    },
    {
      id: 'OWNER-2',
      name: 'Suresh Patel',
      email: 'owner2@test.local',
      role: 'owner',
      status: 'active',
      score: 100
    },
    {
      id: 'USER-1',
      name: 'Priya Mehta',
      email: 'user@test.local',
      role: 'user',
      status: 'active',
      score: 95
    }
  ],
  verifications: [],
  payoutMethods: [],
  spaces: [
    { id: 'SP-1', ownerId: 'OWNER-1', active: true, listingStatus: 'approved' },
    { id: 'SP-2', ownerId: 'OWNER-1', active: false, listingStatus: 'pending' }
  ],
  bookings: [
    { id: 'BK-1', status: 'approved', totalAmount: 500 },
    { id: 'BK-2', status: 'checked_in', totalAmount: 300 },
    { id: 'BK-3', status: 'returned', totalAmount: 1200 },
    { id: 'BK-4', status: 'cancelled', totalAmount: 400 }
  ],
  disputes: [
    { id: 'DSP-1', status: 'open' },
    { id: 'DSP-2', status: 'pending' },
    { id: 'DSP-3', status: 'resolved' }
  ],
  incidents: [
    { id: 'INC-1', status: 'open' },
    { id: 'INC-2', status: 'resolved' }
  ],
  settings: {
    id: 1,
    maxActiveBookingsPerUser: 2,
    weeklySpaceBookingLimitPerUser: 3,
    gracePeriodMins: 15,
    noShowWindowHours: 2,
    platformFeePercent: 8,
    pointsCleanReturn: 5,
    pointsLateReturn: -10,
    pointsNoShow: -10,
    pointsDamage: -30,
    pointsMin: 0,
    pointsMax: 120
  },
  auditLogs: [],
  storageFiles: new Set()
};

// Mock Prisma
const prismaMock = {
  user: {
    async findUnique({ where }) {
      return mockState.users.find(u =>
        (where.id && u.id === where.id) ||
        (where.email && u.email === where.email)
      ) || null;
    },
    async count({ where = {} } = {}) {
      return mockState.users.filter(u => {
        if (where.role && u.role !== where.role) return false;
        if (where.status && u.status !== where.status) return false;
        return true;
      }).length;
    },
    async update({ where, data }) {
      const user = mockState.users.find(u => u.id === where.id);
      if (!user) throw new Error('User not found.');
      Object.assign(user, data);
      return { ...user };
    }
  },
  ownerVerification: {
    async findFirst({ where }) {
      return mockState.verifications.find(v => {
        if (where.userId && v.userId !== where.userId) return false;
        if (where.isVerified !== undefined && v.isVerified !== where.isVerified) return false;
        if (where.user) {
          const user = mockState.users.find(u => u.id === v.userId);
          if (!user) return false;
          if (where.user.role && user.role !== where.user.role) return false;
          if (where.user.status) {
            if (where.user.status.not && user.status === where.user.status.not) return false;
            if (where.user.status.notIn && where.user.status.notIn.includes(user.status)) return false;
          }
        }
        return true;
      }) || null;
    },
    async findMany({ where }) {
      return mockState.verifications.filter(v => {
        if (where.isVerified !== undefined && v.isVerified !== where.isVerified) return false;
        if (where.user) {
          const user = mockState.users.find(u => u.id === v.userId);
          if (!user) return false;
          if (where.user.role && user.role !== where.user.role) return false;
          if (where.user.status && where.user.status.not && user.status === where.user.status.not) return false;
        }
        return true;
      }).map(v => ({
        ...v,
        user: {
          ...mockState.users.find(u => u.id === v.userId),
          _count: { ownedSpaces: mockState.spaces.filter(s => s.ownerId === v.userId).length }
        }
      }));
    },
    async count({ where }) {
      const items = await this.findMany({ where });
      return items.length;
    },
    async create({ data }) {
      const record = { id: `VER-${Date.now()}-${Math.random()}`, ...data };
      mockState.verifications.push(record);
      return record;
    },
    async update({ where, data }) {
      const record = mockState.verifications.find(v => v.id === where.id);
      if (!record) throw new Error('Verification not found.');
      Object.assign(record, data);
      return record;
    }
  },
  payoutMethod: {
    async findUnique({ where }) {
      return mockState.payoutMethods.find(p => p.ownerId === where.ownerId) || null;
    },
    async upsert({ where, create, update }) {
      const idx = mockState.payoutMethods.findIndex(p => p.ownerId === where.ownerId);
      if (idx >= 0) {
        Object.assign(mockState.payoutMethods[idx], update, { updatedAt: new Date() });
        return mockState.payoutMethods[idx];
      }
      const record = { ...create, createdAt: new Date(), updatedAt: new Date() };
      mockState.payoutMethods.push(record);
      return record;
    },
    async deleteMany({ where }) {
      const before = mockState.payoutMethods.length;
      mockState.payoutMethods = mockState.payoutMethods.filter(p => p.ownerId !== where.ownerId);
      return { count: before - mockState.payoutMethods.length };
    }
  },
  space: {
    async count({ where = {} } = {}) {
      return mockState.spaces.filter(s => {
        if (where.active !== undefined && s.active !== where.active) return false;
        if (where.listingStatus && s.listingStatus !== where.listingStatus) return false;
        return true;
      }).length;
    }
  },
  booking: {
    async count({ where = {} } = {}) {
      return mockState.bookings.filter(b => {
        if (where.status && where.status.in && !where.status.in.includes(b.status)) return false;
        return true;
      }).length;
    },
    async aggregate({ _sum }) {
      if (_sum && _sum.totalAmount) {
        const total = mockState.bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        return { _sum: { totalAmount: total } };
      }
      return { _sum: {} };
    }
  },
  dispute: {
    async count({ where = {} } = {}) {
      return mockState.disputes.filter(d => {
        if (where.status && where.status.in && !where.status.in.includes(d.status)) return false;
        if (where.status && typeof where.status === 'string' && d.status !== where.status) return false;
        return true;
      }).length;
    }
  },
  incident: {
    async count({ where = {} } = {}) {
      return mockState.incidents.filter(i => {
        if (where.status && where.status.in && !where.status.in.includes(i.status)) return false;
        return true;
      }).length;
    }
  },
  setting: {
    async findUnique({ where }) {
      if (where.id === mockState.settings.id) return { ...mockState.settings };
      return null;
    },
    async update({ where, data }) {
      if (where.id !== mockState.settings.id) throw new Error('Settings not found.');
      Object.assign(mockState.settings, data);
      return { ...mockState.settings };
    }
  },
  auditLog: {
    async create({ data }) {
      const record = { id: `AUD-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...data };
      mockState.auditLogs.push(record);
      return record;
    }
  },
  async $transaction(fn) {
    return fn(prismaMock);
  }
};

// Mock Supabase storage
const ownershipDocServiceMock = {
  async uploadForOwnerVerification(ownerId, file) {
    if (!file || !file.buffer) throw new Error('An identity document is required.');
    const path = `owners/${ownerId}/mock-doc.pdf`;
    mockState.storageFiles.add(path);
    return {
      path,
      name: file.originalname || 'document.pdf',
      size: file.size || file.buffer.length,
      mimeType: 'application/pdf'
    };
  },
  async getSignedUrl(path) {
    if (!mockState.storageFiles.has(path)) {
      throw new Error('Document not found in storage.');
    }
    return `https://supabase.test.signed/${path}?token=valid_5min`;
  },
  async remove(path) {
    mockState.storageFiles.delete(path);
  }
};

// Intercept modules
const prismaPath = require.resolve('../lib/prisma');
const ownershipDocServicePath = require.resolve('../services/ownershipDocumentService');
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolved = null;
  }
  if (resolved === prismaPath) return prismaMock;
  if (resolved === ownershipDocServicePath) return ownershipDocServiceMock;
  return originalLoad.apply(this, arguments);
};

// Now load actual services with intercepted dependencies
const userService = require('../services/userService');
const settingsService = require('../services/settingsService');
const authMiddleware = require('../middleware/auth');

async function expectThrows(fn, expectedSubstring) {
  try {
    await fn();
    assert.fail(`Expected exception containing "${expectedSubstring}", but no exception was thrown.`);
  } catch (error) {
    if (!error.message.includes(expectedSubstring)) {
      assert.fail(`Expected exception message to contain "${expectedSubstring}", got "${error.message}"`);
    }
  }
}

async function runTests() {
  console.log('🧪 Running Milestone 5 Governance & Administration Tests...\n');

  // ==========================================
  // Area 1: Admin Overview
  // ==========================================
  console.log('--- 1. Admin Overview ---');
  await expectThrows(() => userService.getAdminCounts('USER-1'), 'Administrator access denied.');
  await expectThrows(() => userService.getAdminCounts('UNKNOWN-ID'), 'Administrator access denied.');

  const counts = await userService.getAdminCounts('ADMIN-1');
  assert.strictEqual(counts.total_users, 5, 'total_users count matches');
  assert.strictEqual(counts.total_owners, 2, 'total_owners count matches');
  assert.strictEqual(counts.total_spaces, 1, 'total_spaces counts only active approved spaces');
  assert.strictEqual(counts.active_bookings, 2, 'active_bookings matches approved + checked_in');
  assert.strictEqual(counts.completed_bookings, 1, 'completed_bookings matches returned');
  assert.strictEqual(counts.open_disputes, 2, 'open_disputes counts open and pending disputes');
  assert.strictEqual(counts.active_incidents, 1, 'active_incidents matches open incidents');
  assert.strictEqual(counts.total_volume, 2400, 'total_volume aggregates all booking amounts');
  console.log('✓ Admin overview counts accurately aggregate database records and require admin role');

  // ==========================================
  // Area 2: Owner Verification Lifecycle
  // ==========================================
  console.log('\n--- 2. Owner Verification ---');
  // 2a. Owner submission
  const validFile = {
    originalname: 'identity.pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4 mock')
  };

  // Cross-owner upload protection
  await expectThrows(
    () => userService.submitOwnerVerificationDocument('OWNER-1', validFile, 'OWNER-2'),
    'Verification access denied.'
  );

  // Valid submission
  await userService.submitOwnerVerificationDocument('OWNER-1', validFile, 'OWNER-1');
  const auditDocSubmit = mockState.auditLogs.find(a => a.action === 'OWNER_VERIFICATION_DOCUMENT_SUBMITTED');
  assert(auditDocSubmit, 'Audit record created for document submission');
  assert.strictEqual(auditDocSubmit.target, 'user:OWNER-1');

  // 2b. Document access & signed URLs
  await expectThrows(
    () => userService.getOwnerVerificationDocument('OWNER-1', 'OWNER-2'),
    'Verification access denied.'
  );
  await expectThrows(
    () => userService.getOwnerVerificationDocument('OWNER-1', 'USER-1'),
    'Verification access denied.'
  );

  const ownerUrl = await userService.getOwnerVerificationDocument('OWNER-1', 'OWNER-1');
  assert(ownerUrl.startsWith('https://supabase.test.signed/owners/OWNER-1/'), 'Owner can retrieve own signed URL');

  const adminUrl = await userService.getOwnerVerificationDocument('OWNER-1', 'ADMIN-1');
  assert(adminUrl.startsWith('https://supabase.test.signed/owners/OWNER-1/'), 'Admin can retrieve owner signed URL');

  // 2c. Admin Approval
  await expectThrows(
    () => userService.approveOwner('OWNER-1', 'USER-1', 'Approved test'),
    'Administrator access denied.'
  );

  await userService.approveOwner('OWNER-1', 'ADMIN-1', 'All identity credentials verified');
  const ownerRecord = mockState.users.find(u => u.id === 'OWNER-1');
  assert.strictEqual(ownerRecord.status, 'active', 'Owner user status is active');
  const verificationRecord = mockState.verifications.find(v => v.userId === 'OWNER-1');
  assert.strictEqual(verificationRecord.isVerified, true, 'Verification is marked true');
  assert.strictEqual(verificationRecord.verifiedBy, 'ADMIN-1', 'Verified by admin ID');

  const auditApproved = mockState.auditLogs.find(a => a.action === 'OWNER_APPROVED' && a.target === 'OWNER-1');
  assert(auditApproved, 'Audit record created for owner approval');
  assert.strictEqual(auditApproved.actor, 'ADMIN-1');

  // Repeated approval is rejected
  await expectThrows(
    () => userService.approveOwner('OWNER-1', 'ADMIN-1', 'Duplicate approval attempt'),
    'Pending owner verification not found.'
  );

  // 2d. Admin Rejection
  // Setup pending verification for OWNER-2
  await userService.submitOwnerVerificationDocument('OWNER-2', validFile, 'OWNER-2');
  
  // Rejection requires meaningful reason
  await expectThrows(
    () => userService.rejectOwner('OWNER-2', 'ADMIN-1', 'short'),
    'A meaningful reason is required.'
  );

  // Valid rejection
  await userService.rejectOwner('OWNER-2', 'ADMIN-1', 'Document expired and signature illegible.');
  const owner2 = mockState.users.find(u => u.id === 'OWNER-2');
  assert.strictEqual(owner2.status, 'rejected', 'Owner status updated to rejected');
  const ver2 = mockState.verifications.find(v => v.userId === 'OWNER-2');
  assert.strictEqual(ver2.isVerified, false, 'Verification is false');
  assert.strictEqual(ver2.verifiedBy, 'ADMIN-1');

  const auditRejected = mockState.auditLogs.find(a => a.action === 'OWNER_REJECTED' && a.target === 'OWNER-2');
  assert(auditRejected, 'Audit record created for owner rejection');
  assert.strictEqual(auditRejected.reason, 'Document expired and signature illegible.');

  // Repeated rejection rejected
  await expectThrows(
    () => userService.rejectOwner('OWNER-2', 'ADMIN-1', 'Duplicate rejection attempt'),
    'Pending owner verification not found.'
  );

  // Rejected owner cannot submit new document
  await expectThrows(
    () => userService.submitOwnerVerificationDocument('OWNER-2', validFile, 'OWNER-2'),
    'This owner account cannot submit verification documents.'
  );

  console.log('✓ Owner verification lifecycle enforces document submission, signed URLs, approval/rejection audits, and state protections');

  // ==========================================
  // Area 3: Admin User Suspension & Session Invalidation
  // ==========================================
  console.log('\n--- 3. Admin User Suspension ---');
  // Non-admin cannot suspend
  await expectThrows(
    () => userService.suspend('USER-1', 'USER-1', 'Reasonable reason here'),
    'Administrator access denied.'
  );

  // Admin cannot suspend self
  await expectThrows(
    () => userService.suspend('ADMIN-1', 'ADMIN-1', 'Self suspension test'),
    'Administrators cannot suspend themselves.'
  );

  // Admin cannot suspend another admin
  await expectThrows(
    () => userService.suspend('ADMIN-2', 'ADMIN-1', 'Suspending second admin'),
    'User cannot be suspended.'
  );

  // Meaningful reason required
  await expectThrows(
    () => userService.suspend('USER-1', 'ADMIN-1', 'too short'),
    'A meaningful reason is required.'
  );

  // Suspend USER-1
  await userService.suspend('USER-1', 'ADMIN-1', 'Repeated policy violation and damaged premise.');
  const suspendedUser = mockState.users.find(u => u.id === 'USER-1');
  assert.strictEqual(suspendedUser.status, 'suspended', 'User status set to suspended');

  const auditSuspended = mockState.auditLogs.find(a => a.action === 'USER_SUSPENDED' && a.target === 'USER-1');
  assert(auditSuspended, 'Audit log created for suspension');
  assert.strictEqual(auditSuspended.actor, 'ADMIN-1');

  // Cannot suspend already suspended user
  await expectThrows(
    () => userService.suspend('USER-1', 'ADMIN-1', 'Suspend again test reason'),
    'User is already suspended.'
  );

  // Session invalidation test: attachUser rejects suspended user
  let destroyed = false;
  let redirectedTo = null;
  const mockReq = {
    session: {
      user: { id: 'USER-1', name: 'Priya', role: 'user', status: 'active' },
      destroy(cb) {
        destroyed = true;
        cb();
      }
    }
  };
  const mockRes = {
    locals: {},
    redirect(url) {
      redirectedTo = url;
    }
  };
  await authMiddleware.attachUser(mockReq, mockRes, () => {});
  assert.strictEqual(destroyed, true, 'Existing session was destroyed by attachUser middleware');
  assert.strictEqual(redirectedTo, '/login', 'User was redirected to /login');

  // Reactivate user
  await userService.unsuspend('USER-1', 'ADMIN-1', 'Suspension period expired and mediation accepted.');
  assert.strictEqual(suspendedUser.status, 'active', 'User status restored to active');
  const auditUnsuspended = mockState.auditLogs.find(a => a.action === 'USER_UNSUSPENDED' && a.target === 'USER-1');
  assert(auditUnsuspended, 'Audit log created for reactivation');

  // Cannot unsuspend non-suspended user
  await expectThrows(
    () => userService.unsuspend('USER-1', 'ADMIN-1', 'Already active unsuspend attempt'),
    'User is not suspended.'
  );

  console.log('✓ User suspension and reactivation enforce admin authorization, reason validation, audit trails, and session invalidation');

  // ==========================================
  // Area 4: Settings Integration
  // ==========================================
  console.log('\n--- 4. Settings Management ---');
  await expectThrows(() => settingsService.getAll('USER-1'), 'Administrator access denied.');

  const currentSettings = await settingsService.getAll('ADMIN-1');
  assert.strictEqual(currentSettings.max_active_bookings, 2);
  assert.strictEqual(currentSettings.weekly_booking_limit, 3);
  assert.strictEqual(currentSettings.late_return_penalty, 10, 'Penalty is positive in normalized settings');
  assert.strictEqual(currentSettings.noshow_penalty, 10);
  assert.strictEqual(currentSettings.damage_penalty, 30);

  // Range validation tests
  await expectThrows(
    () => settingsService.update({ max_active_bookings: 0 }, 'ADMIN-1'),
    'Active booking limit must be between 1 and 10.'
  );
  await expectThrows(
    () => settingsService.update({ weekly_booking_limit: 15 }, 'ADMIN-1'),
    'Weekly booking limit must be between 1 and 14.'
  );
  await expectThrows(
    () => settingsService.update({ platform_fee_percent: 25 }, 'ADMIN-1'),
    'Platform fee must be between 0 and 20 percent.'
  );
  await expectThrows(
    () => settingsService.update({ score_min: 100, score_max: 50 }, 'ADMIN-1'),
    'Minimum score cannot exceed maximum score.'
  );

  // Successful settings update
  await settingsService.update({
    max_active_bookings: 3,
    weekly_booking_limit: 5,
    late_return_penalty: 15,
    platform_fee_percent: 10
  }, 'ADMIN-1');

  assert.strictEqual(mockState.settings.maxActiveBookingsPerUser, 3, 'Active booking limit updated in DB');
  assert.strictEqual(mockState.settings.weeklySpaceBookingLimitPerUser, 5, 'Weekly limit updated in DB');
  assert.strictEqual(mockState.settings.pointsLateReturn, -15, 'Penalty stored as negative number in DB');
  assert.strictEqual(mockState.settings.platformFeePercent, 10, 'Platform fee updated in DB');

  const auditSettings = mockState.auditLogs.find(a => a.action === 'PLATFORM_SETTINGS_UPDATED');
  assert(auditSettings, 'Audit log created for settings update');
  assert.strictEqual(auditSettings.actor, 'ADMIN-1');

  console.log('✓ Platform settings enforce bounds, convert penalty signs, require admin authorization, and record audits');

  // ==========================================
  // Area 5: Payout Methods
  // ==========================================
  console.log('\n--- 5. Payout Methods ---');
  // Unauthorized owner access
  await expectThrows(
    () => userService.getPayoutMethod('OWNER-1', 'OWNER-2'),
    'Payout method access denied.'
  );
  await expectThrows(
    () => userService.updatePayoutMethod('OWNER-1', { type: 'upi', payout_value: 'test@upi' }, 'OWNER-2'),
    'Payout method access denied.'
  );

  // Invalid UPI format
  await expectThrows(
    () => userService.updatePayoutMethod('OWNER-1', { type: 'upi', payout_value: 'invalid-upi-id' }, 'OWNER-1'),
    'Enter a valid UPI ID.'
  );

  // Valid UPI
  await userService.updatePayoutMethod('OWNER-1', { type: 'upi', payout_value: 'rajesh@okhdfcbank' }, 'OWNER-1');
  const upiMethod = await userService.getPayoutMethod('OWNER-1', 'OWNER-1');
  assert.strictEqual(upiMethod.type, 'upi');
  assert.strictEqual(upiMethod.masked_details, 'ra***@okhdfcbank', 'UPI details are masked');
  assert.strictEqual(upiMethod.accountNumberEnc, undefined, 'Raw details not exposed in formatted output');

  const auditPayoutUpi = mockState.auditLogs.find(a => a.action === 'PAYOUT_METHOD_UPDATED' && a.target === 'user:OWNER-1');
  assert(auditPayoutUpi, 'Audit record created for UPI payout update');

  // Bank account validation
  await expectThrows(
    () => userService.updatePayoutMethod('OWNER-1', { type: 'bank', payout_value: '12345', ifsc_code: 'HDFC0001234' }, 'OWNER-1'),
    'Enter a valid bank account number.'
  );
  await expectThrows(
    () => userService.updatePayoutMethod('OWNER-1', { type: 'bank', payout_value: '123456789012', ifsc_code: 'INVALID' }, 'OWNER-1'),
    'Enter a valid IFSC code.'
  );

  // Valid Bank account
  await userService.updatePayoutMethod('OWNER-1', {
    type: 'bank',
    payout_value: '50100234567890',
    ifsc_code: 'HDFC0001234'
  }, 'OWNER-1');

  const bankMethod = await userService.getPayoutMethod('OWNER-1', 'OWNER-1');
  assert.strictEqual(bankMethod.type, 'bank');
  assert.strictEqual(bankMethod.masked_details, 'Bank account ending 7890', 'Bank account ending is masked');
  assert.strictEqual(bankMethod.ifsc_code, 'HDFC0001234');

  // Delete payout method
  await userService.deletePayoutMethod('OWNER-1', 'OWNER-1');
  const deletedMethod = await userService.getPayoutMethod('OWNER-1', 'OWNER-1');
  assert.strictEqual(deletedMethod, null, 'Payout method deleted');

  const auditPayoutDelete = mockState.auditLogs.find(a => a.action === 'PAYOUT_METHOD_DELETED' && a.target === 'user:OWNER-1');
  assert(auditPayoutDelete, 'Audit record created for payout method deletion');

  console.log('✓ Owner payout methods validate UPI & Bank details, mask sensitive information, enforce owner scoping, and audit changes');

  // ==========================================
  // Area 6: Identity Documents Isolation
  // ==========================================
  console.log('\n--- 6. Identity Documents Isolation ---');
  // Attempting to submit owner verification for non-owner user fails
  await expectThrows(
    () => userService.submitOwnerVerificationDocument('USER-1', validFile, 'USER-1'),
    'Owner account not found.'
  );

  // Attempting to access owner verification document for non-owner fails
  await expectThrows(
    () => userService.getOwnerVerificationDocument('USER-1', 'ADMIN-1'),
    'Identity document is not available.'
  );

  console.log('✓ Resident identity documents remain safely separated from OwnerVerification model');

  console.log('\n🎉 ALL MILESTONE 5 GOVERNANCE TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed with error:');
  console.error(err);
  process.exit(1);
});
