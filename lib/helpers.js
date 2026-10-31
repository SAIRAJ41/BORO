/**
 * EJS Template View Helpers for BORO
 *
 * Formats raw numbers and raw ISO dates for presentation using:
 * - Locale: en-IN
 * - Timezone: Asia/Kolkata (+05:30)
 */

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(isoOrTimeString) {
  if (!isoOrTimeString) return '';
  if (typeof isoOrTimeString === 'string' && isoOrTimeString.includes(':') && !isoOrTimeString.includes('T')) {
    // Already in HH:MM format
    const [h, m] = isoOrTimeString.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  }
  const d = new Date(isoOrTimeString);
  if (isNaN(d.getTime())) return isoOrTimeString;
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatSpaceType(type) {
  switch (type) {
    case 'community_hall': return 'Community Hall';
    case 'community_ground': return 'Community Ground';
    case 'school_playground': return 'School Playground';
    case 'small_room': return 'Small Room';
    case 'storeroom': return 'Storeroom';
    default: return type ? type.replace(/_/g, ' ') : 'Space';
  }
}

function formatStatus(status) {
  switch (status) {
    case 'requested': return 'Requested';
    case 'approved': return 'Confirmed & Approved';
    case 'rejected': return 'Rejected';
    case 'waitlisted': return 'Waitlisted';
    case 'checked_in': return 'Checked-in';
    case 'returned': return 'Returned & Verified';
    case 'overdue': return 'Overdue Return';
    case 'damaged': return 'Incident / Damaged';
    case 'cancelled': return 'Cancelled';
    case 'closed': return 'Closed & Settled';
    default: return status || '';
  }
}

function getUserInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function getScoreTier(score) {
  const s = Number(score) || 0;
  if (s >= 80) return { tier: 1, label: 'Tier 1 Community', description: 'Normal Access' };
  if (s >= 50) return { tier: 2, label: 'Tier 2 Community', description: 'Owner Approval Required' };
  return { tier: 3, label: 'Tier 3 Community', description: 'Owner Review with Advisory Warning' };
}

function formatPaymentMethod(method) {
  switch (method) {
    case 'upi': return 'UPI (Demo Instant)';
    case 'card': return 'Credit / Debit Card';
    case 'net_banking': return 'Net Banking';
    case 'pay_at_venue': return 'Pay at venue';
    case 'bank_transfer': return 'Bank Transfer';
    default: return method ? method.replace(/_/g, ' ') : 'N/A';
  }
}

module.exports = {
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  formatSpaceType,
  formatStatus,
  formatPaymentMethod,
  getUserInitials,
  getScoreTier
};
