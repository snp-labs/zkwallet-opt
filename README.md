# zkwallet-opt
zkWallet constraint 최적화 버전용 레포

## Quick Start

이 저장소는 Rust 1.94.0 기준으로 검증되었습니다. `rustup`이 설치되어 있다면 루트 디렉터리에서 아래 명령으로 바로 빌드/테스트할 수 있습니다.

```bash
cargo test zkwallet -- --nocapture
```

전체 테스트를 수행하려면 아래 명령을 사용합니다.

```bash
cargo test -- --nocapture
```

## Current Crypto Profile

루트 `src/zkwallet` 회로의 현재 기준은 다음과 같습니다.

- 노트 커밋먼트, 널리파이어, 주소 해시는 기존 `Poseidon` 프로파일을 유지합니다.
- membership proof는 `Poseidon2` leaf hash + `Poseidon2` 4-ary inner hash를 사용합니다.
- membership tree는 인덱스-프리 `4-ary Merkle Tree + OR-constraints` 방식입니다.
- 금액 검증은 회로 내부에서 음수 랩어라운드를 막도록 강화되었습니다.

주의:
`zk-wallet-circuits/` 하위 proving 바이너리도 이제 같은 Poseidon/Poseidon2 프로파일로 정렬되었습니다. witness JSON에서는 호환성용 `leaf_pos` 출력도 제거됐고, parser만 legacy 입력을 계속 읽을 수 있게 유지하고 있습니다. 자세한 상태는 [docs/zkwallet-crypto-profile-2026-03-23.md](/Users/hyunokoh/Documents/zkWallet/docs/zkwallet-crypto-profile-2026-03-23.md) 에 정리했습니다.
반면 `zktransfer-custody-platform/crates/zk-wallet-circuits/` 는 아직 legacy binary-Merkle 경로라서 `leaf_pos`를 계속 요구합니다.
이 레거시 경로의 제거 계획은 [docs/legacy-zkwallet-circuits-deprecation-plan-2026-03-23.md](/Users/hyunokoh/Documents/zkWallet/docs/legacy-zkwallet-circuits-deprecation-plan-2026-03-23.md) 에 정리했습니다.

## Ops Overview

두 zkTransfer 서버의 현재 운영 준비 상태를 한 번에 보려면 아래 명령을 사용할 수 있습니다.

```bash
node /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-overview.mjs
```

## Local Social Recovery Bootstrap

소셜 로그인 기반 `zkpasskey` recovery를 로컬에서 실제에 가깝게 확인하려면 먼저 로컬 컨트랙트를 띄워야 합니다.

1. `vendor/zkpasskey/contract`에서 local RPC를 시작합니다.

```bash
cd /Users/hyunokoh/Documents/zkWallet/vendor/zkpasskey/contract
npm run node:localnet
```

2. 다른 터미널에서 서버가 쓸 `ZKPASSKEY_*` 주소를 출력하거나 `.env`에 반영합니다.

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
npm run bootstrap:zkpasskey:localnet -- --json
npm run bootstrap:zkpasskey:localnet -- --write-env
```

이 bootstrap 명령은 local EntryPoint, Poseidon Merkle directory, factory, verifier logic을 배포하고 서버 social recovery relayer에 필요한 env 값을 바로 출력합니다.

이 스크립트는 각 서버의 `deployment:status`를 집계해서 전체 `blockingIssues`, 서버별 `suggestedCommand`, config/health readiness를 한 번에 요약합니다.

루트에서 더 짧게 실행하려면 아래 `npm` 스크립트를 써도 됩니다.

```bash
npm run ops:overview
```

현재 셸에서 `npm`이 PATH에 없으면 아래 공용 wrapper를 써도 됩니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh overview
```

`node` 경로가 셸에서 바로 잡히지 않으면 아래 래퍼를 써도 됩니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-overview.sh
```

사람이 바로 읽기 좋은 텍스트 요약이 필요하면 아래 명령을 사용할 수 있습니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-summary.sh
```

루트 `npm` 스크립트는 아래와 같습니다.

```bash
npm run ops:summary
```

상태 점검을 한 번에 보고 싶으면 `doctor` 명령을 사용할 수 있습니다. 이 명령은 두 서버의 `deployment:status`, Markdown summary, readiness gate를 순서대로 실행하고, 아직 green이 아니면 non-zero exit code로 종료합니다.

```bash
npm run ops:doctor
```

정말 다음에 칠 명령만 짧게 보고 싶으면 `next`를 사용할 수 있습니다. 공통으로 같은 다음 단계가 잡히면 루트 wrapper 한 줄과 서비스별 실행 줄을 같이 보여줍니다.

```bash
npm run ops:next
```

정말 한 줄만 필요하면 아래처럼 루트 공통 명령만 출력할 수도 있습니다.

```bash
npm run ops:next:root
```

지금 상태에서 어떤 순서로 진행하면 되는지 2-4단계 runbook이 필요하면 `plan`을 사용할 수 있습니다.

```bash
npm run ops:plan
```

