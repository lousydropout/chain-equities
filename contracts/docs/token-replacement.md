# Token Replacement Guide

## Overview

This document provides comprehensive guidance on token replacement strategies for ChainEquityToken instances. Token replacement is a critical operation that allows companies to migrate to new token contracts while preserving ownership continuity and historical traceability.

## Design Decision: Virtual Stock Splits

**Decision: Keep Virtual Stock Splits (No Replacement Needed)**

The system uses a **virtual stock split** mechanism via the `splitFactor` state variable. This approach is gas-efficient and eliminates the need for token replacement in most stock split scenarios.

### Rationale

1. **Gas Efficiency**: Virtual splits don't require iterating through all shareholder balances, making them extremely gas-efficient even for large cap tables
2. **Already Implemented**: The `executeSplit()` function and `effectiveBalanceOf()` view function provide full split functionality
3. **No Migration Needed**: Virtual splits maintain ownership percentages without requiring contract migration
4. **Indexer-Friendly**: The `SplitExecuted` event with indexed parameters allows efficient backend filtering

### How Virtual Splits Work

- **Split Factor**: Stored as `uint256` with 1e18 precision (1e18 = 1x, 7e18 = 7-for-1 split)
- **Base Balances**: Actual token balances remain unchanged
- **Effective Balances**: Calculated as `balance * splitFactor / 1e18` via `effectiveBalanceOf()`
- **Display Logic**: Frontend and backend indexers use effective balances for display

### When Replacement Might Be Needed

Token replacement for stock splits would only be necessary if:
- Regulatory requirements mandate actual balance changes (not just display)
- Integration with external systems requires real balance modifications
- Company policy requires on-chain balance updates

**Current Recommendation**: Use virtual splits for all stock split scenarios.

## Scenarios Requiring Token Replacement

### 1. Symbol Changes

**Scenario**: Company rebrands and needs a new ERC20 token symbol (e.g., "ACME" → "ACME2")

**Current Capability**: 
- Virtual symbol changes via `SymbolChanged` event (already implemented)
- Event is emitted when `changeSymbol()` is called
- Backend indexers can track symbol changes via events

**When Replacement Needed**:
- If the actual ERC20 `symbol()` return value must change
- ERC20 symbols are immutable in OpenZeppelin's implementation
- Requires deploying a new token contract with the new symbol

**Migration Approach**: Off-chain workflow with on-chain verification (see Migration Workflow Guide)

### 2. Contract Upgrades

**Scenario**: Security vulnerability discovered, gas optimization needed, or new features required

**Requirements**:
- Migrate all shareholder balances to new contract
- Preserve exact ownership percentages
- Transfer allowlist state
- Maintain historical traceability

**Migration Approach**: Off-chain workflow with on-chain verification (see Migration Workflow Guide)

### 3. Regulatory Compliance

**Scenario**: New regulations require contract changes that cannot be implemented via upgradeable proxy

**Requirements**:
- Full migration to compliant contract
- All balances and state must be transferred
- Compliance features must be implemented in new contract

**Migration Approach**: Off-chain workflow with on-chain verification (see Migration Workflow Guide)

## Design Principles

### 1. Ownership Continuity

**Requirement**: All shareholder balances must be preserved exactly (1:1 or according to split ratio)

**Verification Steps**:
- Snapshot total supply from old token
- Verify new token total supply matches snapshot (or split-adjusted amount)
- Confirm individual balances match (or are split-adjusted appropriately)
- Verify ownership percentages are preserved

**Edge Cases**:
- Zero-balance addresses (no migration needed)
- Allowlist state must be copied
- Transfer restrictions must match old token

### 2. Historic Traceability

**Requirement**: All historical events, transactions, and corporate actions must remain queryable

**Implementation**:
- Old token contract remains on-chain (never deleted)
- CapTable records replacement action with `recordCorporateAction("TOKEN_REPLACED", data)`
- Backend indexer continues processing events from both tokens
- Historical queries reference both old and new token addresses

**Indexer Requirements**:
- Backend must track token version mappings
- Continue indexing events from old token for historical queries
- Process new token events for current state
- Maintain relationship between token versions

### 3. Event Consistency

**Requirement**: Replacement must emit events that indexers can track

**Events Emitted**:
- `CorporateActionRecorded` with action type "TOKEN_REPLACED"
- Event includes encoded data: `(oldTokenAddress, newTokenAddress, migrationBlockNumber)`
- Indexed parameters allow efficient filtering

**Backward Compatibility**:
- Old token events remain valid for historical queries
- No breaking changes to existing event structure
- Indexers can differentiate between token versions

### 4. Indexer Consistency

**Requirement**: Backend indexer must continue processing events from both tokens

**Approach**:
- Indexer watches both `oldToken` and `newToken` addresses
- Backend maintains mapping of token versions
- Migration state tracked in database
- Rescan service handles missed events during migration window

## Migration Architecture

