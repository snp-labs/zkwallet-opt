function statusLabel(snapshot) {
  if (snapshot?.stabilityOk === true) {
    return "stable";
  }
  if (snapshot?.stabilityOk === false) {
    return "unstable";
  }
  return "unknown";
}

function gateStatusLabel(snapshot) {
  if (snapshot?.regressionsGateOk === true) {
    return "passing";
  }
  if (snapshot?.regressionsGateOk === false) {
    return "failing";
  }
  return "unknown";
}

function sortNames(values) {
  return [...values].filter(Boolean).sort();
}

export function buildRegressionsHistoryComparisonPayload(
  baseDir,
  latest,
  previous,
  latestHistory,
  previousHistory
) {
  const latestSnapshots = Array.isArray(latestHistory?.snapshots) ? latestHistory.snapshots : [];
  const previousSnapshots = Array.isArray(previousHistory?.snapshots)
    ? previousHistory.snapshots
    : [];

  const latestByName = new Map(
    latestSnapshots.map((snapshot) => [snapshot.name, snapshot]).filter(([name]) => Boolean(name))
  );
  const previousByName = new Map(
    previousSnapshots
      .map((snapshot) => [snapshot.name, snapshot])
      .filter(([name]) => Boolean(name))
  );

  const latestNames = new Set(latestByName.keys());
  const previousNames = new Set(previousByName.keys());
  const sharedNames = sortNames([...latestNames].filter((name) => previousNames.has(name)));

  const addedSnapshotNames = sortNames([...latestNames].filter((name) => !previousNames.has(name)));
  const removedSnapshotNames = sortNames(
    [...previousNames].filter((name) => !latestNames.has(name))
  );
  const addedUnstableSnapshotNames = [];
  const addedStableSnapshotNames = [];
  const addedGateFailingSnapshotNames = [];
  const addedGatePassingSnapshotNames = [];
  const unchangedSnapshotNames = [];
  const changedStatuses = [];
  const changedToUnstableNames = [];
  const changedToStableNames = [];
  const changedGateStatuses = [];
  const changedToGateFailingNames = [];
  const changedToGatePassingNames = [];

  for (const name of addedSnapshotNames) {
    const latestStatus = statusLabel(latestByName.get(name));
    const latestGateStatus = gateStatusLabel(latestByName.get(name));
    if (latestStatus === "unstable") {
      addedUnstableSnapshotNames.push(name);
    } else if (latestStatus === "stable") {
      addedStableSnapshotNames.push(name);
    }
    if (latestGateStatus === "failing") {
      addedGateFailingSnapshotNames.push(name);
    } else if (latestGateStatus === "passing") {
      addedGatePassingSnapshotNames.push(name);
    }
  }

  for (const name of sharedNames) {
    const latestSnapshot = latestByName.get(name);
    const previousSnapshot = previousByName.get(name);
    const latestStatus = statusLabel(latestSnapshot);
    const previousStatus = statusLabel(previousSnapshot);
    const latestGateStatus = gateStatusLabel(latestSnapshot);
    const previousGateStatus = gateStatusLabel(previousSnapshot);
    if (latestStatus === previousStatus) {
      unchangedSnapshotNames.push(name);
    } else {
      changedStatuses.push({
        name,
        previousStatus,
        latestStatus,
      });
      if (latestStatus === "unstable") {
        changedToUnstableNames.push(name);
      } else if (latestStatus === "stable") {
        changedToStableNames.push(name);
      }
    }
    if (latestGateStatus !== previousGateStatus) {
      changedGateStatuses.push({
        name,
        previousGateStatus,
        latestGateStatus,
      });
      if (latestGateStatus === "failing") {
        changedToGateFailingNames.push(name);
      } else if (latestGateStatus === "passing") {
        changedToGatePassingNames.push(name);
      }
    }
  }

  const latestGateFailingCount =
    latestHistory?.gateFailingCount ??
    latestSnapshots.filter((snapshot) => snapshot.regressionsGateOk === false).length;
  const previousGateFailingCount =
    previousHistory?.gateFailingCount ??
    previousSnapshots.filter((snapshot) => snapshot.regressionsGateOk === false).length;
  const latestGateIssueCount =
    latestHistory?.gateIssueCount ??
    latestSnapshots.reduce(
      (sum, snapshot) => sum + (snapshot?.regressionsGateIssueCount ?? 0),
      0
    );
  const previousGateIssueCount =
    previousHistory?.gateIssueCount ??
    previousSnapshots.reduce(
      (sum, snapshot) => sum + (snapshot?.regressionsGateIssueCount ?? 0),
      0
    );
  const worseningDetected =
    addedUnstableSnapshotNames.length > 0 ||
    changedToUnstableNames.length > 0 ||
    (latestHistory?.unstableCount ?? 0) - (previousHistory?.unstableCount ?? 0) > 0 ||
    addedGateFailingSnapshotNames.length > 0 ||
    changedToGateFailingNames.length > 0 ||
    latestGateFailingCount - previousGateFailingCount > 0 ||
    latestGateIssueCount - previousGateIssueCount > 0;
  const worseningSignalCount =
    addedUnstableSnapshotNames.length +
    changedToUnstableNames.length +
    (((latestHistory?.unstableCount ?? 0) - (previousHistory?.unstableCount ?? 0)) > 0 ? 1 : 0) +
    addedGateFailingSnapshotNames.length +
    changedToGateFailingNames.length +
    (latestGateFailingCount - previousGateFailingCount > 0 ? 1 : 0) +
    (latestGateIssueCount - previousGateIssueCount > 0 ? 1 : 0);
  const improvingSignalCount =
    addedStableSnapshotNames.length +
    changedToStableNames.length +
    (((latestHistory?.unstableCount ?? 0) - (previousHistory?.unstableCount ?? 0)) < 0 ? 1 : 0) +
    addedGatePassingSnapshotNames.length +
    changedToGatePassingNames.length +
    (latestGateFailingCount - previousGateFailingCount < 0 ? 1 : 0) +
    (latestGateIssueCount - previousGateIssueCount < 0 ? 1 : 0);

  return {
    baseDir,
    latest: {
      name: latest.name,
      generatedAt: latest.generatedAt || null,
      snapshotCount: latestHistory?.snapshotCount ?? latestSnapshots.length,
      stableCount: latestHistory?.stableCount ?? 0,
      unstableCount: latestHistory?.unstableCount ?? 0,
      gateFailingCount: latestGateFailingCount,
      gateIssueCount: latestGateIssueCount,
    },
    previous: {
      name: previous.name,
      generatedAt: previous.generatedAt || null,
      snapshotCount: previousHistory?.snapshotCount ?? previousSnapshots.length,
      stableCount: previousHistory?.stableCount ?? 0,
      unstableCount: previousHistory?.unstableCount ?? 0,
      gateFailingCount: previousGateFailingCount,
      gateIssueCount: previousGateIssueCount,
    },
    snapshotCountDelta:
      (latestHistory?.snapshotCount ?? latestSnapshots.length) -
      (previousHistory?.snapshotCount ?? previousSnapshots.length),
    unstableCountDelta:
      (latestHistory?.unstableCount ?? 0) - (previousHistory?.unstableCount ?? 0),
    stableCountDelta: (latestHistory?.stableCount ?? 0) - (previousHistory?.stableCount ?? 0),
    gateFailingCountDelta: latestGateFailingCount - previousGateFailingCount,
    gateIssueCountDelta: latestGateIssueCount - previousGateIssueCount,
    addedSnapshotNames,
    addedUnstableSnapshotNames,
    addedStableSnapshotNames,
    addedGateFailingSnapshotNames,
    addedGatePassingSnapshotNames,
    removedSnapshotNames,
    unchangedSnapshotNames,
    changedStatuses,
    changedToUnstableNames,
    changedToStableNames,
    changedGateStatuses,
    changedToGateFailingNames,
    changedToGatePassingNames,
    worseningDetected,
    worseningSignalCount,
    improvingSignalCount,
  };
}

