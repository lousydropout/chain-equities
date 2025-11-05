# End-to-End Testing Guide for Event Indexer

This guide walks you through testing the event indexer from start to finish.

## Prerequisites

- Bun installed
- Node.js/npm installed (for Hardhat)
- Contracts directory set up with dependencies

## Quick Start (Automated)

For a quick automated test, run:

```bash
# Terminal 1: Start blockchain node
cd contracts
bun run local:node

# Terminal 2: Run full test suite
cd backend
bun run scripts/test-e2e.sh  # (if you create this)
```

## Manual Step-by-Step Testing

### Step 1: Start Blockchain Node

Open **Terminal 1** and start a local Hardhat node:

```bash
cd contracts
bun run local:node
# Or: npx hardhat node
```

Keep this terminal running. You should see:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
```

### Step 2: Deploy Contracts

In **Terminal 2**, deploy the contracts:

```bash
cd contracts
bun run deploy:acme
```

This will:
- Deploy CapTable and Token contracts
- Link them together
- Export addresses to `exports/deployments.json`
- Verify deployment

Expected output:
```
✅ DEPLOYMENT VERIFICATION COMPLETE
All checks passed
```

### Step 3: Initialize Database

In **Terminal 2**, reset and initialize the database:

```bash
cd backend
bun run db:reset --yes
bun run db:migrate
```

This ensures a clean database state for testing.

### Step 4: Start Backend Server with Indexer

In **Terminal 2**, start the backend server:

```bash
cd backend
bun run dev
```

You should see:
```
✅ Database initialized
🚀 Starting event indexer...
📊 Last indexed block: -1
📦 Current block: X, Safe block: Y
🔍 Scanning blocks...
👀 Starting event watchers...
✅ Event indexer started
🚀 Server listening on http://localhost:4000
```

**Keep this running** - the indexer needs to be active to capture events.

### Step 5: Generate Test Events

Open **Terminal 3** and generate test events:

```bash
cd backend
bun run scripts/generate-test-events.ts
```

This script will:
1. Approve wallets for Alice and Bob
2. Mint 1000 tokens to Alice (Issued event)
3. Mint 500 tokens to Bob (Issued event)
4. Transfer 100 tokens from Alice to Bob (Transfer event)
5. Execute a 2-for-1 stock split (SplitExecuted event)
6. Record a corporate action (CorporateActionRecorded event)

Expected output:
```
🎬 Generating test events...
1️⃣ Approving wallet for Alice...
   ✅ Approved: 0x...
2️⃣ Approving wallet for Bob...
   ✅ Approved: 0x...
3️⃣ Minting 1000 tokens to Alice...
   ✅ Minted: 0x...
4️⃣ Minting 500 tokens to Bob...
   ✅ Minted: 0x...
5️⃣ Transferring 100 tokens from Alice to Bob...
   ✅ Transferred: 0x...
6️⃣ Executing 2-for-1 stock split...
   ✅ Split executed: 0x...
7️⃣ Recording corporate action...
   ✅ Action recorded: 0x...
✅ All test events generated!
```

### Step 6: Verify Indexed Data

In **Terminal 3**, verify that events were indexed:

```bash
cd backend
bun run scripts/verify-indexed-data.ts
```

This will show:
- Events table contents
- Transactions table contents
- Shareholders table with balances
- Corporate actions table
- Summary statistics

Expected output:
```
🔍 Verifying indexed data...

1️⃣ Checking events table...
   Total events: 7
   Event types:
     - Transfer: 3
     - Issued: 2
     - SplitExecuted: 1
     - CorporateActionRecorded: 1
   ✅ Events table has data

2️⃣ Checking transactions table...
   Total transactions: 3
   Transaction types:
     - ISSUED: 2
     - TRANSFER: 1
   ✅ Transactions table has data

3️⃣ Checking shareholders table...
   Total shareholders: 2
   Shareholders:
     - Alice: 900 (effective: 1800)
     - Bob: 600 (effective: 1200)
   ✅ Shareholders table has data

4️⃣ Checking corporate actions table...
   Total corporate actions: 1
   ✅ Corporate actions table has data

✅ All verification checks passed!
```

### Step 7: Check Backend Logs

In **Terminal 2** (where the server is running), you should see real-time event processing:

```
✅ Issued 1000000000000000000000 tokens to 0x... at block 6
✅ Issued 500000000000000000000 tokens to 0x... at block 7
🔄 Transfer 100000000000000000000 from 0x... to 0x... at block 8
📊 SplitExecuted: 1000000000000000000 → 2000000000000000000 at block 9
📋 CorporateActionRecorded: TEST_ACTION at block 10
```

## Manual Database Verification

You can also verify data directly in the database:

```bash
cd backend

# Check events
sqlite3 data/chain-equity.db "SELECT event_type, COUNT(*) FROM events GROUP BY event_type;"

# Check transactions
sqlite3 data/chain-equity.db "SELECT event_type, from_address, to_address, amount FROM transactions;"

# Check shareholders
sqlite3 data/chain-equity.db "SELECT address, balance, effective_balance FROM shareholders;"

# Check corporate actions
sqlite3 data/chain-equity.db "SELECT action_type, block_number FROM corporate_actions;"
```

## Expected Results

After running all steps, you should have:

- **7 events** in the events table
- **3 transactions** in the transactions table (2 ISSUED, 1 TRANSFER)
- **2 shareholders** with correct balances:
  - Alice: 900 base → 1800 effective (after 2x split)
  - Bob: 600 base → 1200 effective (after 2x split)
- **1 corporate action** recorded

## Troubleshooting

### "Cannot connect to blockchain node"
- Make sure Hardhat node is running in Terminal 1
- Check that it's listening on port 8545

### "Failed to load deployments.json"
- Run `cd contracts && bun run deploy:acme` first
- Check that `exports/deployments.json` exists

### "No events found in database"
- Make sure backend server is running when you generate events
- Check backend logs for errors
- Verify contracts are deployed and linked

### "Shareholder balances incorrect"
- Check that split factor is being queried correctly
- Verify effective balance calculation: `balance * splitFactor / 1e18`

## Testing Individual Components

### Test Just the Connection

```bash
cd backend
bun run scripts/test-indexer.ts
```

This tests:
- Blockchain connection
- Contract address loading
- Indexer start/stop

### Generate Events Without Verification

```bash
cd backend
bun run scripts/generate-test-events.ts
```

### Verify Data Without Generating Events

```bash
cd backend
bun run scripts/verify-indexed-data.ts
```

## Clean State Testing

To test from a completely clean state:

```bash
# Stop all services
pkill -f "hardhat node"
pkill -f "bun run src/index.ts"

# Reset database
cd backend
bun run db:reset --yes

# Start fresh
cd contracts
bun run local:node &  # Run in background

cd backend
bun run db:migrate
bun run dev &  # Run in background

# Generate events
bun run scripts/generate-test-events.ts

# Verify
bun run scripts/verify-indexed-data.ts
```

## Next Steps

After successful testing, you can:
1. Integrate with the REST API (Task 2.6-2.9)
2. Add more comprehensive tests
3. Test edge cases (reorgs, large event volumes, etc.)

