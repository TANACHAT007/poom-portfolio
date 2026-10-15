// Security-rule tests for database.rules.json, run against the local emulators only:
//   npm run test:rules        (= firebase emulators:exec --only auth,database "node tests/rules.emu.test.mjs")
// Talks REST to the emulator — never touches a real database. Every rule gets an allow AND a deny check.
// Emulator ID tokens go in ?auth=; the literal "Bearer owner" header is the emulator's admin bypass.
const PROJECT = process.env.GCLOUD_PROJECT || "guyyapap-lab";
const NS = `${PROJECT}-default-rtdb`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}/identitytoolkit.googleapis.com/v1`;
const DB = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000"}`;
// Same data namespace as the app: APP_ROOT from js/firebase.js ("" = own project, "apps/<slug>" = shared).
// Paths below are app-relative; a leading "/" means an absolute database path.
import { readFileSync } from "node:fs";
const APP_ROOT = (readFileSync(new URL("../js/firebase.js", import.meta.url), "utf8").match(/export const APP_ROOT = "([^"]*)"/) || [])[1];
if (APP_ROOT === undefined) throw new Error("Could not read APP_ROOT from js/firebase.js");
const full = (path) => path.startsWith("/") ? path.slice(1) : [APP_ROOT, path].filter(Boolean).join("/");

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };

