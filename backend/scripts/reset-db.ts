#!/usr/bin/env bun

/**
 * @file Database reset script
 * @notice Drop all tables and re-run migrations (development only)
 */

import { connect, close } from "../src/db/index";
import { down, up } from "../src/db/migrations";

async function main() {
  // Safety check: only allow in development
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Database reset is not allowed in production");
    process.exit(1);
  }

  // Confirmation prompt
  const args = process.argv.slice(2);
  const skipConfirm = args.includes("--yes") || args.includes("-y");

  if (!skipConfirm) {
    console.warn("⚠️  WARNING: This will delete all data in the database!");
    console.warn(
      "   Press Ctrl+C to cancel, or run with --yes to skip confirmation"
    );
    console.error("   Please run with --yes flag to confirm");
    process.exit(1);
  }

  try {
    console.log("🔄 Resetting database...");

    const db = connect();

    // Drop all tables
    down(db);

    // Re-run migrations
    up(db);

    console.log("✅ Database reset completed");
    console.log("💡 Run 'bun run db:seed' to populate with test data");

    process.exit(0);
  } catch (error) {
    console.error("❌ Database reset failed:", error);
    process.exit(1);
  } finally {
    close();
  }
}

main();

