# zkTransfer API Draft

## Purpose

client app는 proving이나 tx signing 없이 custody server에 전송 의도만 전달한다.

## Auth

- login 결과로 발급된 `JWT Bearer token`
- 초기 버전은 server-side social login session 또는 mock issuer 허용 가능

## Endpoints

### `POST /v1/auth/social/mock`

개발용 로그인.

Response:

- `accessToken`
- `refreshToken` optional
- `userId`

### `POST /v1/zktransfer/requests`

zkTransfer 요청 생성.

Request body:

- `network`
- `tokenType`
- `tokenAddress`
- `tokenId` optional for fungible
- `senderWalletAddress`
- `receiverWalletAddress`
- `amountPublicIn`
- `amountPrivateIn`
- `amountToPublic`
- `amountToPrivate`
- `inputNoteRef` optional
- `clientRequestId`

Server-side responsibility:

- sender custody material resolve
- receiver public key 조회
- merkle root / path 조회
- current note/state 조회
- snark input 생성
- proof 생성 및 검증
- tx 전송

Response body:

- `requestId`
- `status`
- `txHash` optional

### `GET /v1/zktransfer/requests/:requestId`

요청 상태 조회.

Response:

- `requestId`
- `status`
- `txHash`
- `proofStatus`
- `errorCode`
- `errorMessage`

## Status Model

- `received`
- `validating`
- `proving`
- `broadcasting`
- `confirmed`
- `failed`
