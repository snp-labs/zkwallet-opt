# zkPasskey × zkWallet 통합 연구

## 1. 개요

### 1.1 목적
zkWallet의 현재 키 관리 방식(seed phrase + PIN/생체인증)에 **zkpasskey의 소셜 로그인 기반 ZK 키 복구 스킴**을 통합하여, seed phrase 없이도 안전한 키 복구가 가능한 지갑을 구현한다.

### 1.2 핵심 아이디어
```
현재 zkWallet:     seed phrase → private key → 서명
통합 후 zkWallet:  소셜 로그인(Google/Kakao) → ZK proof → private key 업데이트
                   (seed phrase는 고급 사용자 선택 옵션으로 유지)
```

---

## 2. zkPasskey 스킴 분석

### 2.1 아키텍처
zkpasskey는 **ERC-4337 Account Abstraction** 기반의 이중 키 구조:

| 키 | 역할 | 검증 방식 |
|----|------|----------|
| **txKey** (ECDSA) | 일상 트랜잭션 서명 | 표준 ECDSA.recover |
| **masterKey** (ZK Verifier) | 키 복구/업데이트 전용 | Groth16 ZK proof 검증 |

### 2.2 소셜 로그인 → ZK Proof 흐름

```
1. 사용자가 Google/Kakao로 소셜 로그인
                    ↓
2. OIDC JWT ID Token 수신 (RS256 서명)
   - iss: "https://accounts.google.com"
   - sub: "user_unique_id_12345"
   - nonce: Poseidon(h_sign_userop, counter, random)
                    ↓
3. ZK Circuit (SeparatedCircuit)에서 증명 생성
   - JWT RS256 서명 검증 (RSA-2048 in-circuit)
   - Base64 디코딩 (in-circuit)
   - iss, sub, nonce 클레임 추출 (in-circuit)
   - OIDC 제공자 Merkle 멤버십 증명
   - Vandermonde 임계값 검증
                    ↓
4. 온체인 검증: ZkOAuthKeyUpdateVerifier.validate()
   - k개 Groth16 proof 검증
   - sum(partial_rhs_i) == lhs (임계값)
   - hanchor 일치 (신원 바인딩)
   - counter 일치 (재사용 방지)
                    ↓
5. txKey 업데이트 → 새로운 ECDSA 키로 교체
```

### 2.3 핵심 암호학 기법

#### Vandermonde 임계값 스킴 (k-of-n)
- 사용자가 n개의 소셜 로그인 계정을 등록하고, k개만으로 복구 가능
- 예: Google, Kakao, Apple 3개 등록 → 2개만 있으면 키 복구

```
Anchor 생성:
  x_i = Poseidon(pad(aud) || pad(iss) || pad(sub))   // 각 소셜 계정
  h_i = Poseidon(i, x_i)                              // 인덱스 바인딩
  V = Vandermonde(m × n)                               // m = n - k + 1
  anchor = V * h                                       // 온체인 저장
  hanchor = chain_hash(anchor)                         // 최종 해시
```

#### 신원 해시 (프라이버시 보호)
```
h_id = Poseidon(current_idx, Poseidon(iss, sub))
```
- 온체인에서 실제 소셜 계정 정보(iss, sub)는 절대 노출되지 않음
- ZK proof로 "나는 이 앵커에 바인딩된 소셜 계정의 소유자"임을 증명

---

## 3. zkWallet 현재 아키텍처

### 3.1 현재 키 관리 흐름
```
Wallet 생성:
  1. BIP39 니모닉 생성 (12단어)
  2. ethers.js: Wallet.fromMnemonic() → EOA 주소 + 개인키
  3. PIN 입력 → MiMC7 + PBKDF2로 AES 키 파생
  4. 개인키를 AES로 암호화 → Realm DB에 ctPrivateKey 저장
  5. 니모닉도 암호화 → ctMnemonic 저장
  6. 복호화 키 → Keychain (생체인증 보호)

복구:
  1. 사용자가 12단어 seed phrase 수동 입력
  2. Wallet.fromMnemonic() → 키 복원
  (→ seed phrase 분실 시 복구 불가능!)
```

