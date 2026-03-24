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
const regressionsTextPath = path.join(latestDir, "regressions.txt");
const regressionsJsonPath = path.join(latestDir, "regressions.json");
const compareTextPath = path.join(latestDir, "regressions-compare.txt");
const compareJsonPath = path.join(latestDir, "regressions-compare.json");

if (!fs.existsSync(regressionsTextPath)) {
  throw new Error(
    `Missing latest regressions output at ${regressionsTextPath}. Run social-recovery:smoke:export first.`
  );
}

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        latestDir,
        changesTextPath: fs.existsSync(changesTextPath) ? changesTextPath : null,
        changesJsonPath: fs.existsSync(changesJsonPath) ? changesJsonPath : null,
        regressionsTextPath,
        regressionsJsonPath,
        compareTextPath: fs.existsSync(compareTextPath) ? compareTextPath : null,
        compareJsonPath: fs.existsSync(compareJsonPath) ? compareJsonPath : null,
        regressions: fs.existsSync(regressionsJsonPath)
          ? JSON.parse(fs.readFileSync(regressionsJsonPath, "utf8"))
          : null,
        regressionsCompare: fs.existsSync(compareJsonPath)
          ? JSON.parse(fs.readFileSync(compareJsonPath, "utf8"))
          : null,
        changes: fs.existsSync(changesJsonPath)
          ? JSON.parse(fs.readFileSync(changesJsonPath, "utf8"))
          : null,
      },
      null,
      2
    )
  );
} else {
  if (fs.existsSync(changesTextPath)) {
    process.stdout.write(fs.readFileSync(changesTextPath, "utf8"));
    process.exit(0);
  }
  const regressionsText = fs.readFileSync(regressionsTextPath, "utf8").trimEnd();
  const compareText = fs.existsSync(compareTextPath)
    ? fs.readFileSync(compareTextPath, "utf8").trimEnd()
    : null;
  process.stdout.write(compareText ? `${regressionsText}\n\n${compareText}\n` : `${regressionsText}\n`);
}
