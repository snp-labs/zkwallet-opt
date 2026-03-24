# zkTransfer Server App

Custody server prototype for zkTransfer.

## Current scope

- `POST /v1/auth/social/mock`: mock social login and JWT issuance
- `POST /v1/zktransfer/requests`: authenticated zkTransfer request submission
- `GET /v1/zktransfer/requests/:requestId`: request status polling
- async request lifecycle: `received -> validating -> proving -> broadcasting -> confirmed`

## Current execution model

- custody mode: `hot-wallet`
- execution mode: `mock-chain`
- proof generation: server-side orchestration that shells out to `zk-wallet-circuits` helper binaries
- tx submission: mock broadcaster with extension point for Hardhat / Kaia integration

## Run

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm start
```

Recommended local setup:

```bash
cp .env.example .env
npm run setup:env
npm start
```

Quick verification:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:verify
npm run social-recovery:verify:demo
```

Short test guide:

[SOCIAL_RECOVERY_TESTING.md](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/SOCIAL_RECOVERY_TESTING.md)

Local zkpasskey social recovery bootstrap:

```bash
cd /Users/hyunokoh/Documents/zkWallet/vendor/zkpasskey/contract
npm run node:localnet
```

In a second terminal:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run bootstrap:zkpasskey:localnet -- --json
```

If you want to persist the deployed local contract addresses into `.env`, use:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run bootstrap:zkpasskey:localnet -- --write-env
```

`bootstrap:zkpasskey:localnet` deploys a fresh local EntryPoint, Merkle directory, factory, and verifier logic, then prints the `ZKPASSKEY_*` env block that the server expects for on-chain social account creation and `updateTxKey` recovery.
The local bootstrap keeps `ZKPASSKEY_CREATE_ACCOUNT_FUNDING_WEI=0` and `ZKPASSKEY_RECOVERY_FUNDING_WEI=0` in the emitted env block by default, but a fresh long-lived server that will execute `recovery-submit` should override `ZKPASSKEY_RECOVERY_FUNDING_WEI` to a positive value such as `100000000000000000`. `social-recovery:local-demo` already does this automatically.