### 3.2 현재 회로 (ZkWalletCircuit)
- Groth16 on BN254 (arkworks)
- Poseidon 해시, ElGamal 암호화
- 8진 n-ary Merkle 트리 (인덱스 프리)
- 비밀 송금: 커밋먼트, 널리파이어, 범위 검증

### 3.3 서버 아키텍처
- Mock 소셜 로그인 (JWT) — 실제 OAuth 미구현
- Custody Orchestrator: Rust 바이너리로 증명 생성
- Local Chain Simulator

---

## 4. 통합 설계

### 4.1 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    zkWallet (통합 후)                         │
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │  일상 사용     │     │   키 복구      │     │  비밀 송금   │ │
│  │  (txKey)      │     │  (masterKey)  │     │ (zkTransfer)│ │
│  │              │     │              │     │             │ │
│  │ PIN/생체인증   │     │ 소셜 로그인    │     │ ZK proof    │ │
│  │ → ECDSA 서명  │     │ → ZK proof   │     │ → 비밀 전송  │ │
│  │              │     │ → txKey 교체  │     │             │ │
│  └──────────────┘     └──────────────┘     └─────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              ERC-4337 Smart Account                     ││
│  │  ┌─────────────────┐  ┌──────────────────────────────┐ ││
│  │  │     txKey        │  │         masterKey             │ ││
│  │  │  (ECDSA addr)    │  │  (ZkOAuthKeyUpdateVerifier)  │ ││
│  │  │                 │  │  - hanchor (소셜 신원 해시)     │ ││
│  │  │  일반 TX 서명    │  │  - n, k (임계값 파라미터)      │ ││
│  │  │                 │  │  - recoveryCnt (재사용 방지)    │ ││
│  │  └─────────────────┘  └──────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            PoseidonMerkleTreeDirectory                  ││
│  │  (OIDC 제공자 레지스트리: Google, Kakao, Apple 등)       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 4.2 계정 라이프사이클

#### Phase 1: 지갑 생성 (Seedless by Default)

```
사용자 → "지갑 만들기" 클릭
         ↓
      소셜 로그인 2-3개 연결
      (Google + Kakao + Apple)
         ↓
      디바이스에서 ECDSA 키페어 생성
      (seed phrase 없이, 순수 랜덤 키)
         ↓
      앵커 생성:
        x_i = Poseidon(pad(aud) || pad(iss) || pad(sub))
        anchor = Vandermonde * hash_vector
        hanchor = chain_hash(anchor)
         ↓
      ERC-4337 ZkKeyAccount 배포:
        - txKey = 새 ECDSA 주소
        - masterKey = ZkOAuthKeyUpdateVerifier(hanchor, n=3, k=2)
         ↓
      완료! (seed phrase 표시 없음)

      [선택] 설정 > 고급 > "복구 문구 내보내기"
             → seed phrase 보기/백업 가능
```

#### Phase 2: 일상 사용

```
사용자 → 비밀 송금 요청
         ↓
      PIN/Face ID로 인증
         ↓
      디바이스의 txKey(ECDSA)로 UserOperation 서명
         ↓
      zkTransfer proof 생성 (기존 ZkWalletCircuit)
         ↓
      Bundler를 통해 온체인 제출
```

#### Phase 3: 키 복구 (디바이스 분실/교체 시)

```
새 디바이스에서 "지갑 복구" 클릭
         ↓
      소셜 로그인 k개 수행 (예: Google + Kakao)
         ↓
      각 소셜 로그인마다 JWT ID Token 수신
         ↓
      각 JWT에 대해 SeparatedCircuit proof 생성:
        - RSA-2048 서명 검증 (in-circuit)
        - iss, sub 추출 (in-circuit)
        - Vandermonde 임계값 기여분 계산
         ↓
      k개 proof를 ZkKeyAccount.updateTxKey()에 제출:
        - masterKey.validate() → k개 Groth16 검증
        - sum(partial_rhs) == lhs 확인
        - recoveryCnt 증가
         ↓
      txKey가 새 디바이스의 새 ECDSA 키로 업데이트
         ↓
      기존 디바이스의 키는 즉시 무효화!
```

