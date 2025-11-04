# ChainEquity Architecture

## Overview

A minimal, fully on-chain cap-table management system for a single company, built around a compliance-gated ERC-20-like smart contract that tracks share ownership and corporate actions.

## Three-Layer Architecture

### 1. Smart Contract Layer

**Contract:** `ChainEquityToken`  
**Language:** Solidity  
**Framework:** Hardhat

#### Responsibilities
- Acts as the **on-chain cap table** for one company
- ERC-20 compatible with additional logic:
  - **Allowlist-gated transfers** (KYC / compliance)
  - **Issuance / minting** by the issuer only
  - **Virtual splits** via `splitFactor` (no gas-heavy migrations)
  - **Symbol / ticker changes**
  - **Freeze** capability for symbolic upgrades
- Emits events (`Transfer`, `Issued`, `StockSplit`, `SymbolChanged`) that drive the off-chain indexer

#### Key Events
- `Transfer` - Standard ERC20 transfer events
- `Issued` - Token minting events
- `WalletApproved` / `WalletRevoked` - Allowlist changes
- `SplitExecuted` - Corporate action for stock splits
- `SymbolChanged` - Corporate action for symbol updates

---

### 2. Backend Layer

**Runtime:** Bun  
**DB:** Bun's native SQLite  
**Purpose:** Stateful **indexer + API server**

#### Responsibilities
- **Listen** to contract events in real time using `viem` / WebSocket RPC
- **Store** ownership records and corporate actions in SQLite
- **Serve** REST endpoints for the frontend (read-only data):
  - `GET /holders` → all holders + balances + % ownership
  - `GET /holder/:address` → single holder details
  - `GET /corporate-actions` → splits, symbol changes, freezes
  - `GET /snapshot/:block` → cap-table as-of-block
- Runs as one long-lived Bun process (`Bun.serve()` + event listener)
- Later Dockerized for deployment

#### File Structure
```
backend/
 ├── src/
 │   ├── api.ts        # Bun.serve() HTTP routes
 │   ├── indexer.ts    # listens to blockchain events
 │   ├── db.ts         # SQLite schema + helpers
 │   ├── config.ts     # RPC URLs, env vars
 │   └── contracts/
 │       └── ChainEquity.json
```

#### Database Schema (SQLite)
- `holders` table: address, balance, effective_balance (after split factor)
- `corporate_actions` table: type, block_number, data (JSON)
- `snapshots` table: block_number, snapshot_data (JSON)
- `events` table: event_type, block_number, transaction_hash, data (JSON)

---

### 3. Frontend Layer

**Framework:** React + TypeScript (Next.js optional)  
**Libraries:**
- **wagmi** + **viem** → wallet + contract interaction
- **@tanstack/react-query** → async state
- **tailwindcss** + **shadcn/ui** → styling / components

#### Responsibilities
- **Connect wallets** (MetaMask only, via Wagmi)
- **Admin dashboard:**
  - approve/revoke wallets
  - mint shares
  - trigger corporate actions (split, symbol change, freeze)
- **Shareholder dashboard:**
  - view holdings (`balanceOf`)
  - transfer shares to approved wallets
  - view historical snapshots via backend API

#### File Structure
```
frontend/
 ├── src/
 │   ├── app/
 │   │   ├── admin/        # issuer actions
 │   │   ├── holder/        # shareholder view
 │   │   ├── components/    # Connect, WalletConnector, UI
 │   │   └── provider/     # Wagmi + QueryClient wrappers
 │   ├── abi/ChainEquity.json
 │   └── lib/useChainEquityContract.ts
```

---

## Data Flow

```
MetaMask ↔ wagmi hooks ↔ Smart Contract (read/write)
                         ↓ emits events
                   Backend Indexer (Bun + SQLite)
                         ↑ REST API
                     Frontend (React Dashboard)
```

### Event Flow
1. User action in frontend (e.g., mint tokens)
2. Transaction sent via wagmi → contract
3. Contract emits event (e.g., `Issued`)
4. Backend indexer catches event via WebSocket
5. Indexer updates SQLite database
6. Frontend queries backend API → displays updated state

---

## Lifecycle Example: Acme Inc.

1. **Issuer deploys contract** → new company cap table on-chain
2. **Backend indexer** detects deployment, starts listening
3. **Issuer connects wallet in frontend** → approves wallets, mints shares
4. **Events** update SQLite DB → frontend dashboard reflects real-time cap-table state
5. **Shareholders** connect wallets → view balances, transfer to approved addresses
6. **Issuer** triggers split / symbol change / freeze → events propagate through indexer → frontend updates

---

## Key Design Principles

1. **Single Source of Truth**: Smart contract is the authoritative cap table
2. **Event-Driven**: Backend reacts to on-chain events, not polling
3. **Read-Optimized Backend**: Backend serves read-only data, all writes go through contract
4. **Separation of Concerns**: 
   - Contract = state & business logic
   - Backend = indexing & query optimization
   - Frontend = user interface & wallet interaction
5. **Real-Time Updates**: WebSocket subscription ensures low-latency event processing

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Smart Contract | Solidity + Hardhat | On-chain cap table |
| Backend | Bun + SQLite + viem | Event indexer + REST API |
| Frontend | React + wagmi + viem | Admin & shareholder UI |

---

## Next Implementation Steps

1. ✅ Smart Contract (`ChainEquityToken`) - **COMPLETE**
2. ⏳ Backend Indexer (Bun + SQLite)
3. ⏳ Backend API (REST endpoints)
4. ⏳ Frontend Admin Dashboard
5. ⏳ Frontend Shareholder Dashboard
6. ⏳ Integration Testing

