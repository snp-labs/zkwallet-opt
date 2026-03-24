import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const REQUIRED_BUNDLE_FILES = [
  "manifest.json",
  "report.md",
  "result.json",
  "input.redacted.json",
  "compare.txt",
  "compare.json",
  "changes.txt",
  "changes.json",
  "trend.txt",
  "trend.json",
  "stability.txt",
  "stability.json",
  "regressions.txt",
  "regressions.json",
  "regressions-history.txt",
  "regressions-history.json",
  "regressions-history-gate-failing.txt",
  "regressions-history-gate-failing.json",
  "regressions-history-gate-failing-compare.txt",
  "regressions-history-gate-failing-compare.json",
  "regressions-history-gate-failing-compare-check.txt",
  "regressions-history-gate-failing-compare-check.json",
  "regressions-history-compare.txt",
  "regressions-history-compare.json",
  "regressions-history-compare-check.txt",
  "regressions-history-compare-check.json",
  "regressions-compare.txt",
  "regressions-compare.json",
  "regressions-changes.txt",
  "regressions-changes.json",
  "regressions-status.txt",
  "regressions-status.json",
  "regressions-overview.md",
  "regressions-overview.json",
  "regressions-next.txt",
  "regressions-plan.txt",
  "regressions-plan.json",
  "regressions-summary.md",
  "regressions-summary.json",
  "regressions-doctor.txt",
  "regressions-doctor.json",
  "regressions-gate.txt",
  "regressions-gate.json",
  "regressions-report.md",
  "regressions-report.json",
  "regressions-integrity.txt",
  "regressions-integrity.json",
  "checksums-compare.txt",
  "checksums-compare.json",
  "overview.md",
  "overview.json",
  "plan.txt",
  "plan.json",
  "summary.md",
  "summary.json",
  "checksums.json",
  "checksums.txt",
  "next.txt",
];

export const REGRESSION_BUNDLE_FILES = [
  "regressions.txt",
  "regressions.json",
  "regressions-history.txt",
  "regressions-history.json",
  "regressions-history-gate-failing.txt",
  "regressions-history-gate-failing.json",
  "regressions-history-gate-failing-compare.txt",
  "regressions-history-gate-failing-compare.json",
  "regressions-history-gate-failing-compare-check.txt",
  "regressions-history-gate-failing-compare-check.json",
  "regressions-history-compare.txt",
  "regressions-history-compare.json",
  "regressions-history-compare-check.txt",
  "regressions-history-compare-check.json",
  "regressions-compare.txt",
  "regressions-compare.json",
  "regressions-changes.txt",
  "regressions-changes.json",
  "regressions-status.txt",
  "regressions-status.json",
  "regressions-overview.md",
  "regressions-overview.json",
  "regressions-next.txt",
  "regressions-plan.txt",
  "regressions-plan.json",
  "regressions-summary.md",
  "regressions-summary.json",
  "regressions-doctor.txt",
  "regressions-doctor.json",
  "regressions-gate.txt",
  "regressions-gate.json",
  "regressions-report.md",
  "regressions-report.json",
];

export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function collectMissingFiles(basePath, relativePaths = REQUIRED_BUNDLE_FILES) {
  return relativePaths.filter((relativePath) => !fs.existsSync(path.join(basePath, relativePath)));
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function verifyChecksums(dir, issues, label) {
  const checksumsPath = path.join(dir, "checksums.json");
  if (!fs.existsSync(checksumsPath)) {
    issues.push(`${label} checksums.json is missing`);
    return;
  }

  const checksums = readJsonIfExists(checksumsPath);
  if (!Array.isArray(checksums?.files)) {
    issues.push(`${label} checksums.json is malformed`);
    return;
  }

  for (const entry of checksums.files) {
    const filePath = path.join(dir, entry.path);
    if (!fs.existsSync(filePath)) {
      issues.push(`${label} checksum target missing: ${entry.path}`);
      continue;
    }
    if (sha256File(filePath) !== entry.sha256) {
      issues.push(`${label} checksum mismatch: ${entry.path}`);
    }
  }
}

export function getChecksumStatus(dir, label = "latest/") {
  const issues = [];
  const checksumsPath = path.join(dir, "checksums.json");
  const checksumsTextPath = path.join(dir, "checksums.txt");
  const checksums = readJsonIfExists(checksumsPath);

  if (!fs.existsSync(checksumsPath)) {
    issues.push(`${label} checksums.json is missing`);
  }
  if (!fs.existsSync(checksumsTextPath)) {
    issues.push(`${label} checksums.txt is missing`);
  }
  if (fs.existsSync(checksumsPath)) {
    verifyChecksums(dir, issues, label);
  }

  return {
    ok: issues.length === 0,
    fileCount: Array.isArray(checksums?.files) ? checksums.files.length : 0,
    checksumsPath,
    checksumsTextPath,
    issues,
  };
}

export function verifyChecksumsForPaths(dir, relativePaths, issues, label) {
  const checksumsPath = path.join(dir, "checksums.json");
  if (!fs.existsSync(checksumsPath)) {
    issues.push(`${label} checksums.json is missing`);
    return;
  }

  const checksums = readJsonIfExists(checksumsPath);
  if (!Array.isArray(checksums?.files)) {
    issues.push(`${label} checksums.json is malformed`);
    return;
  }

  const checksumEntries = new Map(checksums.files.map((entry) => [entry.path, entry.sha256]));
  for (const relativePath of relativePaths) {
    const filePath = path.join(dir, relativePath);
    if (!fs.existsSync(filePath)) {
      issues.push(`${label} checksum target missing: ${relativePath}`);
      continue;
    }
    if (!checksumEntries.has(relativePath)) {
      issues.push(`${label} checksum entry missing: ${relativePath}`);
      continue;
    }
    if (sha256File(filePath) !== checksumEntries.get(relativePath)) {
      issues.push(`${label} checksum mismatch: ${relativePath}`);
    }
  }
}
