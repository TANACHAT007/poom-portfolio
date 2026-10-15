// Exercises the error reporter in js/app.js. Two things matter and both are easy to get wrong:
// a crash loop must not flood the database, and a crash report must never turn into a second
// copy of someone's personal data.
//
// Run with:  npm test
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'js', 'app.js');
const START_MARKER = 'const ERR_PATH =';
const END_MARKER = '// Escape untrusted text before it goes anywhere near innerHTML.';

function errorSource() {
  const s = fs.readFileSync(APP, 'utf8');
  const start = s.indexOf(START_MARKER);
  const end = s.indexOf(END_MARKER);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not locate the error-reporting block in js/app.js — did the markers change?');
  }
  const block = s.slice(start, end).replace(/export (async )?function/g, '$1function');
  const names = [...block.matchAll(/(?:async )?function (\w+)/g)].map((m) => m[1]);
  return block + '\nmodule.exports = { ' + [...new Set(names)].join(', ') + ' };\n';
}

let writes, failWrite;

function load({ pathname = '/dashboard.html', search = '' } = {}) {
  writes = [];
  failWrite = false;
  const listeners = {};
  const sandbox = {
    console,
    module: { exports: {} },
    Promise, JSON, Date, String, Object, Set, Math,
    setTimeout, clearTimeout,
    location: { pathname, search },
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 10) Chrome/120', onLine: true },
    window: {
      innerWidth: 390, innerHeight: 844,
      addEventListener: (ev, fn) => { listeners[ev] = fn; },
    },
    db: {},
    p: (x) => x, // APP_ROOT helper from js/firebase.js (identity = own-project mode)
    ref: (_db, p) => ({ path: p }),
    push: () => ({ key: 'k' + (writes.length + 1) }),
    set: (r, data) => {
      if (failWrite) return Promise.reject(new Error('network down'));
      writes.push({ path: r.path, data });
      return Promise.resolve();
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(errorSource(), sandbox);
  return {
    api: sandbox.module.exports,
    writes: () => writes,
    fire: (ev, e) => listeners[ev] && listeners[ev](e),
    setFail: (v) => { failWrite = v; },
  };
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};

(async () => {
  // 1 — a plain error is recorded with the context needed to act on it
  {
    const t = load();
    await t.api.reportError('u1', 'error', 'Cannot read properties of null', 'at foo (app.js:10)', { line: 10 });
    const w = t.writes();
    check('one report written', w.length === 1);
    check('written under the reporting user', w[0].path.startsWith('errors/u1/'), w[0].path);
    check('keeps the message', w[0].data.message.includes('Cannot read properties'));
    check('keeps the page', w[0].data.page === 'dashboard.html', w[0].data.page);
    check('keeps the browser', /Chrome/.test(w[0].data.ua));
  }

  // 2 — the same fault firing repeatedly is one row, not a flood
  {
    const t = load();
    for (let i = 0; i < 20; i++) {
      await t.api.reportError('u1', 'error', 'same boom', 'at loop', { line: 5 });
    }
    check('an identical repeating fault is recorded once', t.writes().length === 1, String(t.writes().length));
  }

  // 3 — many DIFFERENT faults are still capped per session
  {
    const t = load();
    for (let i = 0; i < 30; i++) {
      await t.api.reportError('u1', 'error', 'boom number ' + i, 'at x', { line: i });
    }
    check('distinct faults are capped at 8 per session', t.writes().length === 8, String(t.writes().length));
  }

  // 4 — no personal data leaks in: only the declared fields are sent
  {
    const t = load({ pathname: '/dashboard.html', search: '?user=abc123&token=secret' });
    await t.api.reportError('u1', 'error', 'boom', 'at y', { line: 1 });
    const d = t.writes()[0].data;
    const allowed = new Set(['at', 'kind', 'message', 'stack', 'page', 'ua', 'screen', 'online', 'line', 'col']);
    const unexpected = Object.keys(d).filter((k) => !allowed.has(k));
    check('sends only the declared fields', unexpected.length === 0, unexpected.join(','));
    check('query string is never included', !JSON.stringify(d).includes('secret'));
    check('query string ids are never included', !JSON.stringify(d).includes('abc123'));
  }

  // 5 — oversized text is truncated before it is stored
  {
    const t = load();
    await t.api.reportError('u1', 'error', 'x'.repeat(5000), 'y'.repeat(9000), { line: 1 });
    const d = t.writes()[0].data;
    check('message truncated to 300', d.message.length === 300, String(d.message.length));
    check('stack truncated to 1200', d.stack.length === 1200, String(d.stack.length));
  }

  // 6 — the logger must never become the thing that breaks the page
  {
    const t = load();
    t.setFail(true);
    let threw = false;
    try { await t.api.reportError('u1', 'error', 'boom', 'at z'); } catch (e) { threw = true; }
    check('a failing write does not throw', !threw);
  }

  // 7 — nothing is written when there is no signed-in user, or no message
  {
    const t = load();
    await t.api.reportError(null, 'error', 'boom', '');
    await t.api.reportError('u1', 'error', '   ', '');
    check('no uid or empty message writes nothing', t.writes().length === 0, String(t.writes().length));
  }

  // 8 — the window hooks route real browser events through to a report
  {
    const t = load();
    t.api.initErrorLogging('u1');
    t.fire('error', { message: 'render blew up', error: { stack: 'at render' }, lineno: 42, colno: 7 });
    await new Promise((r) => setTimeout(r, 20));
    check('window error handler records the fault', t.writes().length === 1, String(t.writes().length));
    check('line number is captured', t.writes()[0].data.line === 42);

    t.fire('unhandledrejection', { reason: { message: 'promise died', stack: 'at p' } });
    await new Promise((r) => setTimeout(r, 20));
    check('unhandled promise rejection is recorded', t.writes().length === 2, String(t.writes().length));
    check('rejection is labelled as such', t.writes()[1].data.kind === 'unhandledrejection');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
