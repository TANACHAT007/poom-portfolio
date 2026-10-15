// Exercises the offline outbox that lives in js/app.js, with the browser and Firebase pieces
// stubbed. What is protected here is data safety: someone who saves a record on a bad
// connection must not lose it, and a replayed write must not create a duplicate row.
//
// Run with:  npm test
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Pull the outbox straight out of the shipping file, so this suite can never drift from
// the code that actually runs in the browser.
const APP = path.join(__dirname, '..', 'js', 'app.js');
const START_MARKER = 'const OUTBOX_KEY';
const END_MARKER = '// Escape untrusted text before it goes anywhere near innerHTML.';
// the localStorage key is per-project ("<slug>-outbox"), so read it from the source too
const OUTBOX_KEY = (fs.readFileSync(APP, 'utf8').match(/const OUTBOX_KEY = "([^"]+)"/) || [])[1];
if (!OUTBOX_KEY) throw new Error('Could not read OUTBOX_KEY from js/app.js');

function outboxSource() {
  const s = fs.readFileSync(APP, 'utf8');
  const start = s.indexOf(START_MARKER);
  const end = s.indexOf(END_MARKER);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not locate the outbox block in js/app.js — did the markers change?');
  }
  const block = s.slice(start, end).replace(/export (async )?function/g, '$1function');
  const names = [...block.matchAll(/(?:async )?function (\w+)/g)].map((m) => m[1]);
  return block + '\nmodule.exports = { ' + [...new Set(names)].join(', ') + ' };\n';
}

let store, online, serverWrites, failMode, hangMode;

