import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  buildComparisonPayload,
  compareChecksumBundles,
  renderComparisonText,
  TRACKED_ARTIFACT_PATHS,
} from "./social-recovery-smoke-compare-core.mjs";
import {
  buildOverviewPayload,
  renderOverviewMarkdown,
} from "./social-recovery-smoke-overview-core.mjs";
import {
  buildPlanPayload,
  renderPlanText,
} from "./social-recovery-smoke-plan-core.mjs";
import {
  buildSummaryPayload,
  renderSummaryMarkdown,
} from "./social-recovery-smoke-summary-core.mjs";
import {
  buildTrendPayload,
  renderTrendText,
} from "./social-recovery-smoke-trend-core.mjs";
import {
  buildStabilityPayload,
  renderStabilityText,
} from "./social-recovery-smoke-stability-core.mjs";
import {
  buildRegressionsPayload,
  renderRegressionsText,
} from "./social-recovery-smoke-regressions-core.mjs";
import {
  buildRegressionsComparisonPayload,
  renderRegressionsComparisonText,
} from "./social-recovery-smoke-regressions-compare-core.mjs";
import {
  buildRegressionsIntegrityPayload,
  renderRegressionsIntegrityText,
} from "./social-recovery-smoke-regressions-integrity-core.mjs";
import {
  buildRegressionsGatePayload,
  renderRegressionsGateText,
} from "./social-recovery-smoke-regressions-gate-core.mjs";
import {
  buildRegressionsHistoryPayload,
  renderRegressionsHistoryText,
} from "./social-recovery-smoke-regressions-history-core.mjs";
import {
  buildRegressionsHistoryComparisonPayload,
  buildRegressionsHistoryComparisonCheckPayload,
  renderRegressionsHistoryComparisonCheckText,
  renderRegressionsHistoryComparisonText,
} from "./social-recovery-smoke-regressions-history-compare-core.mjs";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const passthroughArgs = args.filter((arg, index) => {
  if (arg === "--json") {
    return false;
  }
  if (args[index - 1] === "--base-dir") {
    return false;
  }
  if (arg === "--base-dir") {
    return false;
  }
  return true;
});

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

function createSnapshotName() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rewriteHeading(text, heading) {
  const lines = text.split("\n");
  if (lines.length > 0) {
    lines[0] = heading;
  }
  return lines.join("\n");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeChecksums(dir, relativePaths) {
  const checksums = relativePaths.map((relativePath) => ({
    path: relativePath,
    sha256: sha256File(path.join(dir, relativePath)),
  }));
  fs.writeFileSync(
    path.join(dir, "checksums.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), files: checksums }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, "checksums.txt"),
    checksums.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n"
  );
  return checksums;
}

function buildInlineChecksums(dir, relativePaths) {
  return {
    generatedAt: new Date().toISOString(),
    files: relativePaths
      .filter((relativePath) => fs.existsSync(path.join(dir, relativePath)))
      .map((relativePath) => ({
        path: relativePath,
        sha256: sha256File(path.join(dir, relativePath)),
      })),
  };
}

function renderHistory(index) {
  const gateFailingCount = index.snapshots.filter(
    (snapshot) => snapshot.regressionsGateOk === false
  ).length;
  const gateIssueCount = index.snapshots.reduce(
    (sum, snapshot) => sum + (snapshot.regressionsGateIssueCount ?? 0),
    0
  );
  const lines = [
    "# Social Recovery Smoke History",
    "",
    `- snapshots: ${index.snapshots.length}`,
    `- gateFailingSnapshots: ${gateFailingCount}`,
    `- gateIssues: ${gateIssueCount}`,
    "",
    "| Snapshot | Stable | Gate | Gate Issues | Account | Field Changes | Artifact Changes | Tx Hash | UserOp Hash | Generated At |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const snapshot of index.snapshots) {
    lines.push(
      `| ${snapshot.name} | ${snapshot.stabilityOk === true ? "yes" : snapshot.stabilityOk === false ? "no" : "(unknown)"} | ${snapshot.regressionsGateOk === true ? "pass" : snapshot.regressionsGateOk === false ? "fail" : "(unknown)"} | ${snapshot.regressionsGateIssueCount ?? 0} | ${snapshot.accountId || "(none)"} | ${snapshot.changedFieldsCount ?? 0} | ${snapshot.changedArtifactsCount ?? 0} | ${snapshot.submitTransactionHash || "(none)"} | ${snapshot.submitUserOpHash || "(none)"} | ${snapshot.generatedAt || "(none)"} |`
    );
  }

  lines.push("");
  return lines.join("\n");
}

function buildCombinedChangesPayload(baseDir, comparePayload, checksumComparePayload) {
  return {
    baseDir,
    compare: comparePayload,
    checksumsCompare: checksumComparePayload,
  };
}

function renderCombinedChangesText(compareText, checksumCompareText) {
  const sections = [compareText.trimEnd()];
  if (checksumCompareText) {
    sections.push(checksumCompareText.trimEnd());
  }
  return `${sections.join("\n\n")}\n`;
}

function buildCombinedRegressionsChangesPayload(baseDir, regressionsPayload, regressionsComparePayload) {
  return {
    baseDir,
    regressions: regressionsPayload,
    regressionsCompare: regressionsComparePayload,
  };
}

function renderCombinedRegressionsChangesText(regressionsText, regressionsCompareText) {
  const sections = [regressionsText.trimEnd()];
  if (regressionsCompareText) {
    sections.push(regressionsCompareText.trimEnd());
  }
  return `${sections.join("\n\n")}\n`;
}

function getRegressionsRecommendation({
  regressionCount,
  hasRegressionsCompare,
  hasRegressionsChanges,
}) {
  if (regressionCount > 0 && hasRegressionsChanges) {
    return {
      reason: "Regression bundle and delta are both available.",
      command: "npm run social-recovery:smoke:regressions:changes",
    };
  }
  if (regressionCount > 0 && hasRegressionsCompare) {
    return {
      reason: "Regression delta is available for unstable snapshots.",
      command: "npm run social-recovery:smoke:regressions:compare",
    };
  }
  if (regressionCount > 0) {
    return {
      reason: "Unstable snapshots exist but only the raw regression list is available.",
      command: "npm run social-recovery:smoke:regressions",
    };
  }
  return {
    reason: "No unstable snapshots were found in the saved regression window.",
    command: "npm run social-recovery:smoke:regressions:latest",
  };
}

function buildRegressionsStatusPayload({
  baseDir,
  regressionsHistoryPayload,
  regressionsHistoryComparePayload,
  regressionsHistoryCompareCheckPayload,
  regressionsPayload,
  regressionsComparePayload,
  regressionsChangesPayload,
  regressionsIntegrityPayload,
}) {
  return {
    baseDir,
    latestDir: path.join(baseDir, "latest"),
    hasRegressions: Boolean(regressionsPayload),
    hasRegressionsHistory: Boolean(regressionsHistoryPayload),
    hasRegressionsHistoryCompare: Boolean(regressionsHistoryComparePayload),
    hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheckPayload),
    hasRegressionsCompare: Boolean(regressionsComparePayload),
    hasRegressionsChanges: Boolean(regressionsChangesPayload),
    hasRegressionsIntegrity: Boolean(regressionsIntegrityPayload),
    regressionsHistoryCompareCheckOk:
      typeof regressionsHistoryCompareCheckPayload?.ok === "boolean"
        ? regressionsHistoryCompareCheckPayload.ok
        : null,
    regressionsHistoryCompareCheckIssueCount:
      typeof regressionsHistoryCompareCheckPayload?.issueCount === "number"
        ? regressionsHistoryCompareCheckPayload.issueCount
        : Array.isArray(regressionsHistoryCompareCheckPayload?.issues)
        ? regressionsHistoryCompareCheckPayload.issues.length
        : 0,
    regressionsIntegrityOk:
      typeof regressionsIntegrityPayload?.ok === "boolean"
        ? regressionsIntegrityPayload.ok
        : null,
    regressionsIntegrityIssueCount: Array.isArray(regressionsIntegrityPayload?.issues)
      ? regressionsIntegrityPayload.issues.length
      : 0,
    regressionCount: regressionsPayload?.regressionCount ?? 0,
    regressionsHistorySnapshotCount: regressionsHistoryPayload?.snapshotCount ?? 0,
    regressionsHistoryUnstableCount: regressionsHistoryPayload?.unstableCount ?? 0,
    regressionsHistoryCompareChangedStatusCount: Array.isArray(
      regressionsHistoryComparePayload?.changedStatuses
    )
      ? regressionsHistoryComparePayload.changedStatuses.length
      : 0,
    regressionsHistoryCompareAddedUnstableCount: Array.isArray(
      regressionsHistoryComparePayload?.addedUnstableSnapshotNames
    )
      ? regressionsHistoryComparePayload.addedUnstableSnapshotNames.length
      : 0,
    regressionsHistoryCompareChangedToUnstableCount: Array.isArray(
      regressionsHistoryComparePayload?.changedToUnstableNames
    )
      ? regressionsHistoryComparePayload.changedToUnstableNames.length
      : 0,
    regressionsHistoryCompareUnstableCountDelta:
      typeof regressionsHistoryComparePayload?.unstableCountDelta === "number"
        ? regressionsHistoryComparePayload.unstableCountDelta
        : null,
    regressionsHistoryCompareWorseningDetected:
      regressionsHistoryComparePayload?.worseningDetected === true,
    regressionCountDelta:
      typeof regressionsComparePayload?.regressionCountDelta === "number"
        ? regressionsComparePayload.regressionCountDelta
        : null,
    addedSnapshotNames: Array.isArray(regressionsComparePayload?.addedSnapshotNames)
      ? regressionsComparePayload.addedSnapshotNames
      : [],
    suggestedCommands: (() => {
      if (!regressionsPayload) {
        return [
          "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
        ];
      }
      if (regressionsIntegrityPayload?.ok === false) {
        return [
          "npm run social-recovery:smoke:regressions:integrity",
          "npm run social-recovery:smoke:regressions:doctor",
        ];
      }
      if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsChangesPayload) {
        return [
          "npm run social-recovery:smoke:regressions:changes",
          "npm run social-recovery:smoke:regressions:compare",
          "npm run social-recovery:smoke:regressions",
        ];
      }
      if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsComparePayload) {
        return [
          "npm run social-recovery:smoke:regressions:compare",
          "npm run social-recovery:smoke:regressions",
        ];
      }
      if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryCompareCheckPayload?.ok === false) {
        return [
          "npm run social-recovery:smoke:regressions:history:compare:check",
          "npm run social-recovery:smoke:regressions:history:compare",
          "npm run social-recovery:smoke:regressions:history:unstable",
        ];
      }
      if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryComparePayload?.worseningDetected === true) {
        return [
          "npm run social-recovery:smoke:regressions:history:compare:check",
          "npm run social-recovery:smoke:regressions:history:compare",
          "npm run social-recovery:smoke:regressions:history:unstable",
        ];
      }
      if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryComparePayload) {
        return [
          "npm run social-recovery:smoke:regressions:history:compare",
          "npm run social-recovery:smoke:regressions:history:unstable",
        ];
      }
      if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryPayload) {
        return [
          "npm run social-recovery:smoke:regressions:history:unstable",
          "npm run social-recovery:smoke:regressions",
        ];
      }
      if ((regressionsPayload.regressionCount ?? 0) > 0) {
        return ["npm run social-recovery:smoke:regressions"];
      }
      return ["npm run social-recovery:smoke:regressions:latest"];
    })(),
  };
}

