# Testing the Event Indexer

## Prerequisites

1. **Blockchain Node Running**: You need a local Hardhat/Anvil node or a testnet connection
2. **Contracts Deployed**: Contracts must be deployed and addresses exported
3. **Database Initialized**: Database must be migrated

## Quick Test Steps

### 1. Start Local Blockchain Node

```bash
cd contracts
bun run local:node
# Or: npx hardhat node
```

Keep this running in a separate terminal.

### 2. Deploy Contracts (if not already deployed)

```bash
cd contracts
bun run deploy:acme
# This will:
# - Deploy contracts
# - Export addresses to exports/deployments.json
# - Verify deployment
```

### 3. Initialize Database

```bash
cd backend
bun run db:setup
# This will:
# - Run migrations
# - Seed database
```

### 4. Test Indexer Connection

```bash
cd backend
bun run scripts/test-indexer.ts
```

This will:
- Test blockchain connection
- Verify contract addresses are loaded
- Test contract accessibility
- Start and stop the indexer

### 5. Start Backend Server (Full Test)

```bash
cd backend
bun run dev
```

The indexer will automatically start when the server starts. You should see:
- `🚀 Starting event indexer...`
- `📊 Last indexed block: X`
- `🔍 Scanning blocks X to Y` (if there are blocks to catch up)
- `👀 Starting event watchers...`
- `✅ Event indexer started`

### 6. Generate Test Events

To test event indexing, you can interact with the contracts:

```bash
cd contracts
bunx hardhat console --network localhost
```

Then in the console:

```javascript
// Load contracts
const { networks } = require("./exports/deployments.json");
const { capTable, token } = networks["31337"].AcmeInc;
const tokenContract = await ethers.getContractAt("ChainEquityToken", token);

// Get a test account
const [owner, alice] = await ethers.getSigners();

// Approve wallet for transfers
await tokenContract.approveWallet(alice.address);

// Mint tokens (triggers Issued event)
await tokenContract.mint(alice.address, ethers.parseEther("1000"));

// Transfer tokens (triggers Transfer event)
await tokenContract.transfer(owner.address, ethers.parseEther("100"));
```

You should see events being indexed in the backend logs.

### 7. Verify Database

Check that events were stored:

```bash
cd backend
bun run scripts/verify-db.ts  # (if you create this script)
```

Or manually:

```bash
sqlite3 data/chain-equity.db "SELECT COUNT(*) FROM events;"
sqlite3 data/chain-equity.db "SELECT COUNT(*) FROM transactions;"
sqlite3 data/chain-equity.db "SELECT COUNT(*) FROM shareholders;"
```

## Troubleshooting

### "Failed to load deployments.json"
- Make sure contracts are deployed: `cd contracts && bun run deploy:acme`

### "Cannot connect to blockchain node"
- Make sure Hardhat node is running: `cd contracts && bun run local:node`

### "No deployment found for chainId 31337"
- Check that `contracts/exports/deployments.json` exists and has the correct structure

### Indexer not processing events
- Check that contracts are deployed and linked
- Verify contract addresses in logs match deployed addresses
- Check that events are actually being emitted (use Hardhat console to verify)

## Manual Testing Checklist

- [ ] Blockchain node running
- [ ] Contracts deployed
- [ ] Database migrated
- [ ] Indexer starts without errors
- [ ] Events are stored in database
- [ ] Shareholder balances are updated
- [ ] Transactions table is populated
- [ ] Real-time watchers work (new events are indexed immediately)