### 4.3 스마트 컨트랙트 통합

#### 기존 zkWallet 컨트랙트 + zkPasskey 컨트랙트

```solidity
// 기존 zkWallet의 비밀 송금 컨트랙트는 그대로 유지
// 계정 관리만 ZkKeyAccount로 교체

// ZkKeyAccount.sol (zkpasskey에서 가져옴)
contract ZkKeyAccount is BaseAccount {
    address public txKey;           // 일상 ECDSA 서명용
    address public masterKey;       // ZK 키 복구 검증기

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256) {
        // updateTxKey 호출 → masterKey(ZK verifier)로 검증
        // 그 외 → txKey(ECDSA)로 검증
    }

    function updateTxKey(
        uint256 expectedCnt,
        address newTxKey
    ) external;
}

// ZkOAuthKeyUpdateVerifier.sol (zkpasskey에서 가져옴)
contract ZkOAuthKeyUpdateVerifier {
    bytes32 public hanchor;      // 소셜 로그인 앵커 해시
    uint8 public n;              // 등록된 소셜 계정 수
    uint8 public k;              // 복구에 필요한 최소 수

    function validate(
        bytes calldata sig,
        bytes32 msgHash,
        uint256 expectedCounter
    ) external returns (bool);
}

// PoseidonMerkleTreeDirectory.sol (zkpasskey에서 가져옴)
// OIDC 제공자(Google, Kakao 등)의 RSA 공개키를 관리
contract PoseidonMerkleTreeDirectory {
    function insert(bytes32 leaf) external onlyOwner;
    function root() external view returns (bytes32);
}
```

### 4.4 모바일 앱 통합

#### 새로운 화면 흐름

```
앱 시작
  │
  ├─ [신규 사용자] ──→ 소셜 로그인 연결 (2-3개)
  │                      ↓
  │                   ZkKeyAccount 생성
  │                      ↓
  │                   메인 화면
  │
  ├─ [기존 사용자 - 같은 디바이스] ──→ PIN/Face ID ──→ 메인 화면
  │
  └─ [기존 사용자 - 새 디바이스] ──→ "지갑 복구" 클릭
                                       ↓
                                    소셜 로그인 k개
                                       ↓
                                    ZK proof 생성
                                       ↓
                                    txKey 업데이트
                                       ↓
                                    새 PIN 설정
                                       ↓
                                    메인 화면
```

#### React Native 바인딩 활용

zkpasskey는 이미 **React Native 바인딩(Craby)**을 제공:

```
zkpasskey/bindings/craby/
├── src/lib.rs          # Rust FFI (anchor 생성, proof 생성)
├── android/            # Android 네이티브 모듈
└── ios/                # iOS 네이티브 모듈
```

zkWallet 모바일 앱에서 직접 호출 가능:
```typescript
// 예상 API (craby 바인딩 기반)
import { ZkPasskey } from 'react-native-zkpasskey';

// 앵커 생성 (지갑 생성 시)
const anchor = await ZkPasskey.generateAnchor({
  credentials: [
    { iss: 'https://accounts.google.com', sub: 'user123', aud: 'app_id' },
    { iss: 'https://kauth.kakao.com', sub: 'user456', aud: 'app_id' },
  ],
  n: 2,
  k: 2,
});

// ZK proof 생성 (키 복구 시)
const proof = await ZkPasskey.generateRecoveryProof({
  jwtToken: googleIdToken,
  merklePath: oidcProviderPath,
  anchor: storedAnchor,
  userOpHash: updateTxKeyOpHash,
  counter: currentRecoveryCnt,
  currentIdx: 0,
});
```

---

## 5. 기술적 호환성 분석

### 5.1 커브 및 증명 시스템 호환성

