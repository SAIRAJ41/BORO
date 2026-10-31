/**
 * Comprehensive Route & Template Render Tester
 * Boots the app in-memory and verifies every GET endpoint returns 200 OK.
 */

const http = require('http');
require('./testUserServiceMock');
require('./testSpaceServiceMock');
require('./testBookingServiceMock');
require('./testIncidentServiceMock');
require('./testOperationalServiceMocks');
const app = require('../app');

const routesToTest = [
  // Auth & General
  { path: '/login', role: 'user', expectedStatus: 200 },
  { path: '/signup', role: 'user', expectedStatus: 200 },
  { path: '/profile', role: 'user', expectedStatus: 200 },

  // Role Switchers (expect 302 redirect)
  { path: '/demo/user', role: 'user', expectedStatus: 404 },
  { path: '/demo/owner', role: 'user', expectedStatus: 404 },
  { path: '/demo/admin', role: 'user', expectedStatus: 404 },

  // User Views
  { path: '/', role: 'user', expectedStatus: 200 },
  { path: '/search', role: 'user', expectedStatus: 200 },
  { path: '/search?space_type=community_hall', role: 'user', expectedStatus: 200 },
  { path: '/spaces/SP-001', role: 'user', expectedStatus: 200 },
  { path: '/spaces/SP-002', role: 'user', expectedStatus: 200 },
  { path: '/bookings/BK-1001/receipt', role: 'user', expectedStatus: 200 },
  { path: '/my-bookings', role: 'user', expectedStatus: 200 },
  { path: '/my-bookings?tab=waitlisted', role: 'user', expectedStatus: 200 },
  { path: '/my-bookings?tab=completed', role: 'user', expectedStatus: 200 },
  { path: '/my-bookings?tab=all', role: 'user', expectedStatus: 200 },
  { path: '/my-score', role: 'user', expectedStatus: 200 },
  { path: '/history', role: 'user', expectedStatus: 200 },
  { path: '/notifications', role: 'user', expectedStatus: 200 },
  { path: '/notifications?filter=unread', role: 'user', expectedStatus: 200 },

  // Owner Views
  { path: '/owner/requests', role: 'owner', expectedStatus: 200 },
  { path: '/owner/my-spaces', role: 'owner', expectedStatus: 200 },
  { path: '/owner/spaces/SP-001', role: 'owner', expectedStatus: 200 },
  { path: '/owner/spaces/add', role: 'owner', expectedStatus: 200 },
  { path: '/owner/spaces/SP-001/edit', role: 'owner', expectedStatus: 200 },
  { path: '/owner/spaces/SP-001/document', role: 'owner', expectedStatus: 200 },
  { path: '/owner/calendar', role: 'owner', expectedStatus: 200 },
  { path: '/owner/today', role: 'owner', expectedStatus: 200 },
  { path: '/owner/incidents', role: 'owner', expectedStatus: 200 },
  { path: '/owner/history', role: 'owner', expectedStatus: 200 },
  { path: '/owner/earnings', role: 'owner', expectedStatus: 200 },
  { path: '/owner/verification-document', role: 'owner', expectedStatus: 302 },

  // Admin Views
  { path: '/admin/overview', role: 'admin', expectedStatus: 200 },
  { path: '/admin/listings', role: 'admin', expectedStatus: 200 },
  { path: '/admin/listings/SP-001', role: 'admin', expectedStatus: 200 },
  { path: '/admin/listings/SP-001/document', role: 'admin', expectedStatus: 200 },
  { path: '/admin/verify-owners', role: 'admin', expectedStatus: 200 },
  { path: '/admin/owners/USR-003/document', role: 'admin', expectedStatus: 302 },
  { path: '/admin/users', role: 'admin', expectedStatus: 200 },
  { path: '/admin/users?q=Priya', role: 'admin', expectedStatus: 200 },
  { path: '/admin/disputes', role: 'admin', expectedStatus: 200 },
  { path: '/admin/audit-log', role: 'admin', expectedStatus: 200 },
  { path: '/admin/audit-log?action=BOOKING', role: 'admin', expectedStatus: 200 },
  { path: '/admin/settings', role: 'admin', expectedStatus: 200 },

  // 404 Route
  { path: '/non-existent-page', role: 'user', expectedStatus: 404 }
];

async function testAll() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Testing BORO routes on ephemeral port ${port}...\n`);

  let failures = [];
  let successCount = 0;
  const sessions = {};

  async function loginAs(role) {
    const credentials = {
      user: ['priya@demo.com', 'demo123'],
      owner: ['rajesh@demo.com', 'demo123'],
      admin: ['admin@demo.com', 'demo123']
    }[role];
    const page = await fetch(`http://localhost:${port}/login`);
    const pageCookie = (page.headers.get('set-cookie') || '').split(';')[0];
    const html = await page.text();
    const csrfToken = (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    const login = await fetch(`http://localhost:${port}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: pageCookie },
      body: new URLSearchParams({
        email: credentials[0],
        password: credentials[1],
        _csrf: csrfToken
      }).toString(),
      redirect: 'manual'
    });
    return (login.headers.get('set-cookie') || pageCookie).split(';')[0];
  }

  for (const item of routesToTest) {
    // Set session cookie for the role being tested
    let cookie = '';
    if (item.role) {
      if (!sessions[item.role]) sessions[item.role] = await loginAs(item.role);
      cookie = sessions[item.role];
    }

    try {
      const headers = {};
      if (cookie) headers['cookie'] = cookie;

      const res = await fetch(`http://localhost:${port}${item.path}`, {
        headers,
        redirect: 'manual'
      });

      if (res.status !== item.expectedStatus) {
        failures.push(`[${item.role.toUpperCase()}] ${item.path} returned status ${res.status} (expected ${item.expectedStatus})`);
      } else {
        successCount++;
        console.log(`✓ [${item.role.padEnd(5)}] ${item.path} -> ${res.status}`);
      }
    } catch (err) {
      failures.push(`[${item.role.toUpperCase()}] ${item.path} threw error: ${err.message}`);
    }
  }

  server.close();

  console.log(`\nResults: ${successCount} passed, ${failures.length} failed.\n`);
  if (failures.length > 0) {
    console.error('❌ Failures encountered:');
    failures.forEach(f => console.error('  - ' + f));
    process.exit(1);
  } else {
    console.log('🎉 ALL ROUTES AND VIEWS RENDERED WITH ZERO ERRORS!');
  }
}

testAll();
