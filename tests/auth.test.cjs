const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword, signSession, readSession, newGroupCode, digest } = require("../lib/auth-crypto.ts");

test("password hash verifies only the correct password", async () => {
  const hash = await hashPassword("test password only");
  assert.equal(await verifyPassword("test password only", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.equal(await verifyPassword("x", "invalid"), false);
});

test("expired, forged and wrong-key sessions are rejected", () => {
  const session = { role: "participant", projectId: "a", version: "1", expires: Date.now() + 10000 };
  const token = signSession(session, "test secret");
  assert.deepEqual(readSession(token, "test secret"), session);
  assert.equal(readSession(token, "changed secret"), null);
  assert.equal(readSession(token + ".extra", "test secret"), null);
  const forged = Buffer.from(JSON.stringify({ ...session, role: "admin" })).toString("base64url") + "." + token.split(".")[1];
  assert.equal(readSession(forged, "test secret"), null);
  assert.equal(readSession(signSession({ ...session, expires: Date.now() - 1 }, "test secret"), "test secret"), null);
  const code = newGroupCode();
  assert.equal(code.length, 24);
  assert.notEqual(code, newGroupCode());
  assert.equal(digest(code).length, 64);
});
