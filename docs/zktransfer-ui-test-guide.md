# zkTransfer UI Test Guide

## Web UI

1. Start the custody server.
   `cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app`
   `node src/index.js`

2. Start the web client.
   `cd /Users/hyunokoh/Documents/zkWallet/zktransfer-client-app`
   `node src/server.js`

3. Open `http://127.0.0.1:4020`

## Mobile App

1. Start the custody server.
   `cd /Users/hyunokoh/Documents/zkWallet/zktransfer-server-app`
   `node src/index.js`

2. Install dependencies and run Expo.
   `cd /Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app`
   `npm install`
   `npm start`

3. Open the simulator or Expo Go and connect to the app.

## Demo Flow

1. Click `체험 시작`
2. Open the `송금` tab
3. Fill `받는 사람`, `받는 지갑 주소`, `자산`, `송금 방식`, `보낼 수량`
4. Click `송금 요청 보내기`
5. Wait until the status card changes to `완료`

## What Happens

- The browser sends a transfer request to the custody server
- The server builds request-specific circuit input with `zk-wallet-circuits`
- The server generates a real proof with `zk-wallet-circuits`
- The server verifies the proof
- The server writes the transfer into the local chain explorer

## How To Verify zkTransfer

### In the UI

- `내역`: request status and transfer mode
- `영수증`: local chain receipts and proof status
- `홈`: latest transfer summary
- `홈`: portfolio, recent recipients, latest transfer summary

### In the API

- `GET http://127.0.0.1:4010/health`
- `GET http://127.0.0.1:4010/v1/me/summary`
- `GET http://127.0.0.1:4010/v1/local-chain/transactions`

## Notes

- Current proof generation uses the server-side demo input builder plus proving path with `fresh setup`
- Local blockchain submission is still a local chain simulator
- The mobile app now uses the same live API flow as the web client:
  `/Users/hyunokoh/Documents/zkWallet/zktransfer-client-app/mobile-app`
