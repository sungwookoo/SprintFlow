const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { scryptSync } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

test("real HTTP auth, group isolation, admin permissions, backups and session revocation", { timeout: 120000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sprintflow-access-"));
  const database = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
  const listener = require("node:net").createServer();
  await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const salt = "a".repeat(32);
  const env = { ...process.env, DATABASE_URL: database, ADMIN_USERNAME: "test-admin", ADMIN_PASSWORD_HASH: `${salt}:${scryptSync("test-password", salt, 64).toString("hex")}`, SESSION_SECRET: "test-secret-".repeat(5), APP_ORIGIN: origin };
  execFileSync(process.execPath, ["prisma/apply-schema.cjs"], { env });
  const db = new PrismaClient({ datasourceUrl: database });
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] });
  const exited = new Promise(resolve => server.once("exit", resolve));
  let log = ""; server.stdout.on("data", b => { log += b; }); server.stderr.on("data", b => { log += b; });
  async function req(url, { method = "GET", body, cookie, requestOrigin = origin } = {}) {
    const response = await fetch(origin + url, { method, signal: AbortSignal.timeout(10000), redirect: "manual", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), Origin: requestOrigin }, body: body ? JSON.stringify(body) : undefined });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0], headers: response.headers };
  }
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) { try { if ((await req("/login")).status === 200) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 250)); }
    assert.ok(ready, log);
    assert.equal((await req("/")).status, 307);
    for (const [url, method] of [["/api/issues", "POST"], ["/api/issues/unknown", "PATCH"], ["/api/issues/unknown", "DELETE"], ["/api/issues/unknown/comments", "POST"], ["/api/issues/unknown/attachments", "POST"], ["/api/members", "POST"], ["/api/members/unknown", "PATCH"], ["/api/members/unknown", "DELETE"], ["/api/backups/download", "GET"], ["/api/backups/save", "POST"], ["/api/backups/restore", "POST"], ["/api/groups", "POST"], ["/api/trash", "GET"]]) {
      assert.equal((await req(url, { method, body: method === "GET" ? undefined : {} })).status, 401, url);
    }
    assert.equal((await req("/api/access", { method: "POST", body: { action: "admin", username: "test-admin", password: "wrong" } })).status, 401);
    const login = await req("/api/access", { method: "POST", body: { action: "admin", username: "test-admin", password: "test-password" } });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/i); assert.match(login.headers.get("set-cookie"), /Secure/i);
    const admin = login.cookie;
    const a = (await req("/api/groups", { method: "POST", cookie: admin, body: { name: "Group Alpha" } })).data;
    const b = (await req("/api/groups", { method: "POST", cookie: admin, body: { name: "Group Beta" } })).data;
    assert.ok(a.code && b.code);
    const participant = (await req("/api/access", { method: "POST", body: { action: "group", code: a.code } })).cookie;
    const other = (await req("/api/access", { method: "POST", body: { action: "group", code: b.code } })).cookie;
    const adminA = (await req("/api/access", { method: "POST", cookie: admin, body: { action: "select", projectId: a.id } })).cookie;
    assert.equal((await req("/api/groups", { method: "POST", cookie: participant, body: { name: "Denied" } })).status, 403);
    assert.equal((await req(`/api/groups/${a.id}`, { method: "PATCH", cookie: participant, body: { action: "rotate" } })).status, 403);
    assert.equal((await req(`/api/groups/${a.id}`, { method: "DELETE", cookie: participant, body: { confirm: "Group Alpha" } })).status, 403);
    for (const [url, method] of [["/api/backups/download", "GET"], ["/api/backups/save", "GET"], ["/api/backups/save", "POST"], ["/api/backups/restore", "POST"], ["/api/trash", "GET"]]) assert.equal((await req(url, { method, cookie: participant, body: method === "POST" ? {} : undefined })).status, 403);
    const issueA = (await req("/api/issues", { method: "POST", cookie: participant, body: { summary: "Alpha private task" } })).data.issue;
    const issueB = (await req("/api/issues", { method: "POST", cookie: other, body: { summary: "Beta private task" } })).data.issue;
    assert.ok(issueA.id && issueB.id);
    const memberB = (await req("/api/members", { method: "POST", cookie: other, body: { name: "Beta member" } })).data.member;
    const page = await req("/", { cookie: participant }); assert.match(page.data, /Alpha private task/); assert.doesNotMatch(page.data, /Beta private task/);
    for (const [url, method, body] of [[`/api/issues/${issueB.id}`, "PATCH", { summary: "stolen" }], [`/api/issues/${issueB.id}`, "DELETE", {}], [`/api/issues/${issueB.id}/comments`, "POST", { body: "stolen" }], [`/api/issues/${issueB.id}/attachments`, "POST", { fileName: "stolen", url: "https://example.com" }], [`/api/members/${memberB.id}`, "PATCH", { name: "stolen" }]]) assert.equal((await req(url, { method, cookie: participant, body })).status, 404, url);
    assert.equal((await req("/api/issues", { method: "POST", cookie: participant, body: { projectId: b.id, summary: "stolen" } })).status, 403);
    assert.equal((await req(`/api/issues/${issueA.id}`, { method: "PATCH", cookie: participant, body: { assigneeId: memberB.id } })).status, 400);
    assert.equal((await req(`/api/issues/${issueA.id}`, { method: "PATCH", cookie: participant, body: { statusId: issueB.statusId } })).status, 400);
    assert.equal((await req(`/api/issues/${issueA.id}/comments`, { method: "POST", cookie: participant, body: { body: "forged author", authorId: memberB.id } })).status, 400);
    assert.equal((await req(`/api/issues/${issueA.id}`, { method: "PATCH", cookie: participant, requestOrigin: "https://evil.example", body: { summary: "csrf" } })).status, 403);
    assert.equal((await req(`/api/issues/${issueA.id}/attachments`, { method: "POST", cookie: participant, body: { fileName: "x", url: "javascript:alert(1)" } })).status, 400);
    const snapshot = (await req("/api/backups/download", { cookie: adminA })).data;
    assert.equal(snapshot.tables.projects.length, 1); assert.equal(snapshot.tables.projects[0].id, a.id); assert.equal(snapshot.tables.projects[0].accessCodeHash, undefined);
    const forged = structuredClone(snapshot); forged.tables.issues[0].assigneeId = memberB.id;
    assert.equal((await req("/api/backups/restore", { method: "POST", cookie: adminA, body: { snapshot: forged } })).status, 400);
    assert.equal((await req(`/api/issues/${issueA.id}`, { method: "DELETE", cookie: participant, body: {} })).status, 200);
    assert.ok((await db.issue.findUnique({ where: { id: issueA.id } })).deletedAt);
    assert.equal((await req("/api/trash", { method: "POST", cookie: adminA, body: { id: issueA.id, action: "restore" } })).status, 200);
    assert.equal((await db.issue.findUnique({ where: { id: issueA.id } })).deletedAt, null);
    assert.equal((await req("/api/backups/restore", { method: "POST", cookie: adminA, body: { snapshot } })).status, 200);
    assert.equal(await db.issue.count({ where: { projectId: b.id } }), 1);
    assert.equal((await req("/api/issues", { method: "POST", cookie: participant, body: { summary: "stale" } })).status, 401);
    const again = (await req("/api/access", { method: "POST", body: { action: "group", code: a.code } })).cookie;
    const rotated = await req(`/api/groups/${a.id}`, { method: "PATCH", cookie: admin, body: { action: "rotate" } }); assert.ok(rotated.data.code);
    assert.equal((await req("/api/issues", { method: "POST", cookie: again, body: { summary: "stale" } })).status, 401);
    assert.equal((await req("/api/access", { method: "POST", body: { action: "group", code: a.code } })).status, 401);
    assert.equal((await req("/api/access", { method: "POST", body: { action: "group", code: rotated.data.code } })).status, 200);
    const logout = await req("/api/access", { method: "POST", cookie: admin, body: { action: "logout" } }); assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
    await db.loginThrottle.upsert({ where: { id: "admin" }, create: { id: "admin", attempts: 20, windowStart: BigInt(Math.floor(Date.now() / 300000) * 300000) }, update: { attempts: 20 } });
    assert.equal((await req("/api/access", { method: "POST", body: { action: "admin", username: "test-admin", password: "test-password" } })).status, 429);
    // Existing rows survive repeated migration/bootstrap runs.
    execFileSync(process.execPath, ["prisma/apply-schema.cjs"], { env });
    assert.equal(await db.project.count(), 2); assert.equal(await db.issue.count(), 2);
    assert.equal((await req(`/api/groups/${b.id}`, { method: "DELETE", cookie: admin, body: { confirm: "Group Beta" } })).status, 200);
    assert.equal(await db.project.count(), 1); assert.equal(await db.issue.count({ where: { projectId: a.id } }), 1);
    assert.equal((await req("/api/issues", { method: "POST", cookie: other, body: { summary: "deleted group" } })).status, 401);
  } finally {
    server.kill(); await exited;
    await db.$disconnect(); fs.rmSync(directory, { recursive: true, force: true });
  }
});
