const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const rootDir = path.resolve(__dirname, "..");
const schemaDir = __dirname;
const migrationPath = path.join(schemaDir, "migrations", "000_init", "migration.sql");
const shouldReset = process.argv.includes("--reset");

function resolveSqlitePath(url) {
  const value = (url || "file:./dev.db").replace(/^file:/, "");
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return path.normalize(value);
  }

  return path.resolve(schemaDir, value);
}

function splitStatements(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const dbPath = resolveSqlitePath(process.env.DATABASE_URL);
  const journalPath = `${dbPath}-journal`;

  if (shouldReset) {
    for (const filePath of [dbPath, journalPath]) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    }
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Project'"
    );

    if (!shouldReset && Array.isArray(existing) && existing.length > 0) {
      console.log("Preserving existing SQLite data.");
    } else {
    const sql = fs.readFileSync(migrationPath, "utf8");
    const statements = splitStatements(sql);

    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    }

    // Additive and repeatable: never recreate existing workspace tables.
    await prisma.$transaction(async (tx) => {
      const projects = await tx.$queryRawUnsafe('PRAGMA table_info("Project")');
      const issues = await tx.$queryRawUnsafe('PRAGMA table_info("Issue")');
      if (!projects.some(c => c.name === "accessCodeHash")) await tx.$executeRawUnsafe('ALTER TABLE "Project" ADD COLUMN "accessCodeHash" TEXT');
      if (!projects.some(c => c.name === "accessVersion")) await tx.$executeRawUnsafe('ALTER TABLE "Project" ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 0');
      if (!issues.some(c => c.name === "deletedAt")) await tx.$executeRawUnsafe('ALTER TABLE "Issue" ADD COLUMN "deletedAt" DATETIME');
      await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Project_accessCodeHash_key" ON "Project"("accessCodeHash")');
      await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "LoginThrottle" ("id" TEXT NOT NULL PRIMARY KEY, "windowStart" BIGINT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0)');
    });

    console.log(`SQLite schema applied at ${path.relative(rootDir, dbPath)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
