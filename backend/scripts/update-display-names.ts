#!/usr/bin/env bun

/**
 * @file Update display names script
 * @notice Update existing user display names to remove "Investor" suffix
 */

import { connect, close, execute } from "../src/db/index";

async function main() {
  try {
    console.log("🔄 Updating display names...");

    // Update display names for investors
    const updates = [
      { uid: "alice-user", displayName: "Alice" },
      { uid: "bob-user", displayName: "Bob" },
      { uid: "charlie-user", displayName: "Charlie" },
    ];

    let updated = 0;
    for (const { uid, displayName } of updates) {
      const result = execute(
        "UPDATE users SET display_name = ? WHERE uid = ?",
        [displayName, uid]
      );
      
      if (result.changes > 0) {
        console.log(`✅ Updated ${uid}: ${displayName}`);
        updated++;
      } else {
        console.log(`⏭️  User ${uid} not found, skipping`);
      }
    }

    console.log(`\n✅ Update completed: ${updated} users updated`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Update failed:", error);
    process.exit(1);
  } finally {
    close();
  }
}

main();

