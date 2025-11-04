# ChainEquity Deployment Guide

## Overview

This document describes the deployment process for ChainEquity contracts. The system uses Hardhat Ignition for deployment automation and exports contract addresses for use by backend and frontend services.

## Current Deployment Model

ChainEquity uses a **single-company deployment model**:

- One CapTable contract
- One ChainEquityToken contract
- Contracts are linked together after deployment
- Addresses are exported to `contracts/exports/deployments.json`

## Deployment Steps

### 1. Prerequisites

- Hardhat installed and configured
- Network RPC endpoint configured (local Anvil, testnet, or mainnet)
- Sufficient balance for deployment gas fees

### 2. Deploy Using Hardhat Ignition

```bash
# Deploy to local Anvil network
npx hardhat ignition deploy ignition/modules/AcmeCompany.ts --network localhost

# Deploy to testnet
npx hardhat ignition deploy ignition/modules/AcmeCompany.ts --network sepolia
```

**Note:** Use `npx hardhat` (or `bunx hardhat` if using Bun) with the path relative to the contracts directory.

### 3. Deployment Module

The `AcmeCompany.ts` Ignition module:

1. Deploys `ChainEquityToken("Acme Inc. Equity", "ACME", 1_000_000 ether)` with `1_000_000n * 10n ** 18n`
   > Note: bigint syntax is used instead of `parseEther()` for portability and consistency with other modules.
2. Deploys `CapTable("Acme Inc.", "ACME")`
3. Calls `capTable.linkToken(tokenAddress)` to link the contracts (deterministic order: token → capTable → link)

The module ensures deterministic deployment order to prevent linking failures.

### 4. Export Deployment Addresses

After deployment, export addresses to `contracts/exports/deployments.json`:

```bash
npx hardhat run scripts/export-addresses.ts --network localhost
```

This script:

- Automatically detects the active network chainId
- Reads deployed addresses from Ignition artifacts
- Writes to `contracts/exports/deployments.json` in nested format

### 5. Export Format

The deployment exports to `contracts/exports/deployments.json` in a nested network structure:

```json
{
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

This format supports multiple networks and companies. Backend and frontend services load addresses by chainId and company name.

### 6. Verify Deployment

#### Option 1: Using Verification Script

```bash
npx hardhat run scripts/verify-link.ts --network localhost
```

This script:

- Loads addresses from `exports/deployments.json`
- Verifies `capTable.isTokenLinked()` returns `true`
- Confirms token address matches
- Validates token contract is accessible

#### Option 2: Using Hardhat Console

```bash
npx hardhat console --network localhost
```

Then in the console:

```javascript
// Load addresses from deployments.json
const { networks } = require("./exports/deployments.json");
const { capTable, token } = networks["31337"].AcmeInc;

// Load CapTable contract
const cap = await ethers.getContractAt("CapTable", capTable);

// Verify token is linked
await cap.isTokenLinked(); // Should return true

// Get linked token address
await cap.token(); // Should match token address from deployments.json

// Verify token contract
const tokenContract = await ethers.getContractAt("ChainEquityToken", token);
await tokenContract.name(); // Should return "Acme Inc. Equity"
await tokenContract.symbol(); // Should return "ACME"
```

## Network Configuration

### Local Development (Anvil)

```bash
# Start Anvil
anvil

# Deploy to local network
npx hardhat ignition deploy ignition/modules/AcmeCompany.ts --network localhost

# Export addresses after deployment
npx hardhat run scripts/export-addresses.ts --network localhost

# Verify linkage
npx hardhat run scripts/verify-link.ts --network localhost
```

### Testnet (Sepolia)

```bash
# Set environment variables
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
export PRIVATE_KEY="your_private_key"

# Deploy to Sepolia
npx hardhat ignition deploy ignition/modules/AcmeCompany.ts --network sepolia

# Export addresses after deployment
npx hardhat run scripts/export-addresses.ts --network sepolia

# Verify linkage
npx hardhat run scripts/verify-link.ts --network sepolia
```

### Mainnet

```bash
# Set environment variables
export MAINNET_RPC_URL="https://mainnet.infura.io/v3/YOUR_KEY"
export PRIVATE_KEY="your_private_key"

# Deploy to Mainnet
npx hardhat ignition deploy ignition/modules/AcmeCompany.ts --network mainnet

# Export addresses after deployment
npx hardhat run scripts/export-addresses.ts --network mainnet

