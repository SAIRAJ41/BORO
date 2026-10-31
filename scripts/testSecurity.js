const http = require('http');
require('./testUserServiceMock');
require('./testSpaceServiceMock');
require('./testBookingServiceMock');
const app = require('../app');

function cookiePair(value) {
  return (value || '').split(';')[0];
}

async function run() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const baseUrl = `http://localhost:${server.address().port}`;
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      failures += 1;
      console.error(`FAIL: ${message}`);
    } else {
      console.log(`PASS: ${message}`);
    }
  }

  try {
    const loginPage = await fetch(`${baseUrl}/login`);
    const cookie = cookiePair(loginPage.headers.get('set-cookie'));
    const html = await loginPage.text();
    const token = (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    assert(loginPage.headers.get('x-content-type-options') === 'nosniff', 'Security headers are applied');

    const missing = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams({ email: 'priya@demo.com', password: 'demo123' }),
      redirect: 'manual'
    });
    assert(missing.status === 403, 'Missing CSRF token is rejected');

    const invalid = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams({ email: 'priya@demo.com', password: 'demo123', _csrf: 'invalid' }),
      redirect: 'manual'
    });
    assert(invalid.status === 403, 'Invalid CSRF token is rejected');

    const valid = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams({ email: 'priya@demo.com', password: 'demo123', _csrf: token }),
      redirect: 'manual'
    });
    const userCookie = cookiePair(valid.headers.get('set-cookie'));
    assert(valid.status === 302 && valid.headers.get('location') === '/search', 'Valid CSRF token permits login');

    const logoutPage = await fetch(`${baseUrl}/profile`, { headers: { cookie: userCookie } });
    const logoutHtml = await logoutPage.text();
    const logoutToken = (logoutHtml.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    const logout = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: userCookie },
      body: new URLSearchParams({ _csrf: logoutToken }),
      redirect: 'manual'
    });
    assert(logout.status === 302 && logout.headers.get('location') === '/login', 'Logout invalidates the session');

    const demo = await fetch(`${baseUrl}/demo/admin`, { redirect: 'manual' });
    assert(demo.status === 404, 'Demo role switching is not available through GET');

    const ratePage = await fetch(`${baseUrl}/login`);
    const rateCookie = cookiePair(ratePage.headers.get('set-cookie'));
    const rateHtml = await ratePage.text();
    const rateToken = (rateHtml.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    let rateLimited = false;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: rateCookie },
        body: new URLSearchParams({ email: 'bad@example.com', password: 'bad', _csrf: rateToken }),
        redirect: 'manual'
      });
      if (response.headers.get('retry-after')) rateLimited = true;
    }
    assert(rateLimited, 'Login attempts are rate limited');
  } finally {
    server.close();
  }

  if (failures) process.exit(1);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
