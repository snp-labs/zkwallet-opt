# zkWallet 종합 평가 보고서

> 작성일: 2026-03-16
> 대상: zkWallet 프로젝트 전체 (ZK 회로, 모바일 앱, 커스터디 서버, 클라이언트 앱)

## 2026-03-23 업데이트

- 루트 `src/zkwallet` 회로의 membership proof는 이제 `Poseidon2 + 4-ary Merkle Tree + OR-constraints`를 사용한다.
- 루트 회로에는 음수 잔액이 필드에서 큰 수로 랩어라운드되는 문제를 막는 balance/range check가 추가되었다.
- `zk-wallet-circuits/` 하위 proving 바이너리에도 음수 랩어라운드 방지 제약은 반영되었다.
- `zk-wallet-circuits/` 하위 proving 바이너리와 demo input builder도 현재는 `Poseidon2 + 4-ary membership` 경로로 올라왔다.
- commitment/nullifier/address hash와 symmetric note encryption도 Poseidon 경로로 맞춰져, 런타임 crypto profile은 사실상 정렬되었다.
- witness JSON의 `leaf_pos` 출력은 제거됐고, 현재 남은 정리 포인트는 legacy 입력 허용 기간과 서버 fixture 계약이다.
- 다만 `zktransfer-custody-platform/crates/zk-wallet-circuits` 는 아직 binary Merkle + `leaf_pos` 기반 레거시 crate로 남아 있다.
- 레거시 crate 제거 계획과 cutover 기준은 [docs/legacy-zkwallet-circuits-deprecation-plan-2026-03-23.md](/Users/hyunokoh/Documents/zkWallet/docs/legacy-zkwallet-circuits-deprecation-plan-2026-03-23.md) 에 기록했다.
- 최신 상세 상태는 [docs/zkwallet-crypto-profile-2026-03-23.md](/Users/hyunokoh/Documents/zkWallet/docs/zkwallet-crypto-profile-2026-03-23.md) 를 참고.

---

## 1. 아키텍처 개요

### 시스템 구성

| 구성요소 | 기술스택 | 역할 |
|----------|----------|------|
| **ZK 회로 코어** | Rust + Arkworks (Groth16) | 영지식 증명 생성/검증 |
| **zk-wallet-circuits** | Rust | 증명 바이너리 (prove/build input) |
| **Mobile App** | React Native 0.82 + TypeScript | 지갑 UI, 클라이언트 암호화 |
| **Custody Server** | Node.js | 서버사이드 증명 생성, 트랜잭션 브로드캐스트 |
| **Client App** | Node.js | 클라이언트사이드 zkTransfer |

### 핵심 ZK 프로토콜 설계

- **커밋먼트**: `cm = Poseidon_8(du, tk_addr, tk_id, dv, addr_send)`
- **널리파이어 (이중지불 방지)**: `sn = Poseidon_2(cm_old, sk_send_own)`
- **송신자 노트 암호화**: 대칭 암호화 (OTP via Poseidon)
- **수신자 노트 암호화**: ElGamal 비대칭 암호화
- **멤버십 증명**: Poseidon2 기반 4-ary Merkle Tree + OR-constraints (인덱스 비공개)

---

## 2. 기능(Functionality) 평가 — 8/10

### 지원 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| ERC20 전송 | 완성 | 퍼블릭/프라이빗 금액 혼합 지원 |
| ERC721 전송 | 완성 | NFT 프라이빗 전송 |
| ERC1155 전송 | 완성 | Semi-fungible 토큰 지원 |
| 프라이빗-프라이빗 | 완성 | 핵심 UTXO 기반 전송 |
| 커스터디 모드 | 완성 | 서버사이드 증명 생성 + 브로드캐스트 |
| 생체인증 | 완성 | Face ID / Touch ID 지원 |
| 다중 네트워크 | 부분 완성 | hardhat-local, kaia-testnet (어댑터 placeholder) |

### 주요 의존성

**Rust (ZK 코어)**:
- `ark-groth16` 0.5.0 / 0.4.0 — Groth16 SNARK
- `ark-bn254` — BN254 타원곡선
- `ark-ed-on-bn254` — Edwards 곡선
- `ark-crypto-primitives` — 해시, 암호화, Merkle 트리

