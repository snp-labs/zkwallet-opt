# zkTransfer Open Questions

현재 구현을 시작하는 데 치명적인 blocker는 아니지만, 초기에 고정해야 하는 항목들이다.

## Security / Custody

- social login 계정과 custody wallet을 어떻게 매핑할지
- user별 zk secret을 서버가 평문 보관할지, envelope encryption으로 보관할지
- proving 시 secret material을 어떤 메모리 수명으로 다룰지

## Execution

- 첫 버전을 synchronous API로 할지 async job API로 할지
- local hardhat deployment artifact를 어디에 둘지
- Kaia testnet RPC / contract address를 어떻게 관리할지

## Product

- client app를 기존 mobile app에서 파생할지, 신규 최소 client를 별도로 만들지
- note/state 조회 소스를 체인으로만 할지, server DB 캐시를 둘지
