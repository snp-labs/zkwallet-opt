export function buildRegressionsComparisonPayload(baseDir, latest, previous, latestRegressions, previousRegressions) {
  const latestNames = new Set((latestRegressions?.regressions || []).map((entry) => entry.name).filter(Boolean));
  const previousNames = new Set((previousRegressions?.regressions || []).map((entry) => entry.name).filter(Boolean));

  const added = [...latestNames].filter((name) => !previousNames.has(name)).sort();
  const removed = [...previousNames].filter((name) => !latestNames.has(name)).sort();
  const unchanged = [...latestNames].filter((name) => previousNames.has(name)).sort();

  return {
    baseDir,
    latest: {
      name: latest.name,
      generatedAt: latest.generatedAt || null,
      regressionCount: latestRegressions?.regressionCount ?? 0,
      ok: latestRegressions?.ok ?? null,
    },
    previous: {
      name: previous.name,
      generatedAt: previous.generatedAt || null,
      regressionCount: previousRegressions?.regressionCount ?? 0,
      ok: previousRegressions?.ok ?? null,
    },
    regressionCountDelta:
      (latestRegressions?.regressionCount ?? 0) - (previousRegressions?.regressionCount ?? 0),
    addedSnapshotNames: added,
    removedSnapshotNames: removed,
    unchangedSnapshotNames: unchanged,
  };
}

export function renderRegressionsComparisonText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Compare",
    "",
    `- latest: ${payload.latest.name} (${payload.latest.regressionCount})`,
    `- previous: ${payload.previous.name} (${payload.previous.regressionCount})`,
    `- regressionCountDelta: ${payload.regressionCountDelta}`,
    "",
    `- added: ${payload.addedSnapshotNames.join(", ") || "(none)"}`,
    `- removed: ${payload.removedSnapshotNames.join(", ") || "(none)"}`,
    `- unchanged: ${payload.unchangedSnapshotNames.join(", ") || "(none)"}`,
    "",
  ];
  return lines.join("\n");
}
