# zkWallet UX Research: Transfer Screen Simplification

> Date: 2026-03-17
> Branch: docs/ux-improvement-research
> Status: Research Complete, Implementation Planned

---

## 1. Problem Statement

The current zkWallet token transfer screen exposes the internal ZK privacy protocol structure directly to the user, creating significant UX barriers for non-technical users.

### Current Pain Points

| Issue | Description | Severity |
|-------|-------------|----------|
| Dual account model exposed | Users must understand "public account" vs "private account" | High |
| Manual UTXO selection | "Unspent Note" dropdown requires knowledge of UTXO model | High |
| Dual output allocation | Users manually split amounts between public/private outputs | High |
| Change concept | "Remaining balance" (change) shown explicitly | Medium |
| Technical terminology | "ZK fee", "ENA", "Private Notes" | Medium |
| Too many input fields | 5+ amount fields on one screen | High |

### Current Screen Layout (As-Is)

```
┌──────────────────────────────┐
│  Amount to Send               │
│  ├ Public Account:  [___] ETH │  ← User must decide source
│  ├ Private Account: [___] ETH │  ← User must decide source
│  ├ Unspent Note:    [Select▼] │  ← UTXO model exposed
│  └ Total Withdrawals: 0.5 ETH │
│                               │
│  Send to Who                  │
│  ├ Recipient:    [address]    │
│  ├ Public Send:  [___] ETH   │  ← User must decide allocation
│  ├ Private Send: [___] ETH   │  ← User must decide allocation
│  └ Remaining:    0.1 ETH     │  ← Change concept
│                               │
│  Post-Balance Estimate        │
│  └ ZK Fee: 0.001 ETH         │  ← Technical term
│                               │
│       [ Send ]                │
└──────────────────────────────┘
```

---

## 2. Competitive Analysis: ERC-4337 & Smart Account Wallets

### 2.1 Argent (Starknet / ERC-4337)

**Approach**: Mobile banking metaphor

- Single amount input field
- Gas fees abstracted (Argent pays network fees)
- ENS name support for recipient addresses
- Social recovery built-in (guardian-based)
- UI feels identical to mobile banking apps (e.g., KakaoBank)

**Key UX Decisions**:
- No concept of "public vs private" exposed to user
- Contact list integration for recipients
- Activity log resembles bank transaction history

**Reference**: https://www.argent.xyz/

### 2.2 Safe (formerly Gnosis Safe)

**Approach**: Team/institutional asset management

- Batch transactions (multiple sends in one operation)
- Multi-signature approval flow (2/3 signers)
- Contract interaction support for power users
- Clear separation: simple send vs advanced operations

**Key UX Decisions**:
- "Send tokens" is the simplest path (recipient + token + amount)
- "Batch" feature for multiple recipients
- Advanced users can interact with contracts directly

**Reference**: https://safe.global/

### 2.3 Coinbase Wallet / Phantom

**Approach**: Maximum simplicity for retail users

- Fiat-denominated input (enter $50, auto-convert to 0.025 ETH)
- Single screen: recipient + amount = done
- Gas fee shown in fiat ($0.12 instead of 0.0003 ETH)
- "1 screen, 1 action" principle

**Key UX Decisions**:
- Default to fiat input, crypto amount shown as secondary
- Minimal fields per screen
- No advanced options visible by default

**Reference**: https://www.coinbase.com/wallet, https://phantom.app/

### 2.4 ZeroDev / Biconomy (Embedded AA SDKs)

**Approach**: Invisible wallet (embedded in dApps)

- Users don't know they have a wallet
- Session keys for auto-signing after initial approval
- Paymaster covers gas fees
- Batched operations transparent to user

**Key UX Decisions**:
- Wallet is infrastructure, not UI
- Zero friction = zero visibility of blockchain mechanics

---

## 3. Common UX Trends Across AA Wallets

| Trend | Description | Adoption |
|-------|-------------|----------|
| **Input Minimization** | Recipient + amount only | Universal |
| **Gas Abstraction** | Hide or subsidize gas fees | Argent, ZeroDev, Biconomy |
| **Fiat Denomination** | Show amounts in local currency | Coinbase, Phantom |
| **Batch Transactions** | Multiple operations in one UserOp | Safe, ZeroDev |
| **Social Recovery** | No seed phrase required | Argent, zkWallet (zkpasskey) |
| **Progressive Disclosure** | Simple by default, advanced opt-in | Universal best practice |
| **1-Screen-1-Action** | Break complex flows into steps | Coinbase, Phantom |

