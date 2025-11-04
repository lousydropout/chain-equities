# Active Context

## Current Status

**Workspace restructured** - Clean separation into `contracts/`, `frontend/`, and `backend/` directories. New multi-company architecture blueprint defined with Orchestrator and CapTable contracts.

## Recent Work

### Workspace Restructuring ✅
- Monorepo structure established with three workspaces:
  - `contracts/` - Smart contract development (Hardhat)
  - `frontend/` - React + Vite frontend
  - `backend/` - Bun + Fastify backend
- `pnpm-workspace.yaml` and `chain-equity.code-workspace` configured
- Root-level `package.json` with workspace scripts
- Memory bank documentation structure established

### Architecture Blueprint ✅
- New three-layer architecture documented:
  - **Contracts Layer**: ChainEquityToken (✅), CapTable (⏳), Orchestrator (⏳)
  - **Backend Layer**: Fastify API + Event Indexer + Database
  - **Frontend Layer**: React + wagmi + viem for wallet interaction
- Communication patterns defined (HTTP, JSON-RPC, WebSocket)
- File structure templates for each layer

## Implementation Details

### ChainEquityToken Contract ✅
- **Location**: `contracts/contracts/ChainEquityToken.sol`
- **Base**: OpenZeppelin ERC20 + Ownable
- **Features**:
  - Allowlist-based transfer restrictions
  - Issuer-controlled minting
  - Stock split mechanism (virtual split via splitFactor)
  - Symbol change event (for indexer tracking)
  - All required events for cap-table indexing
- **Status**: Complete and tested

### Design Decisions
- **Stock Split**: Option C (virtual split) - uses splitFactor multiplier, indexer handles display
  - Gas efficient for large holder lists
  - No on-chain iteration needed
- **Symbol Change**: Event-based (contract upgrade required for actual change)
- **Transfer Restrictions**: Both sender AND recipient must be approved
- **Multi-Company**: Orchestrator pattern planned for managing multiple companies

## Architecture Summary

### Current State
1. **Smart Contract** (`ChainEquityToken`) - On-chain cap table ✅ COMPLETE
2. **Backend** (Bun + Fastify) - Event indexer + REST API ⏳ TODO
3. **Frontend** (React + wagmi) - Admin & Shareholder dashboards ⏳ TODO

### Planned Enhancements
- **Orchestrator.sol** - Factory contract for creating new companies
- **CapTable.sol** - Per-company cap table management contract
- **Backend Indexer** - Real-time event processing and database sync
- **Contract Exports** - `/contracts/exports/` directory for deployment artifacts
- **Backend API** - REST endpoints for companies, shareholders, transactions
- **Backend Authentication** - ✅ Firebase Auth + Unified Middleware documented (see `authentication.md`)
- **Frontend Wallet Integration** - ✅ Wagmi v2 implementation documented (see `frontendWalletConnector.md`)
- **Frontend UI** - Admin dashboard, shareholder dashboard (to be implemented)

## Next Steps

### Immediate Priorities
1. ⏳ Create `/contracts/exports/` directory structure
2. ⏳ Build Orchestrator.sol for multi-company support
3. ⏳ Build CapTable.sol for per-company management
4. ⏳ Set up backend indexer with viem event watching
5. ⏳ Implement backend REST API endpoints
6. ✅ Backend authentication architecture documented (Firebase Auth + Unified Middleware)
7. ✅ Frontend wallet integration blueprint documented (Wagmi v2 + React Query)
8. ⏳ Implement backend unified auth middleware (`middleware/auth.ts`)
9. ⏳ Implement frontend wallet connector components (`config.ts`, `provider.tsx`, `Connect.tsx`)
10. ⏳ Integrate Firebase Auth in frontend
11. ⏳ Create frontend admin dashboard UI
12. ⏳ Create frontend shareholder dashboard UI

### Future Enhancements
- Backend database schema (SQLite or Postgres)
- Frontend admin dashboard for issuer operations
- Frontend shareholder dashboard for investors
- Integration testing across all layers
- WebSocket support for real-time updates

## Workspace Structure

```
chain-equity/
├── contracts/          ✅ Smart contracts (Hardhat)
├── frontend/           ⏳ React app (Vite)
├── backend/            ⏳ Fastify API (Bun)
├── memory-bank/        ✅ Documentation
├── pnpm-workspace.yaml ✅ Workspace config
└── chain-equity.code-workspace ✅ VS Code workspace
```

See `architecture.md` for complete architecture overview and communication patterns.
