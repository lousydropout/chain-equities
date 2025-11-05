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

- **Location**: `contracts/ignition/modules/AcmeCompany.ts`, `contracts/ignition/modules/CompanyModule.ts`
- **Purpose**: Deterministic deployment modules for single company deployment
- **Features**:
  - `AcmeCompany.ts` - Specific deployment module for Acme Inc.
  - `CompanyModule.ts` - Generic deployment module template (customizable)
  - Deploys ChainEquityToken and CapTable contracts
  - Links contracts automatically after deployment
  - Exports addresses to `contracts/exports/deployments.json` in nested format
  - Comprehensive verification scripts for post-deployment validation
  - Dual-mode support (Hardhat runtime and standalone execution)
- **Network Configuration**:
  - `localhost` network - Connects to Anvil on port 8545
  - `anvil` network - Explicit Anvil network configuration (same as localhost)
- **Scripts**:
  - `scripts/export-addresses.ts` - Exports deployed addresses with network detection
  - `scripts/verify-link.ts` - Basic token linkage verification
  - `scripts/verify-deployment.ts` - Comprehensive deployment verification (new)
  - `package.json` - `deploy:acme` and `deploy:anvil` scripts for one-command deployment
- **Package Management**: 
  - **Important**: Contracts directory uses **npm** (not Bun) due to Hardhat Ignition module resolution compatibility
  - All scripts use `npx` instead of `bunx`
  - Install dependencies with: `npm install --no-workspaces --legacy-peer-deps`
- **Status**: Complete - Task 1.8 ✅
- **Documentation**: `docs/deployment.md` - Complete deployment guide with troubleshooting and npm installation instructions

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
2. **Deployment Configuration** - Single company deployment ✅ COMPLETE (Task 1.8)
   - `AcmeCompany.ts` - Hardhat Ignition deployment module ✅
   - `CompanyModule.ts` - Generic deployment module template ✅
   - Export and verification scripts ✅
   - Comprehensive deployment verification script ✅
   - Anvil network configuration ✅
   - npm/npx usage (Bun incompatible with Hardhat Ignition) ✅
   - Deployment documentation ✅
3. **Role System** - Role-based access control ✅ COMPLETE
   - `Roles.sol` - Role constant definitions (library) ✅
   - Backend database schema with users table ✅
   - Auth middleware with role fetching from database ✅
   - Comprehensive tests (21 contract tests, 17 backend tests) ✅
4. **Event System** - Complete event system with proper indexing ✅ COMPLETE
   - All required events implemented with indexed parameters ✅
   - Event signature documentation (`docs/event-signatures.md`) ✅
   - Comprehensive test suite (17 tests passing) ✅
   - Enhanced SplitExecuted event with indexed oldFactor/newFactor (Task 1.5a) ✅
   - All 137 tests passing including comprehensive test suite (Task 1.7) ✅
5. **Token Replacement Logic** - Design and documentation ✅ COMPLETE
   - Design decision: Keep virtual stock splits (no replacement needed) ✅
   - Off-chain migration workflow designed for symbol changes and upgrades ✅
   - Comprehensive documentation created (`docs/token-replacement.md`) ✅
   - Migration workflow guide (`docs/migration-workflow.md`) with step-by-step instructions ✅
   - Migration helper script template (`scripts/migration-helper.ts`) for Phase 2 ✅
   - CapTable NatSpec enhanced for TOKEN_REPLACED action type ✅
   - Implementation deferred until Phase 2 (as planned) ✅
6. **Comprehensive Test Suite** - Complete test coverage ✅ COMPLETE
   - Enhanced ChainEquityToken tests (35+ tests) covering all functionality ✅
   - Enhanced CapTable tests (35+ tests) including TOKEN_REPLACED scenarios ✅
   - Gas analysis suite for all major operations ✅
   - Integration tests for end-to-end workflows ✅
   - Total: 137 tests passing ✅
7. **Backend Foundation** - Database schema, auth middleware, and server scaffold ✅
   - Database schema with users table ✅
   - Auth middleware with role-based access control ✅
   - Fastify server scaffold with logging, security, and health check ✅ (Task 2.1)
