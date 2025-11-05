/**
 * @file Database connection utility
 * @notice Centralized database connection management with singleton pattern,
 *         type-safe helpers, and transaction support
 *
 * @important Concurrent Writes
 * For future event indexer that writes concurrently, consider:
 * - Using separate Database instances pointing to the same WAL file
 * - Avoid sharing statement handles between instances
 * - Or implement a mutex/queue wrapper around the singleton
 */

import { Database } from "bun:sqlite";
import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  UserRecord,
  ShareholderRecord,
  TransactionRecord,
  CorporateActionRecord,
  EventRecord,
  MetaRecord,
} from "./schema";

// Singleton database instance
let dbInstance: Database | null = null;

// Get database path from env or use default
const DB_PATH =
  process.env.DATABASE_PATH || join(process.cwd(), "data", "chain-equity.db");

// Debug SQL logging
const DEBUG_SQL = process.env.DEBUG_SQL === "true";

/**
 * Connect to SQLite database (singleton pattern)
 * Creates database file and directory if they don't exist
 */
export function connect(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure data directory exists
  const dbDir = dirname(DB_PATH);
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }

  dbInstance = new Database(DB_PATH);

  // Enable foreign keys and WAL mode for better concurrency
  dbInstance.exec("PRAGMA foreign_keys = ON");
  dbInstance.exec("PRAGMA journal_mode = WAL");

  return dbInstance;
}

/**
 * Log SQL query if DEBUG_SQL is enabled
 */
function logQuery(sql: string, params: unknown[]): void {
  if (DEBUG_SQL) {
    console.debug("[SQL]", sql, params.length > 0 ? params : "");
  }
}

/**
 * Execute a SQL query and return results
 * @param sql SQL query string
 * @param params Query parameters
 */
export function query<T = unknown>(sql: string, params: unknown[] = []): T[] {
  logQuery(sql, params);
  const db = connect();
  const stmt = db.prepare(sql);
  return stmt.all(...(params as any[])) as T[];
}

/**
 * Execute a SQL query and return single row
 * @param sql SQL query string
 * @param params Query parameters
 */
export function queryOne<T = unknown>(
  sql: string,
  params: unknown[] = []
): T | null {
  logQuery(sql, params);
  const db = connect();
  const stmt = db.prepare(sql);
  const result = stmt.get(...(params as any[])) as T | undefined;
  return result || null;
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE)
 * @param sql SQL statement string
 * @param params Query parameters
 * @returns Last insert row ID or changes count
 */
export function execute(
  sql: string,
  params: unknown[] = []
): { lastInsertRowid: number; changes: number } {
  logQuery(sql, params);
  const db = connect();
  const stmt = db.prepare(sql);
  const result = stmt.run(...(params as any[]));
  return {
    lastInsertRowid: Number(result.lastInsertRowid),
    changes: result.changes,
  };
}

/**
 * Execute multiple statements in a transaction
 * @param callback Function containing transaction operations
 */
export function transaction<T>(callback: (db: Database) => T): T {
  const db = connect();
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("BEGIN TRANSACTION");
  try {
    const result = callback(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Close database connection (for cleanup)
 */
export function close(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Get raw database instance (for advanced operations)
 * Note: For concurrent writes, consider using separate Database instances
 * pointing to the same WAL file, but avoid sharing statement handles
 */
export function getDatabase(): Database {
  return connect();
}

// Type-safe row mapping helpers
// These prevent silent mismatches when schema evolves

/**
 * Map database row to UserRecord
 */
export function asUserRecord(row: unknown): UserRecord {
  const r = row as Record<string, unknown>;
  return {
    uid: String(r.uid),
    email: String(r.email),
    displayName: r.display_name ? String(r.display_name) : null,
    walletAddress: r.wallet_address ? String(r.wallet_address) : null,
    role: r.role as "admin" | "issuer" | "investor",
    createdAt: String(r.created_at),
  };
}

/**
 * Map database row to ShareholderRecord
 */
export function asShareholderRecord(row: unknown): ShareholderRecord {
  const r = row as Record<string, unknown>;
  return {
    address: String(r.address),
    balance: String(r.balance),
    effectiveBalance: String(r.effective_balance),
    lastUpdatedBlock: Number(r.last_updated_block),
  };
}

/**
 * Map database row to TransactionRecord
 */
export function asTransactionRecord(row: unknown): TransactionRecord {
  const r = row as Record<string, unknown>;
  return {
    id: r.id ? Number(r.id) : undefined,
    txHash: String(r.tx_hash),
    fromAddress: r.from_address ? String(r.from_address) : null,
    toAddress: r.to_address ? String(r.to_address) : null,
    amount: String(r.amount),
    blockNumber: Number(r.block_number),
    blockTimestamp: r.block_timestamp ? Number(r.block_timestamp) : null,
    logIndex: Number(r.log_index),
    eventType: r.event_type as "ISSUED" | "TRANSFER",
  };
}

/**
 * Map database row to CorporateActionRecord
 */
export function asCorporateActionRecord(
  row: unknown
): CorporateActionRecord {
  const r = row as Record<string, unknown>;
  return {
    id: r.id ? Number(r.id) : undefined,
    actionType: String(r.action_type),
    data: r.data ? String(r.data) : null,
    blockNumber: Number(r.block_number),
    blockTimestamp: r.block_timestamp ? Number(r.block_timestamp) : null,
    logIndex: Number(r.log_index),
  };
}

/**
 * Map database row to EventRecord
 */
export function asEventRecord(row: unknown): EventRecord {
  const r = row as Record<string, unknown>;
  return {
    id: r.id ? Number(r.id) : undefined,
    eventType: String(r.event_type),
    contractAddress: String(r.contract_address),
    topics: r.topics ? String(r.topics) : null,
    data: r.data ? String(r.data) : null,
    blockNumber: Number(r.block_number),
    logIndex: Number(r.log_index),
    blockTimestamp: r.block_timestamp ? Number(r.block_timestamp) : null,
    txHash: r.tx_hash ? String(r.tx_hash) : null,
  };
}

/**
 * Map database row to MetaRecord
 */
export function asMetaRecord(row: unknown): MetaRecord {
  const r = row as Record<string, unknown>;
  return {
    key: String(r.key),
    value: String(r.value),
  };
}

