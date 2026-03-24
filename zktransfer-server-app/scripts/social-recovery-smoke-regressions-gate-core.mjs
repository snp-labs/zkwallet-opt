export function buildRegressionsGatePayload({
  baseDir,
  latestDir,
  regressionsPayload,
  regressionsIntegrityPayload,
  regressionsDoctorPayload,
  regressionsHistoryCompareCheckPayload,
  regressionsHistoryGateFailingCompareCheckPayload,
}) {
  const issues = [];

  if (!regressionsPayload) {
    issues.push("latest regressions.json is missing");
  }
  if (!regressionsIntegrityPayload) {
    issues.push("latest regressions-integrity.json is missing");
  } else if (regressionsIntegrityPayload.ok === false) {
    issues.push("latest regressions-integrity.json reports integrity issues");
  }
  if (!regressionsDoctorPayload) {
    issues.push("latest regressions-doctor.json is missing");
  } else if (regressionsDoctorPayload.ok === false) {
    issues.push("latest regressions-doctor.json reports doctor issues");
  }
  if (
    (regressionsPayload?.regressionCount ?? 0) > 0 &&
    !regressionsHistoryCompareCheckPayload
  ) {
    issues.push(
      "latest regressions-history-compare-check.json is missing while unstable snapshots exist"
    );
  } else if (regressionsHistoryCompareCheckPayload?.ok === false) {
    issues.push(
      "latest regressions-history-compare-check.json reports worsening unstable behavior"
    );
  }
  if (
    (regressionsPayload?.regressionCount ?? 0) > 0 &&
    !regressionsHistoryGateFailingCompareCheckPayload
  ) {
    issues.push(
      "latest regressions-history-gate-failing-compare-check.json is missing while unstable snapshots exist"
    );
  } else if (regressionsHistoryGateFailingCompareCheckPayload?.ok === false) {
    issues.push(
      "latest regressions-history-gate-failing-compare-check.json reports worsening gate-failing behavior"
    );
  }

  const issueCount = issues.length;
  const ok = issueCount === 0;
  const nextCommand = !regressionsPayload
    ? "npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json"
    : regressionsIntegrityPayload?.ok === false
    ? "npm run social-recovery:smoke:regressions:integrity"
    : regressionsDoctorPayload?.ok === false
    ? "npm run social-recovery:smoke:regressions:doctor"
    : regressionsHistoryGateFailingCompareCheckPayload?.ok === false
    ? "npm run social-recovery:smoke:regressions:history:gate-failing:compare:check"
    : regressionsHistoryCompareCheckPayload?.ok === false
    ? "npm run social-recovery:smoke:regressions:history:compare:check"
    : "npm run social-recovery:smoke:regressions:report";

  return {
    baseDir,
    latestDir,
    ok,
    issueCount,
    regressionCount: regressionsPayload?.regressionCount ?? 0,
    hasRegressions: Boolean(regressionsPayload),
    hasRegressionsIntegrity: Boolean(regressionsIntegrityPayload),
    regressionsIntegrityOk:
      typeof regressionsIntegrityPayload?.ok === "boolean"
        ? regressionsIntegrityPayload.ok
        : null,
    regressionsIntegrityIssueCount: Array.isArray(regressionsIntegrityPayload?.issues)
      ? regressionsIntegrityPayload.issues.length
      : 0,
    hasRegressionsDoctor: Boolean(regressionsDoctorPayload),
    regressionsDoctorOk:
      typeof regressionsDoctorPayload?.ok === "boolean" ? regressionsDoctorPayload.ok : null,
    regressionsDoctorIssueCount: Array.isArray(regressionsDoctorPayload?.issues)
      ? regressionsDoctorPayload.issues.length
      : 0,
    hasRegressionsHistoryGateFailingCompareCheck: Boolean(
      regressionsHistoryGateFailingCompareCheckPayload
    ),
    regressionsHistoryGateFailingCompareCheckOk:
      typeof regressionsHistoryGateFailingCompareCheckPayload?.ok === "boolean"
        ? regressionsHistoryGateFailingCompareCheckPayload.ok
        : null,
    regressionsHistoryGateFailingCompareCheckIssueCount:
      typeof regressionsHistoryGateFailingCompareCheckPayload?.issueCount === "number"
        ? regressionsHistoryGateFailingCompareCheckPayload.issueCount
        : Array.isArray(regressionsHistoryGateFailingCompareCheckPayload?.issues)
        ? regressionsHistoryGateFailingCompareCheckPayload.issues.length
        : 0,
    hasRegressionsHistoryCompareCheck: Boolean(regressionsHistoryCompareCheckPayload),
    regressionsHistoryCompareCheckOk:
      typeof regressionsHistoryCompareCheckPayload?.ok === "boolean"
        ? regressionsHistoryCompareCheckPayload.ok
        : null,
    regressionsHistoryCompareCheckIssueCount:
      typeof regressionsHistoryCompareCheckPayload?.issueCount === "number"
        ? regressionsHistoryCompareCheckPayload.issueCount
        : Array.isArray(regressionsHistoryCompareCheckPayload?.issues)
        ? regressionsHistoryCompareCheckPayload.issues.length
        : 0,
    issues,
    nextCommand,
  };
}

export function renderRegressionsGateText(payload) {
  const lines = [
    "# Social Recovery Smoke Regressions Gate",
    "",
    `- ok: ${payload.ok}`,
    `- issueCount: ${payload.issueCount}`,
    `- regressionCount: ${payload.regressionCount}`,
    `- hasRegressions: ${payload.hasRegressions}`,
    `- hasRegressionsIntegrity: ${payload.hasRegressionsIntegrity}`,
    `- regressionsIntegrityOk: ${payload.regressionsIntegrityOk ?? "(not available)"}`,
    `- regressionsIntegrityIssueCount: ${payload.regressionsIntegrityIssueCount}`,
    `- hasRegressionsDoctor: ${payload.hasRegressionsDoctor}`,
    `- regressionsDoctorOk: ${payload.regressionsDoctorOk ?? "(not available)"}`,
    `- regressionsDoctorIssueCount: ${payload.regressionsDoctorIssueCount}`,
    `- hasRegressionsHistoryGateFailingCompareCheck: ${payload.hasRegressionsHistoryGateFailingCompareCheck}`,
    `- regressionsHistoryGateFailingCompareCheckOk: ${payload.regressionsHistoryGateFailingCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryGateFailingCompareCheckIssueCount: ${payload.regressionsHistoryGateFailingCompareCheckIssueCount}`,
    `- hasRegressionsHistoryCompareCheck: ${payload.hasRegressionsHistoryCompareCheck}`,
    `- regressionsHistoryCompareCheckOk: ${payload.regressionsHistoryCompareCheckOk ?? "(not available)"}`,
    `- regressionsHistoryCompareCheckIssueCount: ${payload.regressionsHistoryCompareCheckIssueCount}`,
    `- nextCommand: ${payload.nextCommand}`,
    "",
  ];
  if (payload.issues.length === 0) {
    lines.push("- issues: none", "");
  } else {
    lines.push("- issues:");
    for (const issue of payload.issues) {
      lines.push(`  - ${issue}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
