# Portfolio ภูมิ

พอร์ตโฟลิโอผลงานแรก: โครงงาน SolarAqua สถานีอากาศ + แกลเลอรี่วิดีโอ/รูปเก็บข้อมูล 3 วัน

Built from the web-studio template (static multi-page HTML + precompiled Tailwind 3 + Firebase v10
Auth/Realtime Database from the gstatic CDN + PWA). No bundler, no framework.

## How to work here
- Reply to the user in **Thai**, short. Code, file names and comments in English.
- Use the `web-studio` skill for recipes and the verify / beauty checklists.
- After changing **any** Tailwind class in an `.html` or `js/*.js` file: `npm run build:css`
  (classes are precompiled into `css/tailwind.css`; there is no CDN JIT). Commit `css/tailwind.css`.
- Test locally on the emulators only: `npm run emu` (needs Java, see README) + `npm run serve`,
  then open `http://localhost:5500/index.html?emu=1`. While `js/firebase.js` still has the
  `__FIREBASE_…__` placeholders, localhost always uses the emulators.
- `npm test` (outbox + error logger) and `npm run test:rules` (security rules) must pass before
  saying something works. Every new rule gets an allow AND a deny test in `tests/rules.emu.test.mjs`.
- **Never deploy** (`firebase deploy`), publish, send messages, or touch real data without the
  user's explicit OK in this conversation. Deploy only through the skill script, which tests first and
  needs `-Confirm`: `~/.claude/skills/web-studio/scripts/deploy.ps1 -Project . -Target firebase|cloudflare -DryRun`.
- **Database paths**: build every path with `p()` from `js/firebase.js` — `ref(db, p(`items/${uid}`))`.
  `APP_ROOT` is `""` (own Firebase project) or `"apps/<slug>"` (shared project: data, roles and rules of this
  app live under that branch). `database.rules.json` is always written app-relative (as if at the root);
  in shared mode `npm run rules:build` nests it for the emulator, and a bare `firebase deploy --only database`
  is blocked (it would replace every other app's rules).
- Keep `CHANGELOG.md` up to date: plan, decisions/assumptions, what changed, what was tested (real results).

## Map
| File | What |
|---|---|
| `js/app.js` | shared systems: `APP`/`NAV`/`ROLES` config at the top, renderNav, theme (ensureDarkStyles), TH/EN i18n (`TH2EN` + machine translation, `window.__retranslate`, `t()`), toast, escapeHtml, formatDate, outbox `saveOrQueue`/`flushOutbox`, error logging, `requireAuth` (+ profile healing), modal a11y/dismiss, fx animations, `animateNumber`, `lineChart`/`barChart`, `openImageZoom`, PWA install CTA, onboarding |
| `js/firebase.js` | Firebase init + exports; config placeholders; `?emu=1` emulator hook |
| `js/imagecrop.js` | `openImageCropper(file, {aspect, outW})` → JPEG data URL |
| `database.rules.json` | `users/$uid` (owner + admin), `items/$uid` (owner only), `errors/$uid` (append-only, admin reads) |
| `index.html` `auth.html` `dashboard.html` `profile.html` `manage.html` | pages |
| `sw.js`, `manifest.webmanifest` | PWA (bump `CACHE` in sw.js when the precache list changes) |
| `tests/` | `outbox.test.js`, `errors.test.js` (Node, no deps), `rules.emu.test.mjs` (REST vs emulator) |

## Conventions
- Pages are written in Thai; add every fixed UI string to `TH2EN` in `js/app.js`. After rendering
  dynamic HTML call `window.__retranslate?.()`. Wrap names / user content in `data-no-translate`.
- Escape every user string with `escapeHtml()` before it goes into `innerHTML`.
- Writes a user must not lose → `saveOrQueue(path, data, uid)` with `at: "SERVER_TIME"`; build the
  key with `push(ref(db, path)).key` first so retries hit the same path.
- Modals: a `fixed inset-0 … hidden` overlay with a close button whose id ends in `-close` — focus
  trap, Esc and backdrop-close are automatic.
- Roles live at `users/$uid/role` (shared mode: `apps/<slug>/users/$uid/role`; one login works in every
  shared app, each app keeps its own role) ∈ {"user","admin"}. Users can never grant themselves admin; make the
  first admin with `npm run make-admin -- <email>` (emulator) or the Firebase console (production).
- Brand colours: `tailwind.config.js` (`brand`, `accent`) + `BRAND` hex in `js/app.js`.
