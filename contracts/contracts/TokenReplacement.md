# Token Replacement Design

## Overview

This document describes the architecture and design for safe token replacement between ChainEquityToken instances. **This is a design-only placeholder — no implementation exists yet.** The actual implementation is deferred until after Phase 2 (Backend API + Event Indexer) is complete.

**📚 For comprehensive documentation, see:**
- **Token Replacement Guide**: `docs/token-replacement.md` - Complete guide with scenarios, decisions, and migration approach
- **Migration Workflow Guide**: `docs/migration-workflow.md` - Step-by-step migration process with examples

## Design Decision: Virtual Stock Splits

**Decision: Keep Virtual Stock Splits (No Replacement Needed)**

The system uses virtual stock splits via the `splitFactor` mechanism. Token replacement is **not needed** for stock splits. See `docs/token-replacement.md` for detailed rationale.

## Scenarios Requiring Token Replacement

Token replacement may be necessary in the following scenarios:

### 1. Symbol Change
- **Scenario**: Company rebrands and needs a new token symbol (e.g., "ACME" → "ACME2")
- **Current Approach**: Virtual symbol change via event emission (ChainEquityToken.sol already emits `SymbolChanged` event)
- **Future Need**: If the actual token symbol must change (ERC20 `symbol()` return value), a new token contract must be deployed

### 2. Contract Upgrade
- **Scenario**: Security vulnerability discovered, gas optimization needed, or new features required
- **Requirement**: Migrate all balances and allowlist state to a new contract instance

### 3. Non-Virtual Stock Split
- **Scenario**: Company wants to execute a "real" split that changes token balances (not just the virtual `splitFactor`)
- **Current Approach**: Virtual splits via `splitFactor` multiplier (1e18 = 1x, 7e18 = 7x)
- **Decision**: **Keep virtual splits** - Token replacement is not needed for stock splits. Virtual splits are gas-efficient and already implemented. See `docs/token-replacement.md` for rationale.
- **Future Need**: If regulatory or integration requirements mandate actual balance changes, deploy new token with adjusted balances (rare scenario)

### 4. Regulatory Compliance
- **Scenario**: New regulations require contract changes that cannot be implemented via upgradeable proxy
- **Requirement**: Full migration to compliant contract

## Design Invariants

The token replacement mechanism must maintain these invariants:

### 1. Ownership Continuity
- **Requirement**: All shareholder balances must be preserved exactly (1:1 or according to split ratio)
- **Verification**: Total supply of new token must equal (or match split-adjusted) total supply of old token
- **Edge Cases**: Handle zero-balance addresses, allowlist state, transfer restrictions

### 2. Historic Traceability
- **Requirement**: All historical events, transactions, and corporate actions must remain queryable
- **Implementation**: Old token contract remains on-chain; CapTable records replacement action
- **Indexer**: Backend must handle events from both old and new tokens

### 3. Event Consistency
- **Requirement**: Replacement must emit events that indexers can track
- **Events**: `TokenReplaced(oldToken, newToken, timestamp)` emitted from CapTable
- **Backward Compatibility**: Old token events remain valid for historical queries

### 4. Indexer Consistency
- **Requirement**: Backend indexer must continue processing events from both tokens
- **Approach**: Indexer watches both `oldToken` and `newToken` addresses
- **State**: Backend maintains mapping of token versions and migration state

## Proposed Architecture

### Off-Chain Migration Approach

The initial implementation will use an **off-chain migration workflow** with on-chain verification:

#### Step 1: Snapshot Balances
1. Backend indexer queries all shareholder balances from old token
2. Snapshot stored in database with block number for consistency
3. Calculate total supply and verify against token contract

#### Step 2: Deploy New Token
1. Deploy new ChainEquityToken instance with same parameters (or adjusted for split)
2. Link new token to existing CapTable (requires CapTable modification — **future work**)
3. Verify deployment success and contract addresses

#### Step 3: Mint Equivalent Balances
1. Issuer calls `mint()` on new token for each shareholder from snapshot
2. Maintains exact ownership percentages
3. For splits: apply split ratio to balances during minting

#### Step 4: Record Corporate Action
1. Issuer calls `recordCorporateAction("TOKEN_REPLACED", encodedData)` on CapTable
2. Encoded data includes: `oldTokenAddress`, `newTokenAddress`, `migrationBlockNumber`
3. Event emitted: `CorporateActionRecorded` with action type "TOKEN_REPLACED"

#### Step 5: Update Allowlist
1. Copy allowlist state from old token to new token
2. Call `approveWallet()` for each approved address
3. Maintain transfer restrictions consistency

#### Step 6: Indexer Updates
1. Backend indexer processes `CorporateActionRecorded` event
2. Updates database to track both token addresses
3. Continues indexing events from both tokens (old for history, new for current)

### On-Chain Migration Interface (Future)

A future on-chain interface `ITokenReplacement` would provide:

```solidity
interface ITokenReplacement {
    event TokenReplaced(
        address indexed oldToken,
        address indexed newToken,
        uint256 timestamp
    );
    
    function migrateBalances(
        address oldToken,
        address newToken
    ) external;
}
```