공유하거나 붙여넣기 좋은 Markdown 묶음이 필요하면 `report`를 사용할 수 있습니다. 이 출력에는 immediate next command, 권장 순서, detailed summary가 같이 들어갑니다.

```bash
npm run ops:report
```

파일로 남기고 싶으면 `export`를 사용할 수 있습니다. 기본 경로는 시스템 임시 디렉터리 아래 `zktransfer-ops-export/` 이고, 실행할 때마다 `snapshots/<timestamp>/` 와 `latest/` 둘 다 갱신됩니다. 추가로 `snapshots/index.json` 과 `history.md` 도 같이 갱신되어 이전 실행 목록을 바로 볼 수 있습니다. `ZKTRANSFER_OPS_EXPORT_DIR` 로 출력 경로를 바꿀 수 있습니다.

```bash
npm run ops:export
ZKTRANSFER_OPS_EXPORT_DIR=/tmp/my-zktransfer-ops npm run ops:export
```

최근 두 snapshot 차이를 보려면 `compare`를 사용할 수 있습니다. blocking issue 증감, readiness 변화, 서비스별 next command 변화가 요약됩니다.

```bash
npm run ops:compare
```

가장 최근 export에 포함된 compare 결과만 다시 보고 싶으면 `changes`를 사용할 수 있습니다.

```bash
npm run ops:changes
```

특정 snapshot 둘을 지정해서 비교하고 싶으면 아래처럼 snapshot 이름을 환경변수로 넘길 수 있습니다.

```bash
ZKTRANSFER_OPS_COMPARE_LATEST=2026-03-23T12-14-26-663Z \
ZKTRANSFER_OPS_COMPARE_PREVIOUS=2026-03-23T12-12-44-050Z \
npm run ops:compare
```

누적 snapshot 목록 자체를 보려면 `history`를 사용할 수 있습니다.

```bash
npm run ops:history
```

가장 최근 export된 report를 다시 보고 싶으면 `latest`를 사용할 수 있습니다.

```bash
npm run ops:latest
```

바로 이전 snapshot report를 보려면 `previous`를 사용할 수 있습니다.

```bash
npm run ops:previous
```

특정 snapshot 하나를 바로 보고 싶으면 `snapshot`을 사용할 수 있습니다. snapshot 이름은 `ZKTRANSFER_OPS_SNAPSHOT_NAME`으로 넘깁니다.

```bash
ZKTRANSFER_OPS_SNAPSHOT_NAME=2026-03-23T12-14-26-663Z npm run ops:snapshot
```

snapshot을 오래 쌓아둘 예정이면 `prune`로 오래된 snapshot 정리 계획을 볼 수 있습니다. 기본은 dry-run이고, 실제 삭제는 `ZKTRANSFER_OPS_PRUNE_APPLY=1` 일 때만 일어납니다.

```bash
npm run ops:prune
ZKTRANSFER_OPS_PRUNE_KEEP=20 ZKTRANSFER_OPS_PRUNE_APPLY=1 npm run ops:prune
```

Markdown 보고서 형태가 필요하면 `--markdown` 옵션을 붙이면 됩니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-summary.sh --markdown
```

또는:

```bash
npm run ops:summary:markdown
```

또는:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh summary:markdown
```

`doctor`도 wrapper로 바로 실행할 수 있습니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh doctor
```

`next`도 같은 wrapper로 실행할 수 있습니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh next
```

한 줄 루트 명령만 뽑고 싶으면:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh next:root
```

권장 순서를 보려면:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh plan
```

Markdown report를 보려면:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh report
```

파일 export는:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh export
```

최근 두 export 비교는:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh compare
```

가장 최근 compare artifact 출력은:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh changes
```

snapshot history 출력은:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh history
```

history/ latest 경로만 빠르게 확인하려면:

```bash
npm run ops:history:paths
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh history:paths
```

가장 최근 export된 report 출력은:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh latest
```

바로 이전 snapshot report 출력은:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh previous
```

특정 snapshot report 출력은:

```bash
ZKTRANSFER_OPS_SNAPSHOT_NAME=2026-03-23T12-14-26-663Z \
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh snapshot
```

snapshot prune dry-run은:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh prune
```

이 summary 출력에는 서버별 `run:` 줄이 같이 포함되어서, 어느 디렉터리에서 어떤 `npm` 명령을 실행해야 하는지 바로 복붙할 수 있습니다.

배포 전 게이트처럼 쓰고 싶으면 `--check`를 붙이면 됩니다. 전체 준비 상태가 아직 green이 아니면 non-zero exit code로 종료합니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-summary.sh --check
```

또는:

```bash
npm run ops:check
```

또는:

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh check
```

