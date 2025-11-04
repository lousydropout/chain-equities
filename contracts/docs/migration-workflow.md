# Token Migration Workflow Guide

## Overview

This guide provides step-by-step instructions for migrating from an old ChainEquityToken instance to a new one. This workflow is used for symbol changes, contract upgrades, and regulatory compliance scenarios.

**Prerequisites**:
- Access to issuer wallet (CapTable owner)
- Backend indexer operational (Phase 2)
- Testnet testing completed
- Balance snapshot capability

## Migration Workflow

### Step 1: Pre-Migration Planning

#### 1.1 Determine Migration Reason

Document the reason for migration:
- Symbol change (new ERC20 symbol required)
- Contract upgrade (security, features, gas optimization)
- Regulatory compliance (new regulations require changes)

#### 1.2 Coordinate with Stakeholders

- Notify shareholders of upcoming migration (if applicable)
- Schedule migration window (coordinate with operations)
- Prepare rollback plan (if migration fails)

#### 1.3 Backup Current State

- Export current cap table state
- Verify backend indexer is up-to-date
- Document current token address and parameters

### Step 2: Balance Snapshot

#### 2.1 Query All Shareholder Balances

Use backend API or direct contract queries to get all balances:

```typescript
// Example: Query all balances from backend API
const snapshot = await fetch('/api/shareholders');
const shareholders = await snapshot.json();

// Or query directly from contract
const totalSupply = await tokenContract.totalSupply();
const shareholders = await getAllShareholders(tokenContract);
```

#### 2.2 Record Snapshot Block Number

**Critical**: Record the exact block number when snapshot is taken. This ensures consistency.

```typescript
const snapshotBlockNumber = await provider.getBlockNumber();
```

#### 2.3 Verify Snapshot Integrity

- Calculate sum of all balances
- Verify sum equals `totalSupply()` from contract
- Check for any zero-balance addresses (can be skipped)
- Document total number of shareholders

#### 2.4 Store Snapshot

Save snapshot with metadata:

```json
{
  "blockNumber": 12345,
  "timestamp": 1234567890,
  "oldTokenAddress": "0x...",
  "totalSupply": "1000000000000000000000000",
  "shareholderCount": 150,
  "shareholders": [
    {
      "address": "0xAlice",
      "balance": "500000000000000000000000",
      "effectiveBalance": "500000000000000000000000"
    },
    {
      "address": "0xBob",
      "balance": "300000000000000000000000",
      "effectiveBalance": "300000000000000000000000"
    }
  ]
}
```

### Step 3: Deploy New Token

#### 3.1 Prepare Deployment Parameters

Extract parameters from old token or set new values:

```typescript
// Get parameters from old token
const oldName = await oldToken.name();
const oldSymbol = await oldToken.symbol();
const oldTotalAuthorized = await oldToken.totalAuthorized();

// For symbol change, use new symbol
const newSymbol = "ACME2"; // New symbol
const newName = oldName.replace("ACME", "ACME2"); // Or new name
const newTotalAuthorized = oldTotalAuthorized; // Usually same
```

#### 3.2 Deploy New Token Contract

Deploy using Hardhat Ignition or deployment script:

```typescript
// Using Hardhat Ignition
const { ChainEquityToken } = await ignition.deploy("AcmeCompany", {
  parameters: {
    ChainEquityToken: {
      name: newName,
      symbol: newSymbol,
      totalAuthorized: newTotalAuthorized
    }
  }
});

const newTokenAddress = await ChainEquityToken.getAddress();
```

#### 3.3 Verify Deployment

- Verify contract deployed successfully
- Check token address is valid
- Verify name, symbol, and totalAuthorized match expected values
- Confirm issuer is set as owner

### Step 4: Migrate Balances

#### 4.1 Mint Balances to New Token

For each shareholder in snapshot, mint equivalent balance:

```typescript
// Connect to new token contract
const newToken = await ethers.getContractAt("ChainEquityToken", newTokenAddress, issuer);

// Mint balances for each shareholder
for (const shareholder of snapshot.shareholders) {
  if (shareholder.balance > 0) {
    const tx = await newToken.mint(shareholder.address, shareholder.balance);
    await tx.wait();
    console.log(`Minted ${shareholder.balance} to ${shareholder.address}`);
  }
}
```

