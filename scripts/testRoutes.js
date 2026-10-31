/**
 * Comprehensive Route & Template Render Tester
 * Boots the app in-memory and verifies every GET endpoint returns 200 OK.
 */

const http = require('http');
const app = require('../app');
const mockData = require('../data/mock');

const routesToTest = [
  // Auth & General
  { path: '/login', role: 'user', expectedStatus: 200 },
  { path: '/signup', role: 'user', expectedStatus: 200 },
  { path: '/profile', role: 'user', expectedStatus: 200 },

  // Role Switchers (expect 302 redirect)
  { path: '/demo/user', role: 'user', expectedStatus: 302 },
  { path: '/demo/owner', role: 'user', expectedStatus: 302 },
  { path: '/demo/admin', role: 'user', expectedStatus: 302 },

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
  { path: '/owner/spaces/add', role: 'owner', expectedStatus: 200 },
  { path: '/owner/spaces/SP-001/edit', role: 'owner', expectedStatus: 200 },
  { path: '/owner/calendar', role: 'owner', expectedStatus: 200 },
  { path: '/owner/today', role: 'owner', expectedStatus: 200 },
  { path: '/owner/incidents', role: 'owner', expectedStatus: 200 },
  { path: '/owner/history', role: 'owner', expectedStatus: 200 },
  { path: '/owner/earnings', role: 'owner', expectedStatus: 200 },

  // Admin Views
  { path: '/admin/overview', role: 'admin', expectedStatus: 200 },
  { path: '/admin/verify-owners', role: 'admin', expectedStatus: 200 },
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

  for (const item of routesToTest) {
    const roleUser = item.role === 'admin' 
      ? mockData.users.find(u => u.role === 'admin') 
      : (item.role === 'owner' ? mockData.users.find(u => u.role === 'owner') : mockData.users[0]);

    // Set session cookie for the role being tested
    let cookie = '';
    if (item.role) {
      const demoRes = await fetch(`http://localhost:${port}/demo/${item.role}`, { redirect: 'manual' });
      cookie = demoRes.headers.get('set-cookie') || '';
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

