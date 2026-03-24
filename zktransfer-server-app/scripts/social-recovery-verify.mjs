import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const includeLocalDemo = args.has("--with-local-demo");
const dryRun = args.has("--dry-run");
const npmBin = process.env.SOCIAL_RECOVERY_VERIFY_NPM_BIN || process.env.npm_execpath || "npm";

const phases = [
  {
    title: "Full test suite",
    command: [npmBin, "test"],
  },
  {
    title: "Saved regressions summary",
    command: [npmBin, "run", "social-recovery:smoke:regressions:summary"],
  },
];

if (includeLocalDemo) {
  phases.push({
    title: "Local social recovery demo",
    command: [npmBin, "run", "social-recovery:local-demo", "--", "--json"],
  });
}

for (const phase of phases) {
  const commandText = phase.command.join(" ");
  console.log(`\n## ${phase.title}`);
  console.log(commandText);

  if (dryRun) {
    continue;
  }

  const result = spawnSync(phase.command[0], phase.command.slice(1), {
    cwd: appDir,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

if (dryRun) {
  console.log("\nDry run only. No commands were executed.");
}
