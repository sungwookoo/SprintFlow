const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function hasProjectData() {
  const prisma = new PrismaClient();

  try {
    const projectCount = await prisma.project.count();
    return projectCount > 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  runNodeScript("prisma/apply-schema.cjs");

  if (process.env.SPRINTFLOW_SEED_ON_EMPTY === "false") {
    return;
  }

  if (await hasProjectData()) {
    console.log("SprintFlow seed skipped; project data already exists.");
    return;
  }

  console.log("No project data found. Creating initial SprintFlow workspace.");
  runNodeScript("prisma/seed.cjs");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
