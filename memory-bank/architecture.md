# ChainEquity Architecture

## 🏗️ High-Level Architecture — *"ChainEquity"* (Single-Company Model)

```
                      ┌────────────────────────┐
                      │     Frontend (React)   │
                      │  ────────────────────  │
User  ⇄  Browser ⇄──▶ │  Wagmi + Viem Client   │
                      │  UI / WalletConnect    │
                      └────────┬───────────────┘
                               │  HTTP / RPC
                               ▼
                    ┌────────────────────────┐
                    │      Backend (Fastify) │
                    │  ────────────────────  │
                    │  REST APIs             │
                    │  Event Indexer (Viem) │
                    │  DB Cache (SQLite/     │
                    │  Postgres via Prisma)  │
                    └────────┬───────────────┘
                               │
                               │ (hard-coded addresses)
                               ▼
                 ┌──────────────────────────┐
                 │   Smart Contracts (L1/L2)│
                 │  ──────────────────────  │
                 │  CapTable ↔ ChainEquityToken│
                 │  (single deployed pair)   │
                 └──────────────────────────┘
```

**Note:** This architecture assumes exactly one company (e.g., Acme Inc.) with one CapTable and one ChainEquityToken contract. Contract addresses are loaded from `contracts/exports/deployments.json` and hard-coded in backend/frontend configuration.

---

## ⚙️ Layer by Layer

### **1. Contracts Layer (`contracts/`)**

**Purpose:** *Authoritative source of truth for equity data.*

#### Current Implementation
- **ChainEquityToken.sol** — ERC-20-like share token with:
  - Allowlist-gated transfers (KYC/compliance)
  - Issuer-controlled minting
  - Virtual stock splits via `splitFactor`
  - Corporate actions (splits, symbol changes)
  - Transfer restrictions toggle

#### Current Architecture (Single-Company Model)
- **ChainEquityToken.sol** — ERC-20-like share token (✅ COMPLETE)
- **CapTable.sol** — Tracks company metadata and corporate actions (✅ COMPLETE)
- **Single Deployment** — One fixed pair of contracts (CapTable ↔ ChainEquityToken)
- **Hard-Coded Addresses** — Contract addresses loaded from deployment JSON, no dynamic discovery

#### Deployment & Exports
- **Hardhat Ignition** handles deployment and artifact export
- **Exports** ABI and deployment JSONs to `/contracts/exports/`

**Output:**
`contracts/exports/deployments.json`
```json
{
  "capTableAddress": "0x...",
  "tokenAddress": "0x..."
}
```

**Note:** Addresses are loaded once at startup by backend and frontend. No dynamic discovery or multi-tenant logic needed.

#### Key Events
- `Transfer` - Standard ERC20 transfer events
- `Issued` - Token minting events
- `WalletApproved` / `WalletRevoked` - Allowlist changes
- `SplitExecuted` - Corporate action for stock splits
- `SymbolChanged` - Corporate action for symbol updates
- `CapTableCreated` - New cap table deployment
- `TokenLinked` - Token linked to cap table

---

### **2. Backend Layer (`backend/`)**

**Purpose:** *Bridge the blockchain and the app world.*

**Framework:** Fastify (running on Bun)  
**Libraries:** `viem`, `pino` (for logs), `firebase-admin`, `prisma` (optional DB)

#### Authentication & Authorization
- **Firebase Authentication** (email/password) as primary identity layer
- **Unified Auth Middleware** for JWT verification, wallet signatures, and RBAC
- **Wallet linking** for optional blockchain operations
- **Role-based access control** (admin, issuer, investor)

See `authentication.md` for complete authentication architecture and middleware implementation.

#### Responsibilities
- **Event Indexing:**
  - Read events from the single CapTable/Token contract pair (hard-coded addresses)
  - Cache results in a lightweight DB for quick queries
  - Real-time event processing via WebSocket RPC
- **Configuration:**
  - Load contract addresses from `contracts/exports/deployments.json`
  - Store in `backend/src/config/contracts.ts`
  - No dynamic discovery or company registry needed

- **API Exposure:**
  - REST APIs (all protected by unified auth middleware):
    - `GET /api/company` - Get single company info
    - `GET /api/shareholders` - Cap table (single company)
    - `GET /api/shareholders/:address` - Shareholder details
    - `GET /api/transactions` - Transaction history (single company)
    - `GET /api/corporate-actions` - Corporate actions (single company)
    - `GET /api/snapshots/:block` - Historical cap table
    - `POST /api/wallet/link` - Link wallet to user account
  - Push updates to frontend via WebSockets or SSE

#### Viem Client Configuration ✅
```ts
import { getPublicClient, getWalletClient, testConnection } from './services/chain/client';

// Singleton client with WebSocket/HTTP fallback
const client = getPublicClient(); // Supports Hardhat, Sepolia, Mainnet

// Optional wallet client for admin operations
const wallet = getWalletClient(); // Returns null if ADMIN_PRIVATE_KEY not set

// Test connection
await testConnection(); // Verifies RPC connectivity
```

