/**
 * Lightweight Session & Flash Middleware for Frontend Demo
 * Provides req.session, req.flash(type, msg), and res.locals.flash
 */

const crypto = require('crypto');

const memoryStore = new Map();

function parseCookies(cookieHeader = '') {
  const list = {};
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

function sessionMiddleware(options = {}) {
  const cookieName = options.name || 'boro.sid';
  const maxAge = options.maxAge || 24 * 60 * 60 * 1000;
  const isProduction = process.env.NODE_ENV === 'production';

  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies[cookieName];
    let session = sid && memoryStore.get(sid);

    if (!session || session.expiresAt <= Date.now()) {
      if (sid) memoryStore.delete(sid);
      sid = crypto.randomBytes(16).toString('hex');
      session = { flash: {}, createdAt: Date.now(), expiresAt: Date.now() + maxAge };
      memoryStore.set(sid, session);
      res.setHeader('Set-Cookie', buildCookie(cookieName, sid, maxAge, isProduction));
    }

    req.session = session;
    req.session.expiresAt = Date.now() + maxAge;
    if (!req.session.flash) req.session.flash = {};

    // Standard session lifecycle methods
    req.session.regenerate = (callback) => {
      const returnTo = req.session.returnTo;
      memoryStore.delete(sid);
      sid = crypto.randomBytes(16).toString('hex');
      const newSession = {
        flash: {},
        returnTo,
        createdAt: Date.now(),
        expiresAt: Date.now() + maxAge
      };
      memoryStore.set(sid, newSession);
      req.session = newSession;
      res.setHeader('Set-Cookie', buildCookie(cookieName, sid, maxAge, isProduction));
      if (typeof callback === 'function') callback();
    };

    req.session.destroy = (callback) => {
      memoryStore.delete(sid);
      req.session = {};
      res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`);
      if (typeof callback === 'function') callback();
    };

    // Implement flash function
    req.flash = (type, message) => {
      if (!req.session.flash) req.session.flash = {};
      if (message !== undefined) {
        if (!req.session.flash[type]) req.session.flash[type] = [];
        req.session.flash[type].push(message);
      } else {
        const msgs = req.session.flash[type] || [];
        delete req.session.flash[type];
        return msgs;
      }
    };

    // Expose flash messages to views
    res.locals.flash = {
      success: req.flash('success') || [],
      error: req.flash('error') || [],
      warning: req.flash('warning') || [],
      info: req.flash('info') || []
    };

    next();
  };
}

function buildCookie(name, value, maxAge, secure) {
  return `${name}=${value}; Path=/; Max-Age=${Math.floor(maxAge / 1000)}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

module.exports = sessionMiddleware;