function renderRegressionsStatusText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Status",
    "",
    `- baseDir: ${payload.baseDir}`,
    `- hasRegressions: ${payload.hasRegressions}`,
    `- hasRegressionsHistory: ${payload.hasRegressionsHistory}`,
    `- hasRegressionsHistoryCompare: ${payload.hasRegressionsHistoryCompare}`,
    `- hasRegressionsHistoryCompareCheck: ${payload.hasRegressionsHistoryCompareCheck}`,
    `- hasRegressionsCompare: ${payload.hasRegressionsCompare}`,
    `- hasRegressionsChanges: ${payload.hasRegressionsChanges}`,
    `- hasRegressionsIntegrity: ${payload.hasRegressionsIntegrity}`,
    `- regressionsHistoryCompareCheckOk: ${payload.regressionsHistoryCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryCompareCheckIssueCount: ${payload.regressionsHistoryCompareCheckIssueCount}`,
    `- regressionsIntegrityOk: ${payload.regressionsIntegrityOk ?? "(not available)"}`,
    `- regressionsIntegrityIssueCount: ${payload.regressionsIntegrityIssueCount}`,
    `- regressionCount: ${payload.regressionCount}`,
    `- regressionsHistorySnapshotCount: ${payload.regressionsHistorySnapshotCount}`,
    `- regressionsHistoryUnstableCount: ${payload.regressionsHistoryUnstableCount}`,
    `- regressionsHistoryCompareChangedStatusCount: ${payload.regressionsHistoryCompareChangedStatusCount}`,
    `- regressionsHistoryCompareAddedUnstableCount: ${payload.regressionsHistoryCompareAddedUnstableCount}`,
    `- regressionsHistoryCompareChangedToUnstableCount: ${payload.regressionsHistoryCompareChangedToUnstableCount}`,
    `- regressionsHistoryCompareWorseningDetected: ${payload.regressionsHistoryCompareWorseningDetected}`,
    `- regressionsHistoryCompareUnstableCountDelta: ${payload.regressionsHistoryCompareUnstableCountDelta ?? "(not available)"}`,
    `- regressionCountDelta: ${payload.regressionCountDelta ?? "(not available)"}`,
    `- addedSnapshotNames: ${payload.addedSnapshotNames.join(", ") || "(none)"}`,
    "",
    "Recommended next commands:",
  ];
  for (const command of payload.suggestedCommands) {
    lines.push(`- ${command}`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildRegressionsNextPayload({
  baseDir,
  regressionsHistoryPayload,
  regressionsHistoryComparePayload,
  regressionsHistoryCompareCheckPayload,
  regressionsPayload,
  regressionsComparePayload,
  regressionsChangesPayload,
  regressionsIntegrityPayload,
}) {
  const recommendation = (() => {
    if (!regressionsPayload) {
      return {
        reason: "No saved regression artifact exists yet.",
        command:
          "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
      };
    }
    if (regressionsIntegrityPayload?.ok === false) {
      return {
        reason: "Saved regression integrity check is failing.",
        command: "npm run social-recovery:smoke:regressions:integrity",
      };
    }
    if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsChangesPayload) {
      return {
        reason: "Saved regression bundle and regression delta are both available.",
        command: "npm run social-recovery:smoke:regressions:changes",
      };
    }
    if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsComparePayload) {
      return {
        reason: "Regression delta is available but combined regression changes are not.",
        command: "npm run social-recovery:smoke:regressions:compare",
      };
    }
    if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryCompareCheckPayload?.ok === false) {
      return {
        reason: "Saved regression history compare check is already failing on worsening behavior.",
        command: "npm run social-recovery:smoke:regressions:history:compare:check",
      };
    }
    if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryComparePayload?.worseningDetected === true) {
      return {
        reason: "Regression timeline delta already shows worsening unstable behavior.",
        command: "npm run social-recovery:smoke:regressions:history:compare:check",
      };
    }
    if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryComparePayload) {
      return {
        reason: "Regression timeline delta is available even though regression diff artifacts are not.",
        command: "npm run social-recovery:smoke:regressions:history:compare",
      };
    }
    if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryPayload) {
      return {
        reason: "Regression timeline is available even though saved diff artifacts are not.",
        command: "npm run social-recovery:smoke:regressions:history:unstable",
      };
    }
    if ((regressionsPayload.regressionCount ?? 0) > 0) {
      return {
        reason: "Unstable snapshots were found in the latest saved regression window.",
        command: "npm run social-recovery:smoke:regressions",
      };
    }
    return {
      reason: "No regressions were found in the latest saved regression window.",
      command: "npm run social-recovery:smoke:regressions:latest",
    };
  })();

  return {
    baseDir,
    latestDir: path.join(baseDir, "latest"),
    hasRegressions: Boolean(regressionsPayload),
    hasRegressionsHistory: Boolean(regressionsHistoryPayload),
    hasRegressionsHistoryCompare: Boolean(regressionsHistoryComparePayload),
    hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheckPayload),
    hasRegressionsCompare: Boolean(regressionsComparePayload),
    hasRegressionsChanges: Boolean(regressionsChangesPayload),
    hasRegressionsIntegrity: Boolean(regressionsIntegrityPayload),
    regressionsIntegrityOk:
      typeof regressionsIntegrityPayload?.ok === "boolean"
        ? regressionsIntegrityPayload.ok
        : null,
    regressionsHistoryCompareCheckOk:
      typeof regressionsHistoryCompareCheckPayload?.ok === "boolean"
        ? regressionsHistoryCompareCheckPayload.ok
        : null,
    regressionCount: regressionsPayload?.regressionCount ?? 0,
    reason: recommendation.reason,
    command: recommendation.command,
  };
}

