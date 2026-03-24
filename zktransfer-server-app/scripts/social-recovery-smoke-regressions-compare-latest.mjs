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
const comparePath = path.join(latestDir, "regressions-compare.txt");
const compareJsonPath = path.join(latestDir, "regressions-compare.json");

if (!fs.existsSync(comparePath)) {
  throw new Error(
    `Missing latest smoke regressions compare at ${comparePath}. Run social-recovery:smoke:export at least twice first.`
  );
}

const compare = fs.existsSync(compareJsonPath)
  ? JSON.parse(fs.readFileSync(compareJsonPath, "utf8"))
  : null;

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        baseDir,
        latestDir,
        comparePath,
        compareJsonPath,
        compare,
      },
      null,
      2
    )
  );
} else {
  process.stdout.write(fs.readFileSync(comparePath, "utf8"));
}