async function signUp(email) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "secret123", returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.localId) throw new Error("signUp failed: " + JSON.stringify(j));
  return { uid: j.localId, token: j.idToken };
}
async function req(method, path, token, body) {
  const admin = token === "owner";
  const headers = { "Content-Type": "application/json", ...(admin ? { Authorization: "Bearer owner" } : {}) };
  const auth = admin || !token ? "" : `&auth=${token}`;
  const r = await fetch(`${DB}/${full(path)}.json?ns=${NS}${auth}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.status;
}
const ok = (s) => s === 200;

const run = Date.now();
const A = await signUp(`a${run}@test.dev`), B = await signUp(`b${run}@test.dev`), M = await signUp(`m${run}@test.dev`);
const profile = (name, role = "user", extra = {}) => ({ name, email: `${name}@test.dev`, role, createdAt: 1, ...extra });

// ---- users ----
check("A creates own profile as user", ok(await req("PUT", `users/${A.uid}`, A.token, profile("A"))));
check("B creates own profile as user", ok(await req("PUT", `users/${B.uid}`, B.token, profile("B"))));
check("M cannot self-register as admin", !ok(await req("PUT", `users/${M.uid}`, M.token, profile("M", "admin"))));
check("A cannot promote self to admin", !ok(await req("PATCH", `users/${A.uid}`, A.token, { role: "admin" })));
check("A cannot write B's profile", !ok(await req("PATCH", `users/${B.uid}`, A.token, { name: "hacked" })));
check("A cannot read B's profile", !ok(await req("GET", `users/${B.uid}`, A.token)));
check("A can read own profile", ok(await req("GET", `users/${A.uid}`, A.token)));
check("A cannot list all users", !ok(await req("GET", "users", A.token)));
check("signed-out cannot read users", !ok(await req("GET", `users/${A.uid}`, null)));
check("A can update own name/bio/photo", ok(await req("PATCH", `users/${A.uid}`, A.token, { name: "A2", bio: "hi", photo: "data:image/jpeg;base64,xx", updatedAt: 2 })));
check("profile rejects unknown fields", !ok(await req("PATCH", `users/${A.uid}`, A.token, { secret: "x" })));
check("profile rejects invalid role value", !ok(await req("PUT", `users/${M.uid}`, M.token, profile("M", "superuser"))));
check("profile rejects empty name", !ok(await req("PATCH", `users/${A.uid}`, A.token, { name: "" })));
check("profile rejects too-long name", !ok(await req("PATCH", `users/${A.uid}`, A.token, { name: "x".repeat(81) })));

// seed an admin the only way possible: emulator owner bypass (= Firebase console in production)
await req("PUT", `users/${M.uid}`, "owner", profile("M", "admin"));
check("admin lists all users", ok(await req("GET", "users", M.token)));
check("admin reads another profile", ok(await req("GET", `users/${A.uid}`, M.token)));
check("admin promotes B to admin", ok(await req("PATCH", `users/${B.uid}`, M.token, { role: "admin" })));
check("admin demotes B back to user", ok(await req("PATCH", `users/${B.uid}`, M.token, { role: "user" })));
check("admin can keep own role while editing own profile", ok(await req("PATCH", `users/${M.uid}`, M.token, { name: "M2", role: "admin" })));

// ---- items ----
const item = (extra = {}) => ({ title: "Buy beans", note: "", done: false, at: 1, ...extra });
check("A writes own item", ok(await req("PUT", `items/${A.uid}/i1`, A.token, item())));
check("A writes own item with server timestamp", ok(await req("PUT", `items/${A.uid}/i2`, A.token, item({ at: { ".sv": "timestamp" } }))));
check("A writes queued-offline item", ok(await req("PUT", `items/${A.uid}/i3`, A.token, item({ queuedOffline: true }))));
check("A reads own items", ok(await req("GET", `items/${A.uid}`, A.token)));
check("B cannot read A's items", !ok(await req("GET", `items/${A.uid}`, B.token)));
check("B cannot write into A's items", !ok(await req("PUT", `items/${A.uid}/x`, B.token, item())));
check("admin cannot read A's items (owner-only)", !ok(await req("GET", `items/${A.uid}`, M.token)));
check("nobody lists the items root", !ok(await req("GET", "items", M.token)));
check("item requires a title", !ok(await req("PUT", `items/${A.uid}/bad1`, A.token, { at: 1 })));
check("item rejects empty title", !ok(await req("PUT", `items/${A.uid}/bad2`, A.token, item({ title: "" }))));
check("item rejects too-long title", !ok(await req("PUT", `items/${A.uid}/bad3`, A.token, item({ title: "x".repeat(201) }))));
check("item rejects non-boolean done", !ok(await req("PUT", `items/${A.uid}/bad4`, A.token, item({ done: "yes" }))));
check("item rejects unknown fields", !ok(await req("PUT", `items/${A.uid}/bad5`, A.token, item({ owner: "x" }))));
check("A deletes own item", ok(await req("DELETE", `items/${A.uid}/i1`, A.token)));

// ---- errors (append-only, admin-readable) ----
const err = (extra = {}) => ({ at: 1, kind: "error", message: "boom", stack: "at x", page: "index.html", ua: "UA", screen: "390x844", online: true, line: 1, col: 2, ...extra });
check("A appends an error report", ok(await req("PUT", `errors/${A.uid}/e1`, A.token, err())));
check("A cannot overwrite an existing report", !ok(await req("PUT", `errors/${A.uid}/e1`, A.token, err({ message: "edited" }))));
check("A cannot delete a report", !ok(await req("DELETE", `errors/${A.uid}/e1`, A.token)));
check("A cannot read own reports (write-only)", !ok(await req("GET", `errors/${A.uid}`, A.token)));
check("A cannot write reports as B", !ok(await req("PUT", `errors/${B.uid}/e9`, A.token, err())));
check("report rejects long message", !ok(await req("PUT", `errors/${A.uid}/e2`, A.token, err({ message: "x".repeat(301) }))));
check("report rejects unknown fields", !ok(await req("PUT", `errors/${A.uid}/e3`, A.token, err({ formData: "secret" }))));
check("report requires message", !ok(await req("PUT", `errors/${A.uid}/e4`, A.token, { at: 1, kind: "error" })));
check("admin reads all reports", ok(await req("GET", "errors", M.token)));
check("user cannot read all reports", !ok(await req("GET", "errors", B.token)));

// ---- everything else is closed ----
check("unknown top-level path is not writable", !ok(await req("PUT", "/anything/x", A.token, { a: 1 })));
check("unknown app-level path is not writable", !ok(await req("PUT", "anything/x", A.token, { a: 1 })));
check("root is not readable", !ok(await req("GET", "/", A.token)));
if (APP_ROOT) {
  // shared project: the app branch and the list of apps are closed too (cross-app tests: web-studio scripts/tests)
  check("app root is not readable (shared mode)", !ok(await req("GET", "", M.token)));
  check("apps list is not readable (shared mode)", !ok(await req("GET", "/apps", M.token)));
  check("cannot write into another app branch (shared mode)", !ok(await req("PUT", "/apps/zz-other-app/users/" + A.uid, A.token, profile("A"))));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
