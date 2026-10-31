/**
 * Authentication & Authorization Integration Test
 * Verifies:
 * 1. POST /login credentials check for seeded demo accounts (user, owner, admin)
 * 2. Proper role-based redirection on successful authentication
 * 3. 403 Forbidden enforcement on /owner/requests for standard user account
 * 4. 302 Redirect to /login on protected routes when signed out
 */

const http = require('http');
require('./testUserServiceMock');
const app = require('../app');

async function runAuthTests() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`🔐 Running BORO Auth & Access Control Tests on port ${port}...\n`);

  let failures = [];
  let passes = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passes++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failures.push(testName);
    }
  }

  try {
    // 1. Test POST /login for User (Priya Mehta)
    const userLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'priya@demo.com', password: 'demo123' }).toString(),
      redirect: 'manual'
    });
    const userCookie = userLoginRes.headers.get('set-cookie') || '';
    const userLocation = userLoginRes.headers.get('location') || '';
    assert(userLoginRes.status === 302 && userLocation === '/search', 'User login redirects to /search');

    // 2. Test POST /login for Owner (Rajesh Kumar)
    const ownerLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'rajesh@demo.com', password: 'demo123' }).toString(),
      redirect: 'manual'
    });
    const ownerCookie = ownerLoginRes.headers.get('set-cookie') || '';
    const ownerLocation = ownerLoginRes.headers.get('location') || '';
    assert(ownerLoginRes.status === 302 && ownerLocation === '/owner/requests', 'Owner login redirects to /owner/requests');

    // 3. Test POST /login for Admin (Amit Verma)
    const adminLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'admin@demo.com', password: 'demo123' }).toString(),
      redirect: 'manual'
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
    const adminLocation = adminLoginRes.headers.get('location') || '';
    assert(adminLoginRes.status === 302 && adminLocation === '/admin/overview', 'Admin login redirects to /admin/overview');

    // 4. Test Invalid Password
    const invalidLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'priya@demo.com', password: 'wrongpassword' }).toString(),
      redirect: 'manual'
    });
    assert(invalidLoginRes.status === 302 && invalidLoginRes.headers.get('location') === '/login', 'Invalid password redirects back to /login');

    // 5. Verify suspended accounts cannot authenticate
    const suspendedLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'suspended@demo.com', password: 'demo123' }).toString(),
      redirect: 'manual'
    });
    assert(
      suspendedLoginRes.status === 302 && suspendedLoginRes.headers.get('location') === '/login',
      'Suspended account redirects back to /login'
    );

    // 6. Verify owner registration creates an active account that can log in
    const ownerRegistrationRes = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        name: 'New Owner',
        email: 'new-owner@demo.com',
        phone: '+91 90000 00002',
        password: 'ownerpass',
        confirm_password: 'ownerpass',
        role: 'owner',
        organisation: 'Test Organisation'
      }).toString(),
      redirect: 'manual'
    });
    assert(
      ownerRegistrationRes.status === 302 && ownerRegistrationRes.headers.get('location') === '/login',
      'Owner registration redirects to /login'
    );

    const newOwnerLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: 'new-owner@demo.com',
        password: 'ownerpass'
      }).toString(),
      redirect: 'manual'
    });
    const newOwnerCookie = newOwnerLoginRes.headers.get('set-cookie') || '';
    assert(
      newOwnerLoginRes.status === 302 && newOwnerLoginRes.headers.get('location') === '/owner/requests',
      'Newly registered owner can log in immediately'
    );
    const newOwnerDashboardRes = await fetch(`${baseUrl}/owner/spaces/add`, {
      headers: { cookie: newOwnerCookie },
      redirect: 'manual'
    });
    assert(
      newOwnerDashboardRes.status === 200,
      'Newly registered owner can access listing dashboard without verification'
    );

    // 7. Verify registration validation rejects mismatched passwords
    const invalidSignupRes = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        name: 'Test User',
        email: 'test@demo.com',
        password: 'one',
        confirm_password: 'two'
      }).toString(),
      redirect: 'manual'
    });
    assert(
      invalidSignupRes.status === 302 && invalidSignupRes.headers.get('location') === '/signup',
      'Registration rejects mismatched passwords'
    );

    // 8. Verify an authenticated user can update their own profile
    const profileUpdateRes = await fetch(`${baseUrl}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        cookie: userCookie
      },
      body: new URLSearchParams({
        name: 'Priya Updated',
        phone: '+91 90000 00001'
      }).toString(),
      redirect: 'manual'
    });
    assert(
      profileUpdateRes.status === 302 && profileUpdateRes.headers.get('location') === '/profile',
      'Authenticated user profile update redirects to /profile'
    );

    // 9. Verify /owner/requests returns 403 Forbidden for User account
    const forbiddenRes = await fetch(`${baseUrl}/owner/requests`, {
      headers: { cookie: userCookie },
      redirect: 'manual'
    });
    assert(forbiddenRes.status === 403, '/owner/requests returns 403 Forbidden for User account');

    // 10. Verify /owner/requests redirects to /login when signed out
    const unauthenticatedRes = await fetch(`${baseUrl}/owner/requests`, {
      redirect: 'manual'
    });
    assert(
      unauthenticatedRes.status === 302 && unauthenticatedRes.headers.get('location') === '/login',
      '/owner/requests redirects to /login when signed out'
    );

    // 11. Verify Owner can access /owner/requests (200 OK)
    const ownerAccessRes = await fetch(`${baseUrl}/owner/requests`, {
      headers: { cookie: ownerCookie }
    });
    assert(ownerAccessRes.status === 200, 'Owner can access /owner/requests (200 OK)');

    // 12. Verify Admin can access /admin/overview (200 OK)
    const adminAccessRes = await fetch(`${baseUrl}/admin/overview`, {
      headers: { cookie: adminCookie }
    });
    assert(adminAccessRes.status === 200, 'Admin can access /admin/overview (200 OK)');

    // 13. Verify logout destroys the authenticated session
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { cookie: userCookie },
      redirect: 'manual'
    });
    assert(
      logoutRes.status === 302 && logoutRes.headers.get('location') === '/login',
      'Logout redirects to /login'
    );

    const afterLogoutRes = await fetch(`${baseUrl}/profile`, {
      headers: { cookie: userCookie },
      redirect: 'manual'
    });
    assert(
      afterLogoutRes.status === 302 && afterLogoutRes.headers.get('location') === '/login',
      'Logged-out session cannot access protected routes'
    );

  } catch (err) {
    failures.push(`Execution error: ${err.message}`);
    console.error(err);
  } finally {
    server.close();
  }

  console.log(`\nResults: ${passes} passed, ${failures.length} failed.\n`);
  if (failures.length > 0) {
    console.error('❌ Test suite failed.');
    process.exit(1);
  } else {
    console.log('✅ ALL AUTH & ACCESS CONTROL TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runAuthTests();
