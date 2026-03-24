export function buildRegressionsHistoryPayload(
  index,
  windowSize,
  unstableOnly = false,
  gateFailingOnly = false
) {
  const recentSnapshots = index.snapshots.slice(0, windowSize);
  const snapshots = recentSnapshots
    .filter((snapshot) => {
      if (unstableOnly) {
        return snapshot.stabilityOk === false;
      }
      if (gateFailingOnly) {
        return snapshot.regressionsGateOk === false;
      }
      return true;
    })
    .map((snapshot) => ({
      name: snapshot.name || null,
      stabilityOk:
        typeof snapshot.stabilityOk === "boolean" ? snapshot.stabilityOk : null,
      regressionsGateOk:
        typeof snapshot.regressionsGateOk === "boolean"
          ? snapshot.regressionsGateOk
          : null,
      regressionsGateIssueCount: snapshot.regressionsGateIssueCount ?? 0,
      changedFieldsCount: snapshot.changedFieldsCount ?? 0,
      changedArtifactsCount: snapshot.changedArtifactsCount ?? 0,
      submitTransactionHash: snapshot.submitTransactionHash || null,
      submitUserOpHash: snapshot.submitUserOpHash || null,
      generatedAt: snapshot.generatedAt || null,
    }));

  return {
    windowSize,
    recentSnapshotCount: recentSnapshots.length,
    snapshotCount: snapshots.length,
    unstableOnly,
    gateFailingOnly,
    stableCount: snapshots.filter((snapshot) => snapshot.stabilityOk === true).length,
    unstableCount: snapshots.filter((snapshot) => snapshot.stabilityOk === false).length,
    gateFailingCount: snapshots.filter((snapshot) => snapshot.regressionsGateOk === false).length,
    gateIssueCount: snapshots.reduce(
      (sum, snapshot) => sum + (snapshot.regressionsGateIssueCount ?? 0),
      0
    ),
    snapshots,
  };
}

export function renderRegressionsHistoryText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions History",
    "",
    `- windowSize: ${payload.windowSize}`,
    `- recentSnapshotCount: ${payload.recentSnapshotCount}`,
    `- snapshotCount: ${payload.snapshotCount}`,
    `- stableCount: ${payload.stableCount}`,
    `- unstableCount: ${payload.unstableCount}`,
    `- gateFailingCount: ${payload.gateFailingCount}`,
    `- gateIssueCount: ${payload.gateIssueCount}`,
    `- unstableOnly: ${payload.unstableOnly}`,
    `- gateFailingOnly: ${payload.gateFailingOnly}`,
    "",
  ];

  if (payload.snapshots.length === 0) {
    lines.push("No snapshots matched the selected regression history filter.");
  } else {
    lines.push("Recent regression history:");
    for (const snapshot of payload.snapshots) {
      const status =
        snapshot.stabilityOk === true
          ? "stable"
          : snapshot.stabilityOk === false
            ? "unstable"
            : "unknown";
      const gateStatus =
        snapshot.regressionsGateOk === true
          ? "pass"
          : snapshot.regressionsGateOk === false
            ? "fail"
            : "unknown";
      lines.push(
        `- ${snapshot.name || "(unnamed)"}: status=${status}, gate=${gateStatus}, gateIssues=${snapshot.regressionsGateIssueCount}, fields=${snapshot.changedFieldsCount}, artifacts=${snapshot.changedArtifactsCount}, txHash=${snapshot.submitTransactionHash || "(none)"}`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}