**TypeScript (모바일 앱)**:
- `react-native` 0.82.0
- `web3` ^4.16.0
- `@ethersproject/wallet` ^5.8.0
- `react-native-keychain` ^10.0.0
- `react-native-aes-crypto` (zkrypto-inc 포크)
- `@realm/react` ^0.20.0

### 평가

핵심 프라이버시 전송 기능이 잘 구현되어 있으나, 네트워크 어댑터가 placeholder 상태이며 소셜 로그인이 mock 수준이다.

---

## 3. 성능(Performance) 평가 — 7.5/10

### 증명 생성 성능

| 메트릭 | 수치 | 비고 |
|--------|------|------|
| 회로 크기 | ~500만 constraints | Groth16 기준 중대형 |
| 증명 생성 시간 | ~1-2초 | BN254 + 서버사이드 기준 |
| 검증 시간 | 마이크로초 단위 | 온체인 검증에 적합 |
| 증명 크기 | 3개 그룹 원소 | Groth16 고정 크기 (매우 작음) |

### Constraint 분포 (주요 구간)

| 구간 | Constraints |
|------|-------------|
| 해시 체인 (송/수신) | ~1,000 |
| Merkle 멤버십 증명 | ~1,000+ |
| ElGamal 암호화 (2회) | ~1,500+ |
| 대칭 암호화 체크 (11회) | ~2,000 |
| Range 체크 | ~2,000+ (비트 분해) |

### 최적화 기법

| 기법 | 효과 |
|------|------|
| 8-ary Merkle Tree | 2^32 리프 기준: 깊이 32 -> 4 (바이너리 대비) |
| Poseidon 해시 | MiMC 대비 arity 확장 시 선형적 constraint 증가 |
| Constraint 프로파일링 | `ZKWALLET_CONSTRAINT_PROFILE` 환경변수로 병목 분석 가능 |
| 병렬 실행 | Rayon 기반 feature flag 지원 |

### 성능 이슈

- 증명 바이너리 subprocess 호출: 타임아웃 120초, MaxBuffer 8MB — 리소스 제한 불충분
- 메모리 사용량 무제한: 증명 생성 시 메모리 바운드 없음
- 8-ary 트리 최적화: 해시 검증 횟수를 획기적으로 줄임 (강점)

### 평가

서버사이드 증명으로 UX가 좋고, 1-2초 증명 시간은 양호하다. 다만 리소스 관리가 부족하여 프로덕션 환경에서는 보완이 필요하다.

---

## 4. 보안(Security) 평가 — 5.5/10

### 4.1 Critical (즉시 수정 필요)

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| 1 | 하드코딩된 JWT 시크릿 | `zktransfer-server-app/src/config.js` | `"dev-jwt-secret-change-me"` 기본값 — 프로덕션에서 인증 우회 가능 |
| 2 | unwrap() 패닉 | `zk-wallet-circuits/src/api/zkwallet/api.rs` | 모든 FFI 함수에서 `.unwrap()` 사용 — 잘못된 입력 시 서버 크래시 |
| 3 | 비암호화 Realm DB | `zk-wallet-mobile-app` | `encryptionKey` 미설정 — 트랜잭션 이력, 주소 등 평문 저장 |
| 4 | Rate Limiting 없음 | `zktransfer-server-app/src/app.js` | API 엔드포인트에 요청 제한 없음 — DoS 취약 |
| 5 | 증명 생성 리소스 무제한 | Custody Orchestrator | 메모리/CPU 바운드 없는 subprocess 실행 |

### 4.2 High (조속히 수정 필요)

| # | 이슈 | 설명 |
|---|------|------|
| 1 | 약한 PBKDF2 반복 횟수 | 5,000회 (NIST 권장: 100,000+) |
| 2 | 입력 검증 부재 | 역직렬화 전 입력 구조 미검증 |
| 3 | ethers.js v5 사용 | 유지보수 중단됨; v6 마이그레이션 필요 |
| 4 | 커스텀 AES 포크 | 표준 라이브러리 대신 자체 포크 사용 |
| 5 | 하드코딩된 주소 | 핫월렛 주소 등 config에 하드코딩 |

### 4.3 Medium

