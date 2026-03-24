# zkTransfer Client/Server Implementation Plan

## Phase 0

- [x] upstream repositories clone
- [x] current proving flow identify
- [x] target custody architecture document
- [x] new working directories create

## Phase 1

- [ ] request/response schema define
- [ ] custody server API surface define
- [ ] key custody assumptions document
- [ ] chain interaction assumptions document
- [ ] auth model define (`JWT + social login`)
- [ ] token-type abstraction define (`ERC20`, `ERC721`, `ERC1155`)

## Phase 2

- [ ] server app scaffold
- [ ] circuit integration strategy choose
- [ ] proof generation service implement
- [ ] tx builder / broadcaster implement
- [ ] request persistence and job status implement

## Phase 3

- [ ] client app scaffold
- [ ] transfer request form implement
- [ ] server API client implement
- [ ] request status / tx hash UI implement

## Phase 4

- [ ] end-to-end local happy path verify
- [ ] failure mode handling add
- [ ] docs update

## Guardrails

- 기존 upstream repo는 가능한 한 직접 수정하지 않는다.
- 새 app들은 별도 디렉터리에서 composition 방식으로 만든다.
- proof generation은 server로 이동시키되 circuit semantics는 처음에는 유지한다.
- proof correctness보다 먼저 API shape를 고정하지 않는다.

## Immediate Next Step

서버가 받아야 하는 최소 zkTransfer 요청 payload를 정의하고, client에서 무엇을 보내고 무엇은 server가 재조회할지 결정한다.
