import fs from "node:fs";
import path from "node:path";
import { resolveExportDir } from "./zktransfer-ops-export.mjs";

export function resolveLatestPaths(baseDir) {
  const latestDir = path.join(baseDir, "latest");
  return {
    latestDir,
    reportPath: path.join(latestDir, "report.md"),
    summaryPath: path.join(latestDir, "summary.md"),
    manifestPath: path.join(latestDir, "manifest.json")
  };
}

export function renderLatestReport(paths) {
  if (fs.existsSync(paths.reportPath)) {
    return fs.readFileSync(paths.reportPath, "utf8");
  }

  const lines = [];
  lines.push("zkTransfer Ops Latest");
  lines.push(`No latest exported report found in ${paths.latestDir}.`);
  lines.push("Run bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh export first.");
  return `${lines.join("\n")}\n`;
}

function main() {
  const baseDir = resolveExportDir(process.env);
  const paths = resolveLatestPaths(baseDir);
  process.stdout.write(renderLatestReport(paths));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