**Important**: 
- Mint balances in order (recommended: sort by balance descending for gas efficiency)
- Wait for each transaction to confirm before proceeding
- Handle errors gracefully (log and continue)

#### 4.2 Verify Total Supply

After all mints complete, verify:

```typescript
const newTotalSupply = await newToken.totalSupply();
const expectedSupply = snapshot.totalSupply;

if (newTotalSupply.toString() !== expectedSupply) {
  throw new Error(`Total supply mismatch: expected ${expectedSupply}, got ${newTotalSupply}`);
}
```

**Critical**: Do not proceed if total supply doesn't match!

### Step 5: Migrate Allowlist

#### 5.1 Query Old Token Allowlist

Get all approved addresses from old token:

```typescript
// Query all approved addresses (requires indexer or event scanning)
const approvedAddresses = await getApprovedAddresses(oldToken);

// Or query known addresses
const knownAddresses = snapshot.shareholders.map(s => s.address);
const approvedAddresses = [];
for (const addr of knownAddresses) {
  const isApproved = await oldToken.isApproved(addr);
  if (isApproved) {
    approvedAddresses.push(addr);
  }
}
```

#### 5.2 Copy Allowlist to New Token

Approve each address on new token:

```typescript
const newToken = await ethers.getContractAt("ChainEquityToken", newTokenAddress, issuer);

for (const address of approvedAddresses) {
  const tx = await newToken.approveWallet(address);
  await tx.wait();
  console.log(`Approved ${address} on new token`);
}
```

#### 5.3 Verify Allowlist State

Verify all addresses are approved:

```typescript
for (const address of approvedAddresses) {
  const isApproved = await newToken.isApproved(address);
  if (!isApproved) {
    throw new Error(`Address ${address} not approved on new token`);
  }
}
```

### Step 6: Copy Transfer Restrictions

#### 6.1 Check Old Token Restrictions

```typescript
const oldRestrictions = await oldToken.transfersRestricted();
```

#### 6.2 Set New Token Restrictions

```typescript
const newToken = await ethers.getContractAt("ChainEquityToken", newTokenAddress, issuer);
await newToken.setTransfersRestricted(oldRestrictions);
```

### Step 7: Record Corporate Action

#### 7.1 Prepare Encoded Data

Encode replacement data for CapTable:

```typescript
const oldTokenAddress = oldToken.address;
const newTokenAddress = newTokenAddress;
const migrationBlockNumber = snapshot.blockNumber;

const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "address", "uint256"],
  [oldTokenAddress, newTokenAddress, migrationBlockNumber]
);
```

#### 7.2 Record Corporate Action

Call `recordCorporateAction` on CapTable:

```typescript
const capTable = await ethers.getContractAt("CapTable", capTableAddress, issuer);

const tx = await capTable.recordCorporateAction("TOKEN_REPLACED", encodedData);
const receipt = await tx.wait();

// Verify event was emitted
const event = receipt.logs.find(log => {
  const parsed = capTable.interface.parseLog(log);
  return parsed?.name === "CorporateActionRecorded" && parsed.args.actionType === "TOKEN_REPLACED";
});

if (!event) {
  throw new Error("CorporateActionRecorded event not found");
}
```

#### 7.3 Verify Corporate Action Recorded

Query the recorded action:

```typescript
const actionCount = await capTable.getCorporateActionCount();
const action = await capTable.getCorporateAction(actionCount);

console.log("Action ID:", action.id.toString());
console.log("Action Type:", action.actionType);
console.log("Block Number:", action.blockNumber.toString());
```

### Step 8: Update Backend Indexer

#### 8.1 Process Corporate Action Event

Backend indexer should automatically process `CorporateActionRecorded` event:

