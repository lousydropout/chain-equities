# ChainEquity Implementation Task List

## Overview

This document provides a detailed breakdown of all implementation tasks organized by phase. Each task includes specific deliverables, dependencies, and acceptance criteria.

---

## 🚀 Phase 1 — Contracts Foundation

**Goal:** Lock down the blockchain truth layer.

**Duration:** ~2 weeks

**Status:** ⏳ In Progress (Task 1.2 complete)

### Task 1.1: Finalize ChainEquityToken Contract

- [ ] Review and refine existing `ChainEquityToken.sol`
- [ ] Ensure all required features are implemented:
  - [ ] Allowlist-based transfer restrictions
  - [ ] Issuer-controlled minting
  - [ ] Virtual stock splits via `splitFactor`
  - [ ] Symbol change events
  - [ ] Transfer restriction toggle
- [ ] Add comprehensive NatSpec documentation
- [ ] Verify OpenZeppelin v5 compatibility
- **Deliverable:** Production-ready `ChainEquityToken.sol`

### Task 1.2: Design and Implement CapTable Contract ✅

- [x] Design CapTable contract structure
  - [x] Track company metadata (name, symbol, issuer)
  - [x] Link to ChainEquityToken instance
  - [x] Store corporate actions history
  - [x] Manage shareholder registry
- [x] Implement CapTable.sol with:
  - [x] Constructor for initialization (replaces `createCapTable()`)
  - [x] `linkToken()` function
  - [x] `recordCorporateAction()` function
  - [x] Events: `CapTableCreated`, `TokenLinked`, `CorporateActionRecorded`
- [x] Write unit tests (24 tests, all passing)
- **Deliverable:** `contracts/contracts/CapTable.sol` with tests ✅
- **Status:** Complete - Contract deployed, tested, and documented
- **Summary:** See `docs/phase-1-task1.2-summary.md`

### Task 1.3: Design and Implement Orchestrator Contract

- [ ] Design Orchestrator factory pattern
  - [ ] Create new company cap tables
  - [ ] Deploy ChainEquityToken instances
  - [ ] Link CapTable to Token
  - [ ] Track all companies
- [ ] Implement Orchestrator.sol with:
  - [ ] `createCompany()` function
  - [ ] `getCompany()` view function
  - [ ] Events: `CompanyCreated(address capTable, address token, string name)`
- [ ] Write unit tests
- **Deliverable:** `contracts/contracts/Orchestrator.sol` with tests

### Task 1.4: Implement Role System

- [ ] Define role constants:
  - [ ] `ROLE_ISSUER` - Can mint and approve wallets
  - [ ] `ROLE_INVESTOR` - Can hold and transfer tokens
  - [ ] `ROLE_ADMIN` - Can manage system-wide settings
- [ ] Add role management to Orchestrator:
  - [ ] `assignRole()` function
  - [ ] `revokeRole()` function
  - [ ] `hasRole()` view function
- [ ] Add role checks to ChainEquityToken functions
- [ ] Write tests for role-based access control
- **Deliverable:** Role system integrated across contracts

### Task 1.5: Implement Event System

- [ ] Ensure all required events are emitted:
  - [ ] `Issued(address indexed to, uint256 amount)`
  - [ ] `Transferred(address indexed from, address indexed to, uint256 value)`
  - [ ] `SplitExecuted(uint256 oldFactor, uint256 newFactor, uint256 blockNumber)`
  - [ ] `CapTableCreated(address indexed capTable, string name)`
  - [ ] `CompanyCreated(address indexed capTable, address indexed token, string name)`
- [ ] Add indexed parameters for efficient filtering
- [ ] Verify event signatures match backend expectations
- **Deliverable:** Complete event system with proper indexing

### Task 1.6: Token Replacement Logic

- [ ] Design token replacement strategy for:
  - [ ] Symbol changes (deploy new token, migrate balances)
  - [ ] Stock splits (virtual split already implemented)
  - [ ] Contract upgrades
- [ ] Implement migration functions if needed
- [ ] Document replacement workflow
- **Deliverable:** Token replacement logic (or decision to keep virtual splits)

### Task 1.7: Comprehensive Test Suite

- [ ] Write Hardhat tests for ChainEquityToken:
  - [ ] Deployment tests
  - [ ] Minting tests
  - [ ] Transfer restriction tests
  - [ ] Stock split tests
  - [ ] Role-based access tests
  - [ ] Edge cases and error handling
- [ ] Write Hardhat tests for CapTable:
  - [ ] Creation tests
  - [ ] Token linking tests
  - [ ] Corporate action recording tests
- [ ] Write Hardhat tests for Orchestrator:
  - [ ] Company creation tests
  - [ ] Multi-company scenarios
  - [ ] Role assignment tests