#### Simplified Indexer Loop (to be implemented)
```ts
import { capTableAddress, tokenAddress } from './config/contracts';
import { getPublicClient } from './services/chain/client';

const client = getPublicClient(); // Uses configured singleton client

// Watch events from the single CapTable/Token pair
client.watchEvent({
  address: tokenAddress,
  event: parseAbiItem("event Issued(address indexed to, uint256 amount)"),
  onLogs: (logs) => saveToDb(logs)
});

client.watchEvent({
  address: tokenAddress,
  event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
  onLogs: (logs) => saveToDb(logs)
});
```

#### File Structure
```
backend/
 ├── src/
 │   ├── index.ts          # Bun.serve() entry point
 │   ├── middleware/
 │   │   └── auth.ts        # Unified auth middleware
 │   ├── routes/            # Fastify route handlers
 │   │   ├── companies.ts
 │   │   ├── shareholders.ts
 │   │   ├── transactions.ts
 │   │   └── wallet.ts      # Wallet linking routes
 │   ├── services/
 │   │   ├── firebase.ts    # Firebase Admin setup
 │   │   ├── chain/        # viem client & event listeners
 │   │   │   ├── client.ts  # ✅ Viem client (singleton, WebSocket/HTTP fallback)
 │   │   │   └── indexer.ts # (to be created)
 │   │   └── db/           # Database operations
 │   │       └── queries.ts
 │   └── db/
 │       ├── schema.ts     # Database schema (SQLite/Postgres)
 │       └── migrations/
 └── bunfig.toml
```

#### Database Schema (SQLite/Postgres)
- `users` table: uid (PK), email, display_name, wallet_address, role, created_at
- `shareholders` table: address, balance, effective_balance (after split factor)
- `transactions` table: transaction_hash, from_address, to_address, amount, block_number, timestamp
- `corporate_actions` table: action_id, type, block_number, data (JSON)
- `snapshots` table: block_number, snapshot_data (JSON)
- `events` table: event_type, block_number, transaction_hash, data (JSON)

**Note:** No `companies` table needed. Contract addresses are hard-coded in configuration. Future multi-company support would require a registry table, but for now we assume a single fixed company.

---

### **3. Frontend Layer (`frontend/`)**

**Purpose:** *User portal for companies and investors.*

**Framework:** React + Vite (Bun-native build)  
**Libraries:** `wagmi`, `viem`, `@tanstack/react-query`

#### Wallet Integration Layer
- **Wagmi v2** for wallet connectivity (MetaMask)
- **React Query** for state management and caching
- **Declarative hooks** for contract interactions
- **Auto-connect** for session persistence
- **Multi-chain support** (Hardhat, Astar, etc.)

See `frontendWalletConnector.md` for complete wallet integration implementation.

#### Responsibilities
- **Wallet Connection:**
  - Connect wallet and display holdings via MetaMask
  - Auto-reconnect on page refresh
  - Chain switching for multi-chain support

- **Company Dashboard:**
  - View single company info (from backend API)
  - View cap table (single company)
  - No company selection or creation flows

- **Admin Dashboard:**
  - Approve/revoke wallets (`approveWallet`, `revokeWallet`)
  - Mint shares (`mint`)
  - Trigger corporate actions (`executeSplit`, `changeSymbol`)
  - View event history

- **Shareholder Dashboard:**
  - View holdings (`balanceOf` and `effectiveBalanceOf`)
  - Transfer shares to approved wallets (`transfer`)
  - View historical snapshots via backend API
  - Render cap table charts, issuance history, audit trail

#### Communication
- **Blockchain** via wallet → `wagmi` hooks (`useWriteContract`, `useReadContract`)
- **Backend** via HTTP → Fastify APIs (for enriched data, historical snapshots)
- **Backend Auth** via SIWE (Sign-In With Ethereum) for wallet-as-login

#### File Structure
```
frontend/
 ├── src/
 │   ├── config.ts         # Wagmi config (chains, transports)
 │   ├── provider.tsx      # Web3Provider (Wagmi + React Query)
 │   ├── Connect.tsx        # Wallet connection UI
 │   ├── WalletConnector.tsx # Connector button component (optional)
 │   ├── pages/
 │   │   ├── admin/        # Issuer actions
 │   │   ├── holder/       # Shareholder view
 │   │   └── companies/    # Company listing
 │   ├── components/
 │   │   └── UI/           # Shared UI components
 │   ├── hooks/
 │   │   ├── useChainEquityContract.ts
 │   │   └── useBackend.ts
 │   ├── lib/
 │   │   ├── wallet/       # Wallet-related utilities
 │   │   │   └── hooks.ts  # Custom hooks for contract interactions
 │   │   ├── contracts/    # Contract ABIs (from @chain-equity/contracts)
 │   │   └── api.ts        # Backend API client
 │   └── features/
 │       └── auth/         # Authentication components
 └── bunfig.toml
```

---

### **4. Data Flow**