```typescript
// Backend indexer logic (Phase 2)
indexer.on("CorporateActionRecorded", async (event) => {
  if (event.actionType === "TOKEN_REPLACED") {
    const [oldToken, newToken, migrationBlock] = decodeTokenReplacementData(event.data);
    
    // Update database to track both tokens
    await db.updateTokenMapping({
      oldToken,
      newToken,
      migrationBlock,
      actionId: event.actionId
    });
    
    // Start indexing new token
    await indexer.watchToken(newToken);
  }
});
```

#### 8.2 Verify Indexer Updates

- Check database for token mapping entry
- Verify new token events are being indexed
- Confirm old token events still accessible

### Step 9: Post-Migration Verification

#### 9.1 Verify All Balances

Compare balances between old and new tokens:

```typescript
for (const shareholder of snapshot.shareholders) {
  const oldBalance = await oldToken.balanceOf(shareholder.address);
  const newBalance = await newToken.balanceOf(shareholder.address);
  
  if (oldBalance.toString() !== newBalance.toString()) {
    throw new Error(`Balance mismatch for ${shareholder.address}`);
  }
}
```

#### 9.2 Verify Allowlist

Compare allowlist states:

```typescript
for (const address of approvedAddresses) {
  const oldApproved = await oldToken.isApproved(address);
  const newApproved = await newToken.isApproved(address);
  
  if (oldApproved !== newApproved) {
    throw new Error(`Allowlist mismatch for ${address}`);
  }
}
```

#### 9.3 Verify Transfer Restrictions

```typescript
const oldRestricted = await oldToken.transfersRestricted();
const newRestricted = await newToken.transfersRestricted();

if (oldRestricted !== newRestricted) {
  throw new Error("Transfer restrictions mismatch");
}
```

#### 9.4 Verify Total Supply

```typescript
const oldSupply = await oldToken.totalSupply();
const newSupply = await newToken.totalSupply();

if (oldSupply.toString() !== newSupply.toString()) {
  throw new Error(`Total supply mismatch: ${oldSupply} vs ${newSupply}`);
}
```

### Step 10: Update Frontend/Backend Configuration

#### 10.1 Update Contract Addresses

Update configuration files:

```typescript
// backend/src/config/contracts.ts
export const contracts = {
  tokenAddress: newTokenAddress, // Updated
  capTableAddress: capTableAddress, // Unchanged
  // Keep old token address for historical queries
  oldTokenAddress: oldTokenAddress
};
```

#### 10.2 Update Frontend Configuration

```typescript
// frontend/src/config/contracts.ts
export const CONTRACT_ADDRESSES = {
  token: newTokenAddress, // Updated
  capTable: capTableAddress, // Unchanged
};
```

### Step 11: Communicate Migration

#### 11.1 Notify Shareholders

- Inform shareholders of migration completion
- Provide new token address
- Update documentation and support materials

#### 11.2 Update Documentation

- Update deployment addresses
- Document migration in corporate action history
- Update API documentation

## Complete Example: Symbol Change Migration

### Scenario

Migrate from "ACME" token to "ACME2" token for rebranding.

### Step-by-Step Execution

```typescript
// 1. Snapshot balances
const snapshot = {
  blockNumber: 12345,
  totalSupply: "1000000000000000000000000",
  shareholders: [
    { address: "0xAlice", balance: "500000000000000000000000" },
    { address: "0xBob", balance: "300000000000000000000000" },
    { address: "0xCharlie", balance: "200000000000000000000000" }
  ]
};

// 2. Deploy new token
const newToken = await deployToken("Acme Inc. Equity", "ACME2", 1_000_000 ether);
const newTokenAddress = await newToken.getAddress();

// 3. Mint balances
await newToken.mint("0xAlice", "500000000000000000000000");
await newToken.mint("0xBob", "300000000000000000000000");
await newToken.mint("0xCharlie", "200000000000000000000000");

// 4. Verify total supply
const newSupply = await newToken.totalSupply();
console.assert(newSupply.toString() === snapshot.totalSupply, "Supply mismatch");

// 5. Copy allowlist
await newToken.approveWallet("0xAlice");
await newToken.approveWallet("0xBob");
await newToken.approveWallet("0xCharlie");

// 6. Set transfer restrictions
const oldRestricted = await oldToken.transfersRestricted();
await newToken.setTransfersRestricted(oldRestricted);

// 7. Record corporate action
const data = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "address", "uint256"],
  [oldTokenAddress, newTokenAddress, snapshot.blockNumber]
);
await capTable.recordCorporateAction("TOKEN_REPLACED", data);

// 8. Verify everything
// ... verification steps ...
```