- [ ] Achieve 90%+ code coverage
- [ ] Run gas optimization analysis
- **Deliverable:** Test suite with 90%+ coverage

### Task 1.8: Contract Deployment Setup

- [ ] Configure Hardhat Ignition deployment modules:
  - [ ] `OrchestratorModule.ts`
  - [ ] `CompanyModule.ts` (for test deployments)
- [ ] Set up deployment scripts for:
  - [ ] Local Anvil network
  - [ ] Testnet (Sepolia/Goerli)
  - [ ] Mainnet (when ready)
- [ ] Create deployment verification script
- **Deliverable:** Deployment scripts ready

### Task 1.9: Export ABIs and Deployment Artifacts

- [ ] Create `contracts/exports/` directory structure
- [ ] Set up build script to export:
  - [ ] ABIs for all contracts
  - [ ] Deployment addresses JSON
  - [ ] Contract artifacts
- [ ] Generate `deployments.json` format:
  ```json
  {
    "orchestrator": "0x...",
    "networks": {
      "31337": {
        "AcmeInc": {
          "capTable": "0x...",
          "token": "0x..."
        }
      }
    }
  }
  ```
- [ ] Add npm script: `bun run export`
- [ ] Document export format for backend/frontend consumption
- **Deliverable:** `contracts/exports/` with ABIs and deployment JSONs

### Phase 1 Acceptance Criteria

- ✅ All contracts compile without errors
- ✅ Test coverage ≥ 90%
- ✅ All contracts deployed to local network
- ✅ ABIs and deployment JSONs exported
- ✅ Contracts reviewed and documented

---

## 🧩 Phase 2 — Backend API + Event Indexer

**Goal:** Translate blockchain state into a REST / GraphQL API.

**Duration:** ~2 weeks

**Status:** ⏳ Pending

**Dependencies:** Phase 1 complete

### Task 2.1: Scaffold Fastify Server

- [ ] Initialize Fastify project structure
- [ ] Set up Bun runtime configuration
- [ ] Install dependencies:
  - [ ] `fastify`
  - [ ] `viem`
  - [ ] `pino` (logging)
  - [ ] `@fastify/cors`
  - [ ] `@fastify/helmet` (security)
- [ ] Create `backend/src/index.ts` entry point
- [ ] Set up basic server with `/ping` health check
- [ ] Configure port (default: 4000)
- [ ] Add environment variable support
- **Deliverable:** Running Fastify server on :4000

### Task 2.2: Database Schema Design

- [ ] Design SQLite schema (Postgres-compatible):
  - [ ] `users` table
  - [ ] `companies` table
  - [ ] `tokens` table
  - [ ] `shareholders` table
  - [ ] `transactions` table
  - [ ] `corporate_actions` table
  - [ ] `events` table
- [ ] Create migration system
- [ ] Write schema file: `backend/src/db/schema.ts`
- [ ] Add indexes for common queries
- [ ] Document relationships and constraints
- **Deliverable:** Database schema ready for migration

### Task 2.3: Database Setup and Migrations

- [ ] Choose database library (SQLite with `bun:sqlite` or Prisma)
- [ ] Create initial migration
- [ ] Set up database connection pool
- [ ] Create database utility functions:
  - [ ] `db.connect()`
  - [ ] `db.query()`
  - [ ] `db.transaction()`
- [ ] Write seed script for test data
- [ ] Add database reset script for development
- **Deliverable:** Database setup with migrations

### Task 2.4: Viem Client Configuration

- [ ] Create `backend/src/services/chain/client.ts`
- [ ] Configure Viem public client:
  - [ ] Local network (Anvil)
  - [ ] Testnet support
  - [ ] WebSocket transport for event listening
- [ ] Add chain configuration
- [ ] Create wallet client for admin operations
- [ ] Add error handling and retry logic
- [ ] Test connection to local/remote nodes
- **Deliverable:** Viem client configured and tested

### Task 2.5: Event Indexer Implementation

- [ ] Create `backend/src/services/chain/indexer.ts`
- [ ] Implement event watcher:
  - [ ] `watchCompanyCreated()` - Orchestrator events
  - [ ] `watchIssued()` - Token minting events
  - [ ] `watchTransferred()` - Transfer events
  - [ ] `watchSplitExecuted()` - Stock split events
- [ ] Add block scanning for missed events:
  - [ ] `scanBlockRange()` function
  - [ ] `getLastIndexedBlock()` function
  - [ ] Handle reorgs
- [ ] Implement event parsing and storage:
  - [ ] Parse event logs
  - [ ] Store in database
  - [ ] Update shareholder balances
  - [ ] Record transactions
- [ ] Add deduplication logic
- [ ] Add error handling and logging
- **Deliverable:** Event indexer processing on-chain events

