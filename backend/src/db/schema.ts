/**
 * @file Database schema definitions for ChainEquity backend
 * @notice SQLite schema compatible with PostgreSQL for future migration
 *
 * @important Event Identity
 * Each on-chain event is uniquely identified by the (block_number, log_index) pair.
 * This forms the basis for idempotent indexing - events with the same (block_number, log_index)
 * are guaranteed to be the same event and can be safely deduplicated.
 */

/**
 * SQL schema for users table
 * Stores user authentication and role information
 */
export const USERS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    wallet_address TEXT,
    role TEXT CHECK(role IN ('admin', 'issuer', 'investor')) NOT NULL DEFAULT 'investor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address) WHERE wallet_address IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
`;

/**
 * SQL schema for shareholders table
 * Tracks current shareholder balances and effective balances (after stock splits)
 * Effective balance = balance * splitFactor, stored for efficient querying
 */
export const SHAREHOLDERS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS shareholders (
    address TEXT PRIMARY KEY,
    balance TEXT NOT NULL,
    effective_balance TEXT NOT NULL,
    last_updated_block INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_shareholders_address ON shareholders(address);
  CREATE INDEX IF NOT EXISTS idx_shareholders_effective_balance ON shareholders(effective_balance);
  CREATE INDEX IF NOT EXISTS idx_shareholders_last_updated_block ON shareholders(last_updated_block);
  CREATE INDEX IF NOT EXISTS idx_shareholders_balance_eff ON shareholders(effective_balance DESC, balance DESC);
`;

/**
 * SQL schema for transactions table
 * Indexes all Transfer and Issued events from the token contract
 * Stores transaction details for cap table history and analytics
 *
 * @note Relationships:
 *   - from_address and to_address conceptually reference shareholders(address)
 *   - Foreign keys are not enforced in SQLite for performance, but relationships exist:
 *     -- FOREIGN KEY (from_address) REFERENCES shareholders(address)
 *     -- FOREIGN KEY (to_address) REFERENCES shareholders(address)
 */
export const TRANSACTIONS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    amount TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    block_timestamp INTEGER,
    log_index INTEGER NOT NULL,
    event_type TEXT CHECK(event_type IN ('ISSUED','TRANSFER')) NOT NULL,
    UNIQUE(block_number, log_index)
    -- Foreign key relationships (not enforced for performance):
    -- FOREIGN KEY (from_address) REFERENCES shareholders(address),
    -- FOREIGN KEY (to_address) REFERENCES shareholders(address)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
  CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
  CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address);
  CREATE INDEX IF NOT EXISTS idx_transactions_block_number ON transactions(block_number);
  CREATE INDEX IF NOT EXISTS idx_transactions_event_type ON transactions(event_type);
  CREATE INDEX IF NOT EXISTS idx_transactions_block_timestamp ON transactions(block_timestamp);
  CREATE INDEX IF NOT EXISTS idx_transactions_from_to ON transactions(from_address, to_address);
`;

/**
 * SQL schema for corporate_actions table
 * Stores corporate action records from the CapTable contract
 * Includes stock splits, symbol changes, and other corporate events
 *
 * @note The (block_number, log_index) unique constraint ensures idempotent indexing
 * of corporate action events, preventing duplicate records during event replay.
 */
export const CORPORATE_ACTIONS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS corporate_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    data TEXT,
    block_number INTEGER NOT NULL,
    block_timestamp INTEGER,
    log_index INTEGER NOT NULL,
    UNIQUE(block_number, log_index)
    -- Foreign key relationship (not enforced for performance):
    -- FOREIGN KEY (block_number, log_index) REFERENCES events(block_number, log_index)
  );

  CREATE INDEX IF NOT EXISTS idx_corporate_actions_action_type ON corporate_actions(action_type);
  CREATE INDEX IF NOT EXISTS idx_corporate_actions_block_number ON corporate_actions(block_number);
  CREATE INDEX IF NOT EXISTS idx_corporate_actions_block_timestamp ON corporate_actions(block_timestamp);
  CREATE INDEX IF NOT EXISTS idx_corporate_actions_log_index ON corporate_actions(log_index);
`;