두 서버에 같은 다음 단계 명령을 한 번에 적용하려면 아래 헬퍼를 사용할 수 있습니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-run.sh setup:env
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops-run.sh check:ready
```

루트 `npm` 스크립트로는 아래처럼 실행할 수 있습니다.

```bash
npm run ops:status
npm run ops:setup-env
npm run ops:check-ready
npm run ops:install:dry-run
npm run ops:verify
```

동일한 동작을 wrapper로는 아래처럼 부를 수 있습니다.

```bash
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh status
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh setup-env
bash /Users/hyunokoh/Documents/zkWallet/scripts/zktransfer-ops.sh check-ready
```

현재 지원하는 공통 명령은 `setup:env`, `check:ready`, `deployment:status`, `install:systemd:dry-run`, `verify:deployment` 입니다.

# Poseidon Parameters

Poseidon 해시 함수는 ZKP 회로 내에서 매우 효율적으로 동작하도록 설계되었으며, 특히 다중 입력($n$-to-1) 처리에 최적화되어 있습니다.

## 지원되는 곡선 및 Arity (Input Rate)
현재 프로젝트는 다음 곡선들에 대해 사전 생성된 Poseidon 파라미터를 제공합니다. 머클 트리(CRH)나 스폰지(Sponge) 구조에서 입력 길이가 $n$일 때, 이에 대응하는 파라미터를 선택하여 사용합니다.

| 곡선 (Curve) | 지원 Arity ($n$-to-1) | 파라미터 위치 (src/gadget/hashes/poseidon/...) |
| :--- | :--- | :--- |
| **BN254** | 1, 2, 4, 8, 16 | `arkworks_parameters/bn254/` |
| **BLS12-381** | 1, 2, 4, 8, 16 | `arkworks_parameters/bls_12_381/` |
| **BLS12-377** | 1, 2, 4, 8, 16 | `arkworks_parameters/bls_12_377/` |

## 주요 특징
- **높은 효율성:** MiMC와 달리 입력 개수($n$)가 늘어나더라도 제약 조건(Constraint)의 수가 선형적으로 증가하지 않습니다. 따라서 $n$이 클수록 MiMC 대비 훨씬 효율적인 증명 생성이 가능합니다.
- **머클 트리 최적화:** $n=4, 8, 16$ 등의 높은 Arity를 사용하여 트리의 깊이(Depth)를 줄임으로써 전체 회로의 복잡도를 획기적으로 낮출 수 있습니다.

# Index-Free n-ary Merkle Tree with OR-Constraints 

$n$개의 자식을 가지는 $n$-ary 머클 트리를 구현합니다. 특히 ZKP 회로 내에서 효율적인 멤버십 증명을 위해 **인덱스 비트 연산 대신 OR 제약(One-of-n)** 방식을 사용하도록 설계되었습니다.

## 핵심 설계 (Index-Free Membership)

기존의 바이너리 머클 트리는 내가 "왼쪽"인지 "오른쪽"인지를 나타내는 인덱스 비트(`Boolean`)를 저장하고, 이를 이용해 `select` 가젯으로 경로를 선택합니다. $n$-ary 트리로 확장할 경우 이 인덱스 비트가 $\log_2 n$개로 늘어나 회로가 복잡해집니다.

우리는 이 문제를 다음과 같이 해결합니다:

1.  **Path 데이터:** 각 층마다 형제 노드들을 포함한 **$n$개 입력 배열 전체**를 증명 데이터(Path)에 담습니다.
2.  **OR 제약 (One-of-n):** 
    *   하위 레이어의 해시 결과값 $H_{prev}$가 현재 레이어의 입력 배열 $[D_0, D_1, \dots, D_{n-1}]$ 중 하나와 반드시 일치해야 함을 증명합니다.
    *   회로 수식: $\bigvee_{i=0}^{n-1} (D_i == H_{prev}) = \text{true}$
3.  **해시 연결:** 검증된 $n$개 배열을 그대로 $n$-to-1 해시 함수에 넣어 상위 레이어의 해시값을 도출합니다.

### 장점
*   **회로 단순화:** 복잡한 인덱스 비트 쪼개기와 MUX(Multiplexer) 로직이 필요 없습니다.
*   **익명성 (Anonymity):** 회로가 "내가 몇 번째 인덱스인지" 알 필요가 없으므로, 기본적으로 인덱스에 대한 영지식성이 보장됩니다.
*   **Poseidon 최적화:** Poseidon 해시는 넓은 폭(Arity)을 가질 때 효율적이므로, $n=4, 8, 16$ 등을 사용하여 트리의 깊이를 획기적으로 줄일 수 있습니다.

## 제약 사항
*   현재 구현은 리프 노드의 개수가 $n$의 거듭제곱($n^d$)인 완전한 균형 트리만 지원합니다.
*   인덱스 정보가 해시 결과에 녹아있으므로, 명시적인 인덱스 추출이 필요한 경우에는 적합하지 않을 수 있습니다.

## 최적화

n-ary Merkle Tree의 membership proof에 대한 constraint 수
$(log_{ary}^{leaves}) * (\text{n-to-1 hash constraints} + \text{OR constraints}) + \text{leafhash constraints}$

-> 실제 최적 arity는 해시 프로파일과 회로 폭에 따라 달라집니다.
현재 `zkWallet` 루트 회로의 membership 프로파일은 `Poseidon2 + 4-ary`입니다.
