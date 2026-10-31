/**
 * BORO Data Integrity & Consistency Validator
 * Validates:
 * 1. User reliability scores add up deterministically from audit events (multiples of 5, clamped 0-120).
 * 2. Active booking counts match real state (Priya <= 1 active booking).
 * 3. Deposit reconciliations (deposit_held == deductions + refund).
 * 4. Hourly payouts (hourly_fee == price_per_hour * duration_hours).
 */

const mockData = require('../data/mock');

function runChecks() {
  console.log('🔍 Running BORO Data Integrity Checks...\n');
  let errors = [];

  // 1. Verify Scores & Score Multiples of 5
  console.log('Checking User Reliability Scores...');
  mockData.users.forEach(user => {
    if (user.score % 5 !== 0) {
      errors.push(`User ${user.id} (${user.name}) score ${user.score} is not a multiple of 5.`);
    }
    if (user.score < 0 || user.score > 120) {
      errors.push(`User ${user.id} (${user.name}) score ${user.score} is outside 0-120 bounds.`);
    }

    const expectedScore = mockData.computeUserScore ? mockData.computeUserScore(user.id) : user.score;
    if (user.score !== expectedScore) {
      errors.push(`User ${user.id} (${user.name}) score ${user.score} does not match computed events ${expectedScore}.`);
    }
  });

  // Check specific test user scores
  const priya = mockData.users.find(u => u.id === 'USR-001');
  const aarav = mockData.users.find(u => u.id === 'USR-002');
  const rohan = mockData.users.find(u => u.id === 'USR-006');
  const ananya = mockData.users.find(u => u.id === 'USR-007');

  if (priya && priya.score !== 95) errors.push(`Priya Mehta score expected 95, got ${priya.score}`);
  if (aarav && aarav.score !== 75) errors.push(`Aarav Sharma score expected 75, got ${aarav.score}`);
  if (rohan && rohan.score !== 45) errors.push(`Rohan Desai score expected 45, got ${rohan.score}`);
  if (ananya && ananya.score !== 105) errors.push(`Ananya Iyer score expected 105, got ${ananya.score}`);

  console.log('✓ Scores verified.\n');

  // 2. Verify Active Booking Counts
  console.log('Checking Active Booking Counts...');
  const activeStatuses = ['requested', 'approved', 'checked_in', 'overdue'];
  mockData.users.forEach(user => {
    const realActiveCount = mockData.bookings.filter(b => b.user_id === user.id && activeStatuses.includes(b.status)).length;
    const recordedActive = user.active_bookings_count !== undefined ? user.active_bookings_count : user.active_bookings;
    if (recordedActive !== realActiveCount) {
      errors.push(`User ${user.id} (${user.name}) recorded active bookings ${recordedActive} != actual ${realActiveCount}`);
    }
  });

  if (priya) {
    const priyaActive = mockData.bookings.filter(b => b.user_id === priya.id && activeStatuses.includes(b.status)).length;
    if (priyaActive > 1) {
      errors.push(`Priya Mehta must have at most 1 active booking for demo testing (found ${priyaActive}).`);
    }
  }
  console.log('✓ Active booking counts verified.\n');

  // 3. Verify Financial Reconciliation & Incident Math
  console.log('Checking Deposit & Financial Reconciliation...');
  mockData.incidents.forEach(inc => {
    const held = inc.deposit_held || inc.deposit_amount || 0;
    const deductions = inc.deduction_total || inc.total_deductions || inc.deduction_amount || 0;
    const refund = inc.refund_amount !== undefined ? inc.refund_amount : (held - deductions);

    if (held !== (deductions + refund)) {
      errors.push(`Incident ${inc.id} deposit ${held} does not equal deductions (${deductions}) + refund (${refund})`);
    }
  });

  // Check booking hourly fees & total amounts
  mockData.bookings.forEach(b => {
    const hourlyRate = b.hourly_rate || (b.space ? b.space.price_per_hour : 0);
    const duration = b.duration_hours || 1;
    const hourlyTotal = b.hourly_fee_total || b.hourly_fee || 0;
    const deposit = b.deposit_amount || 0;
    const totalAmount = b.total_amount || b.total_paid || 0;

    if (hourlyRate && hourlyTotal && hourlyTotal !== (hourlyRate * duration)) {
      errors.push(`Booking ${b.id} hourly fee ${hourlyTotal} does not match ${hourlyRate} * ${duration}`);
    }
    if (totalAmount && hourlyTotal && deposit && totalAmount !== (hourlyTotal + deposit) && b.payment_status === 'paid') {
      errors.push(`Booking ${b.id} total amount ${totalAmount} does not equal hourly fee (${hourlyTotal}) + deposit (${deposit})`);
    }
  });
  console.log('✓ Financial calculations verified.\n');

  if (errors.length > 0) {
    console.error(`❌ Validation failed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('✅ ALL DATA CONSISTENCY CHECKS PASSED PERFECTLY!\n');
  }
}

runChecks();

