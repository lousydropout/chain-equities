# ChainEquity Backend

Fastify-based backend server for ChainEquity platform.

## Setup

Install dependencies:

```bash
bun install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Bun automatically loads `.env` files (no additional configuration needed).

### Required Variables

- `PORT` - Server port (default: 4000)
- `CHAIN_ID` - Blockchain network chain ID (default: 31337 for Hardhat)
  - `31337` - Local Hardhat node
  - `11155111` - Sepolia testnet
  - `1` - Ethereum mainnet
- `RPC_URL` - HTTP RPC endpoint URL
  - Default for local: `http://127.0.0.1:8545`
  - Required for testnet/mainnet

### Optional Variables

- `NODE_ENV` - Environment mode (default: development)
- `DATABASE_PATH` - SQLite database file path (default: `data/chain-equity.db`)
- `AUTO_MIGRATE` - Auto-run migrations on startup (default: true in development)
- `DEBUG_SQL` - Log SQL queries (default: false)
- `WS_RPC_URL` - WebSocket RPC endpoint URL
  - Default for local: `ws://127.0.0.1:8545`
  - Used for event subscriptions (falls back to HTTP if unavailable)
- `ADMIN_PRIVATE_KEY` - Private key for admin wallet operations
  - Only required if performing admin operations via wallet client

## Running

Start the development server:

```bash
bun run dev
```

Or in production:

```bash
bun run start
```

The server will start on `http://localhost:4000` (or the port specified in `PORT` environment variable).

## Health Check

Verify the server is running:

```bash
curl http://localhost:4000/ping
```

Should return: `{"status":"ok"}`

## Blockchain Configuration

The backend uses Viem for blockchain connectivity. The client service (`src/services/chain/client.ts`) provides:

- **Public Client**: For reading blockchain data (supports WebSocket + HTTP fallback)
- **Wallet Client**: For admin operations (optional, requires `ADMIN_PRIVATE_KEY`)

### Supported Networks

| Network | Chain ID | Default RPC URL |
|---------|----------|-----------------|
| Hardhat (Local) | 31337 | `http://127.0.0.1:8545` |
| Sepolia (Testnet) | 11155111 | Configure via `RPC_URL` |
| Mainnet | 1 | Configure via `RPC_URL` |

### Usage

```typescript
import { getPublicClient, getWalletClient, testConnection } from './services/chain/client';

// Test connection
const isConnected = await testConnection();

// Get public client for queries
const client = getPublicClient();
const chainId = await client.getChainId();

// Get wallet client (if ADMIN_PRIVATE_KEY is set)
const wallet = getWalletClient(); // Returns null if not configured
```

### Connection Testing

The client automatically logs connection info at startup:

```
🔗 Connected to chain: Hardhat (chainId: 31337)
   RPC: http://127.0.0.1:8545
   WS:  ws://127.0.0.1:8545
```

If the Hardhat node is not running, you'll see a friendly error message.

### Testing

Run unit tests:
```bash
bun test
```

Run client-specific tests:
```bash
bun test src/services/chain/__tests__/client.test.ts
```

Test client connection manually (requires Hardhat node running):
```bash
bun run test:client
```

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── plugins/          # Fastify plugins
│   ├── routes/           # API route handlers
│   ├── middleware/       # Request middleware
│   ├── services/         # Business logic services
│   │   ├── chain/        # Blockchain client service
│   │   └── db/           # Database operations
│   ├── config/           # Configuration files
│   ├── db/               # Database schemas and migrations
│   └── types/            # TypeScript type definitions
├── .env.example          # Environment variable template
└── package.json
```
