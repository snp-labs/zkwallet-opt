export function buildRegressionsPayload(index, windowSize) {
  const recentSnapshots = index.snapshots.slice(0, windowSize);
  const regressions = recentSnapshots
    .filter((snapshot) => snapshot.stabilityOk === false)
    .map((snapshot) => ({
      name: snapshot.name || null,
      changedFieldsCount: snapshot.changedFieldsCount ?? 0,
      changedArtifactsCount: snapshot.changedArtifactsCount ?? 0,
      submitTransactionHash: snapshot.submitTransactionHash || null,
      submitUserOpHash: snapshot.submitUserOpHash || null,
      generatedAt: snapshot.generatedAt || null,
    }));

  return {
    windowSize,
    snapshotCount: recentSnapshots.length,
    regressionCount: regressions.length,
    ok: regressions.length === 0,
    regressions,
  };
}

export function renderRegressionsText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions",
    "",
    `- windowSize: ${payload.windowSize}`,
    `- snapshotCount: ${payload.snapshotCount}`,
    `- regressionCount: ${payload.regressionCount}`,
    `- ok: ${payload.ok}`,
    "",
  ];

  if (payload.regressions.length === 0) {
    lines.push("No unstable snapshots found in the selected window.");
  } else {
    lines.push("Unstable snapshots:");
    for (const snapshot of payload.regressions) {
      lines.push(
        `- ${snapshot.name}: fields=${snapshot.changedFieldsCount}, artifacts=${snapshot.changedArtifactsCount}, txHash=${snapshot.submitTransactionHash || "(none)"}`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}
