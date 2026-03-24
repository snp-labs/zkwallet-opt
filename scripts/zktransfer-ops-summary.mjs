import { isSummaryReady, loadDeploymentStatuses, summarizeStatuses } from "./zktransfer-ops-overview.mjs";

export function renderOpsSummary(summary) {
  const lines = [];

  lines.push("zkTransfer Ops Summary");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(
    `Overall: configReady=${summary.overall.configReady} healthReady=${summary.overall.healthReady} blockingIssues=${summary.overall.blockingIssueCount}`
  );

  if (summary.overall.primarySuggestedCommand) {
    lines.push(`Next command: ${summary.overall.primarySuggestedCommand}`);
  }

  if (summary.blockingIssues.length > 0) {
    lines.push("Blocking issues:");
    for (const issue of summary.blockingIssues) {
      lines.push(`- ${issue}`);
    }
  } else {
    lines.push("Blocking issues: none");
  }

  lines.push("Services:");
  for (const service of summary.services) {
    const readiness = service.configReady && service.healthReady ? "ready" : "blocked";
    lines.push(
      `- ${service.serviceName}: ${readiness} | env=${service.envExists} unit=${service.unitExists} | next=${service.suggestedCommand ?? "none"}`
    );

    if (service.suggestedCommandLine) {
      lines.push(`  run: ${service.suggestedCommandLine}`);
    }

    if (service.blockingIssues.length > 0) {
      for (const issue of service.blockingIssues) {
        lines.push(`  issue: ${issue}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderOpsSummaryMarkdown(summary) {
  const lines = [];

  lines.push("# zkTransfer Ops Summary");
  lines.push("");
  lines.push(`- Generated: \`${summary.generatedAt}\``);
  lines.push(
    `- Overall: configReady=\`${summary.overall.configReady}\`, healthReady=\`${summary.overall.healthReady}\`, blockingIssues=\`${summary.overall.blockingIssueCount}\``
  );

  if (summary.overall.primarySuggestedCommand) {
    lines.push(`- Next command: \`${summary.overall.primarySuggestedCommand}\``);
  }

  lines.push("");
  lines.push("## Blocking Issues");
  if (summary.blockingIssues.length > 0) {
    for (const issue of summary.blockingIssues) {
      lines.push(`- ${issue}`);
    }
  } else {
    lines.push("- none");
  }

  lines.push("");
  lines.push("## Services");
  for (const service of summary.services) {
    const readiness = service.configReady && service.healthReady ? "ready" : "blocked";
    lines.push(
      `- **${service.serviceName}**: ${readiness} | env=\`${service.envExists}\` | unit=\`${service.unitExists}\` | next=\`${service.suggestedCommand ?? "none"}\``
    );

    if (service.suggestedCommandLine) {
      lines.push(`  - run: \`${service.suggestedCommandLine}\``);
    }

    if (service.blockingIssues.length > 0) {
      for (const issue of service.blockingIssues) {
        lines.push(`  - issue: ${issue}`);
      }
    }
  }

  lines.push("");
  return `${lines.join("\n")}`;
}

export function renderOpsSummaryByFormat(summary, format = "text") {
  if (format === "markdown") {
    return renderOpsSummaryMarkdown(summary);
  }

  if (format === "json") {
    return `${JSON.stringify(summary, null, 2)}\n`;
  }

  return renderOpsSummary(summary);
}

function parseFormatArg(argv) {
  if (argv.includes("--markdown")) {
    return "markdown";
  }
  if (argv.includes("--json")) {
    return "json";
  }
  return "text";
}

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
    format: parseFormatArg(argv)
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const statuses = loadDeploymentStatuses();
  const summary = summarizeStatuses(statuses);
  process.stdout.write(renderOpsSummaryByFormat(summary, args.format));

  if (args.check && !isSummaryReady(summary)) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
