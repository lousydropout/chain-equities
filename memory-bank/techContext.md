# Technical Context

## Three-Layer Stack

### Smart Contract Layer
- **Language**: Solidity 0.8.28
- **Framework**: Hardhat
- **Base Libraries**: OpenZeppelin (ERC20, Ownable)
- **Network**: Anvil (localhost:8545, chainId: 31337)
- **Key Contract**: `ChainEquityToken.sol`

### Backend Layer
- **Runtime**: Bun
- **Framework**: Fastify (v5.6.1)
- **Database**: Bun's native SQLite
- **Blockchain Client**: viem (v2.38.6) with WebSocket/HTTP fallback, singleton pattern
  - Supports Hardhat (31337), Sepolia (11155111), Mainnet (1)
  - Exponential backoff retry logic
  - Optional wallet client for admin operations
- **API**: Fastify REST endpoints
- **Logging**: Pino with pino-pretty (development)
- **Security**: @fastify/helmet, @fastify/cors
- **Port**: 4000 (configurable via PORT env var)
- **Purpose**: Event indexer + read-only API

### Frontend Layer
- **Framework**: React + TypeScript (Next.js optional)
- **Wallet**: wagmi v2 + viem
- **State Management**: @tanstack/react-query
- **Styling**: tailwindcss + shadcn/ui
- **Purpose**: Admin dashboard + Shareholder dashboard

## Development Environment

### Local Setup
- **Blockchain**: Anvil (Foundry)
- **Deployment**: `bunx hardhat ignition deploy ignition/modules/ChainEquityToken.ts --network anvil`
- **Anvil Setup**: Requires running `anvil` first, then providing private key from anvil as environment variable

### Configuration
- Solidity version: 0.8.28
- Network: Anvil (localhost:8545, chainId: 31337)
- Accounts: Configured via `ANVIL_PRIVATE_KEY` environment variable

## Key Files

### Smart Contracts
- `contracts/ChainEquityToken.sol` - Main cap table contract
- `hardhat.config.ts` - Hardhat configuration
- `ignition/modules/ChainEquityToken.ts` - Deployment module
- `test/` - Test files

### Backend
- `backend/src/index.ts` - Fastify server entry point ✅
- `backend/src/routes/` - REST API route handlers (to be created)
- `backend/src/plugins/` - Fastify plugins (to be created)
- `backend/src/services/chain/client.ts` - Viem client configuration (singleton, WebSocket/HTTP fallback) ✅
- `backend/src/services/chain/indexer.ts` - Event listener (to be created)
- `backend/src/db/schema.ts` - Complete SQLite schema (6 tables) ✅
- `backend/src/db/migrations.ts` - Migration system with version tracking ✅
- `backend/src/config/contracts.ts` - Contract address configuration ✅

### Frontend (to be created)
- `frontend/src/app/admin/` - Issuer dashboard
- `frontend/src/app/holder/` - Shareholder dashboard
- `frontend/src/components/` - UI components
- `frontend/src/provider/` - Wagmi providers