---

## 4. Proposed Design: Simple Mode + Advanced Mode

### 4.1 Simple Mode (Default)

```
┌──────────────────────────────┐
│  Who do you want to send to?  │
│  [Contact or address search]  │
│                               │
│  How much?                    │
│  ┌──────────┐                 │
│  │ ₩50,000  │  ≈ 0.025 ETH   │  ← Fiat input primary
│  └──────────┘                 │
│  Balance: ₩2,500,000          │
│                               │
│  🔒 Private Transfer    [ON]  │  ← Single toggle
│  ℹ️ Amount and recipient       │
│     are hidden on-chain        │
│                               │
│  Fee: ~₩250                   │
│  (includes privacy protection) │
│                               │
│      [ Send ₩50,000 ]         │
└──────────────────────────────┘
```

**Auto-allocation logic when Private Transfer is ON**:
1. Use private (ENA) balance first
2. If insufficient, supplement from public (EOA) balance
3. Auto-select optimal UTXO notes
4. Change automatically returned to private account
5. Combined fee display (gas + ZK fee)

**Auto-allocation logic when Private Transfer is OFF**:
1. Use public (EOA) balance only
2. Standard ERC-20 transfer (no ZK proof needed)
3. Lower fees (gas only)

### 4.2 Advanced Mode (Enabled in Settings)

```
┌──────────────────────────────┐
│  FROM                         │
│  ├ Public:   [___] ETH        │
│  ├ Private:  [___] ETH        │
│  └ Note:     [Select ▼]       │
│  TO                           │
│  ├ Public:   [___] ETH        │
│  ├ Private:  [___] ETH        │
│  └ Change:   auto             │
│  Gas: 0.0003 ETH              │
│  ZK Fee: 0.001 ETH            │
│       [ Send ]                │
└──────────────────────────────┘
```

This is essentially the current UI, preserved for power users who want fine-grained control over input/output allocation.

### 4.3 Mode Toggle Location

Settings > Transfer Preferences > Advanced Mode [OFF]

---

## 5. Implementation Strategy

### Phase 1: Transfer Auto-Allocation Engine
- New service: `TransferAllocator` that computes optimal input/output split
- Input: total amount, privacy preference (on/off), available balances
- Output: public input, private input, selected notes, output allocation

### Phase 2: Simple Transfer UI Component
- New component: `SimpleTokenTransfer` wrapping existing logic
- Fiat input with real-time crypto conversion
- Privacy toggle controlling allocation strategy
- Single combined fee display

### Phase 3: Settings Integration
- Add "Advanced Mode" toggle to Settings
- Route to either `SimpleTokenTransfer` or existing `TokenTransfer`

### Phase 4: Confirmation & Activity Modals
- Simplify `TransferConfirmModal` for simple mode (hide input/output breakdown)
- Keep `TransferActivityModal` but rename stages:
  - "Initializing" → "Preparing transfer"
  - "Generating ZK proof" → "Securing your privacy"
  - "Submit to network" → "Sending"
  - "Mining" → "Confirming"

---

## 6. Key Design Principles

1. **Default to Simple**: New users see only what they need
2. **Progressive Disclosure**: Complexity available but hidden
3. **Fiat-First**: Local currency as primary denomination
4. **Privacy as Toggle**: One switch, not five input fields
5. **Trust Through Clarity**: Clear confirmation before irreversible actions
6. **Familiar Patterns**: Mimic mobile banking (KakaoBank, Toss) UX

---

## 7. References

- Argent Wallet: https://www.argent.xyz/
- Safe Wallet: https://safe.global/
- Turnkey - 5 Crypto Wallet Design Strategies: https://www.turnkey.com/blog/5-crypto-wallet-design-strategies
- Openfort - EOA vs Smart Wallets 2026: https://www.openfort.io/blog/eoa-vs-smart-wallet
- CoinGecko - Top Hot Wallets 2026: https://www.coingecko.com/learn/top-hot-software-wallets-crypto
- Phantom Wallet: https://phantom.app/
- 101 Blockchains - Account Abstraction: https://101blockchains.com/account-abstraction-in-web3/
