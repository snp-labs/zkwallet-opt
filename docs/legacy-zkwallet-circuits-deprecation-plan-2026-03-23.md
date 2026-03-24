# Legacy zkWallet Circuits Deprecation Plan

> 작성일: 2026-03-23
> 대상: `/Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/crates/zk-wallet-circuits`

## 목표

레거시 binary-Merkle + `leaf_pos` 기반 proving backend를 단계적으로 제거하고, 표준 proving 경로를 `/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits` 하나로 고정합니다.

목표 제거일은 `2026-06-30` 입니다.

## 현재 상태

- 표준 경로 `/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits`
  - `Poseidon + Poseidon2`
  - `4-ary membership`
  - witness 출력에서 `leaf_pos` 제거
- 레거시 경로 `/Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/crates/zk-wallet-circuits`
  - binary Merkle
  - witness에 `leaf_pos` 필수
  - platform compatibility 용도로만 유지

## 단계

### 1. Deprecation Announcement

- 기준일: `2026-03-23`
- 상태:
  - README와 상태 문서에 레거시 경로임을 명시
  - 레거시 바이너리 실행 시 경고 출력
  - 플랫폼 서버가 기본적으로 표준 workspace를 우선 선택

### 2. Fail-Closed Rollout

- 시작 권장일: `2026-04-01`
- 조치:
  - 배포 환경에서 `ALLOW_LEGACY_CIRCUITS_FALLBACK=0` 사용
  - 표준 proving 경로가 안정화되면 `ALLOW_LEGACY_PROOF_INPUTS=0` 도 함께 적용
  - `/health`에서 `circuitsProfile`, `circuitsSelectionReason`, `legacyCircuitsRemovalTarget`, `proofInputTelemetry`, `checks.circuitsPolicySatisfied` 모니터링
- 통과 기준:
  - 표준 workspace circuits root가 모든 배포 환경에서 존재
  - proof builder/prover 바이너리 readiness가 안정적으로 `true`
  - 새 flattened 4-ary witness 계약으로만 요청이 들어옴

### 3. Legacy Input Freeze

- 시작 목표일: `2026-05-15`
- 조치:
  - 서버 fixture와 모바일 fixture에서 legacy `leaf_pos` 입력 생성 중단 확인
  - parser의 legacy `leaf_pos` 허용 경로를 사용하지 않는지 로그/테스트로 검증
- 통과 기준:
  - 표준 경로 smoke prove가 CI 또는 배포 검증에서 계속 성공
  - 레거시 input compatibility가 실제 운영 트래픽에서 필요 없다는 확인

### 4. Removal

- 목표일: `2026-06-30`
- 조치:
  - `zktransfer-custody-platform/crates/zk-wallet-circuits` 제거 또는 archive
  - 플랫폼 서버의 legacy fallback 제거
  - 관련 README, health, config에서 legacy 문구 삭제

## Cutover Checklist

- `apps/server` health에서 `circuitsProfile=standard`
- `apps/server` health에서 `ready=true`
- `apps/server` health에서 `checks.circuitsPolicySatisfied=true`
- `apps/server` 배포 환경에 `ALLOW_LEGACY_CIRCUITS_FALLBACK=0` 적용
- 표준 proving 바이너리 release build 검증 완료
- 레거시 crate를 참조하는 자동화, 문서, 스크립트 제거 완료

## 운영 신호

다음 신호가 하나라도 깨지면 제거 일정을 미룹니다.

- 표준 circuits root 미존재
- proof binary 또는 builder binary 누락
- legacy witness 포맷이 여전히 필요한 클라이언트 존재
- platform server가 legacy fallback으로만 기동 가능한 환경 존재

## 권장 후속 작업

1. 배포 환경 기본값을 `ALLOW_LEGACY_CIRCUITS_FALLBACK=0` 로 전환합니다.
2. 서버의 `.env.example` 에도 `ALLOW_LEGACY_CIRCUITS_FALLBACK=0` 와 `ALLOW_LEGACY_PROOF_INPUTS=0` 를 유지합니다.
3. 운영 템플릿(`systemd` 등)에서도 같은 fail-closed env 기본값과 `check:ready` 사전 검증을 사용합니다.
   배포 절차는 [docs/server-systemd-deployment-2026-03-23.md](/Users/hyunokoh/Documents/zkWallet/docs/server-systemd-deployment-2026-03-23.md) 를 기준으로 맞춥니다.
4. 서버에서 legacy witness 입력 사용 여부를 집계하는 로그 또는 메트릭을 추가합니다.
5. 제거일 전까지 legacy crate 참조를 CI에서 금지하는 검사(`scripts/check-no-legacy-runtime-references.mjs`)를 유지합니다.