### Off-Chain Migration Approach

The initial implementation uses an **off-chain migration workflow** with on-chain verification:

1. **Balance Snapshot**: Backend indexer queries all shareholder balances
2. **New Token Deployment**: Deploy new ChainEquityToken instance
3. **Balance Migration**: Mint equivalent balances on new token
4. **Allowlist Migration**: Copy allowlist state to new token
5. **Corporate Action Recording**: Record replacement in CapTable
6. **Indexer Updates**: Backend processes replacement event and tracks both tokens

**Benefits**:
- Manual control over migration process
- Ability to verify each step before proceeding
- Lower risk of errors during migration
- Easier debugging and rollback if needed

**Limitations**:
- Requires issuer to execute multiple transactions
- Gas costs for large shareholder lists
- Manual verification required at each step

### Future: On-Chain Migration Interface

A future on-chain interface (`ITokenReplacement`) could provide automated migration:

- Batch balance migration in single transaction
- Automatic allowlist state transfer
- Built-in verification and rollback mechanisms
- Gas-optimized batch operations

**Note**: On-chain migration is deferred until after Phase 2 (Backend API + Event Indexer) is complete.

## Integration with CapTable

### Corporate Action Recording

Token replacement is recorded as a corporate action in the CapTable contract:

```solidity
// Encode replacement data
bytes memory data = abi.encode(oldTokenAddress, newTokenAddress, migrationBlockNumber);

// Record the corporate action
capTable.recordCorporateAction("TOKEN_REPLACED", data);
```

**Encoded Data Format**:
- `oldTokenAddress` (address): Address of the old token contract
- `newTokenAddress` (address): Address of the new token contract
- `migrationBlockNumber` (uint256): Block number when migration snapshot was taken

**Event Emitted**:
- `CorporateActionRecorded(actionId, "TOKEN_REPLACED", blockNumber)`
- Action ID is incremental and unique
- Action can be queried via `getCorporateAction(actionId)`

### CapTable Linking

**Current Limitation**: CapTable can only link one token at a time (`linkToken()` can only be called once)

**Future Enhancement**: Multi-token support could allow CapTable to track multiple token versions simultaneously

**Current Workaround**: 
- Old token remains linked (for historical queries)
- New token is linked via `linkToken()` (replaces old token link)
- Corporate action record maintains reference to both tokens

## Security Considerations

### Migration Risks

1. **Balance Mismatch**
   - **Risk**: Snapshot and minting don't match exactly, changing ownership percentages
   - **Mitigation**: Verify `totalSupply` of new token equals snapshot total before completing migration

2. **Double-Spending**
   - **Risk**: Old token remains active during migration window, allowing transfers
   - **Mitigation**: Disable transfers on old token (if supported) or coordinate with issuer to pause operations during migration

3. **Allowlist Inconsistency**
   - **Risk**: New token allowlist doesn't match old token, breaking transfers
   - **Mitigation**: Automated allowlist copying script with verification checklist

4. **Indexer Gaps**
   - **Risk**: Events missed during migration window
   - **Mitigation**: Rescan service (Phase 2) handles missed events and fills gaps

### Access Control

- **Migration Initiator**: Only issuer (CapTable owner) can record replacement action
- **Token Deployment**: Only issuer can deploy and mint new tokens
- **Allowlist Updates**: Only issuer can approve wallets on new token

**Security Best Practices**:
- Use multi-sig for issuer operations in production
- Verify all balances before recording corporate action
- Maintain audit trail of all migration steps
- Test migration on testnet before mainnet deployment

## Testing Strategy

When implementing token replacement, test:

1. ✅ Balance preservation (1:1 and split-adjusted)
2. ✅ Allowlist state transfer
3. ✅ Event emission and indexing
4. ✅ Historical query compatibility
5. ✅ Gas costs for large shareholder lists
6. ✅ Edge cases (zero balances, revoked wallets)
7. ✅ Indexer handling of both token versions
8. ✅ Corporate action recording and retrieval

## Implementation Status

**Current Status**: Design complete, implementation deferred until Phase 2

**Reason for Deferral**:
1. Indexer dependency: Requires robust event indexing infrastructure
2. Testing complexity: Needs extensive testing with real balances and events
3. User impact: Token replacement is rare operation, focus on core functionality first
4. Design flexibility: Learn from Phase 2 implementation to design better migration mechanism

**Next Steps**:
1. Complete Phase 2 (Backend API + Event Indexer)
2. Implement migration helper scripts
3. Test migration workflow on testnet
4. Consider on-chain migration interface for future enhancement

## Related Documentation

- **Migration Workflow Guide**: `docs/migration-workflow.md` - Step-by-step migration process
- **Design Document**: `contracts/TokenReplacement.md` - Original design document
- **Interface**: `contracts/ITokenReplacement.sol` - Placeholder interface for future implementation
- **CapTable Contract**: `contracts/CapTable.sol` - Corporate action recording functionality

