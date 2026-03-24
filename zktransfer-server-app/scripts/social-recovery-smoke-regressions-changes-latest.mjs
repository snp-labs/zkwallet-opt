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
const changesTextPath = path.join(latestDir, "regressions-changes.txt");
const changesJsonPath = path.join(latestDir, "regressions-changes.json");

if (!fs.existsSync(changesTextPath)) {
  throw new Error(
    `Missing latest regressions changes artifact at ${changesTextPath}. Run social-recovery:smoke:export first.`
  );
}

const changes = fs.existsSync(changesJsonPath)
  ? JSON.parse(fs.readFileSync(changesJsonPath, "utf8"))
  : null;

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        latestDir,
        changesTextPath,
        changesJsonPath,
        changes,
      },
      null,
      2
    )
  );
} else {
  process.stdout.write(fs.readFileSync(changesTextPath, "utf8"));
}
