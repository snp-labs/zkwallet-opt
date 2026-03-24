import fs from "node:fs";
import { collectSnapshotEntries, resolveExportDir, updateExportIndex } from "./zktransfer-ops-export.mjs";

export function resolvePruneConfig(env = process.env) {
  const keepRaw = env.ZKTRANSFER_OPS_PRUNE_KEEP ?? "10";
  const keep = Number.parseInt(keepRaw, 10);

  if (!Number.isFinite(keep) || keep < 0) {
    throw new Error(`invalid ZKTRANSFER_OPS_PRUNE_KEEP: ${keepRaw}`);
  }

  return {
    keep,
    apply: env.ZKTRANSFER_OPS_PRUNE_APPLY === "1"
  };
}

export function buildPrunePlan(entries, keep) {
  return {
    keep,
    retained: entries.slice(0, keep),
    prunable: entries.slice(keep)
  };
}

export function renderPrunePlan(plan, apply) {
  const lines = [];

  lines.push("zkTransfer Ops Prune");
  lines.push(`Mode: ${apply ? "apply" : "dry-run"}`);
  lines.push(`Keep snapshots: ${plan.keep}`);
  lines.push(`Retained snapshots: ${plan.retained.length}`);
  lines.push(`Prunable snapshots: ${plan.prunable.length}`);

  if (plan.prunable.length === 0) {
    lines.push("Nothing to prune.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("Prunable snapshots:");
  for (const entry of plan.prunable) {
    lines.push(`- ${entry.snapshotName}`);
    lines.push(`  path: ${entry.snapshotDir}`);
  }

  if (!apply) {
    lines.push("Set ZKTRANSFER_OPS_PRUNE_APPLY=1 to delete these snapshots.");
  }

  return `${lines.join("\n")}\n`;
}

export function applyPrunePlan(baseDir, plan) {
  for (const entry of plan.prunable) {
    fs.rmSync(entry.snapshotDir, { recursive: true, force: true });
  }

  return updateExportIndex(baseDir, `${baseDir}/latest`);
}

function main() {
  const baseDir = resolveExportDir(process.env);
  const config = resolvePruneConfig(process.env);
  const entries = collectSnapshotEntries(baseDir);
  const plan = buildPrunePlan(entries, config.keep);

  process.stdout.write(renderPrunePlan(plan, config.apply));

  if (config.apply && plan.prunable.length > 0) {
    const result = applyPrunePlan(baseDir, plan);
    process.stdout.write(`[zktransfer-ops-prune] updated history: ${result.historyPath}\n`);
    process.stdout.write(`[zktransfer-ops-prune] updated index: ${result.indexPath}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