# Verify linkage
npx hardhat run scripts/verify-link.ts --network mainnet
```

## Post-Deployment Setup

### Backend Configuration

1. Copy `contracts/exports/deployments.json` to backend
2. Update `backend/src/config/contracts.ts` to load addresses by network:

   ```typescript
   import deployments from "../deployments.json";

   const chainId = process.env.CHAIN_ID || "31337"; // Default to localhost
   const company = deployments.networks[chainId]?.AcmeInc;

   if (!company) {
     throw new Error(`No deployment found for chain ${chainId}`);
   }

   export const capTableAddress = company.capTable;
   export const tokenAddress = company.token;
   ```

### Frontend Configuration

1. Copy `contracts/exports/deployments.json` to frontend
2. Load addresses in frontend config for Wagmi contract interactions

### Event Indexer Setup

1. Backend indexer loads contract addresses from config
2. Indexer watches events from both contracts:
   - CapTable: `TokenLinked`, `CorporateActionRecorded`
   - Token: `Issued`, `Transfer`, `SplitExecuted`, etc.

## Future Migration Plan

### Token Replacement Workflow

When token replacement is needed (symbol change, upgrade, non-virtual split), use this **off-chain migration workflow**:

#### Step 1: Snapshot Balances

1. **Backend indexer** queries all shareholder balances from old token contract
2. Snapshot stored in database with block number for consistency:
   ```json
   {
     "blockNumber": 12345,
     "totalSupply": "1000000000000000000000000",
     "shareholders": [
       {"address": "0x...", "balance": "..."},
       ...
     ]
   }
   ```
3. Verify total supply matches contract state

#### Step 2: Deploy New Token

1. Deploy new `ChainEquityToken` instance with updated parameters
2. Example: `ChainEquityToken("Acme Inc. Equity", "ACME2", 1_000_000 ether)`
3. Verify deployment success and record new contract address

#### Step 3: Mint Equivalent Balances

1. Issuer calls `mint()` on new token for each shareholder from snapshot
2. Maintain exact ownership percentages (1:1 or split-adjusted)
3. For stock splits: apply split ratio during minting
4. Verify total supply matches snapshot total

#### Step 4: Update Allowlist

1. Copy allowlist state from old token to new token
2. Call `approveWallet(address)` for each approved address
3. Maintain transfer restrictions consistency

#### Step 5: Record Corporate Action

1. Issuer calls `recordCorporateAction()` on CapTable:
   ```solidity
   bytes memory data = abi.encode(oldTokenAddress, newTokenAddress, block.number);
   capTable.recordCorporateAction("TOKEN_REPLACED", data);
   ```
2. Event emitted: `CorporateActionRecorded` with action type "TOKEN_REPLACED"
3. Indexer processes this event to track both tokens

#### Step 6: Update Configuration

1. Update `contracts/exports/deployments.json` with new token address
2. Backend indexer continues watching both old and new tokens:
   - Old token: for historical queries
   - New token: for current state

#### Step 7: Indexer Updates

1. Backend processes `CorporateActionRecorded` event
2. Updates database to track both token addresses
3. Continues indexing events from both tokens

### Migration Verification Checklist

- [ ] Snapshot balances match old token total supply
- [ ] New token total supply matches snapshot (or split-adjusted)
- [ ] All shareholder balances preserved
- [ ] Allowlist state copied to new token
- [ ] Corporate action recorded in CapTable
- [ ] Deployment JSON updated
- [ ] Indexer configured to watch both tokens
- [ ] Historical queries still work with old token
- [ ] Current queries use new token

### Future On-Chain Migration

After Phase 2, consider implementing on-chain migration via `ITokenReplacement` interface:

- Automated balance migration
- Gas-optimized batch operations
- Built-in verification mechanisms

See `TokenReplacement.md` for complete design documentation.

## Troubleshooting

### Developer Notes

> **Note:** Bun may throw module resolution errors for Hardhat Ignition imports. Use Node for deployments or ensure Bun's module resolution is configured properly. If you encounter `Cannot find module '@nomicfoundation/hardhat-ignition/modules'` errors, try using `npx` instead of `bunx` for Hardhat commands.

### Common Gotchas

#### Link Call Order

- **Problem:** Token linking fails with "token already linked" or "token address cannot be zero"
- **Solution:** Ensure deployment order is: token → capTable → link. The Ignition module handles this automatically, but if manually deploying, deploy token first.

#### Wrong Network ID

- **Problem:** Export script finds addresses but writes to wrong chainId, or verification fails
- **Solution:** Always run export/verify scripts with the same `--network` flag used for deployment. The script auto-detects chainId from the active network.

#### Missing Exports Folder

- **Problem:** Export script fails with "ENOENT" error
- **Solution:** Ensure `contracts/exports/` directory exists. The `.gitkeep` file ensures it's tracked in git, but if missing, create it manually.

#### Deployment Address Not Found

- **Problem:** Export script fails with "Could not find AcmeCompany deployment addresses"
- **Solution:** Verify the module was deployed with the exact name "AcmeCompany". Check `ignition/deployments/chain-{chainId}/deployed_addresses.json` for the correct key format: `AcmeCompany#ChainEquityToken` and `AcmeCompany#CapTable`.

### Deployment Fails

- Check network RPC endpoint is accessible
- Verify account has sufficient balance for gas
- Check contract compilation errors
- Ensure Hardhat network configuration matches the network you're deploying to

### Token Linking Fails

- Verify both contracts deployed successfully (check Ignition deployment artifacts)
- Check CapTable owner is correct (should be deployer address)
- Ensure token address is not zero
- Verify deployment order: token must be deployed before CapTable attempts to link

### Address Export Missing

- Check Ignition module exports addresses correctly
- Verify `contracts/exports/` directory exists (contains `.gitkeep`)
- Check file permissions
- Run export script with the same network flag as deployment
- Verify Ignition deployment artifacts exist at `ignition/deployments/chain-{chainId}/deployed_addresses.json`

### Verification Script Fails

- Ensure `export-addresses.ts` was run after deployment
- Check that `exports/deployments.json` exists and contains the correct chainId
- Verify the network flag matches the deployment network
- Confirm CapTable contract is accessible at the deployed address

## Related Documentation

- `TokenReplacement.md` - Token replacement design (future)
- `ITokenReplacement.sol` - Token replacement interface (placeholder)
- `architecture.md` - System architecture overview
