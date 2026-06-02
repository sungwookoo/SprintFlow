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
      console.log("SQLite schema already exists. Use --reset to recreate it.");
      return;
    }

    const sql = fs.readFileSync(migrationPath, "utf8");
    const statements = splitStatements(sql);

    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");

    console.log(`SQLite schema applied at ${path.relative(rootDir, dbPath)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