| 항목 | zkWallet | zkPasskey | 호환성 |
|------|---------|----------|--------|
| 증명 시스템 | Groth16 | Groth16 | ✅ 동일 |
| 곡선 | BN254 | BN254 | ✅ 동일 |
| 해시 | Poseidon + MiMC7 | Poseidon + SHA-256 | ✅ Poseidon 공유 |
| 프레임워크 | arkworks | arkworks (패치) | ⚠️ 버전 확인 필요 |
| 스마트 컨트랙트 | 자체 | ERC-4337 | 🔄 마이그레이션 필요 |

### 5.2 주요 통합 포인트

```
공유 가능한 인프라:
├── Poseidon 해시 (동일 파라미터 사용 시)
├── BN254 곡선 (동일)
├── Groth16 검증기 (동일 구조)
└── arkworks 생태계 (호환)

별도 유지해야 하는 부분:
├── ZkWalletCircuit (비밀 송금 전용)
├── SeparatedCircuit (키 복구 전용)
├── 각각의 trusted setup (CRS)
└── 각각의 검증 키 (VK)
```

### 5.3 arkworks 버전 호환 이슈

zkpasskey는 `ark-groth16 0.5.0`의 **패치 버전**을 사용 (streaming proof 최적화):
```toml
# zkpasskey의 vendor/
ark-groth16 = { path = "vendor/groth16" }  # 패치됨
ark-relations = { path = "vendor/relations" }  # 패치됨
```

**해결 방안:**
- zkWallet의 arkworks 의존성을 zkpasskey 패치 버전에 맞추거나
- zkpasskey의 proof 생성을 별도 바이너리/라이브러리로 분리하여 독립 실행

---

## 6. 보안 분석

### 6.1 공격 벡터 및 대응

| 공격 | 위험도 | 대응 |
|------|--------|------|
| 소셜 계정 탈취 (1개) | 낮음 | k-of-n 임계값으로 1개만으로는 복구 불가 |
| 소셜 계정 탈취 (k개) | 중간 | 2FA 필수 권장 + 시간 지연(timelock) 추가 가능 |
| OIDC 제공자 키 교체 | 낮음 | Merkle Tree에 새 키 추가, 이전 키도 유효기간 내 유지 |
| OIDC 제공자 서비스 중단 | 중간 | n > k로 여유분 확보 (예: 3-of-5) |
| ZK proof 위조 | 매우 낮음 | Groth16 soundness 보장 (trusted setup 전제) |
| 온체인 앵커 변조 | 매우 낮음 | 컨트랙트 불변성 (owner만 업데이트 가능) |
| 재사용 공격 | 없음 | recoveryCnt로 완벽 방지 |
| JWT 만료 후 재사용 | 없음 | nonce에 UserOp 해시 바인딩 |

### 6.2 기존 zkWallet 대비 보안 개선

```
기존 (seed phrase):
  ❌ 사용자 20%가 분실 → 자산 영구 손실
  ❌ 피싱으로 seed 탈취 → 즉시 자산 도난
  ❌ 단일 장애점 (seed 1개가 모든 것)

통합 후 (zkpasskey):
  ✅ 소셜 로그인으로 복구 → 분실 위험 극감
  ✅ ZK proof로 신원 검증 → 소셜 계정 정보 온체인 미노출
  ✅ k-of-n 임계값 → 1개 계정 탈취로는 불가
  ✅ recoveryCnt → 이전 키 즉시 무효화
  ⚠️ 새로운 의존성: OIDC 제공자 가용성
```

### 6.3 프라이버시 보장

```
온체인에 노출되는 정보:
  - hanchor (앵커 해시) → 소셜 계정 정보 역추적 불가
  - Groth16 proof → 영지식 (zero-knowledge)
  - recoveryCnt → 복구 횟수만 노출

온체인에 노출되지 않는 정보:
  - 어떤 소셜 로그인을 사용했는지 (iss)
  - 사용자의 소셜 ID (sub)
  - JWT 토큰 내용
  - 어떤 k개를 선택했는지 (selector)
```

---

## 7. 구현 로드맵