/**
 * SQL schema for events table
 * Raw event log storage for complete indexing history
 * Stores all events from both CapTable and Token contracts
 */
export const EVENTS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    topics TEXT,
    data TEXT,
    block_number INTEGER NOT NULL,
    log_index INTEGER NOT NULL,
    block_timestamp INTEGER,
    tx_hash TEXT,
    UNIQUE(block_number, log_index)
  );

  CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_contract_address ON events(contract_address);
  CREATE INDEX IF NOT EXISTS idx_events_block_number ON events(block_number);
  CREATE INDEX IF NOT EXISTS idx_events_block_timestamp ON events(block_timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_tx_hash ON events(tx_hash);
`;

/**
 * SQL schema for meta table
 * Stores metadata including schema version and indexer state
 * Used for migration tracking and indexer coordination
 *
 * @note Reserved keys:
 *   - `schema_version`: Current database schema version string (e.g., "1.0.0")
 *   - `last_indexed_block`: Last block number that was fully indexed (for indexer coordination)
 */
export const META_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_meta_key ON meta(key);
`;

/**
 * User record interface matching database schema
 * TypeScript interface uses camelCase while DB columns use snake_case
 */
export interface UserRecord {
  uid: string;
  email: string;
  displayName: string | null;
  walletAddress: string | null;
  role: "admin" | "issuer" | "investor";
  createdAt: string; // ISO timestamp string
}

/**
 * Shareholder record interface matching database schema
 * TypeScript interface uses camelCase while DB columns use snake_case
 */
export interface ShareholderRecord {
  address: string;
  balance: string; // Stored as TEXT in wei precision
  effectiveBalance: string; // Stored as TEXT in wei precision
  lastUpdatedBlock: number;
}

/**
 * Transaction record interface matching database schema
 * TypeScript interface uses camelCase while DB columns use snake_case
 */
export interface TransactionRecord {
  id?: number;
  txHash: string;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string; // Stored as TEXT in wei precision
  blockNumber: number;
  blockTimestamp: number | null;
  logIndex: number;
  eventType: "ISSUED" | "TRANSFER";
}

/**
 * Corporate action record interface matching database schema
 * TypeScript interface uses camelCase while DB columns use snake_case
 */
export interface CorporateActionRecord {
  id?: number;
  actionType: string;
  data: string | null;
  blockNumber: number;
  blockTimestamp: number | null;
  logIndex: number;
}

/**
 * Event record interface matching database schema
 * TypeScript interface uses camelCase while DB columns use snake_case
 */
export interface EventRecord {
  id?: number;
  eventType: string;
  contractAddress: string;
  topics: string | null;
  data: string | null;
  blockNumber: number;
  logIndex: number;
  blockTimestamp: number | null;
  txHash: string | null;
}

/**
 * Meta record interface matching database schema
 */
export interface MetaRecord {
  key: string;
  value: string;
}

/**
 * Input type for creating a new user
 */
export interface CreateUserInput {
  uid: string;
  email: string;
  displayName?: string;
  role?: "admin" | "issuer" | "investor";
}

/**
 * Input type for updating a user
 */
export interface UpdateUserInput {
  displayName?: string;
  walletAddress?: string | null;
  role?: "admin" | "issuer" | "investor";
}

/**
 * All schema definitions in order
 * Used by migration system to apply all tables
 */
export const ALL_SCHEMAS = [
  USERS_TABLE_SCHEMA,
  SHAREHOLDERS_TABLE_SCHEMA,
  TRANSACTIONS_TABLE_SCHEMA,
  CORPORATE_ACTIONS_TABLE_SCHEMA,
  EVENTS_TABLE_SCHEMA,
  META_TABLE_SCHEMA,
];