### Task 2.6: REST API Routes - Companies

- [ ] Create `backend/src/routes/companies.ts`
- [ ] Implement endpoints:
  - [ ] `GET /api/companies` - List all companies
  - [ ] `GET /api/companies/:id` - Get company details
  - [ ] `GET /api/companies/:id/metadata` - Get company metadata
- [ ] Add query parameters (pagination, filtering)
- [ ] Add error handling
- [ ] Write route tests
- **Deliverable:** Companies API endpoints

### Task 2.7: REST API Routes - Shareholders

- [ ] Create `backend/src/routes/shareholders.ts`
- [ ] Implement endpoints:
  - [ ] `GET /api/companies/:id/shareholders` - Get cap table
  - [ ] `GET /api/companies/:id/shareholders/:address` - Get shareholder details
  - [ ] `GET /api/shareholders/:address/companies` - Get holdings across companies
- [ ] Add pagination support
- [ ] Calculate ownership percentages
- [ ] Include effective balances (after split factor)
- [ ] Add error handling
- [ ] Write route tests
- **Deliverable:** Shareholders API endpoints

### Task 2.8: REST API Routes - Transactions

- [ ] Create `backend/src/routes/transactions.ts`
- [ ] Implement endpoints:
  - [ ] `GET /api/companies/:id/transactions` - Get transaction history
  - [ ] `GET /api/transactions/:txHash` - Get transaction details
- [ ] Add filtering (by type, date, address)
- [ ] Add pagination
- [ ] Include transaction metadata
- [ ] Add error handling
- [ ] Write route tests
- **Deliverable:** Transactions API endpoints

### Task 2.9: REST API Routes - Corporate Actions

- [ ] Create `backend/src/routes/corporate-actions.ts`
- [ ] Implement endpoints:
  - [ ] `GET /api/companies/:id/corporate-actions` - Get corporate actions
  - [ ] `GET /api/companies/:id/snapshots/:block` - Get historical cap table
- [ ] Add filtering and pagination
- [ ] Include split history
- [ ] Add error handling
- [ ] Write route tests
- **Deliverable:** Corporate actions API endpoints

### Task 2.10: Background Rescan Service

- [ ] Create `backend/src/services/chain/rescan.ts`
- [ ] Implement rescan logic:
  - [ ] Check for missed blocks
  - [ ] Scan block range
  - [ ] Process missed events
  - [ ] Update database
- [ ] Add cron job or interval-based execution
- [ ] Add logging and monitoring
- [ ] Handle errors gracefully
- **Deliverable:** Background rescan service

### Task 2.11: API Documentation

- [ ] Set up Swagger/OpenAPI documentation
- [ ] Document all endpoints:
  - [ ] Request/response schemas
  - [ ] Query parameters
  - [ ] Error responses
  - [ ] Authentication requirements
- [ ] Add example requests/responses
- [ ] Generate interactive API docs
- [ ] Add to README
- **Deliverable:** Complete API documentation

### Task 2.12: Integration Testing

- [ ] Set up integration test environment
- [ ] Test full flow:
  - [ ] Deploy contracts
  - [ ] Index events
  - [ ] Query API endpoints
  - [ ] Verify data consistency
- [ ] Test rescan functionality
- [ ] Test error scenarios
- **Deliverable:** Integration tests passing

### Phase 2 Acceptance Criteria

- ✅ Backend server running on :4000
- ✅ All REST endpoints implemented
- ✅ Event indexer processing on-chain events
- ✅ Database storing indexed data
- ✅ API documentation complete
- ✅ Integration tests passing

---

## 🔐 Phase 3 — Authentication & Access Control

**Goal:** Secure the backend with Firebase and optional wallet linking.

**Duration:** ~1.5 weeks

**Status:** ⏳ Pending

**Dependencies:** Phase 2 complete

### Task 3.1: Firebase Admin Setup

- [ ] Install `firebase-admin` package
- [ ] Create `backend/src/services/firebase.ts`
- [ ] Configure Firebase Admin SDK:
  - [ ] Load service account credentials
  - [ ] Initialize app
  - [ ] Export auth instance
- [ ] Set up environment variables:
  - [ ] `FIREBASE_PROJECT_ID`
  - [ ] `FIREBASE_CLIENT_EMAIL`
  - [ ] `FIREBASE_PRIVATE_KEY`
- [ ] Test Firebase Admin connection
- **Deliverable:** Firebase Admin configured

### Task 3.2: Unified Auth Middleware

- [ ] Create `backend/src/middleware/auth.ts`
- [ ] Implement `requireAuth()` middleware:
  - [ ] Extract JWT from Authorization header
  - [ ] Verify token with Firebase Admin
  - [ ] Attach user context to request
  - [ ] Handle errors gracefully
