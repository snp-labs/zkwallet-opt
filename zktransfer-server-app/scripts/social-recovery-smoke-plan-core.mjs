import { getOverviewRecommendation } from "./social-recovery-smoke-overview-core.mjs";

export function buildPlanPayload({
  baseDir,
  hasLatestReport,
  snapshotCount,
  hasCompare,
  hasChecksumsCompare,
  recentRegressionCount,
  hasRegressionsCompare,
}) {
  const recommendation = getOverviewRecommendation({
    hasLatestReport,
    snapshotCount,
    hasCompare,
    recentRegressionCount,
    hasRegressionsCompare,
  });

  let steps;
  if (!hasLatestReport) {
    steps = [recommendation.command, "npm run social-recovery:smoke:doctor"];
  } else if (snapshotCount < 2 || !hasCompare) {
    steps = [
      "npm run social-recovery:smoke:latest",
      recommendation.command,
      "npm run social-recovery:smoke:doctor",
    ];
  } else {
    steps = recentRegressionCount > 0
      ? [
          hasRegressionsCompare
            ? "npm run social-recovery:smoke:regressions:changes"
            : "npm run social-recovery:smoke:regressions",
          "npm run social-recovery:smoke:checksums:changes",
          "npm run social-recovery:smoke:changes",
          "npm run social-recovery:smoke:overview",
          "npm run social-recovery:smoke:doctor",
        ]
      : hasChecksumsCompare
      ? [
          "npm run social-recovery:smoke:checksums:changes",
          "npm run social-recovery:smoke:changes",
          "npm run social-recovery:smoke:overview",
          "npm run social-recovery:smoke:doctor",
        ]
      : [
          "npm run social-recovery:smoke:changes",
          "npm run social-recovery:smoke:overview",
          "npm run social-recovery:smoke:doctor",
        ];
  }

  return {
    baseDir,
    hasLatestReport,
    snapshotCount,
    hasCompare,
    hasChecksumsCompare,
    hasRegressionsCompare: Boolean(hasRegressionsCompare),
    recentRegressionCount: recentRegressionCount ?? 0,
    reason: recommendation.reason,
    steps,
  };
}

export function renderPlanText(payload) {
  const lines = [
    "# Social Recovery Smoke Plan",
    "",
    `- reason: ${payload.reason}`,
    "",
  ];
  payload.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`);
  });
  lines.push("");
  return lines.join("\n");
}