### Phase 1: 기반 구축 (4주)

```
Week 1-2: 스마트 컨트랙트 통합
  ├── ZkKeyAccount 배포 스크립트 작성
  ├── ZkOAuthKeyUpdateVerifier 배포
  ├── PoseidonMerkleTreeDirectory에 Google/Kakao OIDC 키 등록
  ├── 기존 zkTransfer 컨트랙트와 ZkKeyAccount 연동 테스트
  └── ERC-4337 Bundler 설정 (Stackup/Pimlico)

Week 3-4: 회로 빌드 & Trusted Setup
  ├── zkpasskey SeparatedCircuit 빌드 확인
  ├── zkWallet arkworks 버전 호환성 해결
  ├── 개발용 trusted setup (powers of tau)
  ├── proving key / verification key 생성
  └── 검증 키 온체인 등록
```

### Phase 2: 모바일 앱 통합 (4주)

```
Week 5-6: React Native 바인딩 통합
  ├── zkpasskey craby 바인딩을 zk-wallet-mobile-app에 추가
  ├── iOS/Android 네이티브 모듈 빌드
  ├── Anchor 생성 API 통합
  ├── Proof 생성 API 통합
  └── 성능 측정 (proof 생성 시간)

Week 7-8: UI/UX 구현
  ├── 소셜 로그인 연결 화면 (Google/Kakao OAuth)
  ├── 키 복구 화면 (소셜 로그인 k개 → proof → txKey 업데이트)
  ├── 기존 PIN/생체인증 로그인과 병행
  ├── 설정 > 복구 방법 관리 화면
  └── 온보딩 플로우 수정 (seed phrase → 소셜 로그인)
```

### Phase 3: 서버 통합 & 테스트 (2주)

```
Week 9-10:
  ├── Mock 소셜 로그인을 실제 OIDC로 교체
  ├── OIDC 제공자 공개키 자동 갱신 서비스
  ├── E2E 테스트 (지갑 생성 → 송금 → 키 복구)
  ├── 보안 감사 (회로, 컨트랙트, 앱)
  └── 테스트넷 배포
```

### Phase 4: 고급 기능 (이후)

```
  ├── 소셜 로그인 제공자 추가/삭제 (앵커 업데이트)
  ├── 임계값(k) 동적 변경
  ├── 시간 지연(timelock) 추가 (대액 복구 시 72시간 대기)
  ├── 선택적 seed phrase 내보내기 (고급 사용자용)
  ├── 복구 알림 (기존 디바이스에 "키 교체 시도" 알림)
  └── 하드웨어 키 지원 (YubiKey 등을 n개 중 하나로)
```

---

## 8. 성능 고려사항

### 8.1 Proof 생성 시간 (예상)

| 작업 | 플랫폼 | 예상 시간 |
|------|--------|----------|
| SeparatedCircuit proof (1개) | iPhone 15 | 30-60초 |
| SeparatedCircuit proof (1개) | Android 고성능 | 45-90초 |
| k=2일 때 총 복구 시간 | 모바일 | 60-120초 |
| ZkWalletCircuit proof (비밀 송금) | 서버 | 5-15초 |

### 8.2 최적화 전략

1. **Streaming Proof**: zkpasskey의 패치된 ark-groth16이 메모리 최적화된 streaming proof 지원
2. **병렬 생성**: k개 proof를 동시 생성 (각 소셜 로그인은 독립적)
3. **서버 위임 옵션**: 모바일 성능 부족 시 서버에서 proof 생성 (witness만 클라이언트에서)
4. **SHA-256 Midstate**: JWT 헤더 부분 사전 해시로 회로 크기 축소

### 8.3 회로 크기

| 회로 | 제약 조건 수 (예상) | 용도 |
|------|---------------------|------|
| SeparatedCircuit | ~200만-500만 | RSA-2048 in-circuit + Poseidon Merkle |
| ZkWalletCircuit | ~50만-100만 | ElGamal + 8-ary Merkle + 범위 검증 |

---

## 9. 사용자 경험 시나리오

