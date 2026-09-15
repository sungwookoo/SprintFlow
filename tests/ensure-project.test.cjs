const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { ensureProject } = require("../lib/ensure-project.ts");

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "sprintflow-test-"));
  const url = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
  execFileSync(process.execPath, ["prisma/apply-schema.cjs"], {
    env: { ...process.env, DATABASE_URL: url }
  });
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("concurrent empty workspace requests create one complete project and preserve later edits", async () => {
  await withDatabase(async (prisma) => {
    const projects = await Promise.all([ensureProject(prisma), ensureProject(prisma)]);
    assert.equal(projects[0].id, projects[1].id);
    assert.equal(await prisma.project.count(), 1);
    const statuses = await prisma.status.findMany({ orderBy: { sortOrder: "asc" } });
    assert.deepEqual(statuses.map((s) => s.category), ["TODO", "IN_PROGRESS", "IN_PROGRESS", "DONE"]);
    assert.equal(await prisma.issue.count(), 0);
    const issue = await prisma.issue.create({ data: {
      projectId: projects[0].id, statusId: statuses[0].id, issueKey: "SFL-1", summary: "Keep this task"
    } });
    await prisma.project.update({ where: { id: projects[0].id }, data: { name: "My workspace" } });
    assert.equal((await ensureProject(prisma)).name, "My workspace");
    assert.equal((await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).summary, "Keep this task");
    assert.equal(await prisma.status.count(), 4);
  });
});

test("an existing project with a different key is not replaced or seeded", async () => {
  await withDatabase(async (prisma) => {
    const project = await prisma.project.create({ data: {
      key: "CUSTOM", name: "Existing", summary: "Keep", leadName: "Owner"
    } });
    assert.equal((await ensureProject(prisma)).id, project.id);
    assert.equal(await prisma.project.count(), 1);
    assert.equal(await prisma.status.count(), 0);
  });
});
