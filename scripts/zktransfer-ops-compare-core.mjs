import fs from "node:fs";
import path from "node:path";

export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findSnapshotByName(entries, snapshotName) {
  return entries.find((entry) => entry.snapshotName === snapshotName) || null;
}

export function resolveComparisonSelection(env = process.env) {
  return {
    latestName: env.ZKTRANSFER_OPS_COMPARE_LATEST || null,
    previousName: env.ZKTRANSFER_OPS_COMPARE_PREVIOUS || null
  };
}

export function buildSnapshotComparison({ baseDir, entries, latestName = null, previousName = null }) {
  const latest = latestName ? findSnapshotByName(entries, latestName) : entries[0] || null;
  let previous = previousName ? findSnapshotByName(entries, previousName) : null;

  if (!previousName) {
    previous = entries.find((entry) => entry.snapshotName !== latest?.snapshotName) || null;
  }

  return {
    baseDir,
    entries,
    selection: {
      latestName,
      previousName
    },
    latest,
    previous,
    latestMissingName: latestName && !latest ? latestName : null,
    previousMissingName: previousName && !previous ? previousName : null,
    latestSummary: latest ? readJsonIfExists(path.join(latest.snapshotDir, "summary.json")) : null,
    previousSummary: previous ? readJsonIfExists(path.join(previous.snapshotDir, "summary.json")) : null
  };
}

function compareBlockingIssues(latestSummary, previousSummary) {
  const latestIssues = new Set(latestSummary?.blockingIssues || []);
  const previousIssues = new Set(previousSummary?.blockingIssues || []);

  return {
    added: [...latestIssues].filter((issue) => !previousIssues.has(issue)),
    removed: [...previousIssues].filter((issue) => !latestIssues.has(issue))
  };
}

function compareServiceNextCommands(latestSummary, previousSummary) {
  const latestServices = new Map((latestSummary?.services || []).map((service) => [service.serviceName, service]));
  const previousServices = new Map((previousSummary?.services || []).map((service) => [service.serviceName, service]));
  const serviceNames = [...new Set([...latestServices.keys(), ...previousServices.keys()])].sort();

  return serviceNames
    .map((serviceName) => {
      const latestSuggested = latestServices.get(serviceName)?.suggestedCommand || null;
      const previousSuggested = previousServices.get(serviceName)?.suggestedCommand || null;
      if (latestSuggested === previousSuggested) {
        return null;
      }

      return {
        serviceName,
        latestSuggested,
        previousSuggested
      };
    })
    .filter(Boolean);
}

export function buildComparisonReport(comparison) {
  if (comparison.latestMissingName || comparison.previousMissingName) {
    const missingParts = [];
    if (comparison.latestMissingName) {
      missingParts.push(`latest=${comparison.latestMissingName}`);
    }
    if (comparison.previousMissingName) {
      missingParts.push(`previous=${comparison.previousMissingName}`);
    }

    return {
      status: "missing",
      message: `Requested snapshot was not found: ${missingParts.join(", ")}.`
    };
  }

  if (!comparison.latest) {
    return {
      status: "empty",
      message: "No snapshots found."
    };
  }

  if (!comparison.previous) {
    return {
      status: "single",
      message: `Only one snapshot is available: ${comparison.latest.snapshotName}.`
    };
  }

  const latestSummary = comparison.latestSummary;
  const previousSummary = comparison.previousSummary;
  const blockingIssues = compareBlockingIssues(latestSummary, previousSummary);
  const serviceNextChanges = compareServiceNextCommands(latestSummary, previousSummary);

  return {
    status: "compared",
    latest: comparison.latest,
    previous: comparison.previous,
    latestSummary,
    previousSummary,
    blockingIssueCountDelta:
      (latestSummary?.overall?.blockingIssueCount ?? comparison.latest.blockingIssueCount ?? 0) -
      (previousSummary?.overall?.blockingIssueCount ?? comparison.previous.blockingIssueCount ?? 0),
    configReadyChanged:
      (latestSummary?.overall?.configReady ?? comparison.latest.configReady) !==
      (previousSummary?.overall?.configReady ?? comparison.previous.configReady),
    healthReadyChanged:
      (latestSummary?.overall?.healthReady ?? comparison.latest.healthReady) !==
      (previousSummary?.overall?.healthReady ?? comparison.previous.healthReady),
    blockingIssues,
    serviceNextChanges
  };
}

export function renderComparisonReport(report) {
  if (report.status === "empty" || report.status === "single" || report.status === "missing") {
    return `zkTransfer Ops Compare\n${report.message}\n`;
  }

  const lines = [];
  lines.push("zkTransfer Ops Compare");
  lines.push(`Latest: ${report.latest.snapshotName}`);
  lines.push(`Previous: ${report.previous.snapshotName}`);
  lines.push(`Blocking issue delta: ${report.blockingIssueCountDelta}`);
  lines.push(`Config ready changed: ${report.configReadyChanged}`);
  lines.push(`Health ready changed: ${report.healthReadyChanged}`);

  if (report.blockingIssues.added.length > 0) {
    lines.push("Added blocking issues:");
    for (const issue of report.blockingIssues.added) {
      lines.push(`- ${issue}`);
    }
  }

  if (report.blockingIssues.removed.length > 0) {
    lines.push("Removed blocking issues:");
    for (const issue of report.blockingIssues.removed) {
      lines.push(`- ${issue}`);
    }
  }

  if (report.serviceNextChanges.length > 0) {
    lines.push("Service next-command changes:");
    for (const change of report.serviceNextChanges) {
      lines.push(
        `- ${change.serviceName}: ${change.previousSuggested ?? "none"} -> ${change.latestSuggested ?? "none"}`
      );
    }
  }

  if (
    report.blockingIssues.added.length === 0 &&
    report.blockingIssues.removed.length === 0 &&
    report.serviceNextChanges.length === 0
  ) {
    lines.push("No blocking issue or next-command changes detected.");
  }

  return `${lines.join("\n")}\n`;
}