8. **Backend** (Bun + Fastify) - Event indexer + REST API ⏳ IN PROGRESS
   - Server scaffold complete (Task 2.1) ✅
   - Database schema design complete (Task 2.2) ✅
     - 6-table schema: users, shareholders, transactions, corporate_actions, events, meta
     - Contract address configuration system
     - Migration system with version tracking
     - Comprehensive documentation
   - Database setup and migrations complete (Task 2.3) ✅
     - Database connection utility with singleton pattern
     - Atomic migrations with transaction support
     - Seed scripts with separated seed functions
     - Database reset script with production safety checks
     - Server integration with bootstrap guard
     - Type-safe row mapping helpers
     - DEBUG_SQL logging support
   - Viem client configuration complete (Task 2.4) ✅
     - Singleton public and wallet clients
     - WebSocket/HTTP fallback using viem's `fallback` utility
     - Multi-chain support (Hardhat, Sepolia, Mainnet)
     - Exponential backoff retry helper (`withRetry`)
     - Connection testing with friendly error messages
     - Comprehensive test suite (20 tests passing)
     - Manual test script for interactive testing
   - Event indexer implementation complete (Task 2.5) ✅
     - Comprehensive event indexer service with real-time watching and block scanning
     - Centralized contract metadata (addresses + ABIs) in `config/contracts.ts`
     - All 5 event watchers implemented (TokenLinked, Issued, Transfer, SplitExecuted, CorporateActionRecorded)
     - Block scanning with `publicClient.getLogs()` and confirmation blocks for reorg safety
     - Event handler registry for dynamic event dispatch
     - Batch processing for efficient database writes (~100 events per transaction)
     - Shareholder balance updates with splitFactor query and effective balance calculation
     - Complete deduplication using UNIQUE (block_number, log_index) constraint
     - Clean API: `Indexer.start()`, `Indexer.stop()`, `Indexer.rescan()`
     - Server integration with automatic startup and graceful shutdown
     - Comprehensive end-to-end testing verified (7 events indexed, all types working)
     - Test scripts: `generate-test-events.ts`, `verify-indexed-data.ts`, `test-indexer.ts`
     - Complete testing guide: `E2E_TESTING_GUIDE.md`
9. **Frontend** (React + wagmi) - Admin & Shareholder dashboards ⏳ TODO

### Planned Enhancements

- **Orchestrator.sol** - Factory contract for creating new companies (future enhancement)
- **Backend Indexer** - ✅ Real-time event processing and database sync (Task 2.5 - COMPLETE)
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
4. ✅ Design token replacement logic (Task 1.6 - COMPLETE)
5. ✅ Comprehensive test suite (Task 1.7 - COMPLETE)
6. ✅ Contract deployment setup (Task 1.8 - COMPLETE)
7. ✅ Scaffold Fastify server with logging, security, and health check (Task 2.1 - COMPLETE)
8. ✅ Database setup and migrations (Task 2.3 - COMPLETE)
9. ✅ Viem client configuration with WebSocket/HTTP fallback (Task 2.4 - COMPLETE)
10. ✅ Set up backend indexer with viem event watching (Task 2.5 - COMPLETE)
11. ⏳ Implement backend REST API endpoints (Tasks 2.6-2.9)
12. ✅ Backend authentication architecture documented (Firebase Auth + Unified Middleware)
13. ✅ Frontend wallet integration blueprint documented (Wagmi v2 + React Query)
14. ✅ Implement backend unified auth middleware (`middleware/auth.ts`) - Task 1.4 COMPLETE
15. ⏳ Implement frontend wallet connector components (`config.ts`, `provider.tsx`, `Connect.tsx`)
16. ⏳ Integrate Firebase Auth in frontend
17. ⏳ Create frontend admin dashboard UI
18. ⏳ Create frontend shareholder dashboard UI

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

### Event System ✅

- **Location**: `contracts/contracts/ChainEquityToken.sol`, `contracts/contracts/CapTable.sol`, `contracts/docs/event-signatures.md`, `contracts/test/EventSystem.ts`
- **Events Implemented**:
  - `Issued(address indexed to, uint256 amount)` - Token minting events
  - `Transfer(address indexed from, address indexed to, uint256 value)` - Standard ERC20 transfer events
  - `SplitExecuted(uint256 indexed oldFactor, uint256 indexed newFactor, uint256 blockNumber)` - Stock split events with indexed parameters
  - `CapTableCreated(address indexed capTable, string name, string symbol, address indexed issuer)` - Cap table creation events
  - `TokenLinked(address indexed capTable, address indexed token)` - Token linking events
  - `CorporateActionRecorded(uint256 indexed actionId, string indexed actionType, uint256 blockNumber)` - Corporate action tracking
- **Indexed Parameters**: All key filtering parameters are indexed for efficient backend querying
- **Documentation**: Complete event signature documentation with backend integration notes
- **Tests**: Comprehensive test suite (17 tests) verifying all events are emitted correctly with proper indexing
- **Files Created/Modified**:
  - `contracts/docs/event-signatures.md` - Complete event signature documentation
  - `contracts/test/EventSystem.ts` - Comprehensive event system tests
  - `contracts/contracts/ChainEquityToken.sol` - SplitExecuted event enhanced with indexed parameters (Task 1.5a)