When you have real provider JWTs, you can run the HTTP smoke flow with:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:smoke:template -- --output /absolute/path/to/social-recovery-smoke-input.json
npm run social-recovery:smoke:check -- --input /absolute/path/to/social-recovery-smoke-input.json --json
npm run social-recovery:smoke -- --input /absolute/path/to/social-recovery-smoke-input.json --json
npm run social-recovery:smoke:report -- --input /absolute/path/to/social-recovery-smoke-input.json --json
npm run social-recovery:smoke:export -- --input /absolute/path/to/social-recovery-smoke-input.json --json
npm run social-recovery:smoke:history
npm run social-recovery:smoke:compare
npm run social-recovery:smoke:changes
npm run social-recovery:smoke:latest
npm run social-recovery:smoke:integrity
npm run social-recovery:smoke:doctor
npm run social-recovery:smoke:previous
npm run social-recovery:smoke:paths
npm run social-recovery:smoke:prune
npm run social-recovery:smoke:status
npm run social-recovery:smoke:next
npm run social-recovery:smoke:overview
npm run social-recovery:smoke:plan
npm run social-recovery:smoke:summary
npm run social-recovery:smoke:snapshot -- --name 2026-03-24T12-34-56-789Z
```

`social-recovery:smoke:template` fetches `/v1/social-login/providers`, expands the current `n/k` threshold into `create/challenge/submit` provider slots, generates placeholder JWT entries, and writes a ready-to-fill JSON file for the real OAuth smoke path.
`social-recovery:smoke:check` reads that JSON back, fetches `/health` and `/v1/social-login/providers`, and fails early if placeholder JWTs remain, provider counts do not match `n/k`, or the server is not reporting `socialRecoveryReady=true`.
`social-recovery:smoke:report` runs the same HTTP smoke flow but also writes a redacted artifact bundle under `tmp/social-recovery-smoke-report/latest` by default, including `input.redacted.json`, `result.json`, `manifest.json`, and `report.md`. These artifacts keep issuer/audience/nonce metadata and SHA-256 token fingerprints without storing raw JWT strings.
`social-recovery:smoke:export` goes one step further and writes the redacted bundle into both `tmp/social-recovery-smoke-report/latest` and a timestamped `tmp/social-recovery-smoke-report/snapshots/<timestamp>` directory, then refreshes `snapshots/index.json` and `history.md` for repeated real-provider smoke runs.
`social-recovery:smoke:history` prints the saved snapshot history, now including per-snapshot field-change, artifact-change, and saved regression-gate pass/fail state, `social-recovery:smoke:history:gate-failing` isolates only the snapshots where the saved regression gate failed, `social-recovery:smoke:regressions` isolates recent unstable snapshots, `social-recovery:smoke:regressions:history` shows the recent regression timeline, `social-recovery:smoke:regressions:history:compare` compares the saved regression timeline between two snapshots, `social-recovery:smoke:regressions:history:compare:check` fails fast when that timeline delta introduces new unstable behavior, `social-recovery:smoke:regressions:integrity` validates just the saved regression sub-bundle, `social-recovery:smoke:regressions:gate` combines integrity, doctor, and history-compare-check into one saved pass/fail gate, `social-recovery:smoke:trend` summarizes recent change-count trends and stabilization, `social-recovery:smoke:stability` turns those trend counts into a pass/fail gate, `social-recovery:smoke:trend:latest`, `social-recovery:smoke:stability:latest`, `social-recovery:smoke:regressions:latest`, `social-recovery:smoke:regressions:previous`, `social-recovery:smoke:regressions:compare`, `social-recovery:smoke:regressions:compare:latest`, `social-recovery:smoke:regressions:compare:previous`, `social-recovery:smoke:regressions:compare:snapshot`, `social-recovery:smoke:regressions:changes`, `social-recovery:smoke:regressions:changes:latest`, `social-recovery:smoke:regressions:changes:previous`, `social-recovery:smoke:regressions:changes:snapshot`, `social-recovery:smoke:regressions:status`, `social-recovery:smoke:regressions:status:latest`, `social-recovery:smoke:regressions:status:previous`, `social-recovery:smoke:regressions:status:snapshot`, `social-recovery:smoke:regressions:next`, `social-recovery:smoke:regressions:next:latest`, `social-recovery:smoke:regressions:next:previous`, `social-recovery:smoke:regressions:next:snapshot`, `social-recovery:smoke:regressions:overview`, `social-recovery:smoke:regressions:overview:latest`, `social-recovery:smoke:regressions:overview:previous`, `social-recovery:smoke:regressions:overview:snapshot`, `social-recovery:smoke:regressions:report`, `social-recovery:smoke:regressions:report:latest`, `social-recovery:smoke:regressions:report:previous`, `social-recovery:smoke:regressions:report:snapshot`, `social-recovery:smoke:regressions:summary`, `social-recovery:smoke:regressions:summary:latest`, `social-recovery:smoke:regressions:summary:previous`, `social-recovery:smoke:regressions:summary:snapshot`, `social-recovery:smoke:regressions:paths`, `social-recovery:smoke:regressions:plan`, `social-recovery:smoke:regressions:plan:latest`, `social-recovery:smoke:regressions:plan:previous`, `social-recovery:smoke:regressions:plan:snapshot`, `social-recovery:smoke:regressions:doctor`, `social-recovery:smoke:regressions:doctor:latest`, `social-recovery:smoke:regressions:doctor:previous`, `social-recovery:smoke:regressions:doctor:snapshot`, `social-recovery:smoke:regressions:gate:latest`, `social-recovery:smoke:regressions:gate:previous`, `social-recovery:smoke:regressions:gate:snapshot`, `social-recovery:smoke:regressions:integrity:latest`, and `social-recovery:smoke:regressions:integrity:snapshot` reopen or summarize saved trend/stability/regression artifacts, and export persists `trend.txt/json`, `stability.txt/json`, `regressions.txt/json`, `regressions-history.txt/json`, `regressions-history-compare.txt/json`, `regressions-history-compare-check.txt/json`, `regressions-compare.txt/json`, `regressions-changes.txt/json`, `regressions-status.txt/json`, `regressions-overview.md/json`, `regressions-plan.txt/json`, `regressions-summary.md/json`, `regressions-next.txt`, `regressions-doctor.txt/json`, `regressions-gate.txt/json`, `regressions-report.md/json`, and `regressions-integrity.txt/json` into `latest/` and each snapshot directory alongside the other saved artifacts. The saved readers now also reopen `regressions-history-compare`, `regressions-history-compare-check`, and `regressions-gate` through `:latest`, `:previous`, and `:snapshot`.
`social-recovery:smoke:export` also persists `compare.txt/json`, `changes.txt/json`, and `checksums-compare.txt/json` into both `latest/` and each snapshot directory once at least two runs exist, and `social-recovery:smoke:changes` reads the latest saved combined diff artifact directly.
`social-recovery:smoke:changes:snapshot -- --name ...` opens a named snapshot's saved combined diff artifact, and `social-recovery:smoke:changes:previous` opens the second-most-recent one.
`social-recovery:smoke:checksums` opens the saved checksum bundle for `latest/` by default, or for a named snapshot when you pass `-- --name <timestamp>`.
`social-recovery:smoke:checksums:compare` compares the tracked artifact checksum bundle between the latest and previous snapshots by default, or between two named snapshots when you pass `-- --latest-name ... --previous-name ...`.
`social-recovery:smoke:checksums:changes` prints the latest persisted checksum-compare artifact from `latest/checksums-compare.txt`.
`social-recovery:smoke:latest` prints the latest saved redacted report, and `social-recovery:smoke:snapshot -- --name ...` opens a specific saved snapshot report by timestamp.
`social-recovery:smoke:integrity` checks that `latest/`, `history.md`, `snapshots/index.json`, and every referenced snapshot directory still contain the expected artifact files, and it now validates the saved `checksums.json` hashes too.
`social-recovery:smoke:doctor` combines integrity plus overview/next-command checks, including the latest checksum health, and exits non-zero when the saved artifact bundle is incomplete.
`social-recovery:smoke:previous` opens the second-most-recent saved report, and `social-recovery:smoke:paths` prints the key export locations plus the latest/previous snapshot names.
`social-recovery:smoke:prune` keeps the newest five snapshots by default and only applies deletions when you pass `--apply` or set `SOCIAL_RECOVERY_SMOKE_PRUNE_APPLY=1`.
`social-recovery:smoke:status` gives a one-screen summary of the latest export state, checksum health, saved checksum-compare changes, saved regressions-compare deltas, compare availability, and the next recommended command.
`social-recovery:smoke:next` prints just the immediate next command, and when a saved checksum-only diff exists it now prefers `social-recovery:smoke:checksums:changes`.
`social-recovery:smoke:overview` is the shareable Markdown form of that state, combining latest manifest info, checksum health, saved checksum-compare changes, saved regressions-compare deltas, compare metadata, and the next command in one place.
`social-recovery:smoke:plan` expands that into a short runbook based on the current saved export state, including a regression-diff step when unstable runs exist and a checksum-only diff step when one is available.
`social-recovery:smoke:summary` adds paths, checksum-compare artifact paths, regressions-compare artifact paths, and a short history preview to that overview so it is easier to paste into notes or issue trackers.

Expected input shape:

```json
{
  "providers": ["google", "kakao"],
  "txKeyAddress": "0x...",
  "newTxKeyAddress": "0x...",
  "create": { "jwts": ["...", "..."] },
  "challenge": { "jwts": ["...", "..."] },
  "submit": { "jwts": ["...", "..."] }
}
```

`challenge.jwts` and `submit.jwts` should be freshly minted provider JWTs for the recovery attempt, and the `submit` JWTs should carry the nonce returned by `/v1/social-login/recovery-challenge`.

For a fully local developer path without external OAuth, you can point the server at a localhost JWKS and let the app mint dev RS256 tokens:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run dev:oidc:keypair
npm run dev:oidc:jwks
```

