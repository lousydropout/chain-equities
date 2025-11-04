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
- **Database**: Bun's native SQLite
- **Blockchain Client**: viem (WebSocket subscriptions)
- **API**: Bun.serve() REST endpoints
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

### Backend (to be created)
- `backend/src/api.ts` - REST API routes
- `backend/src/indexer.ts` - Event listener
- `backend/src/db.ts` - SQLite schema
- `backend/src/config.ts` - Configuration

### Frontend (to be created)
- `frontend/src/app/admin/` - Issuer dashboard
- `frontend/src/app/holder/` - Shareholder dashboard
- `frontend/src/components/` - UI components
- `frontend/src/provider/` - Wagmi providers

