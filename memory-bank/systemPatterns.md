# System Patterns

## Architecture Patterns

See `architecture.md` for complete three-layer architecture overview.

### Event-Driven Architecture
- Smart contract emits events for all state changes
- Backend indexer subscribes to events via WebSocket
- Database updated asynchronously from events
- Frontend queries backend API for read operations

### Separation of Concerns
- **Contract Layer**: State management and business logic
- **Backend Layer**: Event indexing and query optimization
- **Frontend Layer**: User interface and wallet interactions

## Smart Contract Patterns

### Allowlist Pattern
- Both sender AND recipient must be approved for transfers
- Centralized approval via issuer role
- Events emitted for all allowlist changes

### Virtual Split Pattern
- Uses `splitFactor` multiplier instead of iterating balances
- Gas-efficient for large holder lists
- Indexer calculates effective balances: `balance * splitFactor / 1e18`

### Event-Heavy Design
- All state changes emit events
- Enables complete off-chain reconstruction of cap table
- Supports "as-of block" snapshots

## Development Patterns

### Backend Patterns
- Long-lived process with WebSocket subscription
- SQLite for persistence (simple, embedded database)
- REST API for read-only queries
- Event replay for historical reconstruction

### Frontend Patterns
- Wagmi hooks for wallet connection
- React Query for async state management
- Component separation: Admin vs Shareholder views
- Real-time updates via API polling or WebSocket

## Data Flow Patterns

1. **Write Path**: Frontend → wagmi → Contract → Event → Indexer → Database
2. **Read Path**: Frontend → API → Database (no contract calls for historical data)
3. **Real-time Path**: Contract Event → WebSocket → Indexer → Database → API → Frontend

