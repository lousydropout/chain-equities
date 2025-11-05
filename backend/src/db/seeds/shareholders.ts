/**
 * @file Shareholder seed data
 * @notice Seed functions for shareholders table
 */

import { Database } from "bun:sqlite";

/**
 * Seed shareholders table with test data
 * @param db Database instance
 * @returns Statistics about seeding operation
 */
export function seedShareholders(db: Database): {
  created: number;
  skipped: number;
} {
  // Placeholder for future shareholder seeding
  // Can add sample addresses with balances for testing
  // For now, shareholders will be populated by the event indexer
  return { created: 0, skipped: 0 };
}

