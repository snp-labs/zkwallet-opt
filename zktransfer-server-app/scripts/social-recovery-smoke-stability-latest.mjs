import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function getBaseDir() {
  return (
    process.env.SOCIAL_RECOVERY_SMOKE_REPORT_DIR ||
    getArgValue("--base-dir") ||
    path.join(appDir, "tmp", "social-recovery-smoke-report")
  );
}

const baseDir = getBaseDir();
const latestDir = path.join(baseDir, "latest");
const stabilityPath = path.join(latestDir, "stability.txt");
const stabilityJsonPath = path.join(latestDir, "stability.json");

if (!fs.existsSync(stabilityPath)) {
  throw new Error(
    `Missing latest smoke stability at ${stabilityPath}. Run social-recovery:smoke:export first.`
  );
}

const stability = fs.existsSync(stabilityJsonPath)
  ? JSON.parse(fs.readFileSync(stabilityJsonPath, "utf8"))
  : null;

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        latestDir,
        stabilityPath,
        stabilityJsonPath,
        stability,
      },
      null,
      2
    )
  );
} else {
  process.stdout.write(fs.readFileSync(stabilityPath, "utf8"));
}
