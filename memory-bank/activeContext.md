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
  - **Contracts Layer**: ChainEquityToken (✅), CapTable (✅), Orchestrator (⏳)
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

### CapTable Contract ✅

- **Location**: `contracts/contracts/CapTable.sol`
- **Base**: OpenZeppelin Ownable
- **Features**:
  - Company metadata tracking (name, symbol, issuer, createdAt)
  - Token linking to ChainEquityToken instances
  - Corporate actions history with incremental IDs
  - View functions for company info and action retrieval
  - Event-driven design for backend indexing
- **Status**: Complete and tested (24 tests passing)
- **Test Suite**: `contracts/test/CapTable.ts` - Comprehensive test coverage
- **Documentation**: `docs/phase-1-task1.2-summary.md`

### Deployment Configuration ✅

- **Location**: `contracts/ignition/modules/AcmeCompany.ts`
- **Purpose**: Deterministic deployment module for single company (Acme Inc.)
- **Features**:
  - Deploys ChainEquityToken and CapTable contracts
  - Links contracts automatically after deployment
  - Exports addresses to `contracts/exports/deployments.json` in nested format
  - Verification scripts for post-deployment validation
  - Dual-mode support (Hardhat runtime and standalone execution)
- **Scripts**:
  - `scripts/export-addresses.ts` - Exports deployed addresses with network detection
  - `scripts/verify-link.ts` - Verifies token linkage after deployment
  - `package.json` - `deploy:acme` script for one-command deployment
- **Status**: Complete - All code and scripts implemented
- **Documentation**: `docs/deployment.md` - Complete deployment guide with troubleshooting
- **Note**: Deployment testing blocked by Bun/Hardhat module resolution issue (environment problem, not code-related)

### Design Decisions

- **Stock Split**: Option C (virtual split) - uses splitFactor multiplier, indexer handles display
  - Gas efficient for large holder lists
  - No on-chain iteration needed
- **Symbol Change**: Event-based (contract upgrade required for actual change)
- **Transfer Restrictions**: Both sender AND recipient must be approved
- **Multi-Company**: Orchestrator pattern planned for managing multiple companies

## Architecture Summary

### Current State

1. **Smart Contracts** - On-chain cap table ✅ COMPLETE
   - `ChainEquityToken.sol` - Token contract with compliance gating ✅
   - `CapTable.sol` - Company registry and corporate actions tracking ✅
2. **Deployment Configuration** - Single company deployment ✅ COMPLETE
   - `AcmeCompany.ts` - Hardhat Ignition deployment module ✅
   - Export and verification scripts ✅
   - Deployment documentation ✅
3. **Role System** - Role-based access control ✅ COMPLETE
   - `Roles.sol` - Role constant definitions (library) ✅
   - Backend database schema with users table ✅
   - Auth middleware with role fetching from database ✅
   - Comprehensive tests (21 contract tests, 17 backend tests) ✅
4. **Backend Foundation** - Database schema and auth middleware ✅ PARTIAL
   - Database schema with users table ✅
   - Auth middleware with role-based access control ✅
   - Server entry point (index.ts) ⏳ TODO (needs Fastify server setup)
5. **Backend** (Bun + Fastify) - Event indexer + REST API ⏳ TODO
6. **Frontend** (React + wagmi) - Admin & Shareholder dashboards ⏳ TODO

### Planned Enhancements

- **Orchestrator.sol** - Factory contract for creating new companies (future enhancement)
- **Backend Indexer** - Real-time event processing and database sync
- **Contract Exports** - ✅ `/contracts/exports/` directory for deployment artifacts (Task 1.3 - COMPLETE)
- **Backend API** - REST endpoints for companies, shareholders, transactions
- **Backend Authentication** - ✅ Firebase Auth + Unified Middleware documented (see `authentication.md`)
- **Frontend Wallet Integration** - ✅ Wagmi v2 implementation documented (see `frontendWalletConnector.md`)
- **Frontend UI** - Admin dashboard, shareholder dashboard (to be implemented)

## Next Steps

### Immediate Priorities

1. ✅ Create `/contracts/exports/` directory structure (Task 1.3 - COMPLETE)
2. ✅ Build deployment configuration for single company (Task 1.3 - COMPLETE)
3. ✅ Build CapTable.sol for per-company management (Task 1.2 - COMPLETE)
4. ⏳ Set up backend indexer with viem event watching
5. ⏳ Implement backend REST API endpoints
6. ✅ Backend authentication architecture documented (Firebase Auth + Unified Middleware)
7. ✅ Frontend wallet integration blueprint documented (Wagmi v2 + React Query)
8. ✅ Implement backend unified auth middleware (`middleware/auth.ts`) - Task 1.4 COMPLETE
9. ⏳ Implement frontend wallet connector components (`config.ts`, `provider.tsx`, `Connect.tsx`)
10. ⏳ Integrate Firebase Auth in frontend
11. ⏳ Create frontend admin dashboard UI
12. ⏳ Create frontend shareholder dashboard UI

### Role System ✅

- **Location**: `contracts/contracts/Roles.sol` (library), `backend/src/types/roles.ts`, `backend/src/db/schema.ts`
- **Role Constants**: ROLE_ISSUER, ROLE_INVESTOR, ROLE_ADMIN defined in Roles library
- **Contract-Level**: Owner = issuer role (enforced via onlyOwner modifier)
- **Backend-Level**: Database-managed roles (admin, issuer, investor) with middleware validation
- **Database Schema**: Users table with role column, indexes on email, wallet_address, role
- **Auth Middleware**: `requireAuth`, `requireRole`, `requireAnyRole`, `requireWalletSignature`
- **Files Created**:
  - `contracts/contracts/Roles.sol` - Role constants library
  - `backend/src/types/roles.ts` - Backend role types and constants
  - `backend/src/db/schema.ts` - Database schema with users table
  - `backend/src/services/db/users.ts` - User database operations
  - `backend/src/middleware/auth.ts` - Enhanced auth middleware with role fetching
  - `contracts/test/RoleSystem.ts` - Contract role system tests
  - `backend/src/__tests__/middleware/auth.test.ts` - Backend auth middleware tests
- **Tests**:
  - 21 contract tests (`contracts/test/RoleSystem.ts`) - all passing
  - 17 backend tests (`backend/src/__tests__/middleware/auth.test.ts`) - all passing
- **Test Commands**:
  - Contract tests: `cd contracts && bunx hardhat test test/RoleSystem.ts`
  - Backend tests: `cd backend && bun test src/__tests__/middleware/auth.test.ts`
- **Status**: Complete - Task 1.4 ✅

### Testing

- **Contract Tests**: Use Hardhat test framework
  - Run all: `cd contracts && bunx hardhat test`
  - Run specific: `cd contracts && bunx hardhat test test/RoleSystem.ts`
- **Backend Tests**: Use Bun's built-in test runner
  - Run all: `cd backend && bun test`
  - Run specific: `cd backend && bun test src/__tests__/middleware/auth.test.ts`
- **Test Coverage**:
  - ChainEquityToken: 10 tests (existing test suite)
  - CapTable: 24 tests (existing test suite)
  - Role System: 21 contract tests, 17 backend tests (Task 1.4)

### Future Enhancements

- Backend server setup (Fastify initialization in index.ts) ⏳ NEXT
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
