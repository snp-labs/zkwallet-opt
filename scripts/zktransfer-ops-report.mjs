import { loadDeploymentStatuses, summarizeStatuses } from "./zktransfer-ops-overview.mjs";
import { renderRootCommandOnly } from "./zktransfer-ops-next.mjs";
import { buildOpsPlan } from "./zktransfer-ops-plan.mjs";
import { renderOpsSummaryMarkdown } from "./zktransfer-ops-summary.mjs";

export function renderOpsReport(summary) {
  const lines = [];
  const nextCommand = renderRootCommandOnly(summary).trim();
  const steps = buildOpsPlan(summary);

  lines.push("# zkTransfer Ops Report");
  lines.push("");
  lines.push(`- Generated: \`${summary.generatedAt}\``);
  lines.push(`- Overall configReady: \`${summary.overall.configReady}\``);
  lines.push(`- Overall healthReady: \`${summary.overall.healthReady}\``);
  lines.push(`- Blocking issues: \`${summary.overall.blockingIssueCount}\``);
  lines.push("");
  lines.push("## Immediate Next Command");
  lines.push("");
  lines.push("```bash");
  lines.push(nextCommand === "" ? "none" : nextCommand);
  lines.push("```");
  lines.push("");
  lines.push("## Recommended Plan");

  if (steps.length === 1 && steps[0].command === "ready") {
    lines.push("");
    lines.push("1. `ready`");
    lines.push(`   ${steps[0].reason}`);
  } else {
    lines.push("");
    for (const [index, step] of steps.entries()) {
      lines.push(`${index + 1}. \`${step.command}\``);
      lines.push(`   ${step.reason}`);
    }
  }

  lines.push("");
  lines.push("## Detailed Summary");
  lines.push("");
  lines.push(renderOpsSummaryMarkdown(summary).trimEnd());
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  const statuses = loadDeploymentStatuses();
  const summary = summarizeStatuses(statuses);
  process.stdout.write(renderOpsReport(summary));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
