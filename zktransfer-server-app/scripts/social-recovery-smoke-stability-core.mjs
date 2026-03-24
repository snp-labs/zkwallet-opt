export function buildStabilityPayload(trendPayload, options) {
  const reasons = [];

  if (trendPayload.snapshotCount === 0) {
    reasons.push("no snapshots available");
  }
  if (!trendPayload.latestStable) {
    reasons.push("latest snapshot is not stable");
  }
  if (options.requireLastTwoStable && !trendPayload.lastTwoStable) {
    reasons.push("last two snapshots are not both stable");
  }
  if (
    options.maxAverageChangedFieldsCount !== null &&
    trendPayload.averageChangedFieldsCount > options.maxAverageChangedFieldsCount
  ) {
    reasons.push(
      `averageChangedFieldsCount ${trendPayload.averageChangedFieldsCount} exceeds ${options.maxAverageChangedFieldsCount}`
    );
  }
  if (
    options.maxAverageChangedArtifactsCount !== null &&
    trendPayload.averageChangedArtifactsCount > options.maxAverageChangedArtifactsCount
  ) {
    reasons.push(
      `averageChangedArtifactsCount ${trendPayload.averageChangedArtifactsCount} exceeds ${options.maxAverageChangedArtifactsCount}`
    );
  }

  return {
    ok: reasons.length === 0,
    reasons,
    options,
    trend: trendPayload,
  };
}

export function renderStabilityText(payload, renderTrendText) {
  const sections = [
    "# Social Recovery Smoke Stability",
    "",
    `- ok: ${payload.ok}`,
    `- requireLastTwoStable: ${payload.options.requireLastTwoStable}`,
    `- maxAverageChangedFieldsCount: ${
      payload.options.maxAverageChangedFieldsCount ?? "(none)"
    }`,
    `- maxAverageChangedArtifactsCount: ${
      payload.options.maxAverageChangedArtifactsCount ?? "(none)"
    }`,
  ];

  if (payload.reasons.length === 0) {
    sections.push("- reasons: none");
  } else {
    sections.push("- reasons:");
    for (const reason of payload.reasons) {
      sections.push(`  - ${reason}`);
    }
  }

  sections.push("");
  sections.push(renderTrendText(payload.trend).trimEnd());
  sections.push("");
  return sections.join("\n");
}
