# Active Context

## Current Status

Initial contract implementation complete. Ready for testing and issuer service development.

## Recent Work

- README.md updated with project description and setup instructions
- Memory bank structure initialized with requirements and design docs
- ChainEquityToken contract implemented based on initial design
- OpenZeppelin contracts added as dependency
- Contract compiles successfully

## Implementation Details

### ChainEquityToken Contract
- **Location**: `contracts/ChainEquityToken.sol`
- **Base**: OpenZeppelin ERC20 + Ownable
- **Features**:
  - Allowlist-based transfer restrictions
  - Issuer-controlled minting
  - Stock split mechanism (virtual split via splitFactor)
  - Symbol change event (for indexer tracking)
  - All required events for cap-table indexing

### Design Decisions
- **Stock Split**: Option C (virtual split) - uses splitFactor multiplier, indexer handles display
  - Gas efficient for large holder lists
  - No on-chain iteration needed
- **Symbol Change**: Event-based (contract upgrade required for actual change)
- **Transfer Restrictions**: Both sender AND recipient must be approved

## Architecture Summary

Three-layer system:
1. **Smart Contract** (`ChainEquityToken`) - On-chain cap table ✅ COMPLETE
2. **Backend** (Bun + SQLite) - Event indexer + REST API ⏳ TODO
3. **Frontend** (React + wagmi) - Admin & Shareholder dashboards ⏳ TODO

See `architecture.md` for complete architecture overview.

## Next Steps

1. Write test suite covering all required scenarios
2. ✅ Create deployment module for ChainEquityToken - COMPLETE
3. Build backend indexer (Bun + SQLite + viem)
4. Build backend API (REST endpoints)
5. Create frontend admin dashboard
6. Create frontend shareholder dashboard

