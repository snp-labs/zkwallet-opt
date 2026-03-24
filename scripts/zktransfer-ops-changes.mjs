import fs from "node:fs";
import path from "node:path";
import { resolveExportDir } from "./zktransfer-ops-export.mjs";

export function resolveLatestComparisonPaths(baseDir) {
  const latestDir = path.join(baseDir, "latest");
  return {
    latestDir,
    compareTextPath: path.join(latestDir, "compare.txt"),
    compareJsonPath: path.join(latestDir, "compare.json")
  };
}

export function renderLatestChanges(paths) {
  if (fs.existsSync(paths.compareTextPath)) {
    return fs.readFileSync(paths.compareTextPath, "utf8");
  }

  const lines = [];
  lines.push("zkTransfer Ops Changes");
  lines.push(`No latest comparison artifact found in ${paths.latestDir}.`);
  lines.push("Run bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh export first.");
  return `${lines.join("\n")}\n`;
}

function main() {
  const baseDir = resolveExportDir(process.env);
  const paths = resolveLatestComparisonPaths(baseDir);
  process.stdout.write(renderLatestChanges(paths));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