- [ ] Implement `requireWalletSignature()` middleware:
  - [ ] Verify signed message
  - [ ] Check wallet linkage
  - [ ] Validate signature
- [ ] Implement `requireRole()` helper:
  - [ ] Check user role
  - [ ] Return 403 if unauthorized
- [ ] Implement `requireAnyRole()` helper
- [ ] Add TypeScript types for `AuthContext`
- [ ] Write middleware tests
- **Deliverable:** Unified auth middleware complete

### Task 3.3: User Database Schema

- [ ] Extend database schema:
  - [ ] Add `users` table (if not exists)
  - [ ] Add `wallet_address` column
  - [ ] Add `role` column
  - [ ] Add indexes
- [ ] Create user model/utilities:
  - [ ] `createUser()`
  - [ ] `getUserByUid()`
  - [ ] `updateUser()`
  - [ ] `linkWallet()`
- [ ] Write database migration
- **Deliverable:** User database schema ready

### Task 3.4: Wallet Linking Endpoint

- [ ] Create `backend/src/routes/wallet.ts`
- [ ] Implement `POST /api/wallet/link`:
  - [ ] Verify Firebase JWT
  - [ ] Extract message and signature
  - [ ] Verify signature with viem
  - [ ] Store wallet address in database
  - [ ] Return success response
- [ ] Implement `POST /api/wallet/unlink`:
  - [ ] Verify Firebase JWT
  - [ ] Remove wallet address
  - [ ] Return success response
- [ ] Add error handling
- [ ] Write route tests
- **Deliverable:** Wallet linking endpoints

### Task 3.5: Role-Based Access Control

- [ ] Apply RBAC to all routes:
  - [ ] Admin routes (company creation, system settings)
  - [ ] Issuer routes (mint, approve wallets)
  - [ ] Investor routes (view holdings, transfer)
- [ ] Update route handlers to use middleware:
  - [ ] `requireAuth` on all protected routes
  - [ ] `requireRole()` where needed
  - [ ] `requireWalletSignature()` for sensitive operations
- [ ] Test role-based access
- [ ] Document role requirements
- **Deliverable:** RBAC enforced across API

### Task 3.6: User Management Endpoints

- [ ] Create `backend/src/routes/users.ts`
- [ ] Implement endpoints:
  - [ ] `GET /api/users/me` - Get current user
  - [ ] `PUT /api/users/me` - Update user profile
  - [ ] `GET /api/users/:id` - Get user (admin only)
- [ ] Add validation
- [ ] Add error handling
- [ ] Write route tests
- **Deliverable:** User management endpoints

### Task 3.7: Seed Admin/Issuer Roles

- [ ] Create seed script:
  - [ ] Create admin user
  - [ ] Create issuer users
  - [ ] Assign roles
  - [ ] Create test companies
- [ ] Add to development setup
- [ ] Document seed data
- **Deliverable:** Seed script for testing

### Task 3.8: Authentication Tests

- [ ] Write tests for:
  - [ ] JWT verification
  - [ ] Wallet signature verification
  - [ ] Role-based access
  - [ ] Wallet linking
  - [ ] Error scenarios
- [ ] Test middleware composition
- [ ] Test unauthorized access
- **Deliverable:** Comprehensive auth tests

### Phase 3 Acceptance Criteria

- ✅ Firebase Admin integrated
- ✅ Unified auth middleware working
- ✅ All routes protected with authentication
- ✅ Role-based access control enforced
- ✅ Wallet linking functional
- ✅ Seed data for testing

---

## 🌐 Phase 4 — Frontend MVP

**Goal:** End-to-end usable interface.

**Duration:** ~3 weeks

**Status:** ⏳ Pending

**Dependencies:** Phase 3 complete

### Task 4.1: Project Scaffolding

- [ ] Set up React + Vite project structure
- [ ] Install dependencies:
  - [ ] `react`, `react-dom`
  - [ ] `wagmi`, `viem`
  - [ ] `@tanstack/react-query`
  - [ ] `firebase` (auth)
  - [ ] `@tanstack/react-router` or `react-router-dom`
- [ ] Configure TypeScript
- [ ] Set up ESLint and Prettier
- [ ] Configure build scripts
- **Deliverable:** Frontend project scaffolded

### Task 4.2: Firebase Auth Setup (Frontend)

- [ ] Install Firebase SDK
- [ ] Create `frontend/src/config/firebase.ts`
- [ ] Initialize Firebase app
- [ ] Set up Firebase Auth
- [ ] Configure environment variables
- [ ] Create auth context/hook
- **Deliverable:** Firebase Auth configured

### Task 4.3: Wagmi Configuration