function loadOutbox() {
  store = {};
  serverWrites = [];
  failMode = null;
  hangMode = false;
  online = true;

  const sandbox = {
    console,
    module: { exports: {} },
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Date,
    String,
    Object,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    navigator: { get onLine() { return online; } },
    window: {},
    document: {
      getElementById: () => null,
      createElement: () => ({ setAttribute() {}, classList: {} }),
      body: { appendChild() {} },
      addEventListener() {},
    },
    toast: () => {},
    serverTimestamp: () => ({ '.sv': 'timestamp' }),
    db: {},
    p: (x) => x, // APP_ROOT helper from js/firebase.js (identity = own-project mode)
    ref: (_db, p) => ({ path: p }),
    set: (r, data) => new Promise((resolve, reject) => {
      if (hangMode) return;                 // what the RTDB web SDK really does offline: never settles
      if (failMode) return reject(Object.assign(new Error(failMode), { code: failMode }));
      serverWrites.push({ path: r.path, data });
      resolve();
    }),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(outboxSource(), sandbox);

  return {
    api: sandbox.module.exports,
    ctl: {
      setOnline: (v) => { online = v; },
      setHang: (v) => { hangMode = v; },
      setFail: (v) => { failMode = v; },
      writes: () => serverWrites,
      raw: () => store,
    },
  };
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};

(async () => {
  // 1 — a normal online save goes straight to the server and is not queued
  {
    const { api, ctl } = loadOutbox();
    const r = await api.saveOrQueue('items/u1/k1', { at: 'SERVER_TIME' }, 'u1');
    check('online save reports "saved"', r === 'saved', r);
    check('online save reached the server', ctl.writes().length === 1);
    check('SERVER_TIME became the real sentinel', JSON.stringify(ctl.writes()[0].data.at) === '{".sv":"timestamp"}');
    check('nothing left in the outbox', api.outboxCount('u1') === 0);
  }

  // 2 — offline: the record must survive, not vanish
  {
    const { api, ctl } = loadOutbox();
    ctl.setOnline(false);
    const r = await api.saveOrQueue('items/u1/k2', { at: 'SERVER_TIME' }, 'u1');
    check('offline save reports "queued"', r === 'queued', r);
    check('offline save did NOT reach the server', ctl.writes().length === 0);
    check('offline save is held locally', api.outboxCount('u1') === 1);
    const held = JSON.parse(ctl.raw()[OUTBOX_KEY])[0];
    check('queued record keeps a real timestamp', typeof held.data.at === 'number');
    check('queued record is marked as offline-origin', held.data.queuedOffline === true);
  }

  // 3 — the RTDB failure mode that actually bites: the promise never settles
  {
    const { api, ctl } = loadOutbox();
    ctl.setHang(true);
    const t0 = Date.now();
    const r = await api.saveOrQueue('items/u1/k3', { at: 'SERVER_TIME' }, 'u1');
    const took = Date.now() - t0;
    check('a hanging write still resolves (does not block forever)', r === 'queued', r);
    check('it gave up near the 8s timeout', took >= 7500 && took < 12000, took + 'ms');
    check('the record was preserved', api.outboxCount('u1') === 1);
  }

  // 4 — reconnecting sends it, exactly once, to the SAME path
  {
    const { api, ctl } = loadOutbox();
    ctl.setOnline(false);
    await api.saveOrQueue('items/u1/k4', { at: 'SERVER_TIME' }, 'u1');
    ctl.setOnline(true);
    const res = await api.flushOutbox('u1');
    check('flush reports one sent', res.sent === 1, JSON.stringify(res));
    check('flush wrote to the original path', ctl.writes()[0].path === 'items/u1/k4', ctl.writes()[0].path);
    check('outbox is now empty', api.outboxCount('u1') === 0);
    await api.flushOutbox('u1');
    check('a second flush writes nothing more', ctl.writes().length === 1, String(ctl.writes().length));
  }

  // 5 — one device, two accounts: data must never cross over
  {
    const { api, ctl } = loadOutbox();
    ctl.setOnline(false);
    await api.saveOrQueue('items/u1/a', { at: 'SERVER_TIME' }, 'u1');
    await api.saveOrQueue('items/u2/b', { at: 'SERVER_TIME' }, 'u2');
    check('each user sees only their own pending count',
      api.outboxCount('u1') === 1 && api.outboxCount('u2') === 1);
    ctl.setOnline(true);
    await api.flushOutbox('u1');
    check("flushing u1 sends only u1's record",
      ctl.writes().length === 1 && ctl.writes()[0].path === 'items/u1/a');
    check("u2's record is still held, not dropped", api.outboxCount('u2') === 1);
  }

  // 6 — a rules rejection can never succeed, so it must not loop forever
  {
    const { api, ctl } = loadOutbox();
    ctl.setOnline(false);
    await api.saveOrQueue('items/u1/denied', { at: 'SERVER_TIME' }, 'u1');
    ctl.setOnline(true);
    ctl.setFail('PERMISSION_DENIED');
    await api.flushOutbox('u1');
    check('permission-denied record is discarded, not retried forever', api.outboxCount('u1') === 0);
  }

  // 7 — a transient failure keeps the record for the next attempt
  {
    const { api, ctl } = loadOutbox();
    ctl.setOnline(false);
    await api.saveOrQueue('items/u1/flaky', { at: 'SERVER_TIME' }, 'u1');
    ctl.setOnline(true);
    ctl.setFail('NETWORK_ERROR');
    await api.flushOutbox('u1');
    check('transient failure keeps the record', api.outboxCount('u1') === 1);
    ctl.setFail(null);
    const res = await api.flushOutbox('u1');
    check('it goes through on the next attempt', res.sent === 1 && api.outboxCount('u1') === 0);
  }

  // 8 — stale records are not replayed weeks later
  {
    const { api, ctl } = loadOutbox();
    ctl.setOnline(false);
    await api.saveOrQueue('items/u1/old', { at: 'SERVER_TIME' }, 'u1');
    const items = JSON.parse(ctl.raw()[OUTBOX_KEY]);
    items[0].queuedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;   // 8 days ago
    ctl.raw()[OUTBOX_KEY] = JSON.stringify(items);
    check('a record older than the 7-day cap is ignored', api.outboxCount('u1') === 0);
    ctl.setOnline(true);
    await api.flushOutbox('u1');
    check('and it is never sent', ctl.writes().length === 0);
  }

  // 9 — corrupt storage must not crash the app
  {
    const { api, ctl } = loadOutbox();
    ctl.raw()[OUTBOX_KEY] = '{not valid json';
    check('corrupt outbox reads as empty instead of throwing', api.outboxCount('u1') === 0);
    const r = await api.saveOrQueue('items/u1/ok', { at: 'SERVER_TIME' }, 'u1');
    check('and saving still works afterwards', r === 'saved');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