| # | 이슈 | 설명 |
|---|------|------|
| 1 | 약한 PIN 검증 | 4자리만 체크, 길이 검증 없음 |
| 2 | Mock 소셜 로그인 | 임의 provider/socialId 수용 |
| 3 | 토큰 리프레시 없음 | 고정 3600초 만료, 갱신 메커니즘 없음 |
| 4 | Certificate Pinning 없음 | MITM 공격에 취약 |
| 5 | Keychain 접근 그룹 미분리 | 동일 번들의 다른 앱이 접근 가능 |

### 4.4 보안 아키텍처 강점

| 항목 | 평가 |
|------|------|
| Poseidon 해시 | ZK-friendly, 검증된 파라미터 사용 |
| 인덱스-프리 Merkle 증명 | OR-constraint로 리프 위치 은닉 |
| ElGamal 암호화 | 수신자만 노트 복호화 가능 |
| Nullifier 설계 | 이중지불 방지 올바르게 구현 |
| JWT timing-safe 비교 | `crypto.timingSafeEqual()` 사용 |
| Witness/Statement 분리 | 공개/비공개 입력 올바르게 분리 |

### 4.5 주요 권장사항

1. JWT 시크릿 환경변수 필수화 + Rate Limiting 추가
2. Realm DB 암호화 활성화 + PBKDF2 반복 횟수 증가 (100,000+)
3. Rust FFI unwrap() -> Result 에러 처리 전환
4. ethers.js v6 마이그레이션 + 의존성 보안 스캔 도입
5. Certificate Pinning + HTTPS 강제 적용
6. Keychain에 `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` 설정
7. Android Keystore 통합으로 키 파생 보안 강화
8. CORS 원본 제한 + 최대 페이로드 크기 설정
9. 증명 생성 프로세스 격리 및 리소스 제한 적용
10. 감사 로깅 구현 (민감한 모든 작업 대상)

---

## 5. 코드 품질 및 테스트

### 코드 품질 — 7/10

- 모듈화: Rust 쪽은 generic trait 기반으로 잘 설계됨
- 에러 처리: Rust FFI에서 `.unwrap()` 남용, Node.js에서도 일부 미흡
- 문서화: README 존재, 인라인 주석은 부족
- 일관성: 네이밍 컨벤션 일관적이나 일부 오타 (`symmetric_encrytions`)

### 테스트 커버리지 — 6/10

| 테스트 종류 | 상태 |
|------------|------|
| 회로 constraint 만족 테스트 | 존재 |
| Groth16 증명/검증 벤치마크 | 존재 (5-sample 평균) |
| ERC20/721/1155 개별 테스트 | 존재 |
| Constraint 프로파일링 | 존재 |
| 서버 API 통합 테스트 | 미확인 |
| 모바일 E2E 테스트 | 부재 |
| 보안 퍼징 테스트 | 부재 |

---

## 6. 종합 평가

| 분야 | 점수 | 코멘트 |
|------|------|--------|
| 기능 | 8/10 | 핵심 완성, 네트워크 어댑터 미완 |
| 성능 | 7.5/10 | 서버사이드 증명 UX 좋음, 리소스 관리 보완 필요 |
| 보안 | 5.5/10 | ZK 프로토콜 설계 우수, 인프라/앱 보안 취약 |
| 코드 품질 | 7/10 | 모듈화 좋음, 에러 처리 부족 |
| 테스트 커버리지 | 6/10 | 회로 테스트 존재, E2E 부족 |
| **종합** | **6.8/10** | |

### 핵심 강점

1. **견고한 ZK 프로토콜 설계** — Poseidon + 8-ary Merkle + ElGamal 조합이 효율적
2. **다중 토큰 지원** — ERC20/721/1155 모두 지원하는 범용 회로
3. **커스터디 아키텍처** — 서버사이드 증명으로 모바일 UX 대폭 개선
4. **Arkworks 기반** — 검증된 Rust 라이브러리 활용

### 프로덕션 배포 전 필수 조치

프로덕션 배포 전에 Critical/High 이슈 해결이 필수적이며, 특히 서버 보안(JWT, Rate Limiting)과 클라이언트 데이터 보호(Realm 암호화, PBKDF2)가 가장 시급하다.
