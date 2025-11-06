# Database Schema Documentation

This document describes the ChainEquity backend database schema, including table relationships, indexes, and example queries.

## Overview

The database uses SQLite with PostgreSQL-compatible syntax for future migration. All numeric values (balances, amounts) are stored as TEXT to preserve precision (wei-level precision for blockchain values).

## Tables

### users

**Purpose:** Stores user authentication and role information.

**Schema:**
- `uid` (TEXT PRIMARY KEY) - Firebase user UID
- `email` (TEXT UNIQUE NOT NULL) - User email address
- `display_name` (TEXT) - Optional display name
- `wallet_address` (TEXT) - Linked Ethereum wallet address (nullable)
- `role` (TEXT CHECK) - User role: 'admin', 'issuer', or 'investor'
- `created_at` (TIMESTAMP) - Account creation timestamp

**Indexes:**
- `idx_users_email` - Fast email lookups
- `idx_users_wallet` - Fast wallet address lookups (partial index for non-null values)
- `idx_users_role` - Fast role-based queries

**Relationships:** None (standalone authentication table)

**Demo Mode Note:**
The users table structure is preserved for schema continuity and future use. However, user management API endpoints (`/api/users`) and wallet linking endpoints (`/api/wallet`) are deferred to post-demo (see Tasks 3.4 & 3.6). Database utilities for user management exist in `src/services/db/users.ts` but are not currently exposed via API. The demo uses mock authentication middleware (Task 3.2) which does not require database lookups.

---

### shareholders

**Purpose:** Tracks current shareholder balances and effective balances (after stock splits).

**Schema:**
- `address` (TEXT PRIMARY KEY) - Ethereum wallet address
- `balance` (TEXT NOT NULL) - Raw token balance in wei (stored as TEXT for precision)
- `effective_balance` (TEXT NOT NULL) - Balance after applying split factor (stored as TEXT)
- `last_updated_block` (INTEGER NOT NULL) - Last block where this shareholder's balance changed

**Indexes:**
- `idx_shareholders_address` - Primary key lookup (already indexed)
- `idx_shareholders_effective_balance` - Sorting by ownership percentage
- `idx_shareholders_last_updated_block` - Finding recently updated shareholders

**Relationships:** None (denormalized current state)

**Notes:**
- Effective balance = balance × splitFactor (calculated on-chain, cached here)
- Updated when Transfer or Issued events are processed
- One row per shareholder address

---

### transactions

**Purpose:** Indexes all Transfer and Issued events from the token contract for cap table history.

**Schema:**
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT) - Auto-incrementing ID
- `tx_hash` (TEXT NOT NULL) - Transaction hash
- `from_address` (TEXT) - Sender address (null for ISSUED events)
- `to_address` (TEXT) - Recipient address
- `amount` (TEXT NOT NULL) - Token amount in wei (stored as TEXT)
- `block_number` (INTEGER NOT NULL) - Block number
- `block_timestamp` (INTEGER) - Block timestamp (Unix epoch)
- `log_index` (INTEGER NOT NULL) - Event log index within transaction
- `event_type` (TEXT CHECK) - 'ISSUED' or 'TRANSFER'

**Constraints:**
- `UNIQUE(block_number, log_index)` - Prevents duplicate event indexing

**Indexes:**
- `idx_transactions_tx_hash` - Lookup by transaction hash
- `idx_transactions_from_address` - All transfers from an address
- `idx_transactions_to_address` - All transfers to an address
- `idx_transactions_block_number` - Chronological queries
- `idx_transactions_event_type` - Filter by event type
- `idx_transactions_block_timestamp` - Time-range queries

**Relationships:** None (denormalized event data)

**Notes:**
- Deduplication via UNIQUE constraint on (block_number, log_index)
- `from_address` is null for ISSUED events (minting)
- Used for transaction history and analytics

---

### corporate_actions

**Purpose:** Stores corporate action records from the CapTable contract (stock splits, symbol changes, etc.).

**Schema:**
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT) - Auto-incrementing ID
- `action_type` (TEXT NOT NULL) - Action type (e.g., 'SPLIT', 'SYMBOL_CHANGE')
- `data` (TEXT) - Encoded action-specific data (JSON string)
- `block_number` (INTEGER NOT NULL) - Block number when action was recorded
- `block_timestamp` (INTEGER) - Block timestamp (Unix epoch)

**Indexes:**
- `idx_corporate_actions_action_type` - Filter by action type
- `idx_corporate_actions_block_number` - Chronological queries
- `idx_corporate_actions_block_timestamp` - Time-range queries

**Relationships:** None (denormalized event data)

**Notes:**
- Mirrors CapTable contract's CorporateAction struct
- `data` field stores encoded bytes as hex string or JSON

---

### events

**Purpose:** Raw event log storage for complete indexing history from both CapTable and Token contracts.

**Schema:**
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT) - Auto-incrementing ID
- `event_type` (TEXT NOT NULL) - Event name (e.g., 'Transfer', 'Issued', 'SplitExecuted')
- `contract_address` (TEXT NOT NULL) - Contract address that emitted the event
- `topics` (TEXT) - Event topics array (JSON string)
- `data` (TEXT) - Event data (hex string)
- `block_number` (INTEGER NOT NULL) - Block number
- `log_index` (INTEGER NOT NULL) - Event log index within transaction
- `block_timestamp` (INTEGER) - Block timestamp (Unix epoch)

