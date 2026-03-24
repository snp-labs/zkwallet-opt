import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSummaryReady, loadDeploymentStatuses, summarizeStatuses } from "./zktransfer-ops-overview.mjs";
import { buildNextStepGroups } from "./zktransfer-ops-next.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function appendUniqueStep(steps, command, reason) {
  if (steps.some((step) => step.command === command)) {
    return;
  }

  steps.push({ command, reason });
}

export function buildOpsPlan(summary) {
  if (isSummaryReady(summary)) {
    return [
      {
        command: "ready",
        reason: "All tracked zkTransfer services report config and health readiness."
      }
    ];
  }

  const steps = [];
  const rootWrapperPath = path.join(__dirname, "zktransfer-ops.sh");
  const groups = buildNextStepGroups(summary);
  const sharedGroup = groups.find((group) => group.rootCommand && group.services.length > 1);

  if (sharedGroup?.rootCommand) {
    appendUniqueStep(
      steps,
      `bash ${JSON.stringify(rootWrapperPath)} ${sharedGroup.rootCommand}`,
      `Current shared next step for ${sharedGroup.services.length} services.`
    );
  }

  if (summary.services.some((service) => !service.configReady)) {
    appendUniqueStep(
      steps,
      `bash ${JSON.stringify(rootWrapperPath)} check-ready`,
      "Re-check per-service readiness after env and fail-closed settings are updated."
    );
  }

  if (summary.services.some((service) => service.missingDeps.includes("systemctl"))) {
    appendUniqueStep(
      steps,
      `bash ${JSON.stringify(rootWrapperPath)} install:dry-run`,
      "Validate deployment prechecks on this non-systemd host before moving to a target machine."
    );
  }

  if (!summary.overall.healthReady) {
    appendUniqueStep(
      steps,
      `bash ${JSON.stringify(rootWrapperPath)} doctor`,
      "Run the full read-only status, summary, and readiness gate after changes."
    );
  }

  return steps;
}

export function renderOpsPlan(summary) {
  const steps = buildOpsPlan(summary);
  const lines = [];

  lines.push("zkTransfer Ops Plan");
  lines.push(`Generated: ${summary.generatedAt}`);

  if (steps.length === 1 && steps[0].command === "ready") {
    lines.push("Status: ready");
    lines.push(`1. ${steps[0].command}`);
    lines.push(`   ${steps[0].reason}`);
    return `${lines.join("\n")}\n`;
  }

  lines.push(`Status: blocked (${summary.overall.blockingIssueCount} blocking issues)`);
  for (const [index, step] of steps.entries()) {
    lines.push(`${index + 1}. ${step.command}`);
    lines.push(`   ${step.reason}`);
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const statuses = loadDeploymentStatuses();
  const summary = summarizeStatuses(statuses);
  process.stdout.write(renderOpsPlan(summary));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