Start the server with matching provider overrides:

```bash
OIDC_GOOGLE_ISSUER_OVERRIDE=http://127.0.0.1:4400/google \
OIDC_GOOGLE_JWKS_URI_OVERRIDE=http://127.0.0.1:4400/jwks \
OIDC_KAKAO_ISSUER_OVERRIDE=http://127.0.0.1:4400/kakao \
OIDC_KAKAO_JWKS_URI_OVERRIDE=http://127.0.0.1:4400/jwks \
OIDC_APPLE_ISSUER_OVERRIDE=http://127.0.0.1:4400/apple \
OIDC_APPLE_JWKS_URI_OVERRIDE=http://127.0.0.1:4400/jwks \
ZKPASSKEY_RECOVERY_FUNDING_WEI=100000000000000000 \
npm start
```

If you want the cleanest manual repro, also use a fresh data file:

```bash
DATA_FILE=/tmp/zktransfer-social-dev-fresh.json \
ZKPASSKEY_RECOVERY_FUNDING_WEI=100000000000000000 \
npm start
```

Then run the local dev smoke flow:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:dev-oidc:smoke -- --json
```

`social-recovery:dev-oidc:smoke` reads the server threshold from `/v1/social-login/providers`, mints create-stage JWTs for `n` slots, mints recovery-stage JWTs for `k` slots, binds submit JWTs to the challenge nonce, and executes `create-account -> recovery-challenge -> recovery-submit`.
When `n` is larger than the number of distinct configured provider types, the dev smoke script reuses `google`, `kakao`, and `apple` in round-robin order but assigns distinct local subjects per slot so the create/recovery subset is still well-formed.

For a full local regression that boots fresh localnet, deploys contracts, starts local JWKS, launches the app, and runs the smoke flow end-to-end, run:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run test:social-recovery:e2e
```