- **Test Commands**:
  - Event System tests: `cd contracts && bunx hardhat test test/EventSystem.ts`
  - All tests: `cd contracts && bunx hardhat test` (72 tests passing)
- **Status**: Complete - Task 1.5 and Task 1.5a ✅

### Token Replacement Logic ✅

- **Location**: `contracts/docs/token-replacement.md`, `contracts/docs/migration-workflow.md`, `contracts/contracts/TokenReplacement.md`, `contracts/scripts/migration-helper.ts`, `contracts/contracts/CapTable.sol`
- **Design Decisions**:
  - **Virtual Stock Splits**: Keep virtual splits via `splitFactor` (no replacement needed) - gas-efficient and already implemented
  - **Symbol Changes**: Off-chain migration workflow with on-chain verification
  - **Contract Upgrades**: Off-chain migration workflow with on-chain verification
- **Documentation Created**:
  - `contracts/docs/token-replacement.md` - Comprehensive guide with scenarios, design principles, security considerations
  - `contracts/docs/migration-workflow.md` - Step-by-step migration workflow with 11-step process, verification checklist, and code examples
  - Migration helper script template ready for Phase 2 implementation
- **Files Created/Modified**:
  - `contracts/docs/token-replacement.md` (new) - Complete token replacement guide
  - `contracts/docs/migration-workflow.md` (new) - Detailed migration workflow guide
  - `contracts/contracts/TokenReplacement.md` (modified) - Updated with finalized design and documentation references
  - `contracts/contracts/CapTable.sol` (modified) - Enhanced NatSpec comments for TOKEN_REPLACED action type
  - `contracts/scripts/migration-helper.ts` (new) - Template script for Phase 2 implementation
- **Key Features**:
  - Complete design for token replacement scenarios
  - Off-chain migration workflow with on-chain verification
  - Corporate action recording via CapTable `recordCorporateAction("TOKEN_REPLACED", data)`
  - Comprehensive security considerations and verification steps
  - Integration guidance for Phase 2 backend indexer
- **Implementation Status**: Design complete, implementation deferred until Phase 2 (Backend API + Event Indexer) as planned
- **Status**: Complete - Task 1.6 ✅

### Comprehensive Test Suite ✅

- **Location**: `contracts/test/` - Comprehensive test suite with 137 passing tests
- **Test Files**:
  - `ChainEquityToken.ts` - 35+ tests covering deployment, allowlist, minting, transfers, splits, symbol changes, and edge cases
  - `CapTable.ts` - 35+ tests covering deployment, token linking, corporate actions (including TOKEN_REPLACED), and edge cases
  - `RoleSystem.ts` - 21 tests covering role-based access control
  - `EventSystem.ts` - 17 tests covering all event emissions and indexing
  - `GasAnalysis.ts` - 15+ tests measuring gas costs for all major operations
  - `Integration.ts` - 14+ tests covering end-to-end workflows and multiple shareholder scenarios
- **Test Coverage**:
  - ChainEquityToken: Comprehensive coverage including deployment, allowlist, minting, transfers (restricted/unrestricted), splits, symbol changes, and all edge cases
  - CapTable: Comprehensive coverage including deployment, token linking, corporate actions (SPLIT, SYMBOL_CHANGE, TOKEN_REPLACED), large data handling, encoding/decoding
  - Gas Analysis: Detailed gas cost measurements for deployment, minting, transfers, splits, corporate actions, and full workflows
  - Integration: End-to-end workflow tests, multiple shareholders, complex corporate action sequences, state consistency
- **Test Commands**:
  - Run all: `cd contracts && npx hardhat test`
  - Run specific: `cd contracts && npx hardhat test test/ChainEquityToken.ts`
  - Gas analysis: `cd contracts && npx hardhat test test/GasAnalysis.ts`
- **Coverage Tool**: solidity-coverage plugin installed (note: known conflict with Hardhat v2, but test suite is comprehensive)
- **Files Created/Modified**:
  - `contracts/test/ChainEquityToken.ts` (enhanced) - Added 30+ new test cases
  - `contracts/test/CapTable.ts` (enhanced) - Added 10+ new test cases
  - `contracts/test/GasAnalysis.ts` (new) - Gas cost analysis suite
  - `contracts/test/Integration.ts` (new) - Integration test suite
  - `contracts/hardhat.config.ts` (modified) - Added coverage configuration
  - `contracts/package.json` (modified) - Added coverage script and dependency
- **Status**: Complete - Task 1.7 ✅ (137 tests passing)

### Testing

- **Contract Tests**: Use Hardhat test framework (npm/npx required)
  - Run all: `cd contracts && npx hardhat test` (137 tests passing)
  - Run specific: `cd contracts && npx hardhat test test/ChainEquityToken.ts`
