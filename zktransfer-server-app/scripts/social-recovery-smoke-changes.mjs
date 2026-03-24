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
const changesTextPath = path.join(latestDir, "changes.txt");
const changesJsonPath = path.join(latestDir, "changes.json");
const compareTextPath = path.join(latestDir, "compare.txt");
const compareJsonPath = path.join(latestDir, "compare.json");
const checksumsCompareTextPath = path.join(latestDir, "checksums-compare.txt");
const checksumsCompareJsonPath = path.join(latestDir, "checksums-compare.json");

if (!fs.existsSync(compareTextPath)) {
  throw new Error(
    `Missing latest compare output at ${compareTextPath}. Run social-recovery:smoke:export at least twice first.`
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
        compareTextPath,
        compareJsonPath,
        checksumsCompareTextPath: fs.existsSync(checksumsCompareTextPath)
          ? checksumsCompareTextPath
          : null,
        checksumsCompareJsonPath: fs.existsSync(checksumsCompareJsonPath)
          ? checksumsCompareJsonPath
          : null,
        compare: fs.existsSync(compareJsonPath)
          ? JSON.parse(fs.readFileSync(compareJsonPath, "utf8"))
          : null,
        checksumsCompare: fs.existsSync(checksumsCompareJsonPath)
          ? JSON.parse(fs.readFileSync(checksumsCompareJsonPath, "utf8"))
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
  const compareText = fs.readFileSync(compareTextPath, "utf8").trimEnd();
  const checksumsCompareText = fs.existsSync(checksumsCompareTextPath)
    ? fs.readFileSync(checksumsCompareTextPath, "utf8").trimEnd()
    : null;
  process.stdout.write(
    checksumsCompareText ? `${compareText}\n\n${checksumsCompareText}\n` : `${compareText}\n`
  );
}
