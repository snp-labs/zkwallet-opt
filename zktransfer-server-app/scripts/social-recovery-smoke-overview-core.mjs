export function getOverviewRecommendation({
  hasLatestReport,
  snapshotCount,
  hasCompare,
  recentRegressionCount = 0,
  hasRegressionsCompare = false,
}) {
  if (!hasLatestReport) {
    return {
      reason: "No saved smoke export exists yet.",
      command:
        "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    };
  }

  if (snapshotCount < 2 || !hasCompare) {
    return {
      reason: "A second saved export is needed before compare output becomes available.",
      command:
        "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json",
    };
  }

  if (recentRegressionCount > 0) {
    return {
      reason: "Recent unstable snapshots were detected in saved smoke history.",
      command: hasRegressionsCompare
        ? "npm run social-recovery:smoke:regressions:changes"
        : "npm run social-recovery:smoke:regressions",
    };
  }

  return {
    reason: "Latest compare output is available.",
    command: "npm run social-recovery:smoke:changes",
  };
}

export function buildOverviewPayload({
  baseDir,
  snapshotCount,
  latestSnapshotName,
  previousSnapshotName,
  hasLatestReport,
  hasCompare,
  recentRegressionCount,
  latestManifest,
  latestCompare,
  latestChecksumStatus,
  latestChecksumsCompare,
  latestRegressionsCompare,
}) {
  const hasRegressionsCompare =
    typeof latestRegressionsCompare?.regressionCountDelta === "number" ||
    Array.isArray(latestRegressionsCompare?.addedSnapshotNames);
  return {
    baseDir,
    snapshotCount,
    latestSnapshotName: latestSnapshotName || null,
    previousSnapshotName: previousSnapshotName || null,
    hasLatestReport,
    hasCompare,
    latestChecksumStatus: latestChecksumStatus || {
      ok: false,
      fileCount: 0,
      issues: ["latest/ checksums.json is missing"],
    },
    latestManifest: latestManifest
      ? {
          generatedAt: latestManifest.generatedAt || null,
          accountId: latestManifest.accountId || null,
          zkAccountAddress: latestManifest.zkAccountAddress || null,
          challengeNonce: latestManifest.challengeNonce || null,
          submitTransactionHash: latestManifest.submitTransactionHash || null,
          submitUserOpHash: latestManifest.submitUserOpHash || null,
        }
      : null,
    latestCompare: latestCompare
      ? {
          latest: latestCompare.latest || null,
          previous: latestCompare.previous || null,
          changedFieldLabels: Array.isArray(latestCompare.changedFields)
            ? latestCompare.changedFields.map((entry) => entry.label)
            : [],
          unchangedFields: Array.isArray(latestCompare.unchangedFields)
            ? latestCompare.unchangedFields
          : [],
      }
    : null,
    latestChecksumsCompare: latestChecksumsCompare
      ? {
          latest: latestChecksumsCompare.latest || null,
          previous: latestChecksumsCompare.previous || null,
          changedArtifactPaths: Array.isArray(latestChecksumsCompare.changedArtifacts)
            ? latestChecksumsCompare.changedArtifacts.map((entry) => entry.path)
            : [],
          unchangedArtifacts: Array.isArray(latestChecksumsCompare.unchangedArtifacts)
            ? latestChecksumsCompare.unchangedArtifacts
            : [],
        }
      : null,
    latestRegressionsCompare: latestRegressionsCompare
      ? {
          latest: latestRegressionsCompare.latest || null,
          previous: latestRegressionsCompare.previous || null,
          regressionCountDelta:
            typeof latestRegressionsCompare.regressionCountDelta === "number"
              ? latestRegressionsCompare.regressionCountDelta
              : null,
          addedSnapshotNames: Array.isArray(latestRegressionsCompare.addedSnapshotNames)
            ? latestRegressionsCompare.addedSnapshotNames
            : [],
          removedSnapshotNames: Array.isArray(latestRegressionsCompare.removedSnapshotNames)
            ? latestRegressionsCompare.removedSnapshotNames
            : [],
          unchangedSnapshotNames: Array.isArray(latestRegressionsCompare.unchangedSnapshotNames)
            ? latestRegressionsCompare.unchangedSnapshotNames
            : [],
        }
      : null,
    recentRegressionCount: recentRegressionCount ?? 0,
    next: getOverviewRecommendation({
      hasLatestReport,
      snapshotCount,
      hasCompare,
      recentRegressionCount,
      hasRegressionsCompare,
    }),
  };
}

export function renderOverviewMarkdown(payload) {
  const lines = [
    "# Social Recovery Smoke Overview",
    "",
    `- baseDir: ${payload.baseDir}`,
    `- snapshotCount: ${payload.snapshotCount}`,
    `- latestSnapshotName: ${payload.latestSnapshotName || "(none)"}`,
    `- previousSnapshotName: ${payload.previousSnapshotName || "(none)"}`,
    `- hasLatestReport: ${payload.hasLatestReport}`,
    `- hasCompare: ${payload.hasCompare}`,
    `- recentRegressionCount: ${payload.recentRegressionCount}`,
    `- latestChecksumOk: ${payload.latestChecksumStatus.ok}`,
    `- latestChecksumFileCount: ${payload.latestChecksumStatus.fileCount}`,
  ];

  if (payload.latestManifest) {
    lines.push(`- latestAccountId: ${payload.latestManifest.accountId || "(none)"}`);
    lines.push(
      `- latestSubmitTransactionHash: ${payload.latestManifest.submitTransactionHash || "(none)"}`
    );
    lines.push(
      `- latestSubmitUserOpHash: ${payload.latestManifest.submitUserOpHash || "(none)"}`
    );
  }

  lines.push("");
  lines.push("## Checksums");
  lines.push("");
  if (payload.latestChecksumStatus.issues.length === 0) {
    lines.push("- issues: none");
  } else {
    lines.push(`- issues: ${payload.latestChecksumStatus.issues.join("; ")}`);
  }

  lines.push("");
  lines.push("## Checksum Compare");
  lines.push("");
  if (payload.latestChecksumsCompare) {
    lines.push(
      `- changedArtifacts: ${payload.latestChecksumsCompare.changedArtifactPaths.join(", ") || "(none)"}`
    );
    lines.push(
      `- unchangedArtifacts: ${payload.latestChecksumsCompare.unchangedArtifacts.join(", ") || "(none)"}`
    );
  } else {
    lines.push("- changedArtifacts: (not available)");
  }

  lines.push("");
  lines.push("## Regressions Compare");
  lines.push("");
  if (payload.latestRegressionsCompare) {
    lines.push(
      `- regressionCountDelta: ${payload.latestRegressionsCompare.regressionCountDelta ?? "(none)"}`
    );
    lines.push(
      `- added: ${payload.latestRegressionsCompare.addedSnapshotNames.join(", ") || "(none)"}`
    );
    lines.push(
      `- removed: ${payload.latestRegressionsCompare.removedSnapshotNames.join(", ") || "(none)"}`
    );
  } else {
    lines.push("- regressionCountDelta: (not available)");
  }

  lines.push("");
  lines.push("## Compare");
  lines.push("");
  if (payload.latestCompare) {
    lines.push(
      `- changedFields: ${payload.latestCompare.changedFieldLabels.join(", ") || "(none)"}`
    );
    lines.push(
      `- unchangedFields: ${payload.latestCompare.unchangedFields.join(", ") || "(none)"}`
    );
  } else {
    lines.push("- changedFields: (not available)");
  }

  lines.push("");
  lines.push("## Next");
  lines.push("");
  lines.push(`- reason: ${payload.next.reason}`);
  lines.push(`- command: ${payload.next.command}`);
  lines.push("");

  return lines.join("\n");
}
