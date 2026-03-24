import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSummaryReady, loadDeploymentStatuses, summarizeStatuses } from "./zktransfer-ops-overview.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function mapSuggestedCommandToRootCommand(suggestedCommand) {
  switch (suggestedCommand) {
    case "npm run setup:env":
      return "setup-env";
    case "npm run check:ready":
      return "check-ready";
    case "npm run deployment:status":
      return "status";
    case "npm run install:systemd:dry-run":
      return "install:dry-run";
    case "npm run verify:deployment":
      return "verify";
    default:
      return null;
  }
}

export function buildNextStepGroups(summary) {
  const groups = new Map();

  for (const service of summary.services) {
    if (!service.suggestedCommand) {
      continue;
    }

    const key = service.suggestedCommand;
    if (!groups.has(key)) {
      groups.set(key, {
        suggestedCommand: key,
        rootCommand: mapSuggestedCommandToRootCommand(key),
        services: []
      });
    }

    groups.get(key).services.push({
      serviceName: service.serviceName,
      suggestedCommandLine: service.suggestedCommandLine,
      blockingIssues: service.blockingIssues
    });
  }

  return [...groups.values()];
}

export function renderNextSteps(summary) {
  const lines = [];
  const groups = buildNextStepGroups(summary);
  const rootWrapperPath = path.join(__dirname, "zktransfer-ops.sh");

  lines.push("zkTransfer Ops Next Steps");
  lines.push(`Generated: ${summary.generatedAt}`);

  if (isSummaryReady(summary)) {
    lines.push("Status: ready");
    return `${lines.join("\n")}\n`;
  }

  lines.push(`Status: blocked (${summary.overall.blockingIssueCount} blocking issues)`);

  if (groups.length === 0) {
    lines.push("Next steps: none");
    return `${lines.join("\n")}\n`;
  }

  lines.push("Next steps:");
  for (const group of groups) {
    if (group.rootCommand && group.services.length > 1) {
      lines.push(`- Shared: bash ${JSON.stringify(rootWrapperPath)} ${group.rootCommand}`);
    } else {
      lines.push(`- Suggested: ${group.suggestedCommand}`);
    }

    for (const service of group.services) {
      lines.push(`  service: ${service.serviceName}`);
      if (service.suggestedCommandLine) {
        lines.push(`  run: ${service.suggestedCommandLine}`);
      }
      if (service.blockingIssues.length > 0) {
        lines.push(`  why: ${service.blockingIssues[0]}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderRootCommandOnly(summary) {
  if (isSummaryReady(summary)) {
    return "ready\n";
  }

  const groups = buildNextStepGroups(summary);
  const rootWrapperPath = path.join(__dirname, "zktransfer-ops.sh");
  const sharedGroup = groups.find((group) => group.rootCommand && group.services.length > 1);

  if (sharedGroup) {
    return `bash ${JSON.stringify(rootWrapperPath)} ${sharedGroup.rootCommand}\n`;
  }

  const firstGroup = groups[0];
  if (!firstGroup) {
    return "none\n";
  }

  if (firstGroup.rootCommand) {
    return `bash ${JSON.stringify(rootWrapperPath)} ${firstGroup.rootCommand}\n`;
  }

  const firstService = firstGroup.services[0];
  if (firstService?.suggestedCommandLine) {
    return `${firstService.suggestedCommandLine}\n`;
  }

  return `${firstGroup.suggestedCommand}\n`;
}

function parseArgs(argv) {
  return {
    rootCommandOnly: argv.includes("--root-command-only")
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const statuses = loadDeploymentStatuses();
  const summary = summarizeStatuses(statuses);
  if (args.rootCommandOnly) {
    process.stdout.write(renderRootCommandOnly(summary));
    return;
  }
  process.stdout.write(renderNextSteps(summary));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
