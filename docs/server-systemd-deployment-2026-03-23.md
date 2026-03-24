# Server systemd Deployment Guide

> 작성일: 2026-03-23
> 대상: `zktransfer-server-app`, `zktransfer-custody-platform/apps/server`

## 목적

두 서버를 `systemd`로 운영할 때, 표준 proving 경로와 fail-closed 정책이 실제 배포에서도 유지되도록 설치 절차를 고정합니다.

## 준비

공통 전제:

- Node.js와 `npm` 이 설치되어 있어야 합니다.
- proving 바이너리가 이미 빌드되어 있어야 합니다.
- 각 서버의 `.env` 는 `.env.example` 을 기준으로 생성합니다.
- `npm run setup:env` 는 placeholder `JWT_SECRET` 교체와 함께, 빠진 fail-closed env 키도 `.env.example` 기준으로 채웁니다.

표준 proving 바이너리 빌드 예시:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits
cargo build --release --features "api zkwallet" --bin build_zkwallet_demo_input --bin prove_zkwallet_from_input
```

## zktransfer-server-app 배포

### 1. 환경 파일 준비

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
cp .env.example .env
npm run setup:env
```

최소 확인 항목:

- `JWT_SECRET` 를 실제 값으로 교체
- `CIRCUITS_ROOT=/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits`
- `ALLOW_LEGACY_PROOF_INPUTS=0`

### 2. readiness 사전 확인

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run check:deps
npm run deployment:status
npm run check:ready
```

성공 기준:

- `ready: true`
- `checks.proofBinaryExists: true`
- `checks.proofInputBuilderExists: true`
- `checks.jwtSecretConfigured: true`
- `checks.proofInputPolicyPinned: true`

### 3. systemd 유닛 설치

```bash
sudo cp /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/deploy/systemd/zktransfer-server-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zktransfer-server-app
sudo systemctl start zktransfer-server-app
```

동일 작업을 헬퍼 스크립트로 수행하려면:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run install:systemd
```

이 명령은 내부적으로 `setup:env` 와 `check:ready` 를 먼저 수행합니다.
실제 설치 전에는 `INSTALL_SYSTEMD_DRY_RUN=1 npm run install:systemd` 로 planned actions 만 확인할 수 있습니다.
또는 `npm run install:systemd:dry-run` 으로 같은 동작을 더 짧게 실행할 수 있고, 이 모드에서는 `curl`, `sudo`, `systemctl` 이 optional 로 취급되며 기존 `.env` 를 수정하지 않습니다.

배포 후 재검증만 따로 수행하려면:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run verify:deployment
```

기본 재시도는 15회이며, `HEALTH_RETRY_COUNT` 와 `HEALTH_RETRY_DELAY_SECONDS` 로 조정할 수 있습니다.

설치 전후 상태를 읽기 전용으로 확인하려면:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run deployment:status
```

### 4. 운영 확인

```bash
sudo systemctl status zktransfer-server-app
journalctl -u zktransfer-server-app -n 100 --no-pager
curl http://127.0.0.1:4010/health
```

health에서 확인할 값:

- `ready`
- `allowLegacyProofInputs`
- `proofInputTelemetry`

## zktransfer-custody-platform/apps/server 배포

### 1. 환경 파일 준비

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/apps/server
cp .env.example .env
npm run setup:env
```

최소 확인 항목:

- `JWT_SECRET` 를 실제 값으로 교체
- `CIRCUITS_ROOT=/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits`
- `ALLOW_LEGACY_CIRCUITS_FALLBACK=0`
- `ALLOW_LEGACY_PROOF_INPUTS=0`

### 2. readiness 사전 확인

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/apps/server
npm run check:deps
npm run deployment:status
npm run check:ready
```

성공 기준:

- `ready: true`
- `circuitsProfile: "standard"`
- `checks.circuitsPolicySatisfied: true`
- `checks.legacyProofInputPolicySatisfied: true`
- `checks.jwtSecretConfigured: true`
- `checks.circuitsFallbackPinned: true`
- `checks.proofInputPolicyPinned: true`

### 3. systemd 유닛 설치

```bash
sudo cp /Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/apps/server/deploy/systemd/zktransfer-custody-platform-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zktransfer-custody-platform-server
sudo systemctl start zktransfer-custody-platform-server
```

동일 작업을 헬퍼 스크립트로 수행하려면:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/apps/server
npm run install:systemd
```

이 명령은 내부적으로 `setup:env` 와 `check:ready` 를 먼저 수행합니다.
실제 설치 전에는 `INSTALL_SYSTEMD_DRY_RUN=1 npm run install:systemd` 로 planned actions 만 확인할 수 있습니다.
또는 `npm run install:systemd:dry-run` 으로 같은 동작을 더 짧게 실행할 수 있고, 이 모드에서는 `curl`, `sudo`, `systemctl` 이 optional 로 취급되며 기존 `.env` 를 수정하지 않습니다.

배포 후 재검증만 따로 수행하려면:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/apps/server
npm run verify:deployment
```

기본 재시도는 15회이며, `HEALTH_RETRY_COUNT` 와 `HEALTH_RETRY_DELAY_SECONDS` 로 조정할 수 있습니다.

설치 전후 상태를 읽기 전용으로 확인하려면:

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/apps/server
npm run deployment:status
```

### 4. 운영 확인

```bash
sudo systemctl status zktransfer-custody-platform-server
journalctl -u zktransfer-custody-platform-server -n 100 --no-pager
curl http://127.0.0.1:4010/health
```

health에서 확인할 값:

- `ready`
- `circuitsProfile`
- `circuitsSelectionReason`
- `allowLegacyCircuitsFallback`
- `allowLegacyProofInputs`
- `proofInputTelemetry`

## 장애 대응

`npm run check:ready` 가 실패하면 먼저 아래를 확인합니다.

- `.env` 가 실제로 존재하는지
- `CIRCUITS_ROOT` 가 표준 workspace 를 가리키는지
- proof builder/prover release 바이너리가 존재하는지
- 플랫폼 서버에서 fail-closed 정책이 legacy profile 과 충돌하지 않는지

로그 확인 명령:

```bash
journalctl -u zktransfer-server-app -f
journalctl -u zktransfer-custody-platform-server -f
```

## 운영 원칙

- 새 배포는 표준 proving 경로만 사용합니다.
- `ALLOW_LEGACY_CIRCUITS_FALLBACK=0` 와 `ALLOW_LEGACY_PROOF_INPUTS=0` 를 기본값으로 유지합니다.
- `/health` 와 `npm run check:ready` 결과가 fail-closed 정책과 동일해야 합니다.
- `npm run deployment:status` 는 설치나 재시작 없이 현재 `.env`, config readiness, systemd, `/health` 상태와 다음 조치 추천, 그리고 누락된 런타임 명령 목록을 읽기 전용으로 보여줘야 합니다.
