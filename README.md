# Portfolio ภูมิ

พอร์ตโฟลิโอผลงานแรก: โครงงาน SolarAqua สถานีอากาศ + แกลเลอรี่วิดีโอ/รูปเก็บข้อมูล 3 วัน

Static multi-page web app: HTML + precompiled Tailwind CSS 3 + Firebase (Auth + Realtime Database,
v10 modular SDK from the CDN) + PWA. Thai/English, light/dark theme, works offline for saves.

## Run locally (no Firebase project needed)
```bash
npm install
npm run build:css            # after any Tailwind class change (or: npm run watch:css)
npm run emu                  # terminal 1 — Auth :9099 + Realtime Database :9000 emulators (needs Java 11+)
npm run serve                # terminal 2 — http://localhost:5500
```
Open http://localhost:5500/index.html. While `js/firebase.js` still holds the `__FIREBASE_…__`
placeholders, localhost always talks to the emulators. With a real config, add `?emu=1` once per
tab to use the emulators (`?emu=0` to stop). Emulator data is wiped when the emulator stops.

Windows + portable Java: set `JAVA_HOME` to the JRE folder and put `%JAVA_HOME%\bin` on `PATH`
before `npm run emu` / `npm run test:rules`. Firebase CLI: `npm i -g firebase-tools`.

Make an account an admin (emulator): sign up in the app, then `npm run make-admin -- you@example.com`.

## Tests
```bash
npm test                     # offline outbox + error logger (plain Node)
npm run test:rules           # security rules against the emulators (starts and stops them itself)
```

## Go live (only with the owner's OK)
1. Create a Firebase project; enable Authentication (Email/Password, Google) and Realtime Database.
2. Project settings → Your apps → Web app → copy the config into `js/firebase.js`
   (replace every `__FIREBASE_…__` value, the `PROJECT_ID`, and the exact `databaseURL`).
3. Own project: `node ~/.claude/skills/web-studio/scripts/firebase-mode.mjs --dir . --mode own --project-id <id> --database-url <url>`
   (sets the id everywhere + `.firebaserc`). Shared project: fill `config/shared-firebase.json` in the skill, then
   `firebase-mode.mjs --dir . --mode shared`.
4. `npm run build:css && npm test && npm run test:rules`
5. Deploy with the web-studio script (runs every test first, prints the plan, deploys only with `-Confirm`):
   `deploy.ps1 -Project . -Target firebase` or `-Target cloudflare`. Shared-project apps: see the skill's
   references/firebase.md — the web config comes from `config/shared-firebase.json`.
6. Make the first admin: Realtime Database → `users/<uid>/role` = `"admin"`.
7. Authentication → Settings → Authorized domains: add any custom domain.

## Structure
See `CLAUDE.md` for the file map and coding conventions, `CHANGELOG.md` for history.