- [ ] Create `frontend/src/config/wagmi.ts`
- [ ] Configure Wagmi with chains (Hardhat, testnet)
- [ ] Set up transports
- [ ] Enable auto-connect
- [ ] Create `frontend/src/provider.tsx`:
  - [ ] Wrap app with WagmiProvider
  - [ ] Wrap with QueryClientProvider
- [ ] Test wallet connection
- **Deliverable:** Wagmi configured and working

### Task 4.4: Wallet Connection UI

- [ ] Create `frontend/src/components/Connect.tsx`
- [ ] Implement MetaMask connection:
  - [ ] Connect button
  - [ ] Disconnect button
  - [ ] Display connected address
  - [ ] Show connection status
- [ ] Create `frontend/src/components/WalletConnector.tsx` (optional)
- [ ] Add to main layout
- [ ] Style components
- **Deliverable:** Wallet connection UI

### Task 4.5: Login/Register Pages

- [ ] Create `frontend/src/pages/Login.tsx`
- [ ] Create `frontend/src/pages/Register.tsx`
- [ ] Implement Firebase Auth:
  - [ ] Email/password login
  - [ ] Registration
  - [ ] Error handling
  - [ ] Loading states
- [ ] Add form validation
- [ ] Style pages
- [ ] Add routing
- **Deliverable:** Authentication pages

### Task 4.6: Protected Route Wrapper

- [ ] Create `frontend/src/components/ProtectedRoute.tsx`
- [ ] Check Firebase Auth status
- [ ] Redirect to login if not authenticated
- [ ] Show loading state
- [ ] Apply to protected routes
- **Deliverable:** Route protection

### Task 4.7: API Client Setup

- [ ] Create `frontend/src/lib/api.ts`
- [ ] Implement API client:
  - [ ] Base URL configuration
  - [ ] JWT token attachment
  - [ ] Error handling
  - [ ] Request/response interceptors
- [ ] Create typed API functions
- [ ] Add React Query hooks
- **Deliverable:** API client ready

### Task 4.8: Company List Page

- [ ] Create `frontend/src/pages/companies/List.tsx`
- [ ] Fetch companies from API
- [ ] Display company list:
  - [ ] Company name, symbol
  - [ ] Total shares
  - [ ] Actions (view, manage)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Style page
- **Deliverable:** Company list page

### Task 4.9: Company Detail Page

- [ ] Create `frontend/src/pages/companies/Detail.tsx`
- [ ] Fetch company details
- [ ] Display company information
- [ ] Show shareholder table
- [ ] Add navigation
- [ ] Style page
- **Deliverable:** Company detail page

### Task 4.10: Shareholder Table Component

- [ ] Create `frontend/src/components/ShareholderTable.tsx`
- [ ] Display shareholder data:
  - [ ] Address
  - [ ] Balance
  - [ ] Effective balance
  - [ ] Ownership percentage
- [ ] Add pagination
- [ ] Add sorting
- [ ] Style table
- **Deliverable:** Shareholder table component

### Task 4.11: Share Issue Form

- [ ] Create `frontend/src/components/IssueSharesForm.tsx`
- [ ] Implement form:
  - [ ] Recipient address input
  - [ ] Amount input
  - [ ] Validation
  - [ ] Submit handler
- [ ] Connect to contract via Wagmi:
  - [ ] Use `useWriteContract()`
  - [ ] Handle transaction status
  - [ ] Show success/error messages
- [ ] Add wallet signature requirement
- [ ] Style form
- **Deliverable:** Share issue form

### Task 4.12: Share Transfer Form

- [ ] Create `frontend/src/components/TransferSharesForm.tsx`
- [ ] Implement form:
  - [ ] Recipient address input
  - [ ] Amount input
  - [ ] Validation
  - [ ] Submit handler
- [ ] Connect to contract via Wagmi
- [ ] Add wallet signature requirement
- [ ] Style form
- **Deliverable:** Share transfer form

### Task 4.13: Wallet Linking UI

- [ ] Create `frontend/src/components/WalletLink.tsx`
- [ ] Implement wallet linking:
  - [ ] Check if wallet connected
  - [ ] Generate message to sign
  - [ ] Request signature via Wagmi
  - [ ] Send to backend API
  - [ ] Show success/error
- [ ] Add to user profile
- [ ] Style component
- **Deliverable:** Wallet linking UI

### Task 4.14: Basic Theming

- [ ] Set up CSS framework (Tailwind or styled-components)
- [ ] Create theme variables
- [ ] Design system components:
  - [ ] Buttons
  - [ ] Forms
  - [ ] Tables
  - [ ] Cards
- [ ] Apply consistent styling
- [ ] Add dark mode support (optional)
- **Deliverable:** Themed UI components

