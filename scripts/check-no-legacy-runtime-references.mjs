import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const scanTargets = [
  "zktransfer-server-app/src",
  "zktransfer-custody-platform/apps/server/src",
  "zktransfer-custody-platform/apps/web",
  "zktransfer-custody-platform/apps/mobile",
  "zktransfer-custody-platform/apps/mobile-native",
  "zktransfer-client-app",
  "zk-wallet-mobile-app"
];

const allowedMatches = new Set([
  path.join(
    repoRoot,
    "zktransfer-custody-platform",
    "apps",
    "server",
    "src",
    "config.js"
  )
]);

const ignoredDirectoryNames = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  "coverage",
  ".git"
]);

const legacyPatterns = [
  /crates\/zk-wallet-circuits/g,
  /["'`]crates["'`]\s*,\s*["'`]zk-wallet-circuits["'`]/g
];

async function walk(entryPath, results) {
  const stat = await fs.stat(entryPath);
  if (stat.isDirectory()) {
    const name = path.basename(entryPath);
    if (ignoredDirectoryNames.has(name)) {
      return;
    }
    const entries = await fs.readdir(entryPath, { withFileTypes: true });
    for (const entry of entries) {
      await walk(path.join(entryPath, entry.name), results);
    }
    return;
  }

  results.push(entryPath);
}

async function collectFilesWithRipgrep() {
  const patterns = legacyPatterns.map((pattern) => pattern.source.replace(/\\\//g, "/"));
  const args = [
    "-l",
    "--hidden",
    "--glob",
    "!**/node_modules/**",
    "--glob",
    "!**/target/**",
    "--glob",
    "!**/dist/**",
    "--glob",
    "!**/build/**",
    "--glob",
    "!**/coverage/**",
    "--glob",
    "!**/.git/**"
  ];
  for (const pattern of patterns) {
    args.push("-e", pattern);
  }
  for (const target of scanTargets) {
    args.push(path.join(repoRoot, target));
  }

  try {
    const { stdout } = await execFile("rg", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    if (error?.code === 1) {
      return [];
    }
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function findPatternMatches(content) {
  const matches = [];
  for (const pattern of legacyPatterns) {
    for (const match of content.matchAll(pattern)) {
      matches.push(match[0]);
    }
  }
  return matches;
}

async function main() {
  const files = await collectFilesWithRipgrep();
  const scanFiles = files ?? [];

  if (files === null) {
    for (const target of scanTargets) {
      const absoluteTarget = path.join(repoRoot, target);
      await walk(absoluteTarget, scanFiles);
    }
  }

  const violations = [];
  for (const filePath of scanFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const matches = findPatternMatches(content);
    if (matches.length === 0) {
      continue;
    }
    if (allowedMatches.has(filePath)) {
      continue;
    }
    violations.push({
      filePath,
      matches: [...new Set(matches)]
    });
  }

  if (violations.length > 0) {
    console.error("[deprecation-guard] found legacy zk-wallet-circuits runtime references:");
    for (const violation of violations) {
      const relativePath = path.relative(repoRoot, violation.filePath);
      console.error(`- ${relativePath}: ${violation.matches.join(", ")}`);
    }
    process.exit(1);
  }

  console.log("[deprecation-guard] no unexpected legacy runtime references found.");
}

main().catch((error) => {
  console.error("[deprecation-guard] failed:", error);
  process.exit(1);
});
