# Social Recovery Testing

## What changed

- Local social recovery now has a real end-to-end path in `zktransfer-server-app`.
- The server can run `create-account -> recovery-challenge -> recovery-submit`.
- Saved smoke exports now keep history, compare, checksum, regression, and gate artifacts.
- Regression summaries now show both count changes and gate-issue-strength changes.

## Fast check

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:verify
```

This runs:

1. `npm test`
2. `npm run social-recovery:smoke:regressions:summary`

## Strong local demo

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:verify:demo
```

This runs the fast check and then:

1. `npm run social-recovery:local-demo -- --json`

## Manual commands

Full test suite:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm test
```

Saved regression summary:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:smoke:regressions:summary
```

Saved regression gate:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:smoke:regressions:gate
```

Local end-to-end demo:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:local-demo -- --json
```

Persistent local app with fresh recovery funding:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
DATA_FILE=/tmp/zktransfer-social-dev-fresh.json \
ZKPASSKEY_RECOVERY_FUNDING_WEI=100000000000000000 \
npm start
```

Then in another terminal:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:dev-oidc:smoke -- --json
```

Real-provider smoke template:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run social-recovery:smoke:template -- --output /absolute/path/to/social-recovery-smoke-input.json
```

## Expected result

- `npm test` should pass.
- `social-recovery:verify` should finish with exit code `0`.
- `social-recovery:verify:demo` should finish with exit code `0` when localnet and local demo prerequisites are available.
- A fresh persistent app should report `socialRecoveryReady=true` on `/health` and `social-recovery:dev-oidc:smoke` should return a non-null `submit.transactionHash`.
