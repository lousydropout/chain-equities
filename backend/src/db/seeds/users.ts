/**
 * @file User seed data
 * @notice Seed functions for users table
 */

import { Database } from "bun:sqlite";
import { createUser } from "../../services/db/users";
import { queryOne, asUserRecord } from "../index";

export const SEED_USERS = [
  {
    uid: "admin-user",
    email: "admin@chainequity.com",
    displayName: "Admin User",
    role: "admin" as const,
  },
  {
    uid: "alice-user",
    email: "alice@chainequity.com",
    displayName: "Alice",
    role: "investor" as const,
  },
  {
    uid: "bob-user",
    email: "bob@chainequity.com",
    displayName: "Bob",
    role: "investor" as const,
  },
  {
    uid: "charlie-user",
    email: "charlie@chainequity.com",
    displayName: "Charlie",
    role: "investor" as const,
  },
];

/**
 * Seed users table with test data
 * @param db Database instance
 * @returns Statistics about seeding operation
 */
export function seedUsers(db: Database): {
  created: number;
  skipped: number;
} {
  let created = 0;
  let skipped = 0;

  for (const userData of SEED_USERS) {
    // Check if user already exists
    const existing = queryOne<unknown>(
      "SELECT * FROM users WHERE uid = ?",
      [userData.uid]
    );

    if (existing) {
      const existingUser = asUserRecord(existing);
      console.log(`⏭️  User ${existingUser.email} already exists, skipping`);
      skipped++;
      continue;
    }

    createUser(db, userData);
    console.log(`✅ Created user: ${userData.email} (${userData.role})`);
    created++;
  }

  return { created, skipped };
}