export function buildRegressionsHistoryComparisonCheckPayload(payload) {
  const issues = [];

  if ((payload.unstableCountDelta ?? 0) > 0) {
    issues.push(
      `unstable snapshot count increased by ${payload.unstableCountDelta} between ${payload.previous.name} and ${payload.latest.name}`
    );
  }
  if ((payload.addedUnstableSnapshotNames?.length ?? 0) > 0) {
    issues.push(
      `new unstable snapshots were added: ${payload.addedUnstableSnapshotNames.join(", ")}`
    );
  }
  if ((payload.changedToUnstableNames?.length ?? 0) > 0) {
    issues.push(
      `snapshots flipped to unstable: ${payload.changedToUnstableNames.join(", ")}`
    );
  }
  if ((payload.gateFailingCountDelta ?? 0) > 0) {
    issues.push(
      `gate-failing snapshot count increased by ${payload.gateFailingCountDelta} between ${payload.previous.name} and ${payload.latest.name}`
    );
  }
  if ((payload.gateIssueCountDelta ?? 0) > 0) {
    issues.push(
      `gate issue count increased by ${payload.gateIssueCountDelta} between ${payload.previous.name} and ${payload.latest.name}`
    );
  }
  if ((payload.addedGateFailingSnapshotNames?.length ?? 0) > 0) {
    issues.push(
      `new gate-failing snapshots were added: ${payload.addedGateFailingSnapshotNames.join(", ")}`
    );
  }
  if ((payload.changedToGateFailingNames?.length ?? 0) > 0) {
    issues.push(
      `snapshots flipped to gate-failing: ${payload.changedToGateFailingNames.join(", ")}`
    );
  }

  return {
    baseDir: payload.baseDir,
    latest: payload.latest,
    previous: payload.previous,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    worseningDetected: payload.worseningDetected === true,
    worseningSignalCount: payload.worseningSignalCount ?? 0,
    unstableCountDelta: payload.unstableCountDelta ?? 0,
    gateFailingCountDelta: payload.gateFailingCountDelta ?? 0,
    gateIssueCountDelta: payload.gateIssueCountDelta ?? 0,
    addedUnstableSnapshotNames: payload.addedUnstableSnapshotNames ?? [],
    changedToUnstableNames: payload.changedToUnstableNames ?? [],
    addedGateFailingSnapshotNames: payload.addedGateFailingSnapshotNames ?? [],
    changedToGateFailingNames: payload.changedToGateFailingNames ?? [],
  };
}

