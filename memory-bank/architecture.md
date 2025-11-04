# ChainEquity Architecture

## 🏗️ High-Level Architecture — *"ChainEquity"*

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
                    │  REST / GraphQL APIs   │
                    │  Event Indexer (Viem)  │
                    │  DB Cache (e.g. SQLite │
                    │  or Postgres via Prisma)│
                    └────────┬───────────────┘
                               │
                               ▼
                 ┌──────────────────────────┐
                 │   Smart Contracts (L1/L2)│
                 │  ──────────────────────  │
                 │  Orchestrator.sol        │
                 │  CapTable.sol (per co.)  │
                 │  ChainEquityToken.sol   │
                 └──────────────────────────┘
```

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

#### Planned Architecture (Multi-Company)
- **ChainEquityToken.sol** — ERC-20-like share token (✅ COMPLETE)
- **CapTable.sol** — Tracks company metadata and corporate actions (✅ COMPLETE)
- **Orchestrator.sol** — Creates and links new company cap tables (⏳ TODO)

#### Deployment & Exports
- **Hardhat Ignition** handles deployment and artifact export
- **Exports** ABI and deployment JSONs to `/contracts/exports/`

**Output:**
`contracts/exports/deployments.json`
```json
{
  "orchestrator": "0x...",
  "AcmeInc": { "capTable": "0x...", "token": "0x..." }
}
```

#### Key Events
- `Transfer` - Standard ERC20 transfer events
- `Issued` - Token minting events
- `WalletApproved` / `WalletRevoked` - Allowlist changes
- `SplitExecuted` - Corporate action for stock splits
- `SymbolChanged` - Corporate action for symbol updates
- `CompanyCreated` - New company cap table (from Orchestrator)

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
  - Read events from Orchestrator/CapTable contracts
  - Cache results in a lightweight DB for quick queries
  - Real-time event processing via WebSocket RPC

- **API Exposure:**
  - REST/GraphQL APIs (all protected by unified auth middleware):
    - `/api/companies` - List all companies
    - `/api/companies/:id/shareholders` - Cap table for a company
    - `/api/companies/:id/transactions` - Transaction history
    - `/api/companies/:id/corporate-actions` - Splits, symbol changes
    - `/api/companies/:id/snapshot/:block` - Historical cap table
    - `/api/wallet/link` - Link wallet to user account
  - Push updates to frontend via WebSockets or SSE

#### Simplified Indexer Loop
```ts
const client = createPublicClient({ chain: mainnet, transport: http() });

client.watchEvent({
  address: orchestratorAddress,
  event: parseAbiItem("event CompanyCreated(address capTable, string name)"),
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
 │   │   │   ├── indexer.ts
 │   │   │   └── client.ts
 │   │   └── db/           # Database operations
 │   │       └── queries.ts
 │   └── db/
 │       ├── schema.ts     # Database schema (SQLite/Postgres)
 │       └── migrations/
 └── bunfig.toml
```

#### Database Schema (SQLite/Postgres)
- `users` table: uid (PK), email, display_name, wallet_address, role, created_at
- `companies` table: id, name, symbol, orchestrator_address, cap_table_address, token_address
- `holders` table: address, company_id, balance, effective_balance (after split factor)
- `corporate_actions` table: company_id, type, block_number, data (JSON)
- `snapshots` table: company_id, block_number, snapshot_data (JSON)
- `events` table: company_id, event_type, block_number, transaction_hash, data (JSON)

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

- **Company Management:**
  - View all companies
  - Create new companies (via Orchestrator)
  - View company cap tables

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
   - Hardhat → `deployments.json` → copied to backend + frontend
   - Contracts export ABIs to `/contracts/exports/`

#### Event Indexing Flow
2. **Event Indexing:**
   - Backend listens for `Transfer`, `Issued`, `Split`, `CompanyCreated`, etc.
   - Events processed and stored in database
   - Real-time updates via WebSocket subscription

#### API Exposure Flow
3. **API Exposure:**
   - Backend exposes `/company/:symbol/captable` from DB or direct contract read
   - Frontend queries backend for enriched data (metadata, historical snapshots)

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
│   │   ├── CapTable.sol          ⏳
│   │   └── Orchestrator.sol      ⏳
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
6. **Multi-Company Support**: Orchestrator pattern enables multiple companies on one platform

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
1. **Orchestrator.sol** - Multi-company factory contract (Task 1.3)
2. **Backend Indexer** - Event listener and database sync
4. **Backend API** - REST endpoints for frontend
5. **Frontend Admin Dashboard** - Issuer operations UI
6. **Frontend Shareholder Dashboard** - Investor view
7. **Contract Exports** - `/contracts/exports/` directory for deployment artifacts
8. **Integration Testing** - End-to-end workflow testing

---

## 🔮 Optional Future Layers

- **Auth service:** JWT or Firebase for company admin access
- **Notification service:** sends email/SMS on new issuances
- **Graph indexer:** for rich querying (GraphQL/Hasura)
- **Analytics dashboard:** internal tool using backend DB

---

This design keeps everything modular and *state-driven*:
Smart contracts define the canonical state → backend indexes & translates → frontend visualizes.