function buildRegressionsOverviewPayload({
  baseDir,
  regressionsHistoryPayload,
  regressionsHistoryComparePayload,
  regressionsHistoryCompareCheckPayload,
  regressionsPayload,
  regressionsComparePayload,
  regressionsChangesPayload,
  regressionsIntegrityPayload,
}) {
  const payload = {
    baseDir,
    latestDir: path.join(baseDir, "latest"),
    regressionCount: regressionsPayload?.regressionCount ?? 0,
    windowSize: regressionsPayload?.windowSize ?? null,
    hasRegressions: Boolean(regressionsPayload),
    hasRegressionsHistory: Boolean(regressionsHistoryPayload),
    hasRegressionsHistoryCompare: Boolean(regressionsHistoryComparePayload),
    hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheckPayload),
    hasRegressionsCompare: Boolean(regressionsComparePayload),
    hasRegressionsChanges: Boolean(regressionsChangesPayload),
    hasRegressionsIntegrity: Boolean(regressionsIntegrityPayload),
    regressionsHistoryCompareCheckOk:
      typeof regressionsHistoryCompareCheckPayload?.ok === "boolean"
        ? regressionsHistoryCompareCheckPayload.ok
        : null,
    regressionsHistoryCompareCheckIssueCount:
      typeof regressionsHistoryCompareCheckPayload?.issueCount === "number"
        ? regressionsHistoryCompareCheckPayload.issueCount
        : Array.isArray(regressionsHistoryCompareCheckPayload?.issues)
        ? regressionsHistoryCompareCheckPayload.issues.length
        : 0,
    regressionsIntegrityOk:
      typeof regressionsIntegrityPayload?.ok === "boolean"
        ? regressionsIntegrityPayload.ok
        : null,
    regressionsIntegrityIssueCount: Array.isArray(regressionsIntegrityPayload?.issues)
      ? regressionsIntegrityPayload.issues.length
      : 0,
    regressionsHistorySnapshotCount: regressionsHistoryPayload?.snapshotCount ?? 0,
    regressionsHistoryUnstableCount: regressionsHistoryPayload?.unstableCount ?? 0,
    regressionsHistoryCompareChangedStatusCount: Array.isArray(
      regressionsHistoryComparePayload?.changedStatuses
    )
      ? regressionsHistoryComparePayload.changedStatuses.length
      : 0,
    regressionsHistoryCompareAddedUnstableCount: Array.isArray(
      regressionsHistoryComparePayload?.addedUnstableSnapshotNames
    )
      ? regressionsHistoryComparePayload.addedUnstableSnapshotNames.length
      : 0,
    regressionsHistoryCompareChangedToUnstableCount: Array.isArray(
      regressionsHistoryComparePayload?.changedToUnstableNames
    )
      ? regressionsHistoryComparePayload.changedToUnstableNames.length
      : 0,
    regressionsHistoryCompareWorseningDetected:
      regressionsHistoryComparePayload?.worseningDetected === true,
    regressionsHistoryCompareUnstableCountDelta:
      typeof regressionsHistoryComparePayload?.unstableCountDelta === "number"
        ? regressionsHistoryComparePayload.unstableCountDelta
        : null,
    regressionCountDelta:
      typeof regressionsComparePayload?.regressionCountDelta === "number"
        ? regressionsComparePayload.regressionCountDelta
        : null,
    addedSnapshotNames: Array.isArray(regressionsComparePayload?.addedSnapshotNames)
      ? regressionsComparePayload.addedSnapshotNames
      : [],
    unstableSnapshotNames: Array.isArray(regressionsPayload?.regressions)
      ? regressionsPayload.regressions.map((entry) => entry.name).filter(Boolean)
      : [],
  };
  payload.next = getRegressionsRecommendation(payload);
  return payload;
}

function renderRegressionsOverviewMarkdown(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Overview",
    "",
    `- baseDir: ${payload.baseDir}`,
    `- regressionCount: ${payload.regressionCount}`,
    `- windowSize: ${payload.windowSize ?? "(not available)"}`,
    `- hasRegressions: ${payload.hasRegressions}`,
    `- hasRegressionsHistory: ${payload.hasRegressionsHistory}`,
    `- hasRegressionsHistoryCompare: ${payload.hasRegressionsHistoryCompare}`,
    `- hasRegressionsHistoryCompareCheck: ${payload.hasRegressionsHistoryCompareCheck}`,
    `- hasRegressionsCompare: ${payload.hasRegressionsCompare}`,
    `- hasRegressionsChanges: ${payload.hasRegressionsChanges}`,
    `- hasRegressionsIntegrity: ${payload.hasRegressionsIntegrity}`,
    `- regressionsHistoryCompareCheckOk: ${payload.regressionsHistoryCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryCompareCheckIssueCount: ${payload.regressionsHistoryCompareCheckIssueCount}`,
    `- regressionsIntegrityOk: ${payload.regressionsIntegrityOk ?? "(not available)"}`,
    `- regressionsIntegrityIssueCount: ${payload.regressionsIntegrityIssueCount}`,
    `- regressionsHistorySnapshotCount: ${payload.regressionsHistorySnapshotCount}`,
    `- regressionsHistoryUnstableCount: ${payload.regressionsHistoryUnstableCount}`,
    `- regressionsHistoryCompareChangedStatusCount: ${payload.regressionsHistoryCompareChangedStatusCount}`,
    `- regressionsHistoryCompareAddedUnstableCount: ${payload.regressionsHistoryCompareAddedUnstableCount}`,
    `- regressionsHistoryCompareChangedToUnstableCount: ${payload.regressionsHistoryCompareChangedToUnstableCount}`,
    `- regressionsHistoryCompareWorseningDetected: ${payload.regressionsHistoryCompareWorseningDetected}`,
    `- regressionsHistoryCompareUnstableCountDelta: ${payload.regressionsHistoryCompareUnstableCountDelta ?? "(not available)"}`,
    `- regressionCountDelta: ${payload.regressionCountDelta ?? "(not available)"}`,
    `- unstableSnapshots: ${payload.unstableSnapshotNames.join(", ") || "(none)"}`,
    `- addedSnapshots: ${payload.addedSnapshotNames.join(", ") || "(none)"}`,
    "",
    "## Next",
    "",
    `- reason: ${payload.next.reason}`,
    `- command: ${payload.next.command}`,
    "",
  ];
  return lines.join("\n");
}

