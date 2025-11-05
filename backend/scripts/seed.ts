#!/usr/bin/env bun

/**
 * @file Database seed script
 * @notice Populate database with test data for development
 */

import { connect, close, transaction } from "../src/db/index";
import { seedUsers } from "../src/db/seeds/users";
import { seedShareholders } from "../src/db/seeds/shareholders";

async function main() {
  try {
    console.log("🌱 Seeding database with test data...");

    const db = connect();

    // Seed in transaction for atomicity
    const results = transaction(() => {
      const userResults = seedUsers(db);
      const shareholderResults = seedShareholders(db);

      return {
        users: userResults,
        shareholders: shareholderResults,
      };
    });

    console.log(`\n✅ Seeding completed:`);
    console.log(
      `   Users: ${results.users.created} created, ${results.users.skipped} skipped`
    );
    console.log(
      `   Shareholders: ${results.shareholders.created} created, ${results.shareholders.skipped} skipped`
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    close();
  }
}

main();

