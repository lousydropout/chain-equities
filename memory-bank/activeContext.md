# Active Context

## Current Status

**Workspace restructured** - Clean separation into `contracts/`, `frontend/`, and `backend/` directories. New multi-company architecture blueprint defined with Orchestrator and CapTable contracts.

## Recent Work

### Task 4.12: Share Transfer Form ✅

- **Status**: Complete - Share transfer form implemented with balance validation
- **Location**: `frontend/src/components/TransferSharesForm.tsx`
- **Integration**: Embedded in Dashboard under "Shareholder Actions" card section
- **Key Features**:
  - Form validation with react-hook-form + zod (recipient address, amount <= user's balance)
  - Fetches user's balance using `useMyShareholder()` hook (queries by user ID via `/api/shareholders/me`)
  - Displays user's current balance in the form
  - Wagmi integration: `useWriteContract` for transfer transaction, `useWaitForTransactionReceipt` for confirmation
  - Available to all authenticated users (not role-restricted)
  - Transaction state management (loading, success with hash, error handling)
  - Automatic cache invalidation for shareholders and company stats after successful transfer
  - Handles edge cases: wallet not linked, balance loading, no balance
  - Shows wallet mismatch warning if connected wallet doesn't match linked wallet
- **Files Created**:
  - `frontend/src/components/TransferSharesForm.tsx` - Main transfer form component
- **Files Modified**:
  - `frontend/src/pages/Dashboard.tsx` - Added "Shareholder Actions" section with TransferSharesForm
  - `backend/src/routes/shareholders.ts` - Added GET /api/shareholders/me endpoint
  - `frontend/src/lib/api.ts` - Added getMyShareholder() function
  - `frontend/src/hooks/useApi.ts` - Added useMyShareholder() hook

### Task 4.13: Wallet Linking UI ✅

- **Status**: Complete - Wallet linking UI and backend API implemented
- **Location**: `frontend/src/components/WalletLink.tsx`, `backend/src/routes/wallet.ts`
- **Integration**: Embedded in Dashboard under "Wallet Management" section, Connect component added to Dashboard
- **Key Features**:
  - Link/unlink wallet functionality with backend API integration
  - User ID-based authentication (frontend sends user info in custom headers)
  - Backend extracts user info from X-User-Uid, X-User-Email, X-User-Role headers
  - Auto-creates users in database if they don't exist (demo mode)
  - Graceful handling of "user not found" scenarios
  - Optimistic cache updates for immediate UI feedback
  - Wallet disconnection on logout/login for security
  - Shows current wallet linking status
  - Displays connected wallet address
  - Link/unlink buttons with loading states and error handling
  - Graceful error handling (shows buttons even if status check fails)
  - Connect component added to Dashboard for wallet connection
- **Backend API Endpoints**:
  - `POST /api/wallet/link` - Link wallet address to user account
  - `POST /api/wallet/unlink` - Unlink wallet address from user account
  - `GET /api/wallet/status` - Get wallet linking status
  - `GET /api/wallet/investors` - Get list of investors with linked wallets (for dropdown)
- **Files Created**:
  - `backend/src/routes/wallet.ts` - Wallet linking routes
  - `frontend/src/components/WalletLink.tsx` - Wallet linking UI component
  - `frontend/src/components/ui/select.tsx` - shadcn/ui Select component
- **Files Modified**:
  - `backend/src/services/db/users.ts` - Added `getUsersWithLinkedWallets()` function
  - `backend/src/index.ts` - Registered wallet routes
  - `frontend/src/lib/api.ts` - Added wallet API functions
  - `frontend/src/hooks/useApi.ts` - Added `useWalletStatus()` and `useInvestorsWithWallets()` hooks
  - `frontend/src/pages/Dashboard.tsx` - Added Wallet Management section and Connect component

### Task 4.11: Share Issue Form (Enhanced) ✅

- **Status**: Complete - Share issue form enhanced with investor dropdown
- **Location**: `frontend/src/components/IssueSharesForm.tsx`
- **Integration**: Embedded in Dashboard under "Issuer Actions" card section
- **Key Features**:
  - Form validation with react-hook-form + zod (investor selection, positive amount)
  - **Investor dropdown**: Replaces manual address input with dropdown of investors with linked wallets
  - Dropdown displays: investor displayName and wallet address (e.g., "alice@chainequity.com (0x1234...5678)")
  - Maps selected investor UID to wallet address on form submission
  - Wagmi integration: `useWriteContract` for mint transaction, `useWaitForTransactionReceipt` for confirmation
  - Role-based access control (issuer/admin only)
  - Transaction state management (loading, success with hash, error handling)
  - Automatic cache invalidation for shareholders and company stats after successful mint
  - Wallet connection requirement with user-friendly messages
  - Shows helpful message if no investors have linked wallets
- **Files Created**:
  - `frontend/src/config/contracts.ts` - Contract configuration with ABI import
  - `frontend/src/components/IssueSharesForm.tsx` - Main form component (enhanced)
- **Files Modified**:
  - `frontend/src/pages/Dashboard.tsx` - Added "Issuer Actions" section
  - `frontend/src/lib/api.ts` - Added `getInvestorsWithWallets()` function
  - `frontend/src/hooks/useApi.ts` - Added `useInvestorsWithWallets()` hook
  - `frontend/tsconfig.app.json` - Added `resolveJsonModule` for JSON imports

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
   - REST API routes - Company Info complete (Task 2.6) ✅
     - Shared `safeRead()` utility for consistent contract read error handling
     - `GET /api/company` endpoint using `getCompanyInfo()` for efficient retrieval
     - `GET /api/company/metadata` endpoint with individual field queries
     - Fastify response schema validation for type safety
     - Graceful handling of unlinked tokens (null token address)
     - Flat JSON response structure for frontend consistency
     - Comprehensive test suite (9 tests passing)
     - All routes registered with `/api` prefix
   - REST API routes - Shareholders complete (Task 2.7) ✅
     - `GET /api/shareholders` endpoint with pagination (limit/offset, max 100, min 1)
     - `GET /api/shareholders/:address` endpoint for individual shareholder details
     - Ownership percentage calculation using BigInt for two-decimal precision
     - Effective balance calculation (balance \* splitFactor / 10^18)
     - In-memory caching for totalSupply/splitFactor (5-second TTL) to reduce contract calls
     - Address validation using Viem's `isAddress` utility
     - Fastify schema validation for request/response types
     - Comprehensive error handling for contract read failures and database errors
     - In-memory SQLite database testing (16 tests passing)
     - Database column aliasing for consistent camelCase JSON responses
     - Helper function `asShareholderResponse()` for unified data transformation
9. **Frontend** (React + wagmi + Vite) - Admin & Shareholder dashboards ⏳ IN PROGRESS
   - Frontend project scaffolding complete (Task 4.1) ✅
     - React + Vite + TypeScript project structure set up
     - All dependencies installed: @tanstack/react-query, firebase, react-router-dom, prettier, eslint plugins
     - Prettier configured with standard React + TypeScript settings (.prettierrc)
     - ESLint integrated with Prettier using flat config format
     - Format scripts added to package.json (format, format:check)
     - All scripts updated to use Bun
     - TypeScript configuration verified and working
     - All tests passing: TypeScript compiles, Prettier formatting works, ESLint integration verified, build succeeds
     - Dev server tested and working (Vite running on port 5173)
   - Mock Auth Setup complete (Task 4.2) ✅
     - Created auth types (`types/auth.ts`) with AuthContext interface and DEMO_USERS constant
     - Multiple demo users added: admin (admin role), alice/bob/charlie (investor role)
     - Created `getDemoUser()` helper function for user lookup by username or email
     - Created AuthContext provider (`contexts/AuthContext.tsx`) with login/logout and localStorage persistence
     - Updated login function to accept username/email parameter for selecting demo user
     - Created useAuth hook (`hooks/useAuth.ts`) for accessing auth context
     - Created auth utilities (`lib/auth.ts`) with token and user storage helpers
     - Integrated AuthProvider in main.tsx wrapping the app
     - Updated App.tsx with demo UI showing login/logout buttons, user info (email, role, UID), and authentication state
     - All files formatted, TypeScript compilation verified, no linting errors
     - localStorage persistence for auth state across page refreshes
     - No Firebase SDK integration (deferred to post-demo)
   - Wagmi Configuration complete (Task 4.3) ✅
     - Created wagmi config with Hardhat (31337) and Sepolia (11155111) chains
     - Configured HTTP transports and injected connector for MetaMask
     - Created Providers component with WagmiProvider and QueryClientProvider
     - Auto-connect enabled via injected connector
     - Comprehensive test suite (10 tests passing)
   - Wallet Connection UI complete (Task 4.4) ✅
     - Created Connect.tsx component with comprehensive wallet connection functionality
     - Uses Wagmi hooks: useAccount(), useConnect(), useDisconnect()
     - Displays formatted address with full address in tooltip
     - Shows connection status and error handling
     - Integrated into App.tsx layout
   - TailwindCSS + shadcn/ui integration complete (Task 4.4b) ✅
     - Installed TailwindCSS v3.4.18 with PostCSS and Autoprefixer
     - Configured tailwind.config.js with content paths and dark mode support
     - Added shadcn/ui CSS variables and theme configuration
     - Installed shadcn/ui core components: Button, Card, Input, Form, Label
     - Refactored Connect.tsx and App.tsx to use shadcn/ui components and Tailwind utilities
     - Removed all old CSS files, all components now use TailwindCSS
     - Build verified: TypeScript compilation passes, Vite build succeeds
   - Login/Register Pages complete (Task 4.5) ✅
     - Created Login.tsx and Register.tsx pages with react-hook-form and zod validation
     - Implemented React Router with BrowserRouter in main.tsx
     - Added ProtectedRoute component to redirect unauthenticated users
     - Created AuthRedirect component to redirect authenticated users away from auth pages
     - Created Home.tsx placeholder page (includes Connect component)
     - Both pages allow selecting demo user via quick login buttons or email/username entry
     - Login page displays quick login buttons for admin, alice, bob, and charlie
     - Added demo mode notes under Card components explaining simulated authentication
     - All forms use shadcn/ui Form components with TailwindCSS styling
     - Fixed zod version compatibility (downgraded to v3.25.76 for react-hook-form compatibility)
     - Routes: /login, /register, / (protected home)
   - Protected Route Wrapper complete (Task 4.6) ✅
     - ProtectedRoute component enhanced with role-based and wallet-based access control
     - Added requiredRole, requireWallet, and redirectTo props
     - Integrated useAccount() hook from Wagmi for wallet connection checks
     - Created example routes: /admin (admin role), /investor (investor role), /wallet-required (wallet required)
     - Demo users added for testing: admin (admin role), alice/bob/charlie (investor role)
     - Login page updated with quick login buttons for each demo user
     - ProtectedRoute checks authentication via useAuth()
     - Redirects unauthenticated users to /login
     - Shows loading state during auth check
     - Applied to home route (/) in App.tsx
   - API Client Setup complete (Task 4.7) ✅
     - Created `frontend/src/types/api.ts` with TypeScript types matching all backend response schemas
     - Implemented composable `createApiClient()` factory function for future multi-tenant support
     - Centralized fetch logic with automatic JSON parsing for both success and error responses
     - Created `APIError` class for typed error handling (status, message, data)
     - Token attachment via token getter function (`getAuthToken()` from `lib/auth.ts`)
     - All API functions implemented: `getCompany()`, `getCompanyMetadata()`, `getShareholders()`, `getShareholder()`, `getTransactions()`, `getTransactionByHash()`, `linkWallet()`, `unlinkWallet()`, `getWalletStatus()`, `getInvestorsWithWallets()`
     - Created React Query hooks in `frontend/src/hooks/useApi.ts` with proper typing: `UseQueryResult<T, APIError>`
     - Pagination ergonomics: Helper hooks (`useShareholdersData()`, `useTransactionsData()`) return composed objects
     - Wallet hooks: `useWalletStatus()`, `useInvestorsWithWallets()` for wallet linking functionality
     - Created API test page (`/api-test`) for comprehensive endpoint testing
     - All files compile without errors, no linting errors
     - Environment variable support: `VITE_API_URL` (defaults to `http://localhost:4000`)
   - Cap Table Page complete (Task 4.9) ✅
     - Created `frontend/src/pages/CapTable.tsx` with desktop-only table layout
     - Uses `useShareholdersData({ limit: 100 })` to fetch all shareholders (demo version, no pagination)
     - Uses `useCompanyStats()` for company name, symbol, and decimals
     - Table displays: Address (formatted), Balance, Effective Balance (with tooltip), Ownership %, Last Block
     - Desktop-only layout with zebra striping and monospace fonts
     - Header with "Back to Dashboard" button and company name/symbol
     - Loading skeleton, error state with retry, empty state handling
     - Tooltip on "Effective Balance" column explaining share splits
     - Route: `/cap-table` added to App.tsx with ProtectedRoute wrapper
     - Real-time data from API (no hardcoded values)
     - Proper ownership percentage calculation using API data or fallback
   - Shareholder Table Component complete (Task 4.10) ✅
     - Created reusable `ShareholderTable.tsx` component extracted from CapTable
     - Props: `shareholders`, `totalOutstanding` (bigint), `decimals` (optional), `defaultSort` (optional)
     - Client-side sorting on all columns (Address, Balance, Effective Balance, Ownership %, Last Block)
     - Sort indicators (ArrowUp/ArrowDown) with clickable headers
     - Default sort: ownership % descending (configurable)
     - Progress bar visualization for ownership percentages (width represents stake)
     - Tooltip for "Effective Balance" column explaining share splits
     - Same styling: monospace fonts, zebra-striping, desktop-only layout
     - Refactored CapTable.tsx to use ShareholderTable component
     - Type-safe implementation using existing Shareholder type
     - Route: `/cap-table` accessible for testing
   - Share Transfer Form complete (Task 4.12) ✅
     - Created `TransferSharesForm.tsx` component for shareholders to transfer tokens
     - Form validation with balance checking (amount <= user's balance)
     - Fetches user's balance using `useMyShareholder()` hook (queries by user ID)
     - Displays user's current balance in the form
     - Uses Wagmi's `useWriteContract` to call `transfer()` function
     - Available to all authenticated users (not role-restricted)
     - Handles edge cases: wallet not linked, balance loading, no balance
     - Shows wallet mismatch warning if connected wallet doesn't match linked wallet
     - Transaction state management and cache invalidation
     - Integrated into Dashboard under "Shareholder Actions" section
   - Wallet Linking UI complete (Task 4.13) ✅
     - Created `WalletLink.tsx` component for linking/unlinking wallets
     - Backend API endpoints: POST /api/wallet/link, POST /api/wallet/unlink, GET /api/wallet/status
     - Backend API endpoint: GET /api/wallet/investors (for investor dropdown in Issue Shares form)
     - Shows current wallet linking status and connected wallet address
     - Link/unlink buttons with loading states and error handling
     - Graceful error handling (shows buttons even if status check fails)
     - Integrated into Dashboard under "Wallet Management" section
     - Connect component added to Dashboard for wallet connection
     - User ID-based authentication (frontend sends user info in headers, backend extracts it)
     - Auto-creates users in database if they don't exist (demo mode)
     - Wallet disconnection on logout/login for security
   - Investor Wallet Approval Flow complete (Task 4.14) ✅
     - Created Approvals page for issuer/admin to approve investor wallets
     - Backend endpoint: GET /api/shareholders/pending - Returns investors with linked wallets not approved on contract
     - Frontend displays table of pending approvals with investor details
     - Approve button calls approveWallet() function on ChainEquityToken contract via Wagmi
     - Real-time status updates via React Query cache invalidation
     - Role-based access control (only issuer/admin can access)
     - Integrated into Dashboard with navigation card
   - Issue Shares Form Enhanced ✅
     - Enhanced with investor dropdown (replaces manual address input)
     - Fetches investors with linked wallets via `useInvestorsWithWallets()` hook
     - Dropdown displays investor displayName and wallet address
     - Maps selected investor UID to wallet address on form submission
     - Shows helpful message if no investors have linked wallets

### Recent Fixes and Improvements

- **User ID-based Authentication** ✅
  - Frontend sends user info in custom headers (X-User-Uid, X-User-Email, X-User-Role)
  - Backend extracts user info from headers instead of hardcoded demo-user
  - Fixes wallet linking to use correct user ID (no more catch-22)
- **Shareholder Query by User ID** ✅
  - Added `/api/shareholders/me` endpoint that queries by authenticated user ID
  - Frontend uses `useMyShareholder()` hook instead of querying by wallet address
  - Eliminates catch-22: queries by user ID (foundational) instead of wallet address
  - TransferSharesForm now queries by user ID, not connected wallet address
- **Database Mapping Fixes** ✅
  - Fixed all user database functions to use `asUserRecord()` helper
  - Properly maps snake_case database columns to camelCase TypeScript properties
  - Fixes wallet linking response to return correct walletAddress
- **Wallet Disconnection on Auth State Changes** ✅
  - Wallet automatically disconnects on logout
  - Wallet automatically disconnects on login (fresh state)
  - Implemented in AuthContext using Wagmi's useDisconnect hook
- **UI/UX Improvements** ✅
  - Added user greeting in Dashboard: "Hi, <username>" button replaces logout icon
  - Shows who is currently logged in
  - Button still functions as logout when clicked

### Planned Enhancements

- **Orchestrator.sol** - Factory contract for creating new companies (future enhancement)
- **Backend Indexer** - ✅ Real-time event processing and database sync (Task 2.5 - COMPLETE)
- **Contract Exports** - ✅ `/contracts/exports/` directory for deployment artifacts (Task 1.3 - COMPLETE)
- **Backend API** - ✅ REST endpoints for companies, shareholders, transactions, wallet linking
- **Backend Authentication** - ✅ Firebase Auth + Unified Middleware documented (see `authentication.md`)
- **Frontend Wallet Integration** - ✅ Wagmi v2 implementation with Connect component, wallet linking UI
- **Frontend UI** - ✅ Dashboard, cap table, share issue form (with investor dropdown), share transfer form, wallet management

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
11. ✅ Implement company info REST API endpoints (Task 2.6 - COMPLETE)
12. ✅ Implement shareholders REST API endpoints (Task 2.7 - COMPLETE)
13. ✅ Implement wallet linking REST API endpoints (Task 3.4 - COMPLETE, demo mode)
14. ⏳ Implement remaining REST API endpoints (Tasks 2.8-2.9)
15. ✅ Backend authentication architecture documented (Firebase Auth + Unified Middleware)
16. ✅ Frontend wallet integration blueprint documented (Wagmi v2 + React Query)
17. ✅ Implement backend unified auth middleware (`middleware/auth.ts`) - Task 1.4 COMPLETE
18. ✅ Frontend project scaffolding complete (Task 4.1) - React + Vite + TypeScript with Prettier/ESLint
19. ✅ Frontend mock auth setup complete (Task 4.2) - React Context, localStorage persistence, demo UI
20. ✅ Frontend Wagmi configuration complete (Task 4.3) - Wagmi v2 with Hardhat and Sepolia chains
21. ✅ Frontend wallet connection UI complete (Task 4.4) - Connect component with MetaMask integration
22. ✅ TailwindCSS + shadcn/ui integration complete (Task 4.4b) - All components migrated to TailwindCSS
23. ✅ Login/Register pages complete (Task 4.5) - React Router, form validation, protected routes
24. ✅ Protected route wrapper complete (Task 4.6) - Authentication checks and redirects
25. ✅ Frontend API client setup complete (Task 4.7) - Composable API client, typed functions, React Query hooks, wallet API functions
26. ✅ Create frontend company dashboard page (Task 4.8) - Complete with stats endpoint, formatting, tooltips, navigation, Connect component, Shareholder Actions, Wallet Management
27. ✅ Create frontend cap table page (Task 4.9) - Desktop-only table with real data, formatting, navigation
28. ✅ Create frontend shareholder table component (Task 4.10) - Reusable component with client-side sorting and progress bars
29. ✅ Enhanced issue shares form (Task 4.11) - Investor dropdown replaces manual address input, uses GET /api/wallet/investors
30. ✅ Create frontend share transfer form (Task 4.12) - Transfer form with balance validation
31. ✅ Create frontend wallet linking UI (Task 4.13) - Wallet link/unlink with backend API
32. ⏳ Create frontend admin dashboard UI
33. ⏳ Create frontend shareholder dashboard UI

### Company Dashboard (Task 4.8) ✅

- **Location**: `frontend/src/pages/Dashboard.tsx`, `backend/src/routes/company.ts`
- **Backend Endpoint**: `GET /api/company/stats` - Optimized single-call endpoint combining contract and database data
- **Features**:
  - Company header card with name, symbol, issuer, creation date, token status badge
  - Stats grid with three cards: Total Outstanding, Total Shareholders, Authorized shares
  - Tooltips and descriptions for each stat explaining what numbers mean
  - Navigation cards to Cap Table, Transactions, and API Test pages
  - Loading skeletons matching final layout
  - Error handling with retry button
  - Empty states showing "—" for missing data
  - Logout button in top-right corner with user info display
  - Formatting utilities for addresses, token amounts, and dates
- **API Integration**:
  - `useCompanyStats()` React Query hook with 30s staleTime and retry: 1
  - Single optimized fetch for all dashboard data
  - Returns: name, symbol, issuer, createdAt (ISO), tokenLinked, tokenAddress, totalShareholders, totalAuthorized, totalOutstanding, decimals, splitFactor (optional)
- **Formatting**:
  - `formatAddress()` - Truncates addresses (e.g., "0x1234…5678")
  - `formatTokenAmount()` - Formats wei using viem.formatUnits + Intl.NumberFormat with compact notation
  - `formatDate()` - Formats ISO dates to readable format
- **Accessibility**:
  - Tooltips on help icons explaining each stat
  - Descriptions below stat values
  - Navigation cards use semantic `<Link>` with aria-labels
  - Focus rings and keyboard navigation support
- **Access Control**: Dashboard accessible to all authenticated users (admin, issuer, investor). Role-specific dashboards planned for Task 7.1.
- **Files Created/Modified**:
  - `backend/src/routes/company.ts` - Added `/api/company/stats` endpoint
  - `frontend/src/pages/Dashboard.tsx` - Main dashboard component
  - `frontend/src/types/api.ts` - Added `CompanyStats` interface
  - `frontend/src/lib/api.ts` - Added `getCompanyStats()` function
  - `frontend/src/hooks/useApi.ts` - Added `useCompanyStats()` hook
  - `frontend/src/lib/utils.ts` - Added formatting utilities
  - `frontend/src/components/ui/badge.tsx` - Badge component
  - `frontend/src/components/ui/tooltip.tsx` - Tooltip component
- **Dependencies**: `lucide-react`, `@radix-ui/react-tooltip`
- **Status**: Complete - Task 4.8 ✅

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
  - Run main suite (excludes client tests): `cd backend && bun run test` (42 tests passing: 17 auth middleware + 16 shareholders + 9 company routes)
  - Run client tests separately: `cd backend && bun run test:client` (20 tests passing)
  - Run all tests: `cd backend && bun run test:all` (62 tests total, 5 may fail due to mock interference)
  - Run specific: `cd backend && bun test src/__tests__/middleware/auth.test.ts`
  - Shareholders route tests: `cd backend && bun test src/routes/__tests__/shareholders.test.ts`
  - Company route tests: `cd backend && bun test src/routes/__tests__/company.test.ts`
  - Manual connection test: `cd backend && bun run test:client:manual`
  - **Note:** Client tests are separated due to `mock.module()` interference from route tests. They pass when run individually.
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
  - `users.ts` - Seed test users (admin, alice, bob, charlie) matching frontend DEMO_USERS
  - `shareholders.ts` - Placeholder for shareholder seeding (not seeded, populated by indexer)
  - `seed.ts` - Main orchestrator script
- **Database Reset Instructions**: Added to backend README
  - Must reset database after fresh contract deployments to avoid stale data conflicts
  - Steps: `bun run db:reset --yes`, optionally set `START_BLOCK`, restart server
  - Seed script only populates users table (off-chain auth), blockchain data comes from indexer
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
  - `backend/package.json` (modified) - Added db:\* scripts
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
- Backend REST API routes - Company Info (Task 2.6) ✅ COMPLETE
- Backend REST API routes - Shareholders, Transactions, Corporate Actions (Tasks 2.7-2.9) ⏳ NEXT

9. **Phase 3 - Authentication & Access Control (Demo Simplified)** ⏳ IN PROGRESS
   - Mock auth middleware complete (Task 3.2) ✅
     - Simplified `requireAuth()` returning hardcoded demo user with issuer role
     - Stubbed `requireWalletSignature()`, `requireRole()`, and `requireAnyRole()` for demo
     - Comprehensive test suite (12 tests passing)
   - User database schema verified (Task 3.3) ✅
     - Users table structure preserved with all required fields (uid, email, display_name, wallet_address, role, created_at)
     - User database utilities implemented in `backend/src/services/db/users.ts` (createUser, getUserByUid, linkWallet, etc.)
     - No `/api/users` or `/api/wallet` routes exist (deferred to post-demo)
     - Documentation added explaining deferred functionality
     - Demo uses mock authentication (Task 3.2) which does not require database lookups
   - Firebase Admin setup (Task 3.1) ⏸️ Deferred
   - Wallet linking endpoints (Task 3.4) ⏸️ Deferred
   - User management endpoints (Task 3.6) ⏸️ Deferred

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