export function renderRegressionsHistoryComparisonCheckText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions History Compare Check",
    "",
    `- ok: ${payload.ok}`,
    `- issueCount: ${payload.issueCount}`,
    `- worseningDetected: ${payload.worseningDetected}`,
    `- worseningSignalCount: ${payload.worseningSignalCount}`,
    `- unstableCountDelta: ${payload.unstableCountDelta}`,
    `- gateFailingCountDelta: ${payload.gateFailingCountDelta}`,
    `- gateIssueCountDelta: ${payload.gateIssueCountDelta}`,
    `- addedUnstableSnapshotNames: ${payload.addedUnstableSnapshotNames.join(", ") || "(none)"}`,
    `- changedToUnstableNames: ${payload.changedToUnstableNames.join(", ") || "(none)"}`,
    `- addedGateFailingSnapshotNames: ${payload.addedGateFailingSnapshotNames.join(", ") || "(none)"}`,
    `- changedToGateFailingNames: ${payload.changedToGateFailingNames.join(", ") || "(none)"}`,
    "",
  ];

  if (payload.issues.length === 0) {
    lines.push("Issues:");
    lines.push("- none");
  } else {
    lines.push("Issues:");
    for (const issue of payload.issues) {
      lines.push(`- ${issue}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderRegressionsHistoryComparisonText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions History Compare",
    "",
    `- latest: ${payload.latest.name} (snapshots=${payload.latest.snapshotCount}, unstable=${payload.latest.unstableCount}, stable=${payload.latest.stableCount}, gateFailing=${payload.latest.gateFailingCount}, gateIssues=${payload.latest.gateIssueCount})`,
    `- previous: ${payload.previous.name} (snapshots=${payload.previous.snapshotCount}, unstable=${payload.previous.unstableCount}, stable=${payload.previous.stableCount}, gateFailing=${payload.previous.gateFailingCount}, gateIssues=${payload.previous.gateIssueCount})`,
    `- snapshotCountDelta: ${payload.snapshotCountDelta}`,
    `- unstableCountDelta: ${payload.unstableCountDelta}`,
    `- stableCountDelta: ${payload.stableCountDelta}`,
    `- gateFailingCountDelta: ${payload.gateFailingCountDelta}`,
    `- gateIssueCountDelta: ${payload.gateIssueCountDelta}`,
    `- worseningDetected: ${payload.worseningDetected}`,
    `- worseningSignalCount: ${payload.worseningSignalCount}`,
    `- improvingSignalCount: ${payload.improvingSignalCount}`,
    "",
    `- added: ${payload.addedSnapshotNames.join(", ") || "(none)"}`,
    `- addedUnstable: ${payload.addedUnstableSnapshotNames.join(", ") || "(none)"}`,
    `- addedStable: ${payload.addedStableSnapshotNames.join(", ") || "(none)"}`,
    `- addedGateFailing: ${payload.addedGateFailingSnapshotNames.join(", ") || "(none)"}`,
    `- addedGatePassing: ${payload.addedGatePassingSnapshotNames.join(", ") || "(none)"}`,
    `- removed: ${payload.removedSnapshotNames.join(", ") || "(none)"}`,
    `- unchanged: ${payload.unchangedSnapshotNames.join(", ") || "(none)"}`,
    `- changedToUnstable: ${payload.changedToUnstableNames.join(", ") || "(none)"}`,
    `- changedToStable: ${payload.changedToStableNames.join(", ") || "(none)"}`,
    `- changedToGateFailing: ${payload.changedToGateFailingNames.join(", ") || "(none)"}`,
    `- changedToGatePassing: ${payload.changedToGatePassingNames.join(", ") || "(none)"}`,
    "",
  ];

  if (payload.changedStatuses.length === 0) {
    lines.push("Changed statuses:");
    lines.push("- none");
  } else {
    lines.push("Changed statuses:");
    for (const entry of payload.changedStatuses) {
      lines.push(`- ${entry.name}: ${entry.previousStatus} -> ${entry.latestStatus}`);
    }
  }

  lines.push("");
  if (payload.changedGateStatuses.length === 0) {
    lines.push("Changed gate statuses:");
    lines.push("- none");
  } else {
    lines.push("Changed gate statuses:");
    for (const entry of payload.changedGateStatuses) {
      lines.push(`- ${entry.name}: ${entry.previousGateStatus} -> ${entry.latestGateStatus}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