If you want the same stack as a one-shot local demo instead of a test harness, run:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:local-demo -- --json
```

`systemd` template:

- `deploy/systemd/zktransfer-server-app.service`
- copy it to `/etc/systemd/system/`
- keep `/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/.env` in sync with `.env.example`
- `npm run setup:env` creates `.env` if needed and replaces placeholder `JWT_SECRET` with a random value
- `npm run setup:env` also appends missing fail-closed proving defaults from `.env.example` without overwriting explicit env choices
- `npm run check:deps` verifies that `node`, `npm`, `curl`, `sudo`, and `systemctl` are available
- `npm run install:systemd:dry-run` treats `curl`, `sudo`, and `systemctl` as optional so the precheck can run on non-systemd development machines
- `npm run check:ready` uses the same `.env` and must pass before `systemd` starts the service
- `npm run deployment:status` prints the current `.env`, config-readiness, systemd, `/health`, and next-step recommendations without changing anything
- `npm run deployment:status` also calls out missing runtime commands such as `curl`, `sudo`, or `systemctl`
- `npm run deployment:status` now includes `blockingIssues` and a copy-pasteable `suggestedCommand`
- the `systemd` template requires `.env` to exist; it does not treat the env file as optional
- `npm run install:systemd` now runs `setup:env`, `check:ready`, installs the unit, reloads `systemd`, enables the service, and restarts it
- use `INSTALL_SYSTEMD_DRY_RUN=1 npm run install:systemd` to validate the prechecks and planned unit actions without touching `systemd`; this dry-run also leaves `.env` unchanged
- `npm run verify:deployment` checks `systemctl is-active` and retries `/health` until ready or timeout
- full deployment steps: [docs/server-systemd-deployment-2026-03-23.md](/Users/hyunokoh/Documents/zkWallet/docs/server-systemd-deployment-2026-03-23.md)

Optional env vars:

- `PORT`
- `HOST`
- `JWT_SECRET`
- `CIRCUITS_ROOT`
- `ALLOW_LEGACY_PROOF_INPUTS`
- `DATA_FILE`
- `CUSTODY_MODE`
- `EXECUTION_MODE`
- `SUPPORTED_NETWORKS`
- `HOT_WALLET_ADDRESS`

## Notes

This is an executable prototype for the new custody split, not the final proving backend.

Current caveat:

- The root workspace `src/zkwallet` circuit and the proving binaries under `zk-wallet-circuits` now share the same `Poseidon2 + 4-ary membership` profile.
- Commitment, nullifier, address hashing, and symmetric note encryption are now aligned on the same Poseidon/Poseidon2 profile as well.
- The proving JSON witness now carries only the flattened 4-ary `tree_proof` payload.
- The proving input parser still accepts legacy `leaf_pos`, but new builder outputs omit it.
- Set `ALLOW_LEGACY_PROOF_INPUTS=0` to fail requests immediately if a legacy `leaf_pos` proof-input contract is detected.
- `JWT_SECRET` must be set to a non-default value for `check:ready`, `/health`, and `verify:deployment` to pass.
- `ALLOW_LEGACY_PROOF_INPUTS=0` must stay pinned for `check:ready`, `/health`, and `verify:deployment` to pass.
- `.env.example` defaults to the standard `zk-wallet-circuits` workspace and fail-closed legacy proof-input policy.
- `npm run bootstrap:zkpasskey:localnet -- --write-env` is the fastest way to fill the local `ZKPASSKEY_*` relayer env values after starting `vendor/zkpasskey/contract` localnet.
- `npm run dev:oidc:jwks` now prints override env lines for `google`, `kakao`, and `apple`, not just `google`.
- `npm run social-recovery:dev-oidc:smoke` is the fastest way to exercise the full HTTP recovery flow with locally minted RS256 JWTs.
- `npm run social-recovery:local-demo` is the fastest one-command local showcase because it boots fresh localnet, deploys contracts, starts JWKS, launches the app, runs the smoke flow, and then cleans everything up.
- `npm run test:social-recovery:e2e` is the strongest local regression check for the full social recovery stack because it boots localnet, deploys contracts, starts JWKS, launches the app, and executes the full smoke flow.
- `npm run social-recovery:smoke:template` and `npm run social-recovery:smoke:check` are the fastest way to prepare and validate a real OAuth smoke input before sending actual provider JWTs to the server.
- `npm run social-recovery:smoke:report -- --input ...` is the safest way to preserve a real OAuth smoke run for sharing because it writes only redacted input summaries and the final recovery result.
- `npm run social-recovery:smoke:export -- --input ...` is the best way to keep a history of real OAuth smoke runs because it snapshots each redacted report and maintains `history.md`.
- `npm run social-recovery:smoke:history`, `npm run social-recovery:smoke:history:unstable`, `npm run social-recovery:smoke:regressions`, `npm run social-recovery:smoke:regressions:history`, `npm run social-recovery:smoke:regressions:history:unstable`, `npm run social-recovery:smoke:regressions:history:compare`, `npm run social-recovery:smoke:regressions:history:compare:check`, `npm run social-recovery:smoke:regressions:latest`, `npm run social-recovery:smoke:regressions:previous`, `npm run social-recovery:smoke:regressions:compare`, `npm run social-recovery:smoke:regressions:compare:latest`, `npm run social-recovery:smoke:regressions:compare:previous`, `npm run social-recovery:smoke:regressions:compare:snapshot`, `npm run social-recovery:smoke:regressions:changes`, `npm run social-recovery:smoke:regressions:changes:latest`, `npm run social-recovery:smoke:regressions:changes:previous`, `npm run social-recovery:smoke:regressions:changes:snapshot`, `npm run social-recovery:smoke:regressions:status`, `npm run social-recovery:smoke:regressions:next`, `npm run social-recovery:smoke:regressions:overview`, `npm run social-recovery:smoke:regressions:summary`, `npm run social-recovery:smoke:regressions:paths`, `npm run social-recovery:smoke:regressions:plan`, `npm run social-recovery:smoke:regressions:doctor`, `npm run social-recovery:smoke:regressions:gate`, `npm run social-recovery:smoke:trend`, `npm run social-recovery:smoke:stability`, `npm run social-recovery:smoke:trend:latest`, `npm run social-recovery:smoke:stability:latest`, and `npm run social-recovery:smoke:compare` are the fastest way to review repeated real-provider smoke runs without reopening individual snapshot directories; `history` shows per-snapshot change counts, `history:unstable` filters them, `regressions` summarizes recent unstable snapshots, `regressions:history` shows the recent stable/unstable timeline for the same window, `regressions:history:compare` shows which entries were added, removed, or flipped between stable and unstable across two saved timeline snapshots, `regressions:history:compare:check` turns that same signal into a fail-fast gate when unstable behavior got worse, and the saved readers now reopen both the compare view and the compare-check result through `:latest`, `:previous`, and `:snapshot`; `regressions:compare` shows what changed between the latest two regression bundles, `regressions:changes` combines the current regression list and regression delta into one saved view, `regressions:status` now includes saved timeline-delta counts, `regressions:gate` combines integrity, doctor, and history compare-check into a single saved pass/fail decision, and `regressions:next`/`regressions:plan` prefer the saved `regressions:history:compare:check` artifact before raw timeline inspection when it already shows worsening unstable behavior; `regressions:overview`/`regressions:summary`/`regressions:report` now surface the same history-compare signal, `regressions:paths` lists the regression-only saved artifact locations, and `regressions:plan`/`regressions:doctor` provide a short runbook and a read-only regression gate; those views are now also persisted in each export snapshot.
- `npm run social-recovery:smoke:changes` is the fastest way to read the latest persisted combined diff after a second or later smoke export because it now reads the saved `changes.txt/json` artifact, which includes both the tracked field diff and the checksum-only diff.
- `npm run social-recovery:smoke:changes:snapshot -- --name ...` and `npm run social-recovery:smoke:changes:previous` are the fastest way to reopen a specific or immediately prior saved combined diff.
- `npm run social-recovery:smoke:regressions:history:gate-failing` isolates only the saved regression-history entries whose saved gate failed, `social-recovery:smoke:regressions:history:gate-failing:latest|previous|snapshot` reopen the persisted gate-failing timeline artifacts, and export now persists `regressions-history-gate-failing.txt/json` alongside the other regression-only saved files.
- `npm run social-recovery:smoke:regressions:history:gate-failing:compare` and `...:compare:check` compare the saved gate-failing-only regression timeline between snapshots and fail fast when that gate-failing subset gets worse; export now persists `regressions-history-gate-failing-compare.txt/json` and `regressions-history-gate-failing-compare-check.txt/json` alongside the other regression-only saved files.
- Those gate-failing compare/check artifacts can now also be reopened through `social-recovery:smoke:regressions:history:gate-failing:compare:latest|previous|snapshot` and `...:compare:check:latest|previous|snapshot`.
- `npm run social-recovery:smoke:checksums` is the fastest way to inspect the saved SHA-256 bundle for `latest/` or a named snapshot.
- `npm run social-recovery:smoke:checksums:compare` is the fastest way to see which tracked artifact files actually changed between two saved snapshots.
- `npm run social-recovery:smoke:checksums:changes` is the fastest way to reopen the latest persisted checksum-only diff.
- `npm run social-recovery:smoke:latest` and `npm run social-recovery:smoke:snapshot -- --name ...` are the fastest way to reopen the latest or a specific saved redacted smoke report.
- `npm run social-recovery:smoke:integrity` is the fastest way to confirm the saved export bundle is still internally consistent before relying on it.
- `npm run social-recovery:smoke:doctor` is the strongest read-only gate because it combines integrity, checksum verification, and the saved-state overview and fails fast when the bundle is not usable yet.
- `npm run social-recovery:smoke:previous` and `npm run social-recovery:smoke:paths` are the fastest way to reopen the immediately prior report or confirm where the export bundle lives on disk.
- `npm run social-recovery:smoke:prune -- --keep 5` is the safest way to preview cleanup, and `npm run social-recovery:smoke:prune -- --keep 5 --apply` actually removes older snapshots.
- `npm run social-recovery:smoke:status` is the fastest way to see whether the latest saved bundle is checksum-clean and whether you need a first export, a second export for compare, or just `changes/latest`.
- `npm run social-recovery:smoke:next` is the fastest way to print that next action as a single line, and it now prefers the checksum-only diff when one is already saved.
- `npm run social-recovery:smoke:overview` is the fastest way to paste a compact human-readable summary into chat or notes, including checksum health.
- `npm run social-recovery:smoke:plan` is the fastest way to get the short recommended sequence of commands for the current saved state, including checksum-only diff review when available.
- `npm run social-recovery:smoke:summary` is the fastest way to get one shareable block that includes overview, paths, and history preview together.
- `GET /health` and `npm run deployment:status` now expose `socialRecoveryReady` separately from the generic server `ready` signal.
- `npm run social-recovery:smoke` is the quickest way to exercise `create-account -> recovery-challenge -> recovery-submit` once real provider JWTs are available.
- `deploy/systemd/zktransfer-server-app.service` starts the app from the repo checkout and reads `.env` through `EnvironmentFile`.
- `deploy/systemd/zktransfer-server-app.service` also runs `npm run check:ready` as `ExecStartPre`.
- `npm run deployment:status` is a read-only snapshot command for `.env`, config readiness, unit-file, service, and `/health` state.
- `npm test` now includes `CustodyOrchestrator` coverage for builder/prover JSON parsing and the flattened 4-ary `tree_proof` witness contract.
- `GET /health` now reports `ready`, binary existence checks, and proof-input telemetry including whether any legacy `leaf_pos` witness has been observed or warned on.
