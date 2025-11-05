/**
 * @file Database migration runner
 * @notice Lightweight migration system for schema version tracking and table management
 */

import { Database } from "bun:sqlite";
import {
  USERS_TABLE_SCHEMA,
  SHAREHOLDERS_TABLE_SCHEMA,
  TRANSACTIONS_TABLE_SCHEMA,
  CORPORATE_ACTIONS_TABLE_SCHEMA,
  EVENTS_TABLE_SCHEMA,
  META_TABLE_SCHEMA,
} from "./schema";

/**
 * Current schema version
 * Increment this when making schema changes
 */
export const SCHEMA_VERSION = "1.0.0";

/**
 * Get current schema version from meta table
 * @param db SQLite database instance
 * @returns Schema version string or null if not set
 */
export function getVersion(db: Database): string | null {
  const stmt = db.prepare("SELECT value FROM meta WHERE key = ?");
  const result = stmt.get("schema_version") as { value: string } | undefined;
  return result?.value || null;
}

/**
 * Set schema version in meta table
 * @param db SQLite database instance
 * @param version Schema version string
 */
export function setVersion(db: Database, version: string): void {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)"
  );
  stmt.run("schema_version", version);
}

/**
 * Run all migrations (create all tables)
 * Idempotent: safe to call multiple times
 * @param db SQLite database instance
 */
export function up(db: Database): void {
  // Create meta table first (needed for version tracking)
  db.exec(META_TABLE_SCHEMA);

  // Create all other tables
  db.exec(USERS_TABLE_SCHEMA);
  db.exec(SHAREHOLDERS_TABLE_SCHEMA);
  db.exec(TRANSACTIONS_TABLE_SCHEMA);
  db.exec(CORPORATE_ACTIONS_TABLE_SCHEMA);
  db.exec(EVENTS_TABLE_SCHEMA);

  // Set schema version
  setVersion(db, SCHEMA_VERSION);

  console.log(`✅ Database schema migrated to version ${SCHEMA_VERSION}`);
}

/**
 * Drop all tables (dev only - use with caution)
 * @param db SQLite database instance
 */
export function down(db: Database): void {
  console.warn("⚠️  Dropping all tables...");

  db.exec("DROP TABLE IF EXISTS events");
  db.exec("DROP TABLE IF EXISTS corporate_actions");
  db.exec("DROP TABLE IF EXISTS transactions");
  db.exec("DROP TABLE IF EXISTS shareholders");
  db.exec("DROP TABLE IF EXISTS users");
  db.exec("DROP TABLE IF EXISTS meta");

  console.log("✅ All tables dropped");
}

/**
 * Run migrations and log version
 * @param db SQLite database instance
 */
export function migrate(db: Database): void {
  const currentVersion = getVersion(db);

  if (currentVersion === SCHEMA_VERSION) {
    console.log(`✅ Database schema is up to date (version ${SCHEMA_VERSION})`);
    return;
  }

  if (currentVersion) {
    console.log(
      `🔄 Migrating from version ${currentVersion} to ${SCHEMA_VERSION}`
    );
  } else {
    console.log(`🆕 Initializing database schema (version ${SCHEMA_VERSION})`);
  }

  up(db);
}
