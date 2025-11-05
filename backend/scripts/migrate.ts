#!/usr/bin/env bun

/**
 * @file Database migration runner
 * @notice Standalone script to run database migrations
 */

import { connect, close } from "../src/db/index";
import { migrate, getVersion, SCHEMA_VERSION } from "../src/db/migrations";

async function main() {
  try {
    console.log("🔄 Running database migrations...");

    const db = connect();
    const currentVersion = getVersion(db);

    if (currentVersion) {
      console.log(`   Current version: ${currentVersion}`);
    }
    console.log(`   Target version: ${SCHEMA_VERSION}`);

    migrate(db);

    const finalVersion = getVersion(db);
    console.log(
      `✅ Migrations completed successfully (version: ${finalVersion})`
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    close();
  }
}

main();

