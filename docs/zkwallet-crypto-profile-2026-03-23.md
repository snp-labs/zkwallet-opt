# zkWallet Crypto Profile Status

> 작성일: 2026-03-23
> 범위: 루트 `src/zkwallet` 회로, `zk-wallet-circuits/` proving 경로, 그리고 별도 레거시 crate의 차이

## 요약

현재 `zkWallet`의 루트 회로와 `zk-wallet-circuits/` proving 경로는 Poseidon/Poseidon2 프로파일로 사실상 정렬되었습니다.

| 경로 | 해시/멤버십 프로파일 | 상태 |
|------|----------------------|------|
| 루트 `src/zkwallet` | Poseidon + Poseidon2 4-ary membership | 최신 |
| `zk-wallet-circuits/` | Poseidon + Poseidon2 4-ary membership | 런타임 정렬됨 |
| `zktransfer-custody-platform/crates/zk-wallet-circuits/` | legacy binary Merkle + `leaf_pos` | 레거시 유지 |

즉, 루트 회로와 현재 표준 proving 경로는 membership tree/profile, note commitment/nullifier/address hash, symmetric encryption, underflow 방지 제약까지 같은 기준으로 맞춰졌습니다. 현재 표준 경로에서는 witness JSON에서도 `leaf_pos` 출력이 제거됐고, legacy 입력 호환만 parser에 남겨둔 상태입니다. 다만 `zktransfer-custody-platform/crates/zk-wallet-circuits/` 는 아직 binary Merkle + `leaf_pos` 기반 레거시 경로입니다.

## 루트 회로 현재 상태

대상 파일: [src/zkwallet/circuit.rs](/Users/hyunokoh/Documents/zkWallet/src/zkwallet/circuit.rs)

- 주소, 커밋먼트, 널리파이어 해시
  - `Poseidon_1`, `Poseidon_2`, `Poseidon_4`, `Poseidon_8`
- membership leaf hash
  - `Poseidon2` width-3 state
- membership inner hash
  - `Poseidon2` width-4 state
- membership tree
  - `4-ary n-ary Merkle tree`
  - `OR-constraints` 기반 index-free membership
- amount safety
  - `total_spend <= available_before` 제약 추가
  - amount는 128-bit
  - balance 집계값은 130-bit 범위로 제한

핵심 위치:

