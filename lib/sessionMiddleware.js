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

  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies[cookieName];

    if (!sid || !memoryStore.has(sid)) {
      sid = crypto.randomBytes(16).toString('hex');
      memoryStore.set(sid, { flash: {} });
      res.setHeader('Set-Cookie', `${cookieName}=${sid}; Path=/; HttpOnly; SameSite=Lax`);
    }

    req.session = memoryStore.get(sid);
    if (!req.session.flash) req.session.flash = {};

    // Standard session lifecycle methods
    req.session.regenerate = (callback) => {
      memoryStore.delete(sid);
      sid = crypto.randomBytes(16).toString('hex');
      const newSession = { flash: {} };
      memoryStore.set(sid, newSession);
      req.session = newSession;
      res.setHeader('Set-Cookie', `${cookieName}=${sid}; Path=/; HttpOnly; SameSite=Lax`);
      if (typeof callback === 'function') callback();
    };

    req.session.destroy = (callback) => {
      memoryStore.delete(sid);
      req.session = {};
      res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`);
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

module.exports = sessionMiddleware;
