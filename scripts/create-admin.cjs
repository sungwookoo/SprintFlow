// Generate credentials locally. No passwords or keys are printed to the console.
const { randomBytes, scryptSync } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const output = resolve(process.argv[2] || "admin-credentials.local.json");
const origin = process.argv[3] || "http://localhost:3000";
if (!["http:", "https:"].includes(new URL(origin).protocol) || new URL(origin).origin !== origin) throw new Error("Specify an origin without a trailing slash or path.");
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
writeFileSync(output, JSON.stringify({ username: "admin", password, environment: {
  ADMIN_USERNAME: "admin", ADMIN_PASSWORD_HASH: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  SESSION_SECRET: randomBytes(48).toString("base64url"), APP_ORIGIN: origin
} }, null, 2), { flag: "wx", mode: 0o600 });
console.log(`Credentials saved to ${output}. Keep this file private; deploy only the environment object.`);