**Constraints:**
- `UNIQUE(block_number, log_index)` - Prevents duplicate event indexing

**Indexes:**
- `idx_events_event_type` - Filter by event type
- `idx_events_contract_address` - Filter by contract
- `idx_events_block_number` - Chronological queries
- `idx_events_block_timestamp` - Time-range queries

**Relationships:** None (raw event storage)

**Notes:**
- Stores complete event logs for debugging and full history
- Used for event replay and gap detection
- Deduplication via UNIQUE constraint on (block_number, log_index)

---

### meta

**Purpose:** Stores metadata including schema version and indexer state.

**Schema:**
- `key` (TEXT PRIMARY KEY) - Metadata key
- `value` (TEXT NOT NULL) - Metadata value

**Indexes:**
- `idx_meta_key` - Fast key lookups

**Common Keys:**
- `schema_version` - Current database schema version
- `last_indexed_block` - Last block number indexed (for indexer coordination)

---

## Numeric Precision Rules

All blockchain numeric values are stored as **TEXT** to preserve precision:

- **Balances**: Stored in wei (1e18 = 1 token)
- **Amounts**: Stored in wei
- **Timestamps**: Stored as INTEGER (Unix epoch seconds)

**Rationale:** JavaScript's Number type loses precision for large integers. Storing as TEXT ensures wei-level precision is maintained.

---

## Example Queries

### Get Top Shareholders by Effective Balance

```sql
SELECT 
  address,
  balance,
  effective_balance,
  last_updated_block
FROM shareholders
ORDER BY CAST(effective_balance AS INTEGER) DESC
LIMIT 10;
```

### Get All Transactions for an Address

```sql
SELECT 
  tx_hash,
  from_address,
  to_address,
  amount,
  event_type,
  block_number,
  block_timestamp
FROM transactions
WHERE from_address = ? OR to_address = ?
ORDER BY block_number DESC;
```

### Get Corporate Actions by Block Range

```sql
SELECT 
  id,
  action_type,
  data,
  block_number,
  block_timestamp
FROM corporate_actions
WHERE block_number BETWEEN ? AND ?
ORDER BY block_number ASC;
```

### Get Recent Events by Type

```sql
SELECT 
  event_type,
  contract_address,
  block_number,
  block_timestamp
FROM events
WHERE event_type = ?
ORDER BY block_number DESC
LIMIT 100;
```

### Get Shareholder Balance History

```sql
SELECT 
  t.block_number,
  t.block_timestamp,
  t.event_type,
  t.amount,
  t.from_address,
  t.to_address
FROM transactions t
WHERE t.to_address = ? OR t.from_address = ?
ORDER BY t.block_number ASC;
```

---

## PostgreSQL Compatibility Notes

When migrating to PostgreSQL, consider these changes:

### Type Mappings

- **INTEGER** → **BIGINT** (PostgreSQL has larger integer range)
- **TEXT** → **VARCHAR** or **TEXT** (both equivalent in PostgreSQL)
- **TIMESTAMP** → **TIMESTAMP** (SQLite uses TEXT, PostgreSQL uses native TIMESTAMP)

### Syntax Differences

- **AUTOINCREMENT** → **SERIAL** or **BIGSERIAL** (PostgreSQL)
- **CREATE INDEX IF NOT EXISTS** → Supported in PostgreSQL 9.5+
- **UNIQUE constraints** → Identical syntax

### Migration Script Template

```sql
-- PostgreSQL version
CREATE TABLE IF NOT EXISTS shareholders (
  address VARCHAR(42) PRIMARY KEY,
  balance VARCHAR(78) NOT NULL,  -- Max 256-bit number as string
  effective_balance VARCHAR(78) NOT NULL,
  last_updated_block BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shareholders_effective_balance 
  ON shareholders(effective_balance);
```

---

## Relationships Summary

The schema is **denormalized** for performance:

- No foreign keys between tables
- Current state stored in `shareholders` (denormalized from `transactions`)
- Historical data in `transactions` and `events`
- Corporate actions stored independently in `corporate_actions`

This design prioritizes:
- **Read performance** (no JOINs needed for common queries)
- **Write performance** (single-table updates)
- **Simplicity** (easier to index and maintain)

---

## Indexing Strategy

Indexes are optimized for common query patterns:

1. **Address lookups** - Fast shareholder and transaction queries
2. **Block ranges** - Chronological queries and time-based filtering
3. **Event type filtering** - Filter by event type without full table scans
4. **Balance sorting** - Top shareholders queries

All indexes use `IF NOT EXISTS` for idempotent migrations.

---

## Schema Version

Current schema version: **1.0.0**

Tracked in `meta` table with key `schema_version`.

---

## Maintenance

- Run migrations with `migrate(db)` from `migrations.ts`
- Schema is idempotent (safe to run multiple times)
- Use `down(db)` for development resets only
