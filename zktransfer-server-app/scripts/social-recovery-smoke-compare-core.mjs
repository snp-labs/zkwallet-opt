export function compareField(label, latestValue, previousValue) {
  const changed = latestValue !== previousValue;
  return {
    label,
    changed,
    latest: latestValue ?? null,
    previous: previousValue ?? null,
  };
}

export const TRACKED_ARTIFACT_PATHS = [
  "manifest.json",
  "report.md",
  "result.json",
  "input.redacted.json",
];

export function compareChecksumBundles(latestChecksums, previousChecksums) {
  const latestFiles = new Map(
    Array.isArray(latestChecksums?.files)
      ? latestChecksums.files.map((entry) => [entry.path, entry.sha256])
      : []
  );
  const previousFiles = new Map(
    Array.isArray(previousChecksums?.files)
      ? previousChecksums.files.map((entry) => [entry.path, entry.sha256])
      : []
  );

  const allPaths = TRACKED_ARTIFACT_PATHS.filter(
    (filePath) => latestFiles.has(filePath) || previousFiles.has(filePath)
  );
  return allPaths.map((filePath) => {
    const latestSha = latestFiles.get(filePath) ?? null;
    const previousSha = previousFiles.get(filePath) ?? null;
    return {
      path: filePath,
      changed: latestSha !== previousSha,
      latestSha256: latestSha,
      previousSha256: previousSha,
    };
  });
}

export function buildComparisonPayload(
  latest,
  previous,
  latestManifest,
  previousManifest,
  baseDir,
  latestChecksums,
  previousChecksums
) {
  const comparisons = [
    compareField("accountId", latestManifest.accountId, previousManifest.accountId),
    compareField(
      "zkAccountAddress",
      latestManifest.zkAccountAddress,
      previousManifest.zkAccountAddress
    ),
    compareField(
      "submitTransactionHash",
      latestManifest.submitTransactionHash,
      previousManifest.submitTransactionHash
    ),
    compareField(
      "submitUserOpHash",
      latestManifest.submitUserOpHash,
      previousManifest.submitUserOpHash
    ),
    compareField(
      "challengeNonce",
      latestManifest.challengeNonce,
      previousManifest.challengeNonce
    ),
  ];
  const artifactComparisons = compareChecksumBundles(latestChecksums, previousChecksums);

  return {
    baseDir,
    latest: {
      name: latest.name,
      generatedAt: latest.generatedAt,
    },
    previous: {
      name: previous.name,
      generatedAt: previous.generatedAt,
    },
    changedFields: comparisons.filter((entry) => entry.changed),
    unchangedFields: comparisons
      .filter((entry) => !entry.changed)
      .map((entry) => entry.label),
    changedArtifacts: artifactComparisons.filter((entry) => entry.changed),
    unchangedArtifacts: artifactComparisons
      .filter((entry) => !entry.changed)
      .map((entry) => entry.path),
  };
}

export function renderComparisonText(payload) {
  const lines = [
    "# Social Recovery Smoke Compare",
    "",
    `- latest: ${payload.latest.name}`,
    `- previous: ${payload.previous.name}`,
    "",
  ];

  if (payload.changedFields.length === 0) {
    lines.push("No tracked fields changed.");
  } else {
    lines.push("Changed fields:");
    for (const entry of payload.changedFields) {
      lines.push(
        `- ${entry.label}: ${entry.previous || "(none)"} -> ${entry.latest || "(none)"}`
      );
    }
  }

  if (payload.unchangedFields.length > 0) {
    lines.push("");
    lines.push(`Unchanged: ${payload.unchangedFields.join(", ")}`);
  }

  lines.push("");
  lines.push("Artifact checksum changes:");
  if (payload.changedArtifacts.length === 0) {
    lines.push("- none");
  } else {
    for (const entry of payload.changedArtifacts) {
      lines.push(
        `- ${entry.path}: ${entry.previousSha256 || "(none)"} -> ${entry.latestSha256 || "(none)"}`
      );
    }
  }

  if (payload.unchangedArtifacts.length > 0) {
    lines.push("");
    lines.push(`Artifacts unchanged: ${payload.unchangedArtifacts.join(", ")}`);
  }

  lines.push("");
  return lines.join("\n");
}