**Note**: This interface is a placeholder. Actual implementation would require:
- Trusted migration coordinator (owner or multi-sig)
- Balance verification mechanism
- Allowlist state transfer
- Gas optimization for batch operations

## Rationale for Deferring Implementation

### Why Defer Until After Phase 2?

1. **Indexer Dependency**: Token replacement requires robust event indexing to track both old and new tokens. Phase 2 provides the backend infrastructure needed.

2. **Testing Complexity**: Migration logic requires extensive testing with real token balances, events, and indexer state. Phase 2 provides the test infrastructure.

3. **User Impact**: Token replacement is a rare operation. Focus on core functionality (issuance, transfers, splits) first.

4. **Design Flexibility**: Deferring allows us to learn from Phase 2 implementation and design a better migration mechanism.

5. **Risk Mitigation**: Manual off-chain migration (with on-chain verification) is safer for initial deployments. Automated on-chain migration can be added later.

### Current Capabilities

The current system already supports:
- ✅ Virtual stock splits via `splitFactor` (no replacement needed)
- ✅ Symbol change events (virtual, via `SymbolChanged` event)
- ✅ Corporate action recording (can record "TOKEN_REPLACED" action)
- ✅ Event emission for indexer tracking

### Future Enhancements

After Phase 2, consider:
- Automated on-chain migration function
- Multi-token support in CapTable (array of token addresses)
- Migration verification contracts
- Gas-optimized batch migration operations

## Migration Workflow Example

### Scenario: Symbol Change from "ACME" to "ACME2"

1. **Pre-Migration** (Old Token):
   - Total Supply: 1,000,000 ACME
   - Shareholders: Alice (500k), Bob (300k), Charlie (200k)
   - Allowlist: Alice ✅, Bob ✅, Charlie ✅

2. **Snapshot** (Backend):
   ```json
   {
     "blockNumber": 12345,
     "totalSupply": "1000000000000000000000000",
     "shareholders": [
       {"address": "0xAlice", "balance": "500000000000000000000000"},
       {"address": "0xBob", "balance": "300000000000000000000000"},
       {"address": "0xCharlie", "balance": "200000000000000000000000"}
     ]
   }
   ```

3. **Deploy New Token**:
   - Deploy `ChainEquityToken("Acme Inc. Equity", "ACME2", 1_000_000 ether)`
   - Address: `0xNewToken`

4. **Mint Balances**:
   - `mint(0xAlice, 500_000 ether)`
   - `mint(0xBob, 300_000 ether)`
   - `mint(0xCharlie, 200_000 ether)`

5. **Update Allowlist**:
   - `approveWallet(0xAlice)`
   - `approveWallet(0xBob)`
   - `approveWallet(0xCharlie)`

6. **Record Action**:
   - `capTable.recordCorporateAction("TOKEN_REPLACED", abi.encode(oldToken, newToken, blockNumber))`

7. **Post-Migration** (New Token):
   - Total Supply: 1,000,000 ACME2 ✅
   - Shareholders: Alice (500k), Bob (300k), Charlie (200k) ✅
   - Ownership percentages preserved ✅

## Security Considerations

### Migration Risks

1. **Balance Mismatch**: If snapshot and minting don't match exactly, ownership percentages change
   - **Mitigation**: Verify `totalSupply` of new token equals snapshot total

2. **Double-Spending**: Old token remains active during migration window
   - **Mitigation**: Disable transfers on old token (if supported) or rely on issuer to not mint/transfer during migration

3. **Allowlist Inconsistency**: New token allowlist doesn't match old token
   - **Mitigation**: Automated allowlist copying script with verification

4. **Indexer Gaps**: Events missed during migration window
   - **Mitigation**: Rescan service (Phase 2) handles missed events

### Access Control

- **Migration Initiator**: Only issuer (CapTable owner) can record replacement action
- **Token Deployment**: Only issuer can deploy and mint new tokens
- **Allowlist Updates**: Only issuer can approve wallets on new token

## Testing Strategy (Future)

When implementing, test:
1. ✅ Balance preservation (1:1 and split-adjusted)
2. ✅ Allowlist state transfer
3. ✅ Event emission and indexing
4. ✅ Historical query compatibility
5. ✅ Gas costs for large shareholder lists
6. ✅ Edge cases (zero balances, revoked wallets)

## Conclusion

Token replacement is a complex operation that requires careful design and testing. The current approach of deferring implementation until after Phase 2 allows us to:
- Focus on core functionality first
- Build robust indexing infrastructure
- Design a safer migration mechanism
- Learn from real-world usage patterns

The placeholder interface and documentation provide a clear path forward when implementation begins.

## Documentation Status

✅ **Design Complete**: This document provides the architectural design for token replacement.

✅ **Comprehensive Guides Created**:
- `docs/token-replacement.md` - Complete token replacement guide with scenarios and decisions
- `docs/migration-workflow.md` - Step-by-step migration workflow with examples and verification checklist

✅ **Implementation Status**: Design finalized, implementation deferred until Phase 2 (Backend API + Event Indexer)

**Next Steps**: 
1. Complete Phase 2 (Backend API + Event Indexer)
2. Implement migration helper scripts using workflow guide
3. Test migration on testnet
4. Consider on-chain migration interface for future enhancement