### 시나리오 1: 첫 지갑 생성

```
사용자: "시작하기" 탭
  → "Google로 시작" 버튼 클릭
  → Google OAuth 로그인
  → "Kakao도 연결하면 더 안전해요" 안내
  → Kakao 로그인
  → "복구에 2개 중 2개 필요" 설정 확인
  → PIN 설정 (일상 인증용)
  → Face ID 등록 (선택)
  → 🎉 "지갑이 만들어졌어요!"
  → 바로 입금/송금 가능

총 소요: ~2분 (seed phrase 없음!)
```

### 시나리오 2: 디바이스 분실 후 복구

```
새 폰에서 앱 설치
  → "지갑 복구" 선택
  → "Google로 복구" 클릭 → Google 로그인
  → "Kakao로 복구" 클릭 → Kakao 로그인
  → 🔄 "신원 검증 중..." (ZK proof 생성, 30-60초)
  → ✅ "지갑이 복구되었어요!"
  → 새 PIN 설정
  → 기존 잔액/내역 모두 복원

기존 폰의 키는 자동으로 무효화됨
```

### 시나리오 3: 하나의 소셜 계정이 해킹당한 경우

```
해커가 Google 계정 탈취
  → 해커가 "지갑 복구" 시도
  → Google 로그인 성공 (1/2)
  → Kakao 로그인 필요... 실패!
  → ❌ k=2 임계값 미달 → 복구 거부

사용자:
  → Kakao로만 잠금 해제는 불가 (k=2이므로)
  → Google 계정 복구 후 → Google + Kakao → 키 복구 성공
  → 또는: Apple을 3번째로 추가했다면 → Kakao + Apple로 복구 가능
```

---

## 10. 오픈 이슈 및 결정 사항

### 10.1 결정이 필요한 사항

| # | 질문 | 권장안 |
|---|------|--------|
| 1 | 기본 임계값 (n, k) | n=3, k=2 (Google + Kakao + Apple 중 2개) |
| 2 | OIDC 제공자 | Google, Kakao, Apple (한국 시장 우선) |
| 3 | Proof 생성 위치 | 클라이언트 우선, 서버 fallback |
| 4 | 기존 seed phrase 지갑 마이그레이션 | 소셜 로그인 연결 → ZkKeyAccount로 자산 이전 |
| 5 | Timelock 추가 여부 | Phase 4에서 추가 (선택적) |
| 6 | ERC-4337 Bundler 선택 | Stackup (자체 운영) 또는 Pimlico (SaaS) |
| 7 | Trusted Setup 방식 | 개발: powers of tau / 프로덕션: MPC ceremony |

### 10.2 리스크

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|----------|
| RSA-2048 in-circuit 성능 | 높음 | Streaming proof + 서버 fallback |
| OIDC 제공자 키 교체 타이밍 | 중간 | 자동 모니터링 + Merkle 업데이트 서비스 |
| arkworks 버전 충돌 | 중간 | 별도 바이너리로 분리 또는 버전 통일 |
| ERC-4337 인프라 안정성 | 중간 | 자체 Bundler 운영 + 폴백 EOA 모드 |

---

## 11. 결론

zkpasskey를 zkWallet에 통합하면:

1. **UX 혁신**: seed phrase 없이 소셜 로그인만으로 지갑 생성/복구
2. **보안 유지**: ZK proof로 소셜 계정 정보 온체인 미노출
3. **복구 안전성**: k-of-n 임계값으로 단일 계정 탈취 방어
4. **기술 호환**: 동일한 BN254 + Groth16 + Poseidon + arkworks 스택

**핵심 도전**: RSA-2048 in-circuit 검증의 모바일 성능 최적화가 가장 큰 기술적 과제이나, zkpasskey의 streaming proof 최적화와 서버 fallback으로 해결 가능.

이 통합은 zkWallet을 **"암호화폐 전문가만의 도구"에서 "누구나 쓸 수 있는 프라이버시 지갑"**으로 전환하는 핵심 요소가 될 것이다.
