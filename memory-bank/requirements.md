# Project Requirements

Based on ChainEquity.pdf specification.

## Deliverables

1. **Gated token contract** (allowlist-based transfer restrictions)
2. **Issuer service** for wallet approval and token minting
3. **Event indexer** producing cap-table snapshots
4. **Corporate action system** (splits, symbol changes)
5. **Operator UI or CLI** for demonstrations
6. **Test suite and gas benchmarks**
7. **Technical writeup** with decision rationale

## Core Requirements

### 1. Gated Token Contract

Create a token representing synthetic equity with transfer restrictions:

- Standard token interface (ERC-20, SPL Token, or equivalent)
- Allowlist mechanism: only approved wallets can send/receive
- Transfer validation: check sender AND recipient allowlist status
- Revert transfers if either party not approved
- Emit events for all transfers and approvals
- Owner/admin controls for allowlist management

**Example flow:**
- Wallet A requests approval → Admin approves → Wallet A added to allowlist
- Wallet B not approved
- Transfer from A to B → FAILS (B not on allowlist)
- Admin approves B
- Transfer from A to B → SUCCESS (both on allowlist)

### 2. Issuer Service (Off-Chain)

Build a minimal backend for operator workflows:

- Approve/deny wallet addresses (KYC mock)
- Submit allowlist updates to contract
- Mint tokens to approved wallets
- Query allowlist status
- Trigger corporate actions

**Implementation options:**
- Node.js/Python backend with web3 library
- CLI tool with commands for each operation
- Simple admin dashboard (minimal UI)

### 3. Event Indexing & Cap-Table Export

Index blockchain events to produce ownership records:

- Listen for Transfer, Mint, Burn events
- Maintain current balance per wallet
- Generate "as-of block" snapshots
- Export cap-table in CSV/JSON format
- Include: wallet address, balance, percentage ownership
- Query historical cap-table at any block height

**Example cap-table output:**
```
Wallet          | Balance | Ownership %
0x1234...5678   | 10,000  | 50%
0xabcd...ef01   | 7,000   | 35%
0x9876...4321   | 3,000   | 15%
```

### 4. Corporate Actions (Required: 2 Types)

#### Action 1: Stock Split (7-for-1)

**Requirements:**
- Multiply all balances by 7
- Maintain proportional ownership (percentages unchanged)
- Update total supply accordingly
- Emit event documenting the split
- Example: Wallet with 2 shares → 14 shares after split

**Implementation approaches:**
- Option A: Iterate through all holders and update balances on-chain (gas intensive)
- Option B: Deploy new contract with multiplied supply, migrate holders
- Option C: Keep balances unchanged but adjust display logic (virtual split)
- Document your choice and tradeoffs

#### Action 2: Symbol/Ticker Change

**Requirements:**
- Change token symbol/ticker (e.g., "OLD" → "NEW")
- Preserve all balances and ownership
- Update metadata visible to explorers/wallets
- Emit event documenting the change
- Example: Wallets holding "ACME" now show "ACMEX"

**Implementation approaches:**
- Option A: Update contract metadata (if mutable)
- Option B: Deploy new contract with new symbol, migrate balances
- Option C: Wrapper contract that proxies to original
- Document your choice and tradeoffs

### 5. Operator Demo (UI or CLI)

Build a demonstration showing:

- Mint tokens to approved wallet → SUCCESS
- Transfer between two approved wallets → SUCCESS
- Transfer to non-approved wallet → BLOCKED
- Approve new wallet → Transfer now succeeds
- Execute 7-for-1 split → Balances multiply by 7
- Change ticker symbol → Symbol updates, balances unchanged
- Export cap-table at specific block

**Format options:**
- CLI with commands: approve-wallet, mint, transfer, split, change-symbol, export-cap-table
- Simple web UI with buttons for each operation
- Scripted demo (JavaScript/Python) that runs automatically

## Technical Architecture

### Chain Selection

Choose a blockchain and justify your decision:

- Ethereum (Sepolia testnet): Most mature ecosystem, ERC-20 standard, high gas costs
- Polygon (Mumbai testnet): EVM-compatible, low fees, fast finality
- Solana (Devnet): High throughput, low cost, different programming model (Rust)
- Arbitrum/Optimism: L2 with lower fees, EVM-compatible
- Local devnet: Ganache, Hardhat Network, Anvil, or solana-test-validator

**Requirements:**
- Must be movable to public chain (even if you develop locally)
- Document deployment addresses and transaction hashes
- Include reproducible setup scripts
- If using testnet, never use real funds

### Smart Contract Stack

**Ethereum/EVM options:**
- Solidity with Hardhat or Foundry
- OpenZeppelin contracts for ERC-20 base
- Custom allowlist logic on top

**Solana options:**
- Rust with Anchor framework
- SPL Token program as base
- Custom program for transfer hooks

### Backend/Indexer

**Suggested tools:**
- Node.js: ethers.js, web3.js, or @solana/web3.js
- Python: web3.py or solana-py
- Event listening: WebSocket subscriptions or polling
- Storage: In-memory, SQLite, or PostgreSQL for cap-table

## Code Quality Requirements

- Clean, readable code with clear separation (contracts / backend / indexer)
- One-command setup: make dev, docker-compose up, or equivalent
- Concise README with setup, deployment, and demo instructions
- Test suite: unit tests for contracts, integration tests for flows
- Deterministic demo scripts that can be run repeatedly
- Decision log documenting key architectural choices
- Gas report for all contract operations
- Environment variables for secrets (.env.example provided)

## Success Criteria

### Evaluation Metrics

| Category | Metric | Target |
|----------|--------|--------|
| Correctness | False-positive transfers (non-allowlisted) | 0 |
| Correctness | False-negative blocks (allowlisted) | 0 |
| Operability | "As-of block" cap-table export | Generated successfully |
| Corporate Actions | Split and symbol change both work | Demonstrated |
| Performance | Transfer confirmation time | Within testnet norms |
| Performance | Indexer produces cap-table | <10s after finality |
| Documentation | Chain/standard rationale documented | Clear and justified |

### Additional Requirements

- Admin safety controls prevent unauthorized minting/approval
- Gas report shows reasonable costs for all operations
- Test coverage for happy path and failure scenarios
- Reproducible setup (anyone can run your demo)
- Risks/limitations documented (no false compliance claims)

## Required Test Scenarios

1. Approve wallet → Mint tokens → Verify balance
2. Transfer between two approved wallets → SUCCESS
3. Transfer from approved to non-approved → FAIL
4. Transfer from non-approved to approved → FAIL
5. Revoke approval → Previously approved wallet can no longer receive
6. Execute 7-for-1 split → All balances multiply by 7, total supply updates
7. Change symbol → Metadata updates, balances unchanged
8. Export cap-table at block N → Verify accuracy
9. Export cap-table at block N+10 → Verify changes reflected
10. Unauthorized wallet attempts admin action → FAIL

## Gas Benchmarks (EVM Chains)

| Operation | Target Gas |
|-----------|------------|
| Mint tokens | <100k gas |
| Approve wallet | <50k gas |
| Transfer (gated) | <100k gas |
| Revoke approval | <50k gas |
| Stock split (per holder) | Document actual cost |

