function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildTrendPayload(index, windowSize) {
  const snapshots = index.snapshots.slice(0, windowSize).map((snapshot) => ({
    name: snapshot.name,
    generatedAt: snapshot.generatedAt || null,
    changedFieldsCount: snapshot.changedFieldsCount ?? 0,
    changedArtifactsCount: snapshot.changedArtifactsCount ?? 0,
  }));

  const fieldCounts = snapshots.map((entry) => entry.changedFieldsCount);
  const artifactCounts = snapshots.map((entry) => entry.changedArtifactsCount);
  const latest = snapshots[0] || null;
  const previous = snapshots[1] || null;
  const latestStable =
    latest !== null && latest.changedFieldsCount === 0 && latest.changedArtifactsCount === 0;
  const lastTwoStable =
    snapshots.length >= 2 &&
    snapshots[0].changedFieldsCount === 0 &&
    snapshots[0].changedArtifactsCount === 0 &&
    snapshots[1].changedFieldsCount === 0 &&
    snapshots[1].changedArtifactsCount === 0;

  return {
    snapshotCount: index.snapshots.length,
    windowSize,
    latestSnapshotName: latest?.name || null,
    previousSnapshotName: previous?.name || null,
    latestStable,
    lastTwoStable,
    averageChangedFieldsCount: Number(average(fieldCounts).toFixed(2)),
    averageChangedArtifactsCount: Number(average(artifactCounts).toFixed(2)),
    snapshots,
  };
}

export function renderTrendText(payload) {
  const lines = [
    "# Social Recovery Smoke Trend",
    "",
    `- snapshotCount: ${payload.snapshotCount}`,
    `- windowSize: ${payload.windowSize}`,
    `- latestSnapshotName: ${payload.latestSnapshotName || "(none)"}`,
    `- previousSnapshotName: ${payload.previousSnapshotName || "(none)"}`,
    `- latestStable: ${payload.latestStable}`,
    `- lastTwoStable: ${payload.lastTwoStable}`,
    `- averageChangedFieldsCount: ${payload.averageChangedFieldsCount}`,
    `- averageChangedArtifactsCount: ${payload.averageChangedArtifactsCount}`,
    "",
    "Recent snapshots:",
  ];

  if (payload.snapshots.length === 0) {
    lines.push("- (none)");
  } else {
    for (const snapshot of payload.snapshots) {
      lines.push(
        `- ${snapshot.name}: fields=${snapshot.changedFieldsCount}, artifacts=${snapshot.changedArtifactsCount}`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}