### Task 4.15: Loading States & Error Handling

- [ ] Add loading spinners
- [ ] Add skeleton loaders
- [ ] Implement error boundaries
- [ ] Add toast notifications
- [ ] Handle API errors gracefully
- [ ] Handle wallet errors
- **Deliverable:** Polished UX with loading/error states

### Task 4.16: Integration Testing

- [ ] Test full user flows:
  - [ ] Register → Login → View companies
  - [ ] Link wallet → Issue shares
  - [ ] Transfer shares
  - [ ] View updated cap table
- [ ] Test error scenarios
- [ ] Test wallet disconnection
- [ ] Test role-based access
- **Deliverable:** End-to-end flows working

### Phase 4 Acceptance Criteria

- ✅ User can register and login
- ✅ User can view companies and cap tables
- ✅ Issuer can issue shares
- ✅ Shareholder can transfer shares
- ✅ Wallet linking works
- ✅ Real-time updates from backend
- ✅ All UI polished with loading/error states

---

## 🧮 Phase 5 — Indexing & Data Optimization

**Goal:** Improve performance and reliability.

**Duration:** ~1 week

**Status:** ⏳ Pending

**Dependencies:** Phase 4 complete

### Task 5.1: Pagination Implementation

- [ ] Add pagination to API endpoints:
  - [ ] `GET /api/companies` (cursor/offset)
  - [ ] `GET /api/companies/:id/shareholders` (cursor/offset)
  - [ ] `GET /api/companies/:id/transactions` (cursor/offset)
- [ ] Update frontend to handle pagination
- [ ] Add pagination controls
- [ ] Test with large datasets
- **Deliverable:** Paginated API responses

### Task 5.2: Caching Strategy

- [ ] Implement response caching:
  - [ ] Company data cache
  - [ ] Shareholder data cache
  - [ ] Transaction history cache
- [ ] Add cache invalidation logic
- [ ] Set appropriate TTLs
- [ ] Add cache headers
- [ ] Test cache behavior
- **Deliverable:** Caching system

### Task 5.3: Event Deduplication

- [ ] Improve indexer deduplication:
  - [ ] Check transaction hash
  - [ ] Check log index
  - [ ] Handle reorgs
- [ ] Add idempotency checks
- [ ] Log duplicate events
- [ ] Test deduplication
- **Deliverable:** Robust event deduplication

### Task 5.4: Background Rescan Service

- [ ] Enhance rescan service:
  - [ ] Periodic rescan (every N blocks)
  - [ ] Gap detection
  - [ ] Automatic recovery
- [ ] Add monitoring and alerts
- [ ] Add rescan status endpoint
- [ ] Test rescan functionality
- **Deliverable:** Reliable rescan service

### Task 5.5: Aggregate Endpoints

- [ ] Create `backend/src/routes/analytics.ts`
- [ ] Implement endpoints:
  - [ ] `GET /api/companies/:id/analytics` - Company analytics
  - [ ] `GET /api/companies/:id/totals` - Total shares, holders
  - [ ] `GET /api/analytics/global` - Global stats
- [ ] Optimize queries
- [ ] Add caching
- [ ] Document endpoints
- **Deliverable:** Analytics endpoints

### Task 5.6: Database Query Optimization

- [ ] Analyze slow queries
- [ ] Add missing indexes
- [ ] Optimize JOIN queries
- [ ] Add query logging
- [ ] Test performance improvements
- **Deliverable:** Optimized database queries

### Task 5.7: Postgres Migration (if needed)

- [ ] Evaluate SQLite vs Postgres
- [ ] Create Postgres schema
- [ ] Write migration script
- [ ] Test migration
- [ ] Update connection strings
- [ ] Document migration process
- **Deliverable:** Postgres migration (if applicable)

### Phase 5 Acceptance Criteria

- ✅ API responses paginated
- ✅ Caching implemented
- ✅ Event deduplication robust
- ✅ Rescan service reliable
- ✅ Analytics endpoints working
- ✅ Query performance optimized

---

## 🧰 Phase 6 — DevOps & Tooling

**Goal:** Make builds, tests, and deployments reproducible.

**Duration:** ~1 week

**Status:** ⏳ Pending

**Dependencies:** Phase 5 complete

### Task 6.1: Environment Management

- [ ] Create `.env.example` files:
  - [ ] `.env.example` (root)
  - [ ] `contracts/.env.example`
  - [ ] `backend/.env.example`
  - [ ] `frontend/.env.example`
- [ ] Document all environment variables
- [ ] Set up `.env` loading (Bun auto-loads)
- [ ] Add validation for required vars
- [ ] Add to `.gitignore`
- **Deliverable:** Environment variable management

### Task 6.2: Docker Configuration

