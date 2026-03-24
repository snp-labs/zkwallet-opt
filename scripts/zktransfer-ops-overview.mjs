import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const SERVICE_TARGETS = [
  {
    key: "zktransfer-server-app",
    label: "zktransfer-server-app",
    appDir: path.join(rootDir, "zktransfer-server-app"),
    statusScript: path.join(rootDir, "zktransfer-server-app", "scripts", "deployment-status.sh")
  },
  {
    key: "zktransfer-custody-platform-server",
    label: "zktransfer-custody-platform-server",
    appDir: path.join(rootDir, "zktransfer-custody-platform", "apps", "server"),
    statusScript: path.join(
      rootDir,
      "zktransfer-custody-platform",
      "apps",
      "server",
      "scripts",
      "deployment-status.sh"
    )
  }
];

export function extractJsonDocument(stdout) {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("status command did not emit JSON");
  }
  return JSON.parse(stdout.slice(jsonStart));
}

export function buildSuggestedCommandLine(appDir, suggestedCommand) {
  if (!suggestedCommand) {
    return null;
  }

  return `cd ${JSON.stringify(appDir)} && ${suggestedCommand}`;
}

export function summarizeStatuses(statuses) {
  const services = statuses.map((status) => ({
    serviceName: status.serviceName,
    appDir: status.appDir || null,
    envExists: status.envExists,
    unitExists: status.unitExists,
    configReady: Boolean(status.config?.ready),
    healthReady: Boolean(status.health?.ready),
    missingDeps: status.missingDeps || [],
    blockingIssues: status.blockingIssues || [],
    suggestedCommand: status.suggestedCommand || null,
    suggestedCommandLine: buildSuggestedCommandLine(status.appDir, status.suggestedCommand || null)
  }));

  const blockingIssues = [...new Set(services.flatMap((service) => service.blockingIssues))];
  const suggestedCommands = [...new Set(
    services
      .map((service) => service.suggestedCommand)
      .filter(Boolean)
  )];

  return {
    generatedAt: new Date().toISOString(),
    overall: {
      configReady: services.every((service) => service.configReady),
      healthReady: services.every((service) => service.healthReady),
      blockingIssueCount: blockingIssues.length,
      suggestedCommands,
      primarySuggestedCommand: suggestedCommands[0] || null
    },
    blockingIssues,
    services
  };
}

export function isSummaryReady(summary) {
  return Boolean(summary?.overall?.configReady) && Boolean(summary?.overall?.healthReady);
}

export function loadDeploymentStatuses(targets = SERVICE_TARGETS) {
  const childEnv = { ...process.env };
  const pathEntries = (childEnv.PATH || "").split(":").filter(Boolean);
  if (!pathEntries.includes("/opt/homebrew/bin")) {
    pathEntries.push("/opt/homebrew/bin");
  }
  childEnv.PATH = pathEntries.join(":");

  return targets.map((target) => {
    const stdout = execFileSync("bash", [target.statusScript], {
      cwd: target.appDir,
      encoding: "utf8",
      env: childEnv
    });
    const status = extractJsonDocument(stdout);
    return {
      ...status,
      appDir: target.appDir
    };
  });
}

function parseArgs(argv) {
  return {
    check: argv.includes("--check")
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const statuses = loadDeploymentStatuses();
  const summary = summarizeStatuses(statuses);
  console.log(JSON.stringify(summary, null, 2));

  if (args.check && !isSummaryReady(summary)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === __filename) {
  main();
}
