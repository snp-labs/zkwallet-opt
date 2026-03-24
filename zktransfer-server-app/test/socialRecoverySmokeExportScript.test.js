import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function createTempApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zktransfer-social-export-"));
  fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tmp"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-export.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-export.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-compare-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-compare-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-overview-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-overview-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-plan-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-plan-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-summary-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-summary-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-trend.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-trend.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-trend-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-trend-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-stability-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-stability-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-compare-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-compare-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-integrity-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-integrity-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-gate-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-gate-core.mjs")
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-regressions-history-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-regressions-history-core.mjs")
  );
  fs.copyFileSync(
    path.join(
      process.cwd(),
      "scripts",
      "social-recovery-smoke-regressions-history-compare-core.mjs"
    ),
    path.join(
      tempDir,
      "scripts",
      "social-recovery-smoke-regressions-history-compare-core.mjs"
    )
  );
  fs.copyFileSync(
    path.join(process.cwd(), "scripts", "social-recovery-smoke-bundle-core.mjs"),
    path.join(tempDir, "scripts", "social-recovery-smoke-bundle-core.mjs")
  );
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );
  return tempDir;
}

test("social-recovery-smoke-export writes latest snapshot and history", async () => {
  const tempDir = createTempApp();
  const inputPath = path.join(tempDir, "tmp", "social-recovery-smoke-input.json");
  const exportDir = path.join(tempDir, "tmp", "social-recovery-smoke-report");

  fs.writeFileSync(
    inputPath,
    JSON.stringify(
      {
        providers: ["google"],
        txKeyAddress: "0x1111111111111111111111111111111111111111",
        newTxKeyAddress: "0x2222222222222222222222222222222222222222",
        create: {
          providers: ["google"],
          jwts: [
            "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNyZWF0ZS1raWQifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ6a3Bhc3NrZXktY2xpZW50Iiwic3ViIjoiY3JlYXRlLXN1YmplY3QiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMzYwMH0.signature"
          ],
        },
        challenge: {
          providers: ["google"],
          jwts: [
            "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNoYWxsZW5nZS1raWQifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ6a3Bhc3NrZXktY2xpZW50Iiwic3ViIjoiY2hhbGxlbmdlLXN1YmplY3QiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMzYwMH0.signature"
          ],
        },
        submit: {
          providers: ["google"],
          jwts: [
            "eyJhbGciOiJSUzI1NiIsImtpZCI6InN1Ym1pdC1raWQifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ6a3Bhc3NrZXktY2xpZW50Iiwic3ViIjoic3VibWl0LXN1YmplY3QiLCJub25jZSI6IjB4YWJjIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.signature"
          ],
        },
      },
      null,
      2
    )
  );

  let submissionCounter = 0;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    JSON.parse(Buffer.concat(chunks).toString("utf8"));

    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/social-login/create-account") {
      res.end(
        JSON.stringify({
          accountData: { accountId: "account-export" },
          chainAccount: {
            zkAccountAddress: "0x3333333333333333333333333333333333333333",
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/recovery-challenge") {
      res.end(
        JSON.stringify({
          challenge: {
            nonce: "0xabc",
            random: "0xdef",
            userOpHash: "0x123",
            zkAccountAddress: "0x3333333333333333333333333333333333333333",
          },
        })
      );
      return;
    }
    if (req.url === "/v1/social-login/recovery-submit") {
      submissionCounter += 1;
      res.end(
        JSON.stringify({
          account: {
            accountId: "account-export",
            chainAccount: {
              zkAccountAddress: "0x3333333333333333333333333333333333333333",
            },
          },
          challenge: {
            counter: String(submissionCounter),
          },
          submission: {
            transactionHash: `0x999${submissionCounter}`,
            userOpHash: `0x123${submissionCounter}`,
          },
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "unexpected route" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    const first = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-export.mjs"),
        "--json",
        "--base-dir",
        exportDir,
        "--input",
        inputPath,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_BASE_URL: `http://127.0.0.1:${address.port}`,
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    const second = await execFileAsync(
      "node",
      [
        path.join(tempDir, "scripts", "social-recovery-smoke-export.mjs"),
        "--json",
        "--base-dir",
        exportDir,
        "--input",
        inputPath,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          SOCIAL_RECOVERY_BASE_URL: `http://127.0.0.1:${address.port}`,
        },
      }
    );

    const firstResult = JSON.parse(first.stdout);
    const secondResult = JSON.parse(second.stdout);
    const index = JSON.parse(
      fs.readFileSync(path.join(exportDir, "snapshots", "index.json"), "utf8")
    );
    const history = fs.readFileSync(path.join(exportDir, "history.md"), "utf8");
    const latestManifest = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "manifest.json"), "utf8")
    );
    const latestCompareText = fs.readFileSync(
      path.join(exportDir, "latest", "compare.txt"),
      "utf8"
    );
    const latestCompareJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "compare.json"), "utf8")
    );
    const latestChangesText = fs.readFileSync(
      path.join(exportDir, "latest", "changes.txt"),
      "utf8"
    );
    const latestChangesJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "changes.json"), "utf8")
    );
    const latestChecksumsCompareText = fs.readFileSync(
      path.join(exportDir, "latest", "checksums-compare.txt"),
      "utf8"
    );
    const latestChecksumsCompareJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "checksums-compare.json"), "utf8")
    );
    const latestOverview = fs.readFileSync(
      path.join(exportDir, "latest", "overview.md"),
      "utf8"
    );
    const latestOverviewJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "overview.json"), "utf8")
    );
    const latestNext = fs.readFileSync(path.join(exportDir, "latest", "next.txt"), "utf8");
    const latestPlan = fs.readFileSync(path.join(exportDir, "latest", "plan.txt"), "utf8");
    const latestPlanJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "plan.json"), "utf8")
    );
    const latestSummary = fs.readFileSync(path.join(exportDir, "latest", "summary.md"), "utf8");
    const latestSummaryJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "summary.json"), "utf8")
    );
    const latestTrendText = fs.readFileSync(path.join(exportDir, "latest", "trend.txt"), "utf8");
    const latestTrendJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "trend.json"), "utf8")
    );
    const latestStabilityText = fs.readFileSync(
      path.join(exportDir, "latest", "stability.txt"),
      "utf8"
    );
    const latestStabilityJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "stability.json"), "utf8")
    );
    const latestRegressionsText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions.txt"),
      "utf8"
    );
    const latestRegressionsJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions.json"), "utf8")
    );
    const latestRegressionsCompareText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-compare.txt"),
      "utf8"
    );
    const latestRegressionsCompareJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-compare.json"), "utf8")
    );
    const latestRegressionsChangesText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-changes.txt"),
      "utf8"
    );
    const latestRegressionsChangesJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-changes.json"), "utf8")
    );
    const latestRegressionsStatusText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-status.txt"),
      "utf8"
    );
    const latestRegressionsStatusJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-status.json"), "utf8")
    );
    const latestRegressionsOverview = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-overview.md"),
      "utf8"
    );
    const latestRegressionsOverviewJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-overview.json"), "utf8")
    );
    const latestRegressionsNext = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-next.txt"),
      "utf8"
    );
    const latestRegressionsPlan = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-plan.txt"),
      "utf8"
    );
    const latestRegressionsPlanJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-plan.json"), "utf8")
    );
    const latestRegressionsSummary = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-summary.md"),
      "utf8"
    );
    const latestRegressionsSummaryJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-summary.json"), "utf8")
    );
    const latestRegressionsHistoryText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-history.txt"),
      "utf8"
    );
    const latestRegressionsHistoryJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-history.json"), "utf8")
    );
    const latestRegressionsHistoryCompareText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-history-compare.txt"),
      "utf8"
    );
    const latestRegressionsHistoryCompareJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-history-compare.json"), "utf8")
    );
    const latestRegressionsHistoryCompareCheckText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-history-compare-check.txt"),
      "utf8"
    );
    const latestRegressionsHistoryCompareCheckJson = JSON.parse(
      fs.readFileSync(
        path.join(exportDir, "latest", "regressions-history-compare-check.json"),
        "utf8"
      )
    );
    const latestRegressionsDoctorText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-doctor.txt"),
      "utf8"
    );
    const latestRegressionsDoctorJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-doctor.json"), "utf8")
    );
    const latestRegressionsGateText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-gate.txt"),
      "utf8"
    );
    const latestRegressionsGateJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-gate.json"), "utf8")
    );
    const latestRegressionsReport = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-report.md"),
      "utf8"
    );
    const latestRegressionsReportJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-report.json"), "utf8")
    );
    const latestRegressionsIntegrityText = fs.readFileSync(
      path.join(exportDir, "latest", "regressions-integrity.txt"),
      "utf8"
    );
    const latestRegressionsIntegrityJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "regressions-integrity.json"), "utf8")
    );
    const latestChecksumsJson = JSON.parse(
      fs.readFileSync(path.join(exportDir, "latest", "checksums.json"), "utf8")
    );

    assert.equal(fs.existsSync(path.join(exportDir, "latest", "report.md")), true);
    assert.equal(fs.existsSync(path.join(firstResult.snapshotDir, "report.md")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "report.md")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "compare.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "compare.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "changes.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "changes.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "trend.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "trend.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "stability.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "stability.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-history.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-history.json")), true);
    assert.equal(
      fs.existsSync(path.join(secondResult.snapshotDir, "regressions-history-gate-failing.txt")),
      true
    );
    assert.equal(
      fs.existsSync(
        path.join(secondResult.snapshotDir, "regressions-history-gate-failing.json")
      ),
      true
    );
    assert.equal(
      fs.existsSync(
        path.join(secondResult.snapshotDir, "regressions-history-gate-failing-compare.txt")
      ),
      true
    );
    assert.equal(
      fs.existsSync(
        path.join(secondResult.snapshotDir, "regressions-history-gate-failing-compare.json")
      ),
      true
    );
    assert.equal(
      fs.existsSync(
        path.join(
          secondResult.snapshotDir,
          "regressions-history-gate-failing-compare-check.txt"
        )
      ),
      true
    );
    assert.equal(
      fs.existsSync(
        path.join(
          secondResult.snapshotDir,
          "regressions-history-gate-failing-compare-check.json"
        )
      ),
      true
    );
    assert.equal(
      fs.existsSync(path.join(secondResult.snapshotDir, "regressions-history-compare.txt")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(secondResult.snapshotDir, "regressions-history-compare.json")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(secondResult.snapshotDir, "regressions-history-compare-check.txt")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(secondResult.snapshotDir, "regressions-history-compare-check.json")),
      true
    );
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-compare.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-compare.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-changes.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-changes.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-status.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-status.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-overview.md")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-overview.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-next.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-plan.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-plan.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-summary.md")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-summary.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-doctor.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-doctor.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-gate.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-gate.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-report.md")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-report.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-integrity.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "regressions-integrity.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "checksums-compare.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "checksums-compare.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "overview.md")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "overview.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "next.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "plan.txt")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "plan.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "summary.md")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "summary.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "checksums.json")), true);
    assert.equal(fs.existsSync(path.join(secondResult.snapshotDir, "checksums.txt")), true);
    assert.equal(index.snapshots.length, 2);
    assert.notEqual(firstResult.snapshotName, secondResult.snapshotName);
    assert.equal(index.snapshots[0].name, secondResult.snapshotName);
    assert.equal(typeof index.snapshots[0].changedFieldsCount, "number");
    assert.equal(typeof index.snapshots[0].changedArtifactsCount, "number");
    assert.equal(typeof index.snapshots[0].stabilityOk, "boolean");
    assert.equal(typeof index.snapshots[0].regressionsGateOk, "boolean");
    assert.equal(typeof index.snapshots[0].regressionsGateIssueCount, "number");
    assert.equal(latestManifest.submitTransactionHash, "0x9992");
    assert.match(history, /Social Recovery Smoke History/);
    assert.match(history, /gateFailingSnapshots:/);
    assert.match(history, /gateIssues:/);
    assert.match(history, /0x9992/);
    assert.match(history, /\| Snapshot \| Stable \| Gate \| Gate Issues \| Account \| Field Changes \| Artifact Changes \|/);
    assert.match(latestCompareText, /Changed fields:/);
    assert.match(latestCompareText, /submitTransactionHash: 0x9991 -> 0x9992/);
    assert.match(latestChangesText, /Social Recovery Smoke Compare/);
    assert.match(latestChangesText, /Social Recovery Smoke Checksum Compare/);
    assert.match(latestCompareText, /Artifact checksum changes:/);
    assert.equal(latestCompareJson.changedFields[0].label.length > 0, true);
    assert.equal(Array.isArray(latestCompareJson.changedArtifacts), true);
    assert.equal(Array.isArray(latestChangesJson.compare.changedFields), true);
    assert.equal(Array.isArray(latestChangesJson.checksumsCompare.changedArtifacts), true);
    assert.match(latestChecksumsCompareText, /Social Recovery Smoke Checksum Compare/);
    assert.equal(Array.isArray(latestChecksumsCompareJson.changedArtifacts), true);
    assert.match(latestOverview, /Social Recovery Smoke Overview/);
    assert.match(latestOverview, /command: npm run social-recovery:smoke:changes/);
    assert.equal(latestOverviewJson.next.command, "npm run social-recovery:smoke:changes");
    assert.match(latestNext, /social-recovery:smoke:changes/);
    assert.match(latestPlan, /Social Recovery Smoke Plan/);
    assert.deepEqual(latestPlanJson.steps, [
      "npm run social-recovery:smoke:changes",
      "npm run social-recovery:smoke:overview",
      "npm run social-recovery:smoke:doctor",
    ]);
    assert.match(latestSummary, /Social Recovery Smoke Summary/);
    assert.equal(latestSummaryJson.overview.next.command, "npm run social-recovery:smoke:changes");
    assert.match(latestTrendText, /Social Recovery Smoke Trend/);
    assert.equal(typeof latestTrendJson.latestStable, "boolean");
    assert.match(latestStabilityText, /Social Recovery Smoke Stability/);
    assert.equal(latestStabilityJson.ok, latestTrendJson.latestStable);
    assert.match(latestRegressionsText, /Social Recovery Smoke Regressions/);
    assert.equal(typeof latestRegressionsJson.regressionCount, "number");
    assert.match(latestRegressionsCompareText, /Social Recovery Smoke Regressions Compare/);
    assert.equal(typeof latestRegressionsCompareJson.regressionCountDelta, "number");
    assert.match(latestRegressionsChangesText, /Social Recovery Smoke Regressions/);
    assert.match(latestRegressionsChangesText, /Social Recovery Smoke Regressions Compare/);
    assert.equal(typeof latestRegressionsChangesJson.regressions.regressionCount, "number");
    assert.equal(
      typeof latestRegressionsChangesJson.regressionsCompare?.regressionCountDelta,
      "number"
    );
    assert.match(latestRegressionsStatusText, /Social Recovery Smoke Regressions Status/);
    assert.match(latestRegressionsStatusText, /regressionsHistoryCompareCheckIssueCount:/);
    assert.match(latestRegressionsStatusText, /regressionsIntegrityIssueCount:/);
    assert.equal(latestRegressionsStatusJson.hasRegressionsHistory, true);
    assert.equal(latestRegressionsStatusJson.hasRegressionsIntegrity, true);
    assert.equal(typeof latestRegressionsStatusJson.regressionsHistoryCompareCheckIssueCount, "number");
    assert.equal(typeof latestRegressionsStatusJson.regressionsIntegrityIssueCount, "number");
    assert.equal(Array.isArray(latestRegressionsStatusJson.suggestedCommands), true);
    assert.match(latestRegressionsOverview, /Social Recovery Smoke Regressions Overview/);
    assert.match(latestRegressionsOverview, /regressionsHistoryCompareCheckIssueCount:/);
    assert.match(latestRegressionsOverview, /regressionsIntegrityIssueCount:/);
    assert.equal(latestRegressionsOverviewJson.hasRegressionsHistory, true);
    assert.equal(latestRegressionsOverviewJson.hasRegressionsIntegrity, true);
    assert.equal(
      typeof latestRegressionsOverviewJson.regressionsHistoryCompareCheckIssueCount,
      "number"
    );
    assert.equal(typeof latestRegressionsOverviewJson.regressionsIntegrityIssueCount, "number");
    const expectedRegressionsNextCommand =
      latestRegressionsJson.regressionCount > 0
        ? "npm run social-recovery:smoke:regressions:changes"
        : "npm run social-recovery:smoke:regressions:latest";
    assert.equal(latestRegressionsOverviewJson.next.command, expectedRegressionsNextCommand);
    assert.match(
      latestRegressionsNext,
      new RegExp(expectedRegressionsNextCommand.replaceAll(":", "\\:"))
    );
    assert.match(latestRegressionsPlan, /Social Recovery Smoke Regressions Plan/);
    assert.equal(latestRegressionsPlanJson.hasRegressionsHistory, true);
    assert.equal(latestRegressionsPlanJson.hasRegressionsIntegrity, true);
    assert.deepEqual(
      latestRegressionsPlanJson.steps,
      latestRegressionsJson.regressionCount > 0
        ? [
            "npm run social-recovery:smoke:regressions:changes",
            "npm run social-recovery:smoke:regressions:overview",
            "npm run social-recovery:smoke:regressions:doctor",
          ]
        : [
            "npm run social-recovery:smoke:regressions:latest",
            "npm run social-recovery:smoke:regressions:doctor",
          ]
    );
    assert.match(latestRegressionsSummary, /Social Recovery Smoke Regressions Summary/);
    assert.equal(
      latestRegressionsSummaryJson.overview.next.command,
      expectedRegressionsNextCommand
    );
    assert.equal(
      typeof latestRegressionsSummaryJson.overview.regressionsHistoryCompareCheckIssueCount,
      "number"
    );
    assert.equal(
      typeof latestRegressionsSummaryJson.overview.regressionsIntegrityIssueCount,
      "number"
    );
    assert.match(latestRegressionsHistoryText, /Social Recovery Smoke Regressions History/);
    assert.equal(Array.isArray(latestRegressionsHistoryJson.snapshots), true);
    assert.match(
      latestRegressionsHistoryCompareText,
      /Social Recovery Smoke Regressions History Compare/
    );
    assert.equal(typeof latestRegressionsHistoryCompareJson.unstableCountDelta, "number");
    assert.match(
      latestRegressionsHistoryCompareCheckText,
      /Social Recovery Smoke Regressions History Compare Check/
    );
    assert.equal(typeof latestRegressionsHistoryCompareCheckJson.ok, "boolean");
    assert.match(latestRegressionsDoctorText, /Social Recovery Smoke Regressions Doctor/);
    assert.equal(latestRegressionsDoctorJson.hasRegressionsIntegrity, true);
    assert.equal(typeof latestRegressionsDoctorJson.regressionsIntegrityOk, "boolean");
    assert.equal(typeof latestRegressionsDoctorJson.ok, "boolean");
    assert.match(latestRegressionsGateText, /Social Recovery Smoke Regressions Gate/);
    assert.equal(typeof latestRegressionsGateJson.ok, "boolean");
    assert.equal(typeof latestRegressionsGateJson.issueCount, "number");
    assert.equal(typeof latestRegressionsGateJson.regressionsIntegrityIssueCount, "number");
    assert.equal(
      typeof latestRegressionsGateJson.regressionsHistoryCompareCheckIssueCount,
      "number"
    );
    assert.match(latestRegressionsReport, /Social Recovery Smoke Regressions Report/);
    assert.equal(typeof latestRegressionsReportJson.gate.ok, "boolean");
    assert.equal(
      typeof latestRegressionsReportJson.summary.overview.regressionsHistoryCompareCheckIssueCount,
      "number"
    );
    assert.equal(
      typeof latestRegressionsReportJson.summary.overview.regressionsIntegrityIssueCount,
      "number"
    );
    assert.equal(typeof latestRegressionsReportJson.doctor.ok, "boolean");
    assert.match(latestRegressionsIntegrityText, /Social Recovery Smoke Regressions Integrity/);
    assert.equal(typeof latestRegressionsIntegrityJson.ok, "boolean");
    assert.equal(Array.isArray(latestChecksumsJson.files), true);
    assert.equal(latestChecksumsJson.files.length >= 10, true);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