- [ ] Create `Dockerfile` for backend
- [ ] Create `docker-compose.yml`:
  - [ ] Backend service
  - [ ] Database service (Postgres/SQLite)
  - [ ] Optional: Redis for caching
- [ ] Add health checks
- [ ] Configure networking
- [ ] Test Docker setup
- [ ] Document Docker usage
- **Deliverable:** Docker configuration

### Task 6.3: CI Pipeline Setup

- [ ] Create `.github/workflows/ci.yml`
- [ ] Set up pipeline stages:
  - [ ] Lint (ESLint, Solidity lint)
  - [ ] Test (unit tests, integration tests)
  - [ ] Build (contracts, frontend, backend)
- [ ] Add test coverage reporting
- [ ] Configure secrets
- [ ] Test CI pipeline
- **Deliverable:** Working CI pipeline

### Task 6.4: Contract Deployment Automation

- [ ] Create deployment script:
  - [ ] `scripts/deploy.ts`
  - [ ] Support multiple networks
  - [ ] Verify deployments
  - [ ] Export artifacts
- [ ] Add to CI/CD pipeline
- [ ] Document deployment process
- **Deliverable:** Automated contract deployment

### Task 6.5: Build Scripts

- [ ] Create npm/bun scripts:
  - [ ] `bun run dev` - Start all services
  - [ ] `bun run build` - Build all packages
  - [ ] `bun run test` - Run all tests
  - [ ] `bun run deploy` - Deploy contracts
  - [ ] `bun run lint` - Lint all code
- [ ] Add to root `package.json`
- [ ] Test all scripts
- [ ] Document scripts
- **Deliverable:** Unified build scripts

### Task 6.6: Development Setup Documentation

- [ ] Create `DEVELOPMENT.md`:
  - [ ] Prerequisites
  - [ ] Installation steps
  - [ ] Local setup
  - [ ] Running tests
  - [ ] Troubleshooting
- [ ] Update main README
- [ ] Add setup scripts if needed
- **Deliverable:** Complete development docs

### Task 6.7: Production Build Configuration

- [ ] Configure production builds:
  - [ ] Frontend build optimization
  - [ ] Backend build configuration
  - [ ] Environment-specific configs
- [ ] Test production builds
- [ ] Document build process
- **Deliverable:** Production-ready builds

### Phase 6 Acceptance Criteria

- ✅ One-command local setup
- ✅ CI pipeline passing
- ✅ Docker setup working
- ✅ Automated deployments
- ✅ All scripts documented
- ✅ Development docs complete

---

## 🎨 Phase 7 — UX & Enterprise Polish

**Goal:** Turn the MVP into a professional demo.

**Duration:** ~2 weeks

**Status:** ⏳ Pending

**Dependencies:** Phase 6 complete

### Task 7.1: Dashboard Redesign

- [ ] Design role-based dashboards:
  - [ ] Admin dashboard
  - [ ] Issuer dashboard
  - [ ] Investor dashboard
- [ ] Create layout components
- [ ] Implement navigation
- [ ] Add role-based menu items
- [ ] Style dashboards
- **Deliverable:** Role-based dashboards

### Task 7.2: Email Invites System

- [ ] Integrate Firebase Auth email invites
- [ ] Create invite flow:
  - [ ] Generate invite link
  - [ ] Send email
  - [ ] Handle invite acceptance
  - [ ] Assign roles
- [ ] Add invite management UI
- [ ] Test invite flow
- **Deliverable:** Email invite system

### Task 7.3: Password Reset Flow

- [ ] Use Firebase Auth password reset
- [ ] Create reset password page
- [ ] Add "Forgot Password" link
- [ ] Style reset flow
- [ ] Test reset functionality
- **Deliverable:** Password reset working

### Task 7.4: Enhanced Charts and Visualizations

- [ ] Install charting library (recharts, chart.js)
- [ ] Create cap table visualization
- [ ] Add ownership pie chart
- [ ] Add transaction history chart
- [ ] Add corporate action timeline
- [ ] Style charts
- **Deliverable:** Enhanced visualizations

### Task 7.5: Improved Tables

- [ ] Enhance shareholder table:
  - [ ] Better sorting
  - [ ] Column filtering
  - [ ] Export functionality
  - [ ] Responsive design
- [ ] Improve transaction table
- [ ] Add table tooltips
- [ ] Style tables
- **Deliverable:** Professional tables

### Task 7.6: Status Indicators

- [ ] Add status badges:
  - [ ] Company status
  - [ ] Shareholder status
  - [ ] Transaction status
- [ ] Add loading indicators
- [ ] Add success/error indicators
- [ ] Style indicators
- **Deliverable:** Clear status indicators

### Task 7.7: Branding and Design