## Verification Checklist

Use this checklist before considering migration complete:

- [ ] Balance snapshot recorded at specific block number
- [ ] New token deployed with correct parameters
- [ ] All balances minted to new token
- [ ] Total supply matches snapshot
- [ ] All allowlist addresses copied
- [ ] Transfer restrictions match old token
- [ ] Corporate action recorded in CapTable
- [ ] Corporate action event emitted
- [ ] Backend indexer updated
- [ ] All balances verified (old vs new)
- [ ] Allowlist verified
- [ ] Transfer restrictions verified
- [ ] Total supply verified
- [ ] Frontend/backend configuration updated
- [ ] Shareholders notified

## Common Pitfalls and Solutions

### Pitfall 1: Balance Mismatch

**Problem**: Total supply doesn't match after migration

**Solution**: 
- Verify snapshot was taken at consistent block
- Check for rounding errors in calculations
- Ensure all shareholders were included in minting

### Pitfall 2: Missing Allowlist Addresses

**Problem**: Some addresses not approved on new token

**Solution**:
- Use event scanning to find all approved addresses
- Verify allowlist state before migration
- Create allowlist verification script

### Pitfall 3: Indexer Gaps

**Problem**: Events missed during migration window

**Solution**:
- Use rescan service to fill gaps
- Verify indexer processes both old and new tokens
- Check database for missed events

### Pitfall 4: Gas Costs

**Problem**: Migration too expensive for large shareholder lists

**Solution**:
- Batch operations where possible
- Consider off-peak hours for lower gas prices
- Plan for sufficient gas budget

## Integration with Phase 2 Backend

### Indexer Requirements

Backend indexer must:
1. Process `CorporateActionRecorded` events with type "TOKEN_REPLACED"
2. Decode replacement data to extract old/new token addresses
3. Update database to track token version mappings
4. Continue indexing events from both tokens
5. Handle historical queries for old token events

### Database Schema

```sql
-- Token replacement tracking
CREATE TABLE token_replacements (
  id INTEGER PRIMARY KEY,
  old_token_address TEXT NOT NULL,
  new_token_address TEXT NOT NULL,
  migration_block_number INTEGER NOT NULL,
  action_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (action_id) REFERENCES corporate_actions(id)
);

-- Token version tracking
CREATE TABLE token_versions (
  token_address TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,
  replaced_at TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

## Testing on Testnet

**Always test migration on testnet first!**

1. Deploy test contracts
2. Create test shareholders with various balances
3. Execute full migration workflow
4. Verify all steps complete successfully
5. Test indexer integration
6. Document any issues or improvements

## Rollback Plan

If migration fails, have a rollback plan:

1. **Stop Migration**: Don't record corporate action if verification fails
2. **Document Issues**: Log all problems encountered
3. **Fix Issues**: Address problems before retrying
4. **Retry Migration**: Start from beginning after fixes
5. **Alternative**: Consider using old token if issues persist

## Security Best Practices

1. **Multi-Sig**: Use multi-sig wallet for issuer operations
2. **Verification**: Verify every step before proceeding
3. **Testing**: Always test on testnet first
4. **Audit Trail**: Document all migration steps
5. **Backup**: Keep backups of all snapshots and state
6. **Coordination**: Coordinate with operations team
7. **Monitoring**: Monitor gas costs and transaction status

## Next Steps

After migration:
1. Monitor new token for any issues
2. Verify backend indexer is processing correctly
3. Update all documentation
4. Communicate with stakeholders
5. Archive old token address (but keep accessible)

## Related Documentation

- **Token Replacement Guide**: `docs/token-replacement.md` - Comprehensive replacement guide
- **Design Document**: `contracts/TokenReplacement.md` - Original design document
- **CapTable Contract**: `contracts/CapTable.sol` - Corporate action recording

