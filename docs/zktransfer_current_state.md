# zkTransfer Current State

작성일: 2026-03-13

이 문서는 다음 AI agent 또는 사람이 현재 상태를 빠르게 파악할 수 있도록 정리한 인수인계 문서다.

---

## 1. 목표

현재 프로젝트의 목표는 다음과 같다.

- 사용자는 client app/web에서 `송금 요청`만 한다.
- custody server가 실제 zkTransfer용 `circuit input 생성 -> proof 생성 -> verify -> tx 기록`을 수행한다.
- 현재 체인 기록은 퍼블릭 체인이 아니라 `local chain simulator`다.
- UI는 일반 사용자가 이해할 수 있는 `송금`, `영수증`, `친구`, `설정` 중심으로 보인다.

---

## 2. 현재 구현 상태

### 서버

경로:
- [zktransfer-server-app](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app)

핵심 기능:
- mock social login with JWT
- zkTransfer request 생성
- async 상태 전이
- circuit input 생성
- 실제 Rust proving binary 호출
- proof verify
- local chain transaction 기록
- 프로필/포트폴리오 관리
- 연락처 관리
- QR 공유 payload 생성
- 설정 저장

주요 파일:
- [app.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/app.js)
- [profileService.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/services/profileService.js)
- [custodyOrchestrator.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/services/custodyOrchestrator.js)
- [localChainService.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/services/localChainService.js)
- [jobStore.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/store/jobStore.js)

추가된 서버 API:
- `GET /health`
- `POST /v1/auth/social/mock`
- `GET /v1/me/summary`
- `GET /v1/me/address-qr`
- `GET /v1/contacts`
- `POST /v1/contacts`
- `PUT /v1/settings`
- `GET /v1/zktransfer/requests`
- `POST /v1/zktransfer/requests`
- `GET /v1/zktransfer/requests/:id`
- `GET /v1/local-chain/transactions`
- `GET /v1/local-chain/transactions/:txHash`

서버 데이터 모델 요약:
- `profiles[userId]`
  - `walletAddress`
  - `accounts`
  - `recentRecipients`
  - `contacts`
  - `settings`
  - `transferStats`

### proving backend

경로:
- [zk-wallet-circuits](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits)

현재 연결된 binary:
- [build_zkwallet_demo_input.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/bin/build_zkwallet_demo_input.rs)
- [prove_zkwallet_from_input.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/bin/prove_zkwallet_from_input.rs)

현재 의미:
- proof는 실제 생성한다
- verify도 실제 수행한다
- 단, live on-chain state를 읽는 production path는 아직 아니다
- local/demo wallet state 기반 input builder를 사용한다

### 웹

경로:
- [zktransfer-client-app/public](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/public)

현재 탭:
- 홈
- 송금
- 내역
- 영수증
- 설정

현재 웹 기능:
- 로그인
- 홈 잔액/요약/빠른 액션
- 송금 요청
- 친구/최근 수신인 선택
- 최근 내역 조회
- 영수증 조회
- 등록 이름 우선 표시
- 내 주소 QR 표시
- 주소 복사
- 친구 수동 등록
- QR 문자열로 친구 등록
- 설정 저장

주요 파일:
- [index.html](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/public/index.html)
- [styles.css](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/public/styles.css)
- [app.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/public/app.js)

### 모바일

경로:
- [zktransfer-client-app/mobile-app](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app)

현재 상태:
- Expo 기반 실행 구성 존재
- mock login, summary, request 생성, polling, transactions 조회 연결됨
- 웹과 유사한 `Home / Send / Activity / Explorer` 구조

주요 파일:
- [App.tsx](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app/src/App.tsx)
- [api.ts](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app/src/api.ts)
- [SendScreen.tsx](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app/src/screens/SendScreen.tsx)
- [ActivityScreen.tsx](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app/src/screens/ActivityScreen.tsx)
- [ExplorerScreen.tsx](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app/src/screens/ExplorerScreen.tsx)

