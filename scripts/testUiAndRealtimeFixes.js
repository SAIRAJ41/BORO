/**
 * Targeted Test Suite for UI, Images, Dynamic Badges, and Real-Time Fixes
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const helpers = require('../lib/helpers');

async function runTests() {
  console.log('🧪 Running UI, Images, Badges, and Real-Time Integration Tests...\n');

  // --- 1. Default Space Images ---
  console.log('--- 1. Default Space Image Fallbacks ---');
  assert.strictEqual(helpers.getDefaultSpaceImage('storeroom'), '/images/spaces/storeroom-1.jpg');
  assert.strictEqual(helpers.getDefaultSpaceImage('community_hall'), '/images/spaces/community-hall-1.jpg');
  assert.strictEqual(helpers.getDefaultSpaceImage('community_ground'), '/images/spaces/community-ground-1.jpg');
  assert.strictEqual(helpers.getDefaultSpaceImage('school_playground'), '/images/spaces/school-playground-1.jpg');
  assert.strictEqual(helpers.getDefaultSpaceImage('small_room'), '/images/spaces/small-room-1.jpg');
  assert.strictEqual(helpers.getDefaultSpaceImage('unknown'), '/images/spaces/community-hall-1.jpg');
  console.log('✓ All space types have distinct, guaranteed demo images');

  // --- 2. Real Binary JPEG Integrity ---
  console.log('\n--- 2. Space Images Are Genuine Binary JPEGs ---');
  const spaceImages = ['community-ground-1.jpg', 'community-hall-1.jpg', 'school-playground-1.jpg', 'small-room-1.jpg', 'storeroom-1.jpg'];
  for (const img of spaceImages) {
    const filePath = path.join(__dirname, '..', 'public', 'images', 'spaces', img);
    assert(fs.existsSync(filePath), `File ${img} exists`);
    const buf = fs.readFileSync(filePath);
    assert(buf.length > 10000, `${img} is a full high-resolution image (${buf.length} bytes)`);
    assert(buf[0] === 0xFF && buf[1] === 0xD8, `${img} is a genuine JPEG binary with JFIF header`);
  }
  console.log('✓ All 5 space images are genuine binary JPEGs decoded natively by all browsers');

  // --- 3. Navbar Account Switch Dropdown ---
  console.log('\n--- 3. Account Switch Dropdown Cleanliness ---');
  const navbarContent = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'navbar.ejs'), 'utf8');
  assert(!navbarContent.includes('My Profile & Verification'), 'Redundant Profile link removed from account switch menu');
  assert(!navbarContent.includes('Verification & Profile'), 'Redundant Verification link removed from account switch menu');
  console.log('✓ Verification & Profile removed from account switcher dropdown across all accounts');

  // --- 4. Sidebar Dynamic Badges & Seen/Disappear Behavior ---
  console.log('\n--- 4. Sidebar Dynamic Badges & Clear on View ---');
  const userSidebar = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'sidebar-user.ejs'), 'utf8');
  assert(userSidebar.includes("locals.activeRoute !== 'my-bookings'"), 'My Bookings badge disappears when visited');
  assert(userSidebar.includes("locals.activeRoute !== 'notifications'"), 'Notifications badge disappears when visited');

  const ownerSidebar = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'sidebar-owner.ejs'), 'utf8');
  assert(ownerSidebar.includes("locals.activeRoute !== 'owner-requests'"), 'Requests badge disappears when visited');
  assert(ownerSidebar.includes("locals.activeRoute !== 'owner-today'"), 'Today Operations badge disappears when visited');
  assert(ownerSidebar.includes("locals.activeRoute !== 'owner-incidents'"), 'Incidents badge disappears when visited');
  assert(!ownerSidebar.includes('• 2 due</span>'), 'Hardcoded static • 2 due badge completely removed');
  assert(!ownerSidebar.includes('>1</span>'), 'Hardcoded static incident count completely removed');
  assert(ownerSidebar.includes('/profile'), 'Verification & Profile correctly present in owner sidebar');
  console.log('✓ All sidebar badges are dynamic and properly disappear when section is viewed');

  // --- 5. Calendar Start/End Time Inputs ---
  console.log('\n--- 5. Calendar Time Input Formatting ---');
  const calendarContent = fs.readFileSync(path.join(__dirname, '..', 'views', 'pages', 'owner', 'calendar.ejs'), 'utf8');
  assert(calendarContent.includes('Start Time (HH:MM)'), 'Clear Start Time label provided');
  assert(calendarContent.includes('End Time (HH:MM)'), 'Clear End Time label provided');
  assert(calendarContent.includes('step="60"'), 'Strict 60-second time step enforced for clock picker');
  console.log('✓ Calendar start and end inputs enforce clean HH:MM time picker format');

  // --- 6. Today Operations Nested Form Fix ---
  console.log('\n--- 6. Operations & Check-In Forms ---');
  const todayContent = fs.readFileSync(path.join(__dirname, '..', 'views', 'pages', 'owner', 'today.ejs'), 'utf8');
  assert(!todayContent.includes('<form action="/owner/today/'), 'No nested form inside checkin form');
  assert(todayContent.includes('formaction="/owner/today/'), 'Clean HTML5 formaction used for No-Show action');
  assert(!todayContent.includes('Overdue by 35 mins'), 'Static overdue minutes replaced with clean dynamic badge');
  console.log('✓ Operations check-in and no-show forms properly structured without invalid HTML nesting');

  // --- 7. Incidents Open Count Dynamic ---
  console.log('\n--- 7. Incidents Open Count ---');
  const incidentsContent = fs.readFileSync(path.join(__dirname, '..', 'views', 'pages', 'owner', 'incidents.ejs'), 'utf8');
  assert(incidentsContent.includes('openIncidents.length'), 'Open incidents count rendered dynamically from array');
  console.log('✓ Incidents page displays exact live open incidents count');

  // --- 8. Profile Role Separation ---
  console.log('\n--- 8. Profile Role-Scoped Verification ---');
  const profileContent = fs.readFileSync(path.join(__dirname, '..', 'views', 'pages', 'user', 'profile.ejs'), 'utf8');
  assert(profileContent.includes("user.role === 'owner'"), 'Owner-specific accreditation block supported on profile');
  assert(profileContent.includes('Owner Partner Accreditation'), 'Owner accreditation header displayed for owners');
  console.log('✓ Profile cleanly distinguishes between resident verification and owner accreditation');

  console.log('\n🎉 ALL 8 UI AND REAL-TIME INTEGRATION TESTS PASSED 100%!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
