/**
 * EJS Rendering Engine for Express
 * Provides standard EJS template compilation, partial inclusion, and HTML escaping.
 */

const fs = require('fs');
const path = require('path');
const helpers = require('./helpers');

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compileEjs(templateStr, viewDir, rootViewsDir) {
  let js = 'let __out = []; with (locals || {}) {\n';
  let cursor = 0;
  const regex = /<%(?:([=-])|#)?([\s\S]*?)%>/g;
  let match;

  while ((match = regex.exec(templateStr)) !== null) {
    const textBefore = templateStr.slice(cursor, match.index);
    if (textBefore) {
      js += '__out.push(' + JSON.stringify(textBefore) + ');\n';
    }
    const mode = match[1]; // '=' or '-' or undefined
    const code = match[2].trim();

    if (mode === '=') {
      js += '__out.push(escapeHtml(' + code + '));\n';
    } else if (mode === '-') {
      js += '__out.push(String(' + code + ' == null ? "" : ' + code + '));\n';
    } else if (match[0].startsWith('<%#')) {
      // Comment, ignore
    } else {
      js += code + '\n';
    }
    cursor = regex.lastIndex;
  }
  const textAfter = templateStr.slice(cursor);
  if (textAfter) {
    js += '__out.push(' + JSON.stringify(textAfter) + ');\n';
  }
  js += '} return __out.join("");';

  const fn = new Function('locals', 'include', 'escapeHtml', js);
  return fn;
}

function resolveIncludePath(relPath, currentDir, rootViewsDir) {
  let target = relPath;
  if (!target.endsWith('.ejs')) target += '.ejs';
  // Try relative to currentDir
  let p = path.resolve(currentDir, target);
  if (fs.existsSync(p)) return p;
  // Try relative to rootViewsDir
  p = path.resolve(rootViewsDir, target);
  if (fs.existsSync(p)) return p;
  // Try relative to rootViewsDir/partials
  p = path.resolve(rootViewsDir, 'partials', target);
  if (fs.existsSync(p)) return p;
  return null;
}

function renderFileSync(filePath, locals, rootViewsDir) {
  const templateStr = fs.readFileSync(filePath, 'utf8');
  const viewDir = path.dirname(filePath);
  const compiled = compileEjs(templateStr, viewDir, rootViewsDir);

  const fullLocals = { ...helpers, ...(locals || {}) };

  const include = (relPath, includeLocals = {}) => {
    const resolved = resolveIncludePath(relPath, viewDir, rootViewsDir);
    if (!resolved) {
      throw new Error(`EJS include not found: "${relPath}" from "${filePath}"`);
    }
    return renderFileSync(resolved, { ...fullLocals, ...includeLocals }, rootViewsDir);
  };

  return compiled(fullLocals, include, escapeHtml);
}

function expressEjsEngine(filePath, options, callback) {
  try {
    const rootViewsDir = options.settings.views || path.resolve(process.cwd(), 'views');
    const pageContent = renderFileSync(filePath, options, rootViewsDir);

    // If layout is explicitly false or this is already a layout file, render as-is
    if (options.layout === false || filePath.includes(path.sep + 'layouts' + path.sep)) {
      return callback(null, pageContent);
    }

    const layoutName = typeof options.layout === 'string' ? options.layout : 'layouts/main';
    const layoutPath = resolveIncludePath(layoutName, path.dirname(filePath), rootViewsDir);
    if (layoutPath && fs.existsSync(layoutPath)) {
      const layoutResult = renderFileSync(layoutPath, { ...options, body: pageContent }, rootViewsDir);
      return callback(null, layoutResult);
    }

    callback(null, pageContent);
  } catch (err) {
    callback(err);
  }
}

module.exports = {
  expressEjsEngine,
  renderFileSync,
  escapeHtml
};
