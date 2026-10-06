const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

test("production migration preserves existing rows and is repeatable", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sprintflow-migration-"));
  const url = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
  fs.writeFileSync(path.join(directory, "test.db"), "");
  fs.copyFileSync("prisma/schema.prisma", path.join(directory, "schema.prisma"));
  const migrationRoot = path.join(directory, "migrations");
  fs.mkdirSync(migrationRoot);
  fs.cpSync("prisma/migrations/000_init", path.join(migrationRoot, "000_init"), { recursive: true });
  const migrate = () => execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", path.join(directory, "schema.prisma")], { env: { ...process.env, DATABASE_URL: url } });
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    migrate();
    await db.$executeRawUnsafe(`INSERT INTO Project (id, key, name, summary, leadName, updatedAt) VALUES ('existing', 'OLD', 'Keep workspace', 'Existing data', 'Owner', CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`INSERT INTO Status (id, projectId, name) VALUES ('status', 'existing', 'TODO')`);
    await db.$executeRawUnsafe(`INSERT INTO Issue (id, projectId, statusId, issueKey, summary, updatedAt) VALUES ('task', 'existing', 'status', 'OLD-1', 'Keep task', CURRENT_TIMESTAMP)`);
    fs.cpSync("prisma/migrations/001_group_access", path.join(migrationRoot, "001_group_access"), { recursive: true });
    migrate(); migrate();
    const project = await db.project.findUniqueOrThrow({ where: { id: "existing" } });
    assert.equal(project.name, "Keep workspace"); assert.equal(project.accessCodeHash, null); assert.equal(project.accessVersion, 0);
    const task = await db.issue.findUniqueOrThrow({ where: { id: "task" } });
    assert.equal(task.summary, "Keep task"); assert.equal(task.deletedAt, null);
    assert.equal(await db.loginThrottle.count(), 0);
  } finally { await db.$disconnect(); fs.rmSync(directory, { recursive: true, force: true }); }
});