- membership config: [src/zkwallet/circuit.rs](/Users/hyunokoh/Documents/zkWallet/src/zkwallet/circuit.rs#L104)
- membership verification: [src/zkwallet/circuit.rs](/Users/hyunokoh/Documents/zkWallet/src/zkwallet/circuit.rs#L408)
- range/balance check: [src/zkwallet/circuit.rs](/Users/hyunokoh/Documents/zkWallet/src/zkwallet/circuit.rs#L551)

## 새 해시 모듈

- Poseidon2 leaf hash: [src/gadget/hashes/poseidon2/mod.rs](/Users/hyunokoh/Documents/zkWallet/src/gadget/hashes/poseidon2/mod.rs)
- Poseidon2 width-4 inner hash: [src/gadget/hashes/poseidon2_width4.rs](/Users/hyunokoh/Documents/zkWallet/src/gadget/hashes/poseidon2_width4.rs)
- hash module export: [src/gadget/hashes/mod.rs](/Users/hyunokoh/Documents/zkWallet/src/gadget/hashes/mod.rs#L7)

## 검증 상태

실행 명령:

```bash
cargo test zkwallet -- --nocapture
```

확인한 결과:

- 12개 테스트 통과
- 음수 랩어라운드 회귀 테스트 통과
- Groth16 proving/verification 테스트 통과
- 최근 측정값
  - constraints: `19900`
  - average proving: 약 `13.06s`
  - average verifying: 약 `0.080s`

## 런타임 정렬 상태

대상 파일: [zk-wallet-circuits/src/zkwallet/circuit.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/zkwallet/circuit.rs)

현재 하위 proving 회로는 다음 상태입니다.

- 커밋먼트/주소/널리파이어는 Poseidon 해시 기반
- membership은 `Poseidon2` leaf hash + `Poseidon2` width-4 inner hash
- membership tree는 `4-ary n-ary Merkle tree`
- witness JSON은 이제 `leaf_pos` 없이 flattened 4-ary path만 직렬화함
- parser는 구 입력과의 호환을 위해 `leaf_pos`가 포함된 legacy witness도 계속 허용함
- amount safety는 2026-03-23 기준으로 보강됨
  - `total_spend <= available_before` 제약 추가
  - 금액/잔액 비트 범위 제한 추가
- 대칭 노트 암호화도 Poseidon 2-to-1 파라미터를 사용

실제 proving 입력 생성 경로인 [zk-wallet-circuits/src/bin/build_zkwallet_demo_input.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/bin/build_zkwallet_demo_input.rs) 와 [zk-wallet-circuits/src/bin/prove_zkwallet_from_input.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/bin/prove_zkwallet_from_input.rs) 기준으로 새 membership 프로파일 smoke prove까지 통과했습니다.

검증 명령:

```bash
cargo test --features "api zkwallet" --no-run
cargo build --release --features "api zkwallet" --bin build_zkwallet_demo_input --bin prove_zkwallet_demo --bin prove_zkwallet_from_input
./target/release/build_zkwallet_demo_input --request-id leaf-pos-removal-smoke > /tmp/leaf-pos-removal-smoke.json
jq -r '.input_json' /tmp/leaf-pos-removal-smoke.json > /tmp/leaf-pos-removal-smoke.input.json
jq '.witnesses | has("leaf_pos")' /tmp/leaf-pos-removal-smoke.input.json
./target/release/prove_zkwallet_from_input --request-id leaf-pos-removal-smoke --input-json-path /tmp/leaf-pos-removal-smoke.input.json
```

확인 결과:

- `leaf_pos` emitted in witness JSON: `false`
- `verified: true`
- `proof_generation_seconds: 0.4558`
- `verification_seconds: 0.0034`
- `tree_proof` witness는 `4 + 4 * depth` flattened 포맷으로 직렬화됨

추가 정렬 검증:

- `./target/release/prove_zkwallet_demo --request-id poseidon-hash-align`
  - `verified: true`
  - `constraints: 28043`
  - `proof_generation_seconds: 0.7062`
  - `verification_seconds: 0.0036`
- `./target/release/prove_zkwallet_from_input --request-id poseidon-hash-align --input-json-path /tmp/poseidon-hash-align.input.json`
  - `verified: true`
  - `proof_generation_seconds: 0.6387`
  - `verification_seconds: 0.0039`

## 레거시 플랫폼 crate 상태

대상 파일: [zktransfer-custody-platform/crates/zk-wallet-circuits/src/zkwallet/circuit.rs](/Users/hyunokoh/Documents/zkWallet/zktransfer-custody-platform/crates/zk-wallet-circuits/src/zkwallet/circuit.rs)

- 별도 플랫폼 레포 안의 이 crate는 아직 binary Merkle gadget을 사용함
- witness JSON은 여전히 `leaf_pos`를 필수로 요구함
- 즉, 최신 `zk-wallet-circuits/` 의 flattened 4-ary witness 계약과는 다름
- 2026-03-23 기준으로는 이 차이를 테스트와 README에 명시해 두었음

검증 명령:

```bash
cargo test --features "api zkwallet" witness_ -- --nocapture
cargo test --features "api zkwallet" create_circuit_preserves_legacy_leaf_index -- --nocapture
```

확인 결과:

- legacy witness serde 회귀 테스트 통과
- legacy `leaf_pos -> leaf_index` 전달 회귀 테스트 통과

## 다음 권장 작업

1. legacy `leaf_pos` 입력 허용을 언제까지 유지할지 API deprecation 계획을 정한다.
2. `zktransfer-custody-platform/crates/zk-wallet-circuits/` 를 최신 4-ary Poseidon2 경로로 올릴지, 명시적으로 deprecated 처리할지 결정한다.
3. custody/server가 어떤 회로 바이너리를 표준으로 사용할지 명확히 정한다.
4. 서버 경로에서 새 flattened 4-ary proof 포맷과 Poseidon statement fixture를 고정한 회귀 테스트를 유지한다.
5. `zktransfer-custody-platform/apps/server` 배포에서는 `ALLOW_LEGACY_CIRCUITS_FALLBACK=0` 로 fail-closed 운영을 기본값으로 검토한다.
6. 레거시 crate cutover 기준과 제거 일정은 [docs/legacy-zkwallet-circuits-deprecation-plan-2026-03-23.md](/Users/hyunokoh/Documents/zkWallet/docs/legacy-zkwallet-circuits-deprecation-plan-2026-03-23.md) 기준으로 관리한다.