#### Deployment Flow
1. **Deployments:**
   - Hardhat Ignition → Deploy single CapTable + Token pair (Acme Inc.)
   - Call `capTable.linkToken(tokenAddress)` after deployment
   - Export addresses to `deployments.json`:
     ```json
     { "capTableAddress": "0x...", "tokenAddress": "0x..." }
     ```
   - Backend and frontend load addresses from config (hard-coded)
   - Contracts export ABIs to `/contracts/exports/`

#### Event Indexing Flow
2. **Event Indexing:**
   - Backend loads contract addresses from config (single pair)
   - Backend listens for events from the single CapTable/Token pair:
     - `TokenLinked` (from CapTable)
     - `Transfer`, `Issued`, `SplitExecuted` (from Token)
     - `CorporateActionRecorded` (from CapTable)
   - Events processed and stored in database
   - Real-time updates via WebSocket subscription

#### API Exposure Flow
3. **API Exposure:**
   - Backend exposes routes for single company:
     - `GET /api/company` - Company info
     - `GET /api/shareholders` - Cap table
     - `GET /api/transactions` - Transaction history
     - `GET /api/corporate-actions` - Corporate actions
   - Frontend queries backend for enriched data (metadata, historical snapshots)
   - No company selection or multi-tenant logic

#### User Interaction Flow
4. **User Interaction:**
   - Frontend reads data from backend (read-only queries)
   - User actions trigger signed transactions → contracts
   - Events propagate back through indexer → database → frontend updates

---

### 🧩 Communication Summary

| Direction            | Protocol            | Example                     |
| -------------------- | ------------------- | --------------------------- |
| Frontend → Backend   | HTTPS / REST        | `GET /companies`            |
| Frontend → Contracts | JSON-RPC via wallet | `transfer(address,uint256)` |
| Backend → Contracts  | JSON-RPC via viem   | `getShareholders()`         |
| Backend → DB         | SQL                 | persist events              |
| Backend → Frontend   | WebSocket / SSE     | real-time updates           |

---

### 🧱 Development Layout

```
chain-equity/
├── contracts/
│   ├── contracts/
│   │   ├── ChainEquityToken.sol  ✅
│   │   └── CapTable.sol          ✅
│   ├── ignition/
│   ├── exports/                  ⏳ (to be created)
│   ├── test/
│   └── hardhat.config.ts
│
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/               ⏳
│   │   ├── services/
│   │   │   ├── chain/            ⏳
│   │   │   └── db/               ⏳
│   │   └── db/                   ⏳
│   └── bunfig.toml
│
├── frontend/
│   ├── src/
│   │   ├── pages/                ⏳
│   │   ├── components/           ⏳
│   │   ├── hooks/                ⏳
│   │   └── lib/
│   │       └── contracts/        ⏳
│   └── bunfig.toml
│
├── memory-bank/                   ✅
├── bunfig.toml                    ✅
├── pnpm-workspace.yaml            ✅
└── chain-equity.code-workspace    ✅
```

---

## Key Design Principles

1. **Single Source of Truth**: Smart contracts are the authoritative cap table
2. **Event-Driven**: Backend reacts to on-chain events, not polling
3. **Read-Optimized Backend**: Backend serves read-only data, all writes go through contracts
4. **Separation of Concerns**: 
   - Contracts = state & business logic
   - Backend = indexing & query optimization
   - Frontend = user interface & wallet interaction
5. **Real-Time Updates**: WebSocket subscription ensures low-latency event processing
6. **Single-Company Model**: One fixed CapTable/Token pair with hard-coded addresses. Future multi-company support would require a registry table and dynamic discovery, but is out of scope for MVP.

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Smart Contract | Solidity + Hardhat | On-chain cap table |
| Backend | Bun + Fastify + viem + SQLite/Postgres | Event indexer + REST API |
| Frontend | React + Vite + wagmi + viem | Admin & shareholder UI |

---

## Implementation Status

### ✅ Complete
1. **ChainEquityToken.sol** - Core token contract with compliance gating
2. **CapTable.sol** - Company registry and corporate actions tracking
3. **Test Suites** - Comprehensive test coverage (ChainEquityToken: 10 tests, CapTable: 24 tests)
4. **Deployment Module** - Hardhat Ignition deployment
5. **Workspace Structure** - Monorepo with contracts, frontend, backend
6. **Memory Bank** - Documentation and architecture docs

### ⏳ In Progress / Planned
1. **Deployment Workflow** - Hardhat Ignition module for single Acme Inc. deployment (Task 1.3)
2. **Backend Indexer** - Event listener for single CapTable/Token pair (hard-coded addresses)
3. **Backend API** - REST endpoints for single company (no multi-tenant logic)
4. **Frontend Dashboard** - Single company view (no company selection)
5. **Contract Exports** - `/contracts/exports/` directory for deployment artifacts
6. **Integration Testing** - End-to-end workflow testing for single company

---

## 🔮 Optional Future Layers

- **Auth service:** JWT or Firebase for company admin access
- **Notification service:** sends email/SMS on new issuances
- **Graph indexer:** for rich querying (GraphQL/Hasura)
- **Analytics dashboard:** internal tool using backend DB

---

This design keeps everything modular and *state-driven*:
Smart contracts define the canonical state → backend indexes & translates → frontend visualizes.
