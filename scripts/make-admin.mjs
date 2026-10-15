// LOCAL EMULATOR ONLY: give an existing account the "admin" role so manage.html can be tested.
//   npm run emu            (other terminal)
//   npm run make-admin -- someone@test.dev
// In production, set users/<uid>/role (shared project: apps/<slug>/users/<uid>/role) = "admin" by hand in the Firebase console (Realtime Database)
// — the security rules deliberately make it impossible for anyone to grant themselves admin.
const email = process.argv[2];
if (!email) { console.error("usage: npm run make-admin -- <email>"); process.exit(1); }
const PROJECT = process.env.GCLOUD_PROJECT || "guyyapap-lab";
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`;
const DB = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000"}`;
// app data namespace ("" = own project, "apps/<slug>" = shared project) — same as js/firebase.js
import { readFileSync } from "node:fs";
const APP_ROOT = (readFileSync(new URL("../js/firebase.js", import.meta.url), "utf8").match(/export const APP_ROOT = "([^"]*)"/) || [])[1] || "";
const ROLE_PATH = (uid) => [APP_ROOT, `users/${uid}/role`].filter(Boolean).join("/");

// emulator-only admin endpoint: list accounts in the project
const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: "{}",
});
if (!r.ok) { console.error("Auth emulator not reachable — is `npm run emu` running?", r.status); process.exit(1); }
const users = (await r.json()).userInfo || [];
const u = users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
if (!u) { console.error("No emulator account with that email. Sign up in the app first."); process.exit(1); }
const w = await fetch(`${DB}/${ROLE_PATH(u.localId)}.json?ns=${PROJECT}-default-rtdb`, {
  method: "PUT", headers: { Authorization: "Bearer owner" }, body: JSON.stringify("admin"),
});
console.log(w.ok ? `OK: ${email} (${u.localId}) is now admin in the emulator` : `Failed: ${w.status} ${await w.text()}`);
process.exit(w.ok ? 0 : 1);