- **Backend Tests**: Use Bun's built-in test runner
  - Run all: `cd backend && bun test` (37 tests passing: 17 auth middleware + 20 client configuration)
  - Run specific: `cd backend && bun test src/__tests__/middleware/auth.test.ts`
  - Client tests: `cd backend && bun test src/services/chain/__tests__/client.test.ts`
  - Manual connection test: `cd backend && bun run test:client`
- **Deployment**: Use npm scripts
  - Deploy: `cd contracts && npm run deploy:acme` or `npm run deploy:anvil`
  - Manual: `cd contracts && npx hardhat ignition deploy ignition/modules/AcmeCompany.ts --network localhost`
- **Test Coverage**:
  - ChainEquityToken: 35+ tests (comprehensive coverage)
  - CapTable: 35+ tests (comprehensive coverage)
  - Role System: 21 contract tests, 17 backend tests (Task 1.4)
  - Event System: 17 tests (Task 1.5)
  - Gas Analysis: 15+ tests (Task 1.7)
  - Integration: 14+ tests (Task 1.7)
  - Total: 137 tests passing (including all comprehensive test suites)

### Database Setup and Migrations ✅

- **Location**: `backend/src/db/`, `backend/scripts/`
- **Database Library**: `bun:sqlite` (built-in Bun SQLite support)
- **Connection Utility**: `backend/src/db/index.ts` with singleton pattern
  - `connect()` - Singleton database connection
  - `query()` / `queryOne()` - Type-safe query helpers
  - `execute()` - Insert/update/delete operations
  - `transaction()` - Atomic transaction wrapper
  - Type-safe row mapping helpers (`asUserRecord`, `asShareholderRecord`, etc.)
  - DEBUG_SQL environment variable for query logging
- **Migrations**: `backend/src/db/migrations.ts` with atomic transactions
  - `up()` - Create all tables (wrapped in transaction)
  - `down()` - Drop all tables (wrapped in transaction)
  - `migrate()` - Version-aware migration runner
  - Schema version tracking in meta table
- **Seed Scripts**: `backend/src/db/seeds/` with separated seed functions
  - `users.ts` - Seed test users (admin, issuer, investor)
  - `shareholders.ts` - Placeholder for shareholder seeding
  - `seed.ts` - Main orchestrator script
- **Scripts**:
  - `db:migrate` - Run migrations
  - `db:seed` - Seed test data
  - `db:reset` - Reset database (dev only, requires --yes flag)
  - `db:setup` - Run migrations + seed in one command
- **Server Integration**: Auto-migration in development mode
  - Bootstrap guard: only auto-migrates when `NODE_ENV=development` or `AUTO_MIGRATE=true`
  - Graceful shutdown closes database connection
- **Files Created/Modified**:
  - `backend/src/db/index.ts` (new) - Connection utility
  - `backend/src/db/migrations.ts` (modified) - Atomic transactions
  - `backend/src/db/seeds/users.ts` (new) - User seed function
  - `backend/src/db/seeds/shareholders.ts` (new) - Shareholder seed placeholder
  - `backend/scripts/migrate.ts` (new) - Migration runner
  - `backend/scripts/seed.ts` (new) - Seed orchestrator
  - `backend/scripts/reset-db.ts` (new) - Reset script
  - `backend/src/index.ts` (modified) - Database initialization
  - `backend/package.json` (modified) - Added db:* scripts
  - `backend/.env.example` (modified) - Added database env vars
  - `backend/.gitignore` (modified) - Added database files
- **Test Commands**:
  - `bun run db:migrate` - Run migrations
  - `bun run db:seed` - Seed data
  - `bun run db:setup` - Complete setup
  - `bun run db:reset` - Reset (dev only)
- **Status**: Complete - Task 2.3 ✅

### Future Enhancements

- Backend database schema design and migrations (Task 2.2) ✅ COMPLETE
- Backend database setup and migrations (Task 2.3) ✅ COMPLETE
- Backend Viem client configuration (Task 2.4) ✅ COMPLETE
- Backend event indexer implementation (Task 2.5) ✅ COMPLETE
- Backend REST API routes (Tasks 2.6-2.9) ⏳ NEXT
- Frontend admin dashboard for issuer operations
- Frontend shareholder dashboard for investors
- Integration testing across all layers
- WebSocket support for real-time updates

## Workspace Structure

```
chain-equity/
├── contracts/          ✅ Smart contracts (Hardhat)
├── frontend/           ⏳ React app (Vite)
├── backend/            ⏳ Fastify API (Bun) - Server scaffold ✅
├── memory-bank/        ✅ Documentation
├── pnpm-workspace.yaml ✅ Workspace config
└── chain-equity.code-workspace ✅ VS Code workspace
```

See `architecture.md` for complete architecture overview and communication patterns.