- [ ] Create logo/favicon
- [ ] Design color scheme
- [ ] Choose typography
- [ ] Create design system
- [ ] Apply branding consistently
- [ ] Add meta tags
- **Deliverable:** Branded application

### Task 7.8: Responsive Design

- [ ] Test on mobile devices
- [ ] Fix mobile layout issues
- [ ] Optimize touch interactions
- [ ] Test on tablets
- [ ] Document responsive breakpoints
- **Deliverable:** Responsive application

### Task 7.9: Demo Script & Walkthrough

- [ ] Create demo script
- [ ] Record demo video (optional)
- [ ] Create walkthrough deck
- [ ] Document user flows
- [ ] Prepare demo data
- **Deliverable:** Demo materials

### Phase 7 Acceptance Criteria

- ✅ Professional-looking UI
- ✅ Role-based dashboards working
- ✅ Email invites functional
- ✅ Enhanced visualizations
- ✅ Responsive design
- ✅ Demo-ready application

---

## 🧭 Phase 8 — Production Readiness (Optional)

**Goal:** Harden and monitor.

**Duration:** Ongoing

**Status:** ⏳ Optional

**Dependencies:** Phase 7 complete

### Task 8.1: Logging & Error Tracking

- [ ] Set up structured logging (Pino)
- [ ] Integrate error tracking (Sentry)
- [ ] Add log levels
- [ ] Configure log rotation
- [ ] Set up alerts
- **Deliverable:** Comprehensive logging

### Task 8.2: Analytics Integration

- [ ] Choose analytics provider (Mixpanel/PostHog)
- [ ] Integrate analytics SDK
- [ ] Track key events:
  - [ ] User registrations
  - [ ] Share issuances
  - [ ] Transfers
  - [ ] Page views
- [ ] Create analytics dashboard
- **Deliverable:** Analytics tracking

### Task 8.3: Rate Limiting

- [ ] Install rate limiting library
- [ ] Configure rate limits:
  - [ ] Per IP
  - [ ] Per user
  - [ ] Per endpoint
- [ ] Add rate limit headers
- [ ] Test rate limiting
- **Deliverable:** Rate limiting implemented

### Task 8.4: API Keys & Org Boundaries

- [ ] Design API key system
- [ ] Implement API key generation
- [ ] Add API key validation middleware
- [ ] Create org boundaries:
  - [ ] Multi-tenant isolation
  - [ ] Org-level permissions
- [ ] Test multi-tenant scenarios
- **Deliverable:** API keys and org boundaries

### Task 8.5: Cloud Deployment

- [ ] Choose deployment platform:
  - [ ] Backend: Render/Fly/Railway
  - [ ] Frontend: Vercel/Netlify
  - [ ] Database: Supabase/Render Postgres
- [ ] Set up deployment pipelines
- [ ] Configure environment variables
- [ ] Set up custom domains
- [ ] Test production deployment
- **Deliverable:** Production deployment

### Task 8.6: Monitoring & Alerts

- [ ] Set up uptime monitoring
- [ ] Configure health check endpoints
- [ ] Set up alerts:
  - [ ] Error rate
  - [ ] Response time
  - [ ] Database issues
  - [ ] Indexer failures
- [ ] Create monitoring dashboard
- **Deliverable:** Monitoring system

### Task 8.7: Security Hardening

- [ ] Security audit checklist
- [ ] Add security headers
- [ ] Implement CSRF protection
- [ ] Add input validation
- [ ] Review authentication flows
- [ ] Document security measures
- **Deliverable:** Security-hardened application

### Phase 8 Acceptance Criteria

- ✅ Production deployment live
- ✅ Monitoring and alerts configured
- ✅ Analytics tracking events
- ✅ Rate limiting active
- ✅ Security measures in place
- ✅ Documentation complete

---

## Summary

**Total Estimated Duration:** ~12-14 weeks

**Phases:**

1. Contracts Foundation (2 weeks)
2. Backend API + Event Indexer (2 weeks)
3. Authentication & Access Control (1.5 weeks)
4. Frontend MVP (3 weeks)
5. Indexing & Data Optimization (1 week)
6. DevOps & Tooling (1 week)
7. UX & Enterprise Polish (2 weeks)
8. Production Readiness (ongoing, optional)

**Critical Path:**

- Phase 1 → Phase 2 → Phase 3 → Phase 4 (must be sequential)
- Phase 5-8 can be parallelized or done incrementally

**Key Milestones:**

- ✅ Phase 1: Contracts deployed and tested
- ✅ Phase 2: Backend API serving real data
- ✅ Phase 3: Secure API with authentication
- ✅ Phase 4: End-to-end user flows working
- ✅ Phase 7: Demo-ready application
