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
require('./testSpaceServiceMock');
require('./testBookingServiceMock');
require('./testOperationalServiceMocks');
const app = require('../app');

async function runAuthTests() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`🔐 Running BORO Auth & Access Control Tests on port ${port}...\n`);

  let failures = [];
  let passes = 0;

  async function csrfFor(path, cookie = '') {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: 'manual'
    });
    const responseCookie = (response.headers.get('set-cookie') || '').split(';')[0];
    const html = await response.text();
    const token = (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    return { cookie: cookie || responseCookie, token };
  }

  async function postForm(path, data, cookie = '', tokenPath = '/login') {
    const csrf = await csrfFor(tokenPath, cookie);
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (csrf.cookie) headers.cookie = csrf.cookie;
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ ...data, _csrf: csrf.token }).toString(),
      redirect: 'manual'
    });
  }

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
    const userLoginRes = await postForm('/login', {
      email: 'priya@demo.com',
      password: 'demo123'
    });
    const userCookie = userLoginRes.headers.get('set-cookie') || '';
    const userLocation = userLoginRes.headers.get('location') || '';
    assert(userLoginRes.status === 302 && userLocation === '/search', 'User login redirects to /search');

    // 2. Test POST /login for Owner (Rajesh Kumar)
    const ownerLoginRes = await postForm('/login', {
      email: 'rajesh@demo.com',
      password: 'demo123'
    });
    const ownerCookie = ownerLoginRes.headers.get('set-cookie') || '';
    const ownerLocation = ownerLoginRes.headers.get('location') || '';
    assert(ownerLoginRes.status === 302 && ownerLocation === '/owner/requests', 'Owner login redirects to /owner/requests');

    // 3. Test POST /login for Admin (Amit Verma)
    const adminLoginRes = await postForm('/login', {
      email: 'admin@demo.com',
      password: 'demo123'
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
    const adminLocation = adminLoginRes.headers.get('location') || '';
    assert(adminLoginRes.status === 302 && adminLocation === '/admin/overview', 'Admin login redirects to /admin/overview');

    // 4. Test Invalid Password
    const invalidLoginRes = await postForm('/login', {
      email: 'priya@demo.com',
      password: 'wrongpassword'
    });
    assert(invalidLoginRes.status === 302 && invalidLoginRes.headers.get('location') === '/login', 'Invalid password redirects back to /login');

    // 5. Verify suspended accounts cannot authenticate
    const suspendedLoginRes = await postForm('/login', {
      email: 'suspended@demo.com',
      password: 'demo123'
    });
    assert(
      suspendedLoginRes.status === 302 && suspendedLoginRes.headers.get('location') === '/login',
      'Suspended account redirects back to /login'
    );

    // 6. Verify owner registration creates an active account that can log in
    const ownerRegistrationRes = await postForm('/signup', {
        name: 'New Owner',
        email: 'new-owner@demo.com',
        phone: '+91 90000 00002',
        password: 'ownerpass',
        confirm_password: 'ownerpass',
        role: 'owner',
        organisation: 'Test Organisation'
      }, '', '/signup');
    assert(
      ownerRegistrationRes.status === 302 && ownerRegistrationRes.headers.get('location') === '/login',
      'Owner registration redirects to /login'
    );

    const newOwnerLoginRes = await postForm('/login', {
        email: 'new-owner@demo.com',
        password: 'ownerpass'
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
    const invalidSignupRes = await postForm('/signup', {
        name: 'Test User',
        email: 'test@demo.com',
        password: 'one',
        confirm_password: 'two'
      }, '', '/signup');
    assert(
      invalidSignupRes.status === 302 && invalidSignupRes.headers.get('location') === '/signup',
      'Registration rejects mismatched passwords'
    );

    // 8. Verify an authenticated user can update their own profile
    const profileUpdateRes = await postForm('/profile', {
        name: 'Priya Updated',
        phone: '+91 90000 00001'
      }, userCookie, '/profile');
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

    const unauthenticatedUploadRes = await fetch(`${baseUrl}/owner/spaces`, {
      method: 'POST',
      redirect: 'manual'
    });
    assert(
      unauthenticatedUploadRes.status === 403,
      'Unauthenticated listing upload is rejected before mutation'
    );

    const unauthorizedDocumentRes = await fetch(`${baseUrl}/admin/listings/SP-001/document`, {
      headers: { cookie: userCookie },
      redirect: 'manual'
    });
    assert(
      unauthorizedDocumentRes.status === 403,
      'Standard users cannot retrieve admin listing documents'
    );

    const unauthorizedQueueRes = await fetch(`${baseUrl}/admin/listings`, {
      headers: { cookie: userCookie },
      redirect: 'manual'
    });
    assert(
      unauthorizedQueueRes.status === 403,
      'Standard users cannot access the listing review queue'
    );

    const unauthorizedOwnerQueueRes = await fetch(`${baseUrl}/admin/listings`, {
      headers: { cookie: ownerCookie },
      redirect: 'manual'
    });
    assert(
      unauthorizedOwnerQueueRes.status === 403,
      'Owners cannot access the listing review queue'
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
    const logoutRes = await postForm('/logout', {}, userCookie, '/profile');
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
