# zkTransfer Custody Architecture

## Goal

기존 구조:

- mobile app가 zkTransfer statement/witness를 구성한다.
- mobile app가 로컬 native circuit bridge를 통해 proof를 생성한다.
- mobile app가 sender EOA private key로 tx를 서명하고 체인에 제출한다.

목표 구조:

- client app는 zkTransfer 요청만 생성하고 custody server로 전송한다.
- custody server가 필요한 witness/statement/proof/tx 생성을 수행한다.
- custody server가 custody key로 tx를 서명하고 blockchain으로 브로드캐스트한다.

## Existing Flow

Mobile app의 현재 proving 흐름:

- [transfer.ts](/Users/hyunokoh/Documents/zkWallet/zk-wallet-mobile-app/src/azeroth/transfer.ts)
- [generateZkTransferInput.ts](/Users/hyunokoh/Documents/zkWallet/zk-wallet-mobile-app/src/azeroth/snark-input/generateZkTransferInput.ts)
- [api.rs](/Users/hyunokoh/Documents/zkWallet/zk-wallet-circuits/src/api/zkwallet/api.rs)

핵심:

- app가 setup params를 체인에서 조회
- app가 snark input 생성
- app가 `runProof` / `runVerify` 실행
- app가 proof 포함 contract args를 만들어 직접 submit

## Target Split

### Client App

책임:

- 사용자 입력 수집
- 전송 요청 payload 생성
- custody server API 호출
- 요청 상태 표시
- 성공 시 tx hash 및 결과 조회

비책임:

- proving
- tx signing
- direct chain submission
- CRS / proving key 보관

### Custody Server

책임:

- authenticated zkTransfer request 수신
- sender/receiver/setup params 조회
- snark input 생성
- proof 생성 및 검증
- on-chain zkTransfer tx 생성 및 전송
- 요청/상태/tx 기록

## Proposed New Directories

- `/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app`
- `/Users/hyunokoh/Documents/zkWallet/zktransfer-server-app`

## Initial Implementation Strategy

1. 기존 mobile app의 zkTransfer request 생성 로직을 추출한다.
2. request DTO를 정의한다.
3. server에서 proof generation과 tx submission을 수행하는 API를 만든다.
4. client app는 기존 proving 호출을 server API 호출로 대체한다.
5. end-to-end happy path를 먼저 만든 뒤 보안/운영 요구사항을 보강한다.

## Open Decisions

현재 결정:

- custody server 서명 모델은 장기적으로 `HSM/KMS` 전제
- 초기 구현은 `hot wallet`로 시작
- ZKP 입력에 필요한 비밀 material은 장기적으로 `HSM/KMS`에서 복호화/전달되는 구조를 상정
- client 인증은 `JWT + social login`
- 대상 체인은 `Kaia testnet` 또는 `local hardhat`
- 첫 구현부터 `ERC20`, `ERC721`, `ERC1155` zkTransfer 모두 고려

추가로 남은 결정:

- social login provider를 무엇으로 시작할지
- custody server가 user secret material을 어떤 단위로 보관할지
- hardhat local contract deployment를 새로 만들지, 기존 app/contract 환경을 재사용할지
- request를 synchronous하게 처리할지, job queue 기반 async 처리로 시작할지