---

## 3. 현재 실행 방법

### 서버

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app
node src/index.js
```

### 웹

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-client-app
node src/server.js
```

접속:
- 웹: `http://127.0.0.1:4020`
- API: `http://127.0.0.1:4010`

### 모바일

```bash
cd /Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app
npm install
npm start
```

주의:
- 실제 기기에서 테스트할 때는 [App.tsx](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app/src/App.tsx) 의 base URL을 로컬 네트워크에서 접근 가능한 주소로 바꿔야 한다.

---

## 4. 현재 UX 상태

완성된 부분:
- 일반 사용자가 `zk`, `proof`, `note`를 직접 보지 않도록 숨겼다.
- 수신인/금액/자산 중심 송금 경험을 제공한다.
- 홈에서 `잔액`, `빠른 액션`, `최근 송금`, `자주 보내는 사람`을 볼 수 있다.
- 설정에서 QR 공유, 친구 등록, 표시 방식 설정이 가능하다.

아직 제품화 전인 부분:
- 카메라 스캔으로 QR 읽기 기능은 없다
  - 현재는 QR 문자열 붙여넣기 방식
- 친구/최근/주소 직접입력 UX는 들어갔지만 검색 UI는 없다
- 퍼블릭 체인이 아니라 local chain simulator다
- live contract state fetch와 HSM/KMS는 아직 붙지 않았다
- production auth/social login provider는 아직 mock 수준이다

---

## 5. 중요한 제약과 해석

### proof / blockchain 상태

- `proof generation`: 실제 수행
- `proof verification`: 실제 수행
- `blockchain submit`: local chain simulator에 기록
- `real public blockchain submit`: 아직 아님

즉 현재는 `proof는 진짜`, `체인 기록은 local demo`라고 이해하면 된다.

### 프로필/연락처 데이터

- 현재 프로필은 파일 기반 store에 저장된다
- 기존 예전 프로필과의 호환을 위해 [profileService.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/services/profileService.js) 에 마이그레이션 성격의 보정 로직을 넣었다

---

## 6. 다음 AI agent가 먼저 보면 좋은 파일

### 서버
- [app.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/app.js)
- [profileService.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/services/profileService.js)
- [custodyOrchestrator.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app/src/services/custodyOrchestrator.js)

### 웹
- [index.html](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/public/index.html)
- [app.js](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/public/app.js)
- [styles.css](/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/public/styles.css)

### proving
- [build_zkwallet_demo_input.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/bin/build_zkwallet_demo_input.rs)
- [prove_zkwallet_from_input.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/bin/prove_zkwallet_from_input.rs)

---

## 7. 다음 작업 우선순위 제안

1. QR 카메라 스캔 추가
2. 친구 검색 / 최근 검색 / 주소 직접 입력을 분리한 수신인 선택 UI
3. hardhat local 또는 Kaia testnet broadcaster 연결
4. live state 기반 input builder로 교체
5. HSM/KMS 연계 설계 반영
6. 모바일 앱의 연락처/설정/QR 화면도 웹 수준으로 확장

---

## 8. 참고 문서

- [zktransfer-custody-architecture.md](/Users/hyunokoh/Documents/zkWallet/docs/zktransfer-custody-architecture.md)
- [zktransfer-implementation-plan.md](/Users/hyunokoh/Documents/zkWallet/docs/zktransfer-implementation-plan.md)
- [zktransfer-api-draft.md](/Users/hyunokoh/Documents/zkWallet/docs/zktransfer-api-draft.md)
- [zktransfer-ui-architecture.md](/Users/hyunokoh/Documents/zkWallet/docs/zktransfer-ui-architecture.md)
- [zktransfer-ui-test-guide.md](/Users/hyunokoh/Documents/zkWallet/docs/zktransfer-ui-test-guide.md)