function buildRegressionsPlanPayload({
  baseDir,
  regressionsHistoryPayload,
  regressionsHistoryComparePayload,
  regressionsHistoryCompareCheckPayload,
  regressionsPayload,
  regressionsComparePayload,
  regressionsChangesPayload,
  regressionsIntegrityPayload,
}) {
  let reason;
  let steps;

  if (!regressionsPayload) {
    reason = "No saved regression artifacts exist yet.";
    steps = [
      "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
      "npm run social-recovery:smoke:regressions:status",
    ];
  } else if (regressionsIntegrityPayload?.ok === false) {
    reason = "Saved regression integrity is failing and should be fixed before diff review.";
    steps = [
      "npm run social-recovery:smoke:regressions:integrity",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsChangesPayload) {
    reason = "Combined regression diff is available for unstable snapshots.";
    steps = [
      "npm run social-recovery:smoke:regressions:changes",
      "npm run social-recovery:smoke:regressions:overview",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsComparePayload) {
    reason = "Regression delta exists, but combined regression changes do not.";
    steps = [
      "npm run social-recovery:smoke:regressions:compare",
      "npm run social-recovery:smoke:regressions",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryCompareCheckPayload?.ok === false) {
    reason = "A saved history-compare check already shows worsening unstable behavior.";
    steps = [
      "npm run social-recovery:smoke:regressions:history:compare:check",
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryComparePayload?.worseningDetected === true) {
    reason = "The saved regression timeline delta already shows worsening unstable behavior.";
    steps = [
      "npm run social-recovery:smoke:regressions:history:compare:check",
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryComparePayload) {
    reason = "A saved regression timeline delta exists even though regression diff artifacts do not.";
    steps = [
      "npm run social-recovery:smoke:regressions:history:compare",
      "npm run social-recovery:smoke:regressions:history:unstable",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else if ((regressionsPayload.regressionCount ?? 0) > 0 && regressionsHistoryPayload) {
    reason = "A saved regression timeline exists even though diff artifacts do not.";
    steps = [
      "npm run social-recovery:smoke:regressions:history:unstable",
      "npm run social-recovery:smoke:regressions",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else if ((regressionsPayload.regressionCount ?? 0) > 0) {
    reason = "Only the raw regression list is available for unstable snapshots.";
    steps = [
      "npm run social-recovery:smoke:regressions",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  } else {
    reason = "No unstable snapshots are present in the saved regression window.";
    steps = [
      "npm run social-recovery:smoke:regressions:latest",
      "npm run social-recovery:smoke:regressions:doctor",
    ];
  }

  return {
    baseDir,
    hasRegressions: Boolean(regressionsPayload),
    hasRegressionsHistory: Boolean(regressionsHistoryPayload),
    hasRegressionsHistoryCompare: Boolean(regressionsHistoryComparePayload),
    hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheckPayload),
    hasRegressionsCompare: Boolean(regressionsComparePayload),
    hasRegressionsChanges: Boolean(regressionsChangesPayload),
    hasRegressionsIntegrity: Boolean(regressionsIntegrityPayload),
    regressionsIntegrityOk:
      typeof regressionsIntegrityPayload?.ok === "boolean"
        ? regressionsIntegrityPayload.ok
        : null,
    regressionsHistoryCompareCheckOk:
      typeof regressionsHistoryCompareCheckPayload?.ok === "boolean"
        ? regressionsHistoryCompareCheckPayload.ok
        : null,
    regressionCount: regressionsPayload?.regressionCount ?? 0,
    reason,
    steps,
  };
}

function renderRegressionsPlanText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Plan",
    "",
    `- reason: ${payload.reason}`,
    "",
  ];
  payload.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  lines.push("");
  return lines.join("\n");
}

function buildRegressionsSummaryPayload({ baseDir, overviewPayload, historyText }) {
  return {
    baseDir,
    overview: overviewPayload,
    paths: {
      latestRegressionsPath: path.join(baseDir, "latest", "regressions.txt"),
      latestRegressionsHistoryComparePath: path.join(
        baseDir,
        "latest",
        "regressions-history-compare.txt"
      ),
      latestRegressionsHistoryCompareCheckPath: path.join(
        baseDir,
        "latest",
        "regressions-history-compare-check.txt"
      ),
      latestRegressionsComparePath: path.join(baseDir, "latest", "regressions-compare.txt"),
      latestRegressionsChangesPath: path.join(baseDir, "latest", "regressions-changes.txt"),
      latestRegressionsStatusPath: path.join(baseDir, "latest", "regressions-status.txt"),
      latestRegressionsOverviewPath: path.join(baseDir, "latest", "regressions-overview.md"),
      latestRegressionsPlanPath: path.join(baseDir, "latest", "regressions-plan.txt"),
      latestRegressionsNextPath: path.join(baseDir, "latest", "regressions-next.txt"),
      latestRegressionsGatePath: path.join(baseDir, "latest", "regressions-gate.txt"),
      historyPath: path.join(baseDir, "history.md"),
    },
    historyPreview: historyText
      ? historyText.split("\n").slice(0, 8).join("\n").trim()
      : null,
  };
}

function renderRegressionsSummaryMarkdown(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Summary",
    "",
    renderRegressionsOverviewMarkdown(payload.overview).trimEnd(),
    "",
    "## Paths",
    "",
    `- latestRegressionsPath: ${payload.paths.latestRegressionsPath}`,
    `- latestRegressionsHistoryComparePath: ${payload.paths.latestRegressionsHistoryComparePath}`,
    `- latestRegressionsHistoryCompareCheckPath: ${payload.paths.latestRegressionsHistoryCompareCheckPath}`,
    `- latestRegressionsComparePath: ${payload.paths.latestRegressionsComparePath}`,
    `- latestRegressionsChangesPath: ${payload.paths.latestRegressionsChangesPath}`,
    `- latestRegressionsStatusPath: ${payload.paths.latestRegressionsStatusPath}`,
    `- latestRegressionsOverviewPath: ${payload.paths.latestRegressionsOverviewPath}`,
    `- latestRegressionsPlanPath: ${payload.paths.latestRegressionsPlanPath}`,
    `- latestRegressionsNextPath: ${payload.paths.latestRegressionsNextPath}`,
    `- latestRegressionsGatePath: ${payload.paths.latestRegressionsGatePath}`,
    `- historyPath: ${payload.paths.historyPath}`,
    "",
    "## History Preview",
    "",
    payload.historyPreview || "(history not available)",
    "",
  ];
  return lines.join("\n");
}

function buildRegressionsDoctorPayload({
  baseDir,
  regressionsHistoryComparePayload,
  regressionsHistoryCompareCheckPayload,
  regressionsPayload,
  regressionsComparePayload,
  regressionsChangesPayload,
  regressionsIntegrityPayload,
}) {
  const issues = [];
  if (!regressionsPayload) {
    issues.push("latest regressions.json is missing");
  }
  if (regressionsPayload && (regressionsPayload.regressionCount ?? 0) > 0 && !regressionsChangesPayload) {
    issues.push("latest regressions-changes.json is missing while unstable snapshots exist");
  }
  if (regressionsPayload && (regressionsPayload.regressionCount ?? 0) > 0 && !regressionsComparePayload) {
    issues.push("latest regressions-compare.json is missing while unstable snapshots exist");
  }
  if (
    regressionsPayload &&
    (regressionsPayload.regressionCount ?? 0) > 0 &&
    regressionsHistoryComparePayload &&
    !regressionsHistoryCompareCheckPayload
  ) {
    issues.push(
      "latest regressions-history-compare-check.json is missing while timeline delta exists"
    );
  }
  if (regressionsIntegrityPayload?.ok === false) {
    issues.push("latest regressions-integrity.json reports integrity issues");
  }

  return {
    ok: issues.length === 0,
    baseDir,
    latestDir: path.join(baseDir, "latest"),
    regressionCount: regressionsPayload?.regressionCount ?? 0,
    hasRegressions: Boolean(regressionsPayload),
    hasRegressionsHistoryCompare: Boolean(regressionsHistoryComparePayload),
    hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheckPayload),
    hasRegressionsCompare: Boolean(regressionsComparePayload),
    hasRegressionsChanges: Boolean(regressionsChangesPayload),
    hasRegressionsIntegrity: Boolean(regressionsIntegrityPayload),
    regressionsIntegrityOk:
      typeof regressionsIntegrityPayload?.ok === "boolean"
        ? regressionsIntegrityPayload.ok
        : null,
    issues,
    nextCommand: !regressionsPayload
      ? "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json"
      : regressionsIntegrityPayload?.ok === false
      ? "npm run social-recovery:smoke:regressions:integrity"
      : regressionsChangesPayload
      ? "npm run social-recovery:smoke:regressions:changes"
      : regressionsComparePayload
      ? "npm run social-recovery:smoke:regressions:compare"
      : "npm run social-recovery:smoke:regressions",
  };
}

function renderRegressionsDoctorText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Doctor",
    "",
    `- ok: ${payload.ok}`,
    `- regressionCount: ${payload.regressionCount}`,
    `- hasRegressions: ${payload.hasRegressions}`,
    `- hasRegressionsHistoryCompare: ${payload.hasRegressionsHistoryCompare}`,
    `- hasRegressionsHistoryCompareCheck: ${payload.hasRegressionsHistoryCompareCheck}`,
    `- hasRegressionsCompare: ${payload.hasRegressionsCompare}`,
    `- hasRegressionsChanges: ${payload.hasRegressionsChanges}`,
    `- hasRegressionsIntegrity: ${payload.hasRegressionsIntegrity}`,
    `- regressionsIntegrityOk: ${payload.regressionsIntegrityOk ?? "(not available)"}`,
    `- nextCommand: ${payload.nextCommand}`,
    "",
  ];
  if (payload.issues.length === 0) {
    lines.push("- issues: none", "");
  } else {
    lines.push("- issues:");
    for (const issue of payload.issues) {
      lines.push(`  - ${issue}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildRegressionsReportPayload({
  baseDir,
  regressionsOverviewPayload,
  regressionsSummaryPayload,
  regressionsPlanPayload,
  regressionsDoctorPayload,
  regressionsGatePayload,
  regressionsNextPayload,
}) {
  return {
    baseDir,
    generatedAt: new Date().toISOString(),
    overview: regressionsOverviewPayload,
    summary: regressionsSummaryPayload,
    plan: regressionsPlanPayload,
    doctor: regressionsDoctorPayload,
    gate: regressionsGatePayload,
    next: regressionsNextPayload,
  };
}

function renderRegressionsReportMarkdown(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Report",
    "",
    renderRegressionsSummaryMarkdown(payload.summary).trimEnd(),
    "",
    "## Plan",
    "",
    `- reason: ${payload.plan.reason}`,
    ...payload.plan.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Doctor",
    "",
    `- ok: ${payload.doctor.ok}`,
    `- nextCommand: ${payload.doctor.nextCommand}`,
    payload.doctor.issues.length === 0
      ? "- issues: none"
      : "- issues:",
    ...(payload.doctor.issues.length === 0
      ? []
      : payload.doctor.issues.map((issue) => `  - ${issue}`)),
    "",
    "## Gate",
    "",
    `- ok: ${payload.gate.ok}`,
    `- issueCount: ${payload.gate.issueCount}`,
    `- nextCommand: ${payload.gate.nextCommand}`,
    payload.gate.issues.length === 0 ? "- issues: none" : "- issues:",
    ...(payload.gate.issues.length === 0
      ? []
      : payload.gate.issues.map((issue) => `  - ${issue}`)),
    "",
    "## Next",
    "",
    `- reason: ${payload.next.reason}`,
    `- command: ${payload.next.command}`,
    "",
  ];
  return lines.join("\n");
}

function writeRegressionArtifacts(dir, artifacts) {
  fs.writeFileSync(path.join(dir, "regressions.txt"), artifacts.regressionsText);
  writeJson(path.join(dir, "regressions.json"), artifacts.regressionsPayload);
  fs.writeFileSync(path.join(dir, "regressions-history.txt"), artifacts.regressionsHistoryText);
  writeJson(path.join(dir, "regressions-history.json"), artifacts.regressionsHistoryPayload);
  fs.writeFileSync(
    path.join(dir, "regressions-history-gate-failing.txt"),
    artifacts.regressionsHistoryGateFailingText
  );
  writeJson(
    path.join(dir, "regressions-history-gate-failing.json"),
    artifacts.regressionsHistoryGateFailingPayload
  );
  fs.writeFileSync(
    path.join(dir, "regressions-history-compare.txt"),
    artifacts.regressionsHistoryCompareText
  );
  writeJson(
    path.join(dir, "regressions-history-compare.json"),
    artifacts.regressionsHistoryComparePayload
  );
  fs.writeFileSync(
    path.join(dir, "regressions-history-compare-check.txt"),
    artifacts.regressionsHistoryCompareCheckText
  );
  writeJson(
    path.join(dir, "regressions-history-compare-check.json"),
    artifacts.regressionsHistoryCompareCheckPayload
  );
  fs.writeFileSync(
    path.join(dir, "regressions-history-gate-failing-compare.txt"),
    artifacts.regressionsHistoryGateFailingCompareText
  );
  writeJson(
    path.join(dir, "regressions-history-gate-failing-compare.json"),
    artifacts.regressionsHistoryGateFailingComparePayload
  );
  fs.writeFileSync(
    path.join(dir, "regressions-history-gate-failing-compare-check.txt"),
    artifacts.regressionsHistoryGateFailingCompareCheckText
  );
  writeJson(
    path.join(dir, "regressions-history-gate-failing-compare-check.json"),
    artifacts.regressionsHistoryGateFailingCompareCheckPayload
  );
  fs.writeFileSync(path.join(dir, "regressions-compare.txt"), artifacts.regressionsCompareText);
  writeJson(path.join(dir, "regressions-compare.json"), artifacts.regressionsComparePayload);
  fs.writeFileSync(path.join(dir, "regressions-changes.txt"), artifacts.combinedRegressionsChangesText);
  writeJson(path.join(dir, "regressions-changes.json"), artifacts.combinedRegressionsChangesPayload);
  fs.writeFileSync(path.join(dir, "regressions-status.txt"), artifacts.regressionsStatusText);
  writeJson(path.join(dir, "regressions-status.json"), artifacts.regressionsStatusPayload);
  fs.writeFileSync(path.join(dir, "regressions-overview.md"), artifacts.regressionsOverviewMarkdown);
  writeJson(path.join(dir, "regressions-overview.json"), artifacts.regressionsOverviewPayload);
  fs.writeFileSync(path.join(dir, "regressions-next.txt"), `${artifacts.regressionsNextPayload.command}\n`);
  fs.writeFileSync(path.join(dir, "regressions-plan.txt"), artifacts.regressionsPlanText);
  writeJson(path.join(dir, "regressions-plan.json"), artifacts.regressionsPlanPayload);
  fs.writeFileSync(path.join(dir, "regressions-summary.md"), artifacts.regressionsSummaryMarkdown);
  writeJson(path.join(dir, "regressions-summary.json"), artifacts.regressionsSummaryPayload);
  fs.writeFileSync(path.join(dir, "regressions-doctor.txt"), artifacts.regressionsDoctorText);
  writeJson(path.join(dir, "regressions-doctor.json"), artifacts.regressionsDoctorPayload);
  fs.writeFileSync(path.join(dir, "regressions-gate.txt"), artifacts.regressionsGateText);
  writeJson(path.join(dir, "regressions-gate.json"), artifacts.regressionsGatePayload);
  fs.writeFileSync(path.join(dir, "regressions-report.md"), artifacts.regressionsReportMarkdown);
  writeJson(path.join(dir, "regressions-report.json"), artifacts.regressionsReportPayload);
}

async function main() {
  const baseDir = getBaseDir();
  const snapshotsDir = path.join(baseDir, "snapshots");
  const latestDir = path.join(baseDir, "latest");
  const snapshotName = createSnapshotName();
  const snapshotDir = path.join(snapshotsDir, snapshotName);

  ensureDir(snapshotsDir);

  const smokeScriptPath = path.join(appDir, "scripts", "social-recovery-smoke.mjs");
  const smokeArgs = [smokeScriptPath, "--json", "--output-dir", snapshotDir, ...passthroughArgs];
  const { stdout } = await execFileAsync(process.execPath, smokeArgs, {
    cwd: appDir,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  const result = JSON.parse(stdout);
  const manifestPath = path.join(snapshotDir, "manifest.json");
  const manifest = readJson(manifestPath, {});
  const snapshotRecord = {
    name: snapshotName,
    generatedAt: manifest.generatedAt || new Date().toISOString(),
    snapshotDir,
    accountId: manifest.accountId || null,
    zkAccountAddress: manifest.zkAccountAddress || null,
    submitTransactionHash: manifest.submitTransactionHash || null,
    submitUserOpHash: manifest.submitUserOpHash || null,
  };

  fs.rmSync(latestDir, { recursive: true, force: true });
  fs.cpSync(snapshotDir, latestDir, { recursive: true });

  const indexPath = path.join(snapshotsDir, "index.json");
  const existingIndex = readJson(indexPath, { snapshots: [] });
  const snapshots = [
    snapshotRecord,
    ...existingIndex.snapshots.filter((entry) => entry.name !== snapshotName),
  ];
  const index = { generatedAt: new Date().toISOString(), snapshots };
  let comparePayload = null;
  let compareText = "Need at least two smoke export snapshots to compare.\n";
  let checksumComparePayload = null;
  let checksumCompareText = "Need at least two smoke export snapshots to compare checksum bundles.\n";
  if (snapshots.length >= 2) {
    const latest = snapshots[0];
    const previous = snapshots[1];
    const latestManifest = readJson(path.join(latest.snapshotDir, "manifest.json"), {});
    const previousManifest = readJson(path.join(previous.snapshotDir, "manifest.json"), {});
    const latestChecksums = buildInlineChecksums(latest.snapshotDir, TRACKED_ARTIFACT_PATHS);
    const previousChecksums = readJson(path.join(previous.snapshotDir, "checksums.json"), null);
    comparePayload = buildComparisonPayload(
      latest,
      previous,
      latestManifest,
      previousManifest,
      baseDir,
      latestChecksums,
      previousChecksums
    );
    compareText = renderComparisonText(comparePayload);
    const checksumComparisons = compareChecksumBundles(latestChecksums, previousChecksums);
    checksumComparePayload = {
      baseDir,
      trackedArtifactPaths: TRACKED_ARTIFACT_PATHS,
      latest: {
        name: latest.name,
        generatedAt: latest.generatedAt || null,
        snapshotDir: latest.snapshotDir,
      },
      previous: {
        name: previous.name,
        generatedAt: previous.generatedAt || null,
        snapshotDir: previous.snapshotDir,
      },
      changedArtifacts: checksumComparisons.filter((entry) => entry.changed),
      unchangedArtifacts: checksumComparisons
        .filter((entry) => !entry.changed)
        .map((entry) => entry.path),
    };
    checksumCompareText = [
      "# Social Recovery Smoke Checksum Compare",
      "",
      `- latest: ${checksumComparePayload.latest.name}`,
      `- previous: ${checksumComparePayload.previous.name}`,
      "",
      checksumComparePayload.changedArtifacts.length === 0
        ? "No tracked artifact checksum changes."
        : "Changed artifacts:",
      ...(
        checksumComparePayload.changedArtifacts.length === 0
          ? []
          : checksumComparePayload.changedArtifacts.map(
              (entry) =>
                `- ${entry.path}: ${entry.previousSha256 || "(none)"} -> ${entry.latestSha256 || "(none)"}`
            )
      ),
      "",
      `Unchanged artifacts: ${checksumComparePayload.unchangedArtifacts.join(", ") || "(none)"}`,
      "",
    ].join("\n");
  }
  snapshotRecord.changedFieldsCount = Array.isArray(comparePayload?.changedFields)
    ? comparePayload.changedFields.length
    : 0;
  snapshotRecord.changedArtifactsCount = Array.isArray(checksumComparePayload?.changedArtifacts)
    ? checksumComparePayload.changedArtifacts.length
    : 0;

  const trendPayload = {
    baseDir,
    ...buildTrendPayload(index, 5),
  };
  const trendText = renderTrendText(trendPayload);
  const stabilityPayload = buildStabilityPayload(trendPayload, {
    requireLastTwoStable: false,
    maxAverageChangedFieldsCount: null,
    maxAverageChangedArtifactsCount: null,
  });
  const stabilityText = renderStabilityText(stabilityPayload, renderTrendText);
  const regressionsPayload = {
    baseDir,
    ...buildRegressionsPayload(index, 10),
  };
  const regressionsText = renderRegressionsText(regressionsPayload);
  const regressionsHistoryPayload = {
    baseDir,
    ...buildRegressionsHistoryPayload(index, 10, false),
  };
  const regressionsHistoryText = renderRegressionsHistoryText(regressionsHistoryPayload);
  const regressionsHistoryGateFailingPayload = {
    baseDir,
    ...buildRegressionsHistoryPayload(index, 10, false, true),
  };
  const regressionsHistoryGateFailingText = renderRegressionsHistoryText(
    regressionsHistoryGateFailingPayload
  );
  let regressionsHistoryGateFailingComparePayload = null;
  let regressionsHistoryGateFailingCompareText =
    "Need at least two smoke export snapshots to compare gate-failing regression history.\n";
  let regressionsHistoryGateFailingCompareCheckPayload = null;
  let regressionsHistoryGateFailingCompareCheckText =
    "Need at least two smoke export snapshots to check gate-failing regression history delta.\n";
  let regressionsHistoryComparePayload = null;
  let regressionsHistoryCompareText =
    "Need at least two smoke export snapshots to compare regression history.\n";
  let regressionsHistoryCompareCheckPayload = null;
  let regressionsHistoryCompareCheckText =
    "Need at least two smoke export snapshots to check regression history delta.\n";
  let regressionsComparePayload = null;
  let regressionsCompareText =
    "Need at least two smoke export snapshots to compare regressions.\n";
  if (snapshots.length >= 2) {
    const latest = snapshots[0];
    const previous = snapshots[1];
    const previousRegressionsHistory = readJson(
      path.join(previous.snapshotDir, "regressions-history.json"),
      null
    );
    const previousRegressionsHistoryGateFailing = readJson(
      path.join(previous.snapshotDir, "regressions-history-gate-failing.json"),
      null
    );
    regressionsHistoryGateFailingComparePayload = buildRegressionsHistoryComparisonPayload(
      baseDir,
      latest,
      previous,
      regressionsHistoryGateFailingPayload,
      previousRegressionsHistoryGateFailing
    );
    regressionsHistoryGateFailingCompareText = rewriteHeading(
      renderRegressionsHistoryComparisonText(regressionsHistoryGateFailingComparePayload),
      "# Social Recovery Smoke Regressions Gate-Failing History Compare"
    );
    regressionsHistoryGateFailingCompareCheckPayload =
      buildRegressionsHistoryComparisonCheckPayload(
        regressionsHistoryGateFailingComparePayload
      );
    regressionsHistoryGateFailingCompareCheckText = rewriteHeading(
      renderRegressionsHistoryComparisonCheckText(
        regressionsHistoryGateFailingCompareCheckPayload
      ),
      "# Social Recovery Smoke Regressions Gate-Failing History Compare Check"
    );
    regressionsHistoryComparePayload = buildRegressionsHistoryComparisonPayload(
      baseDir,
      latest,
      previous,
      regressionsHistoryPayload,
      previousRegressionsHistory
    );
    regressionsHistoryCompareText = renderRegressionsHistoryComparisonText(
      regressionsHistoryComparePayload
    );
    regressionsHistoryCompareCheckPayload = buildRegressionsHistoryComparisonCheckPayload(
      regressionsHistoryComparePayload
    );
    regressionsHistoryCompareCheckText = renderRegressionsHistoryComparisonCheckText(
      regressionsHistoryCompareCheckPayload
    );
    const latestRegressions = readJson(path.join(latest.snapshotDir, "regressions.json"), null);
    const previousRegressions = readJson(
      path.join(previous.snapshotDir, "regressions.json"),
      null
    );
    regressionsComparePayload = buildRegressionsComparisonPayload(
      baseDir,
      latest,
      previous,
      latestRegressions,
      previousRegressions
    );
    regressionsCompareText = renderRegressionsComparisonText(regressionsComparePayload);
  }
  snapshotRecord.stabilityOk = stabilityPayload.ok;
  writeJson(indexPath, index);
  fs.writeFileSync(path.join(baseDir, "history.md"), renderHistory(index));
  const combinedChangesPayload = buildCombinedChangesPayload(
    baseDir,
    comparePayload,
    checksumComparePayload
  );
  const combinedChangesText = renderCombinedChangesText(compareText, checksumCompareText);
  const combinedRegressionsChangesPayload = buildCombinedRegressionsChangesPayload(
    baseDir,
    regressionsPayload,
    regressionsComparePayload
  );
  const combinedRegressionsChangesText = renderCombinedRegressionsChangesText(
    regressionsText,
    regressionsCompareText
  );
  const historyText = fs.readFileSync(path.join(baseDir, "history.md"), "utf8");
  function buildRegressionArtifacts(regressionsIntegrityPayload = null) {
    const regressionsStatusPayload = buildRegressionsStatusPayload({
      baseDir,
      regressionsHistoryPayload,
      regressionsHistoryComparePayload,
      regressionsHistoryCompareCheckPayload,
      regressionsPayload,
      regressionsComparePayload,
      regressionsChangesPayload: combinedRegressionsChangesPayload,
      regressionsIntegrityPayload,
    });
    const regressionsNextPayload = buildRegressionsNextPayload({
      baseDir,
      regressionsHistoryPayload,
      regressionsHistoryComparePayload,
      regressionsHistoryCompareCheckPayload,
      regressionsPayload,
      regressionsComparePayload,
      regressionsChangesPayload: combinedRegressionsChangesPayload,
      regressionsIntegrityPayload,
    });
    const regressionsOverviewPayload = buildRegressionsOverviewPayload({
      baseDir,
      regressionsHistoryPayload,
      regressionsHistoryComparePayload,
      regressionsHistoryCompareCheckPayload,
      regressionsPayload,
      regressionsComparePayload,
      regressionsChangesPayload: combinedRegressionsChangesPayload,
      regressionsIntegrityPayload,
    });
    const regressionsPlanPayload = buildRegressionsPlanPayload({
      baseDir,
      regressionsHistoryPayload,
      regressionsHistoryComparePayload,
      regressionsHistoryCompareCheckPayload,
      regressionsPayload,
      regressionsComparePayload,
      regressionsChangesPayload: combinedRegressionsChangesPayload,
      regressionsIntegrityPayload,
    });
    const regressionsSummaryPayload = buildRegressionsSummaryPayload({
      baseDir,
      overviewPayload: regressionsOverviewPayload,
      historyText,
    });
    const regressionsDoctorPayload = buildRegressionsDoctorPayload({
      baseDir,
      regressionsHistoryComparePayload,
      regressionsHistoryCompareCheckPayload,
      regressionsPayload,
      regressionsComparePayload,
      regressionsChangesPayload: combinedRegressionsChangesPayload,
      regressionsIntegrityPayload,
    });
    const regressionsGatePayload = buildRegressionsGatePayload({
      baseDir,
      latestDir: path.join(baseDir, "latest"),
      regressionsPayload,
      regressionsIntegrityPayload,
      regressionsDoctorPayload,
      regressionsHistoryCompareCheckPayload,
    });
    const regressionsReportPayload = buildRegressionsReportPayload({
      baseDir,
      regressionsOverviewPayload,
      regressionsSummaryPayload,
      regressionsPlanPayload,
      regressionsDoctorPayload,
      regressionsGatePayload,
      regressionsNextPayload,
    });
    return {
      regressionsPayload,
      regressionsText,
      regressionsHistoryPayload,
      regressionsHistoryText,
      regressionsHistoryGateFailingPayload,
      regressionsHistoryGateFailingText,
      regressionsHistoryGateFailingComparePayload,
      regressionsHistoryGateFailingCompareText,
      regressionsHistoryGateFailingCompareCheckPayload,
      regressionsHistoryGateFailingCompareCheckText,
      regressionsHistoryComparePayload,
      regressionsHistoryCompareText,
      regressionsHistoryCompareCheckPayload,
      regressionsHistoryCompareCheckText,
      regressionsComparePayload,
      regressionsCompareText,
      combinedRegressionsChangesPayload,
      combinedRegressionsChangesText,
      regressionsStatusPayload,
      regressionsStatusText: renderRegressionsStatusText(regressionsStatusPayload),
      regressionsNextPayload,
      regressionsOverviewPayload,
      regressionsOverviewMarkdown: renderRegressionsOverviewMarkdown(regressionsOverviewPayload),
      regressionsPlanPayload,
      regressionsPlanText: renderRegressionsPlanText(regressionsPlanPayload),
      regressionsSummaryPayload,
      regressionsSummaryMarkdown: renderRegressionsSummaryMarkdown(regressionsSummaryPayload),
      regressionsDoctorPayload,
      regressionsDoctorText: renderRegressionsDoctorText(regressionsDoctorPayload),
      regressionsGatePayload,
      regressionsGateText: renderRegressionsGateText(regressionsGatePayload),
      regressionsReportPayload,
      regressionsReportMarkdown: renderRegressionsReportMarkdown(regressionsReportPayload),
    };
  }
  let regressionArtifacts = buildRegressionArtifacts();

  fs.writeFileSync(path.join(snapshotDir, "compare.txt"), compareText);
  writeJson(path.join(snapshotDir, "compare.json"), comparePayload);
  fs.writeFileSync(path.join(snapshotDir, "changes.txt"), combinedChangesText);
  writeJson(path.join(snapshotDir, "changes.json"), combinedChangesPayload);
  fs.writeFileSync(path.join(snapshotDir, "trend.txt"), trendText);
  writeJson(path.join(snapshotDir, "trend.json"), trendPayload);
  fs.writeFileSync(path.join(snapshotDir, "stability.txt"), stabilityText);
  writeJson(path.join(snapshotDir, "stability.json"), stabilityPayload);
  writeRegressionArtifacts(snapshotDir, regressionArtifacts);
  fs.writeFileSync(path.join(snapshotDir, "checksums-compare.txt"), checksumCompareText);
  writeJson(path.join(snapshotDir, "checksums-compare.json"), checksumComparePayload);
  fs.writeFileSync(path.join(latestDir, "compare.txt"), compareText);
  writeJson(path.join(latestDir, "compare.json"), comparePayload);
  fs.writeFileSync(path.join(latestDir, "changes.txt"), combinedChangesText);
  writeJson(path.join(latestDir, "changes.json"), combinedChangesPayload);
  fs.writeFileSync(path.join(latestDir, "trend.txt"), trendText);
  writeJson(path.join(latestDir, "trend.json"), trendPayload);
  fs.writeFileSync(path.join(latestDir, "stability.txt"), stabilityText);
  writeJson(path.join(latestDir, "stability.json"), stabilityPayload);
  writeRegressionArtifacts(latestDir, regressionArtifacts);
  fs.writeFileSync(path.join(latestDir, "checksums-compare.txt"), checksumCompareText);
  writeJson(path.join(latestDir, "checksums-compare.json"), checksumComparePayload);
  const overviewPayload = buildOverviewPayload({
    baseDir,
    snapshotCount: snapshots.length,
    latestSnapshotName: snapshots[0]?.name || null,
    previousSnapshotName: snapshots[1]?.name || null,
    hasLatestReport: true,
    hasCompare:
      Array.isArray(comparePayload?.changedFields) ||
      Array.isArray(comparePayload?.unchangedFields),
    latestManifest: readJson(path.join(latestDir, "manifest.json"), null),
    latestCompare: comparePayload,
    latestChecksumsCompare: checksumComparePayload,
    latestRegressionsCompare: regressionsComparePayload,
    latestChecksumStatus: {
      ok: true,
      fileCount: 0,
      issues: [],
    },
    recentRegressionCount: regressionsPayload.regressionCount,
  });
  const overviewMarkdown = renderOverviewMarkdown(overviewPayload);
  const planPayload = buildPlanPayload({
    baseDir,
    hasLatestReport: true,
    snapshotCount: snapshots.length,
    hasCompare:
      Array.isArray(comparePayload?.changedFields) ||
      Array.isArray(comparePayload?.unchangedFields),
  });
  const summaryPayload = buildSummaryPayload({
    baseDir,
    overview: overviewPayload,
    latestDir,
    snapshotsDir,
    historyText: fs.readFileSync(path.join(baseDir, "history.md"), "utf8"),
  });
  fs.writeFileSync(path.join(snapshotDir, "overview.md"), overviewMarkdown);
  writeJson(path.join(snapshotDir, "overview.json"), overviewPayload);
  fs.writeFileSync(path.join(snapshotDir, "next.txt"), `${overviewPayload.next.command}\n`);
  fs.writeFileSync(path.join(latestDir, "overview.md"), overviewMarkdown);
  writeJson(path.join(latestDir, "overview.json"), overviewPayload);
  fs.writeFileSync(path.join(latestDir, "next.txt"), `${overviewPayload.next.command}\n`);
  fs.writeFileSync(path.join(snapshotDir, "plan.txt"), renderPlanText(planPayload));
  writeJson(path.join(snapshotDir, "plan.json"), planPayload);
  fs.writeFileSync(
    path.join(snapshotDir, "summary.md"),
    renderSummaryMarkdown(summaryPayload, renderOverviewMarkdown)
  );
  writeJson(path.join(snapshotDir, "summary.json"), summaryPayload);
  fs.writeFileSync(path.join(latestDir, "plan.txt"), renderPlanText(planPayload));
  writeJson(path.join(latestDir, "plan.json"), planPayload);
  fs.writeFileSync(
    path.join(latestDir, "summary.md"),
    renderSummaryMarkdown(summaryPayload, renderOverviewMarkdown)
  );
  writeJson(path.join(latestDir, "summary.json"), summaryPayload);
  const checksumTargets = [
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
    "next.txt",
    "plan.txt",
    "plan.json",
    "summary.md",
    "summary.json",
  ];
  const provisionalChecksumTargets = checksumTargets.filter(
    (target) => target !== "regressions-integrity.txt" && target !== "regressions-integrity.json"
  );
  writeChecksums(snapshotDir, provisionalChecksumTargets);
  writeChecksums(latestDir, provisionalChecksumTargets);
  const regressionsIntegrityPayload = buildRegressionsIntegrityPayload({
    baseDir,
    latestDir,
    indexPath,
    index,
  });
  const regressionsIntegrityText = renderRegressionsIntegrityText(regressionsIntegrityPayload);
  fs.writeFileSync(path.join(snapshotDir, "regressions-integrity.txt"), regressionsIntegrityText);
  writeJson(path.join(snapshotDir, "regressions-integrity.json"), regressionsIntegrityPayload);
  fs.writeFileSync(path.join(latestDir, "regressions-integrity.txt"), regressionsIntegrityText);
  writeJson(path.join(latestDir, "regressions-integrity.json"), regressionsIntegrityPayload);
  regressionArtifacts = buildRegressionArtifacts(regressionsIntegrityPayload);
  snapshotRecord.regressionsGateOk = regressionArtifacts.regressionsGatePayload.ok;
  snapshotRecord.regressionsGateIssueCount = regressionArtifacts.regressionsGatePayload.issueCount;
  writeJson(indexPath, index);
  fs.writeFileSync(path.join(baseDir, "history.md"), renderHistory(index));
  writeRegressionArtifacts(snapshotDir, regressionArtifacts);
  writeRegressionArtifacts(latestDir, regressionArtifacts);
  writeChecksums(snapshotDir, checksumTargets);
  writeChecksums(latestDir, checksumTargets);
  writeJson(
    path.join(baseDir, "export-manifest.json"),
    {
      generatedAt: new Date().toISOString(),
      baseDir,
      latestDir,
      snapshotsDir,
      snapshotName,
      snapshotDir,
      latestManifestPath: path.join(latestDir, "manifest.json"),
      latestReportPath: path.join(latestDir, "report.md"),
      latestResultPath: path.join(latestDir, "result.json"),
      latestInputPath: path.join(latestDir, "input.redacted.json"),
      latestCompareTextPath: path.join(latestDir, "compare.txt"),
      latestCompareJsonPath: path.join(latestDir, "compare.json"),
      latestChangesTextPath: path.join(latestDir, "changes.txt"),
      latestChangesJsonPath: path.join(latestDir, "changes.json"),
      latestTrendPath: path.join(latestDir, "trend.txt"),
      latestTrendJsonPath: path.join(latestDir, "trend.json"),
      latestStabilityPath: path.join(latestDir, "stability.txt"),
      latestStabilityJsonPath: path.join(latestDir, "stability.json"),
      latestRegressionsPath: path.join(latestDir, "regressions.txt"),
      latestRegressionsJsonPath: path.join(latestDir, "regressions.json"),
      latestRegressionsHistoryPath: path.join(latestDir, "regressions-history.txt"),
      latestRegressionsHistoryJsonPath: path.join(latestDir, "regressions-history.json"),
      latestRegressionsHistoryGateFailingPath: path.join(
        latestDir,
        "regressions-history-gate-failing.txt"
      ),
      latestRegressionsHistoryGateFailingJsonPath: path.join(
        latestDir,
        "regressions-history-gate-failing.json"
      ),
      latestRegressionsHistoryGateFailingCompareTextPath: path.join(
        latestDir,
        "regressions-history-gate-failing-compare.txt"
      ),
      latestRegressionsHistoryGateFailingCompareJsonPath: path.join(
        latestDir,
        "regressions-history-gate-failing-compare.json"
      ),
      latestRegressionsHistoryGateFailingCompareCheckTextPath: path.join(
        latestDir,
        "regressions-history-gate-failing-compare-check.txt"
      ),
      latestRegressionsHistoryGateFailingCompareCheckJsonPath: path.join(
        latestDir,
        "regressions-history-gate-failing-compare-check.json"
      ),
      latestRegressionsHistoryCompareTextPath: path.join(
        latestDir,
        "regressions-history-compare.txt"
      ),
      latestRegressionsHistoryCompareJsonPath: path.join(
        latestDir,
        "regressions-history-compare.json"
      ),
      latestRegressionsHistoryCompareCheckTextPath: path.join(
        latestDir,
        "regressions-history-compare-check.txt"
      ),
      latestRegressionsHistoryCompareCheckJsonPath: path.join(
        latestDir,
        "regressions-history-compare-check.json"
      ),
      latestRegressionsCompareTextPath: path.join(latestDir, "regressions-compare.txt"),
      latestRegressionsCompareJsonPath: path.join(latestDir, "regressions-compare.json"),
      latestRegressionsChangesTextPath: path.join(latestDir, "regressions-changes.txt"),
      latestRegressionsChangesJsonPath: path.join(latestDir, "regressions-changes.json"),
      latestRegressionsStatusTextPath: path.join(latestDir, "regressions-status.txt"),
      latestRegressionsStatusJsonPath: path.join(latestDir, "regressions-status.json"),
      latestRegressionsOverviewPath: path.join(latestDir, "regressions-overview.md"),
      latestRegressionsOverviewJsonPath: path.join(latestDir, "regressions-overview.json"),
      latestRegressionsNextPath: path.join(latestDir, "regressions-next.txt"),
      latestRegressionsPlanPath: path.join(latestDir, "regressions-plan.txt"),
      latestRegressionsPlanJsonPath: path.join(latestDir, "regressions-plan.json"),
      latestRegressionsSummaryPath: path.join(latestDir, "regressions-summary.md"),
      latestRegressionsSummaryJsonPath: path.join(latestDir, "regressions-summary.json"),
      latestRegressionsDoctorPath: path.join(latestDir, "regressions-doctor.txt"),
      latestRegressionsDoctorJsonPath: path.join(latestDir, "regressions-doctor.json"),
      latestRegressionsGatePath: path.join(latestDir, "regressions-gate.txt"),
      latestRegressionsGateJsonPath: path.join(latestDir, "regressions-gate.json"),
      latestRegressionsReportPath: path.join(latestDir, "regressions-report.md"),
      latestRegressionsReportJsonPath: path.join(latestDir, "regressions-report.json"),
      latestRegressionsIntegrityPath: path.join(latestDir, "regressions-integrity.txt"),
      latestRegressionsIntegrityJsonPath: path.join(latestDir, "regressions-integrity.json"),
      latestChecksumsCompareTextPath: path.join(latestDir, "checksums-compare.txt"),
      latestChecksumsCompareJsonPath: path.join(latestDir, "checksums-compare.json"),
      latestOverviewPath: path.join(latestDir, "overview.md"),
      latestOverviewJsonPath: path.join(latestDir, "overview.json"),
      latestNextPath: path.join(latestDir, "next.txt"),
      latestPlanPath: path.join(latestDir, "plan.txt"),
      latestPlanJsonPath: path.join(latestDir, "plan.json"),
      latestSummaryPath: path.join(latestDir, "summary.md"),
      latestSummaryJsonPath: path.join(latestDir, "summary.json"),
      latestChecksumsPath: path.join(latestDir, "checksums.json"),
      latestChecksumsTextPath: path.join(latestDir, "checksums.txt"),
      latestIndexPath: indexPath,
      historyPath: path.join(baseDir, "history.md"),
    }
  );

  const payload = {
    baseDir,
    latestDir,
    snapshotsDir,
    snapshotName,
    snapshotDir,
    compare: comparePayload,
    regressionsCompare: regressionsComparePayload,
    result,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("[social-recovery-smoke-export] completed");
    console.log(`baseDir: ${baseDir}`);
    console.log(`snapshotName: ${snapshotName}`);
    console.log(`snapshotDir: ${snapshotDir}`);
    console.log(`latestDir: ${latestDir}`);
    console.log(`submit txHash: ${result.submit?.transactionHash || "(none)"}`);
  }
}

await main();
