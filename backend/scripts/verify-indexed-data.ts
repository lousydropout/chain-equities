/**
 * @file Verify indexed data in database
 * @notice Checks that events were properly indexed
 */

import { query, queryOne } from "../src/db/index";
import type {
  EventRecord,
  TransactionRecord,
  ShareholderRecord,
  CorporateActionRecord,
} from "../src/db/schema";
import {
  asEventRecord,
  asTransactionRecord,
  asShareholderRecord,
  asCorporateActionRecord,
} from "../src/db/index";

async function main() {
  console.log("🔍 Verifying indexed data...\n");

  // Check events table
  console.log("1️⃣ Checking events table...");
  const eventRows = query<unknown>("SELECT * FROM events ORDER BY block_number, log_index");
  const events = eventRows.map(asEventRecord);
  console.log(`   Total events: ${events.length}`);
  
  const eventTypes = events.reduce((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log("   Event types:");
  for (const [type, count] of Object.entries(eventTypes)) {
    console.log(`     - ${type}: ${count}`);
  }
  
  if (events.length > 0) {
    console.log(`   ✅ Events table has data\n`);
  } else {
    console.log(`   ⚠️  No events found in database\n`);
  }

  // Check transactions table
  console.log("2️⃣ Checking transactions table...");
  const transactionRows = query<unknown>(
    "SELECT * FROM transactions ORDER BY block_number, log_index"
  );
  const transactions = transactionRows.map(asTransactionRecord);
  console.log(`   Total transactions: ${transactions.length}`);
  
  const transactionTypes = transactions.reduce((acc, t) => {
    acc[t.eventType] = (acc[t.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log("   Transaction types:");
  for (const [type, count] of Object.entries(transactionTypes)) {
    console.log(`     - ${type}: ${count}`);
  }
  
  if (transactions.length > 0) {
    console.log("   Sample transactions:");
    transactions.slice(0, 3).forEach((tx) => {
      console.log(
        `     - ${tx.eventType}: ${tx.amount} from ${tx.fromAddress || "null"} to ${tx.toAddress} (block ${tx.blockNumber})`
      );
    });
    console.log(`   ✅ Transactions table has data\n`);
  } else {
    console.log(`   ⚠️  No transactions found in database\n`);
  }

  // Check shareholders table
  console.log("3️⃣ Checking shareholders table...");
  const shareholderRows = query<unknown>(
    "SELECT * FROM shareholders ORDER BY effective_balance DESC"
  );
  const shareholders = shareholderRows.map(asShareholderRecord);
  console.log(`   Total shareholders: ${shareholders.length}`);
  
  if (shareholders.length > 0) {
    console.log("   Shareholders:");
    shareholders.forEach((sh) => {
      const balance = BigInt(sh.balance);
      const effectiveBalance = BigInt(sh.effectiveBalance);
      console.log(
        `     - ${sh.address}: ${balance.toString()} (effective: ${effectiveBalance.toString()}) at block ${sh.lastUpdatedBlock}`
      );
    });
    console.log(`   ✅ Shareholders table has data\n`);
  } else {
    console.log(`   ⚠️  No shareholders found in database\n`);
  }

  // Check corporate actions table
  console.log("4️⃣ Checking corporate actions table...");
  const corporateActionRows = query<unknown>(
    "SELECT * FROM corporate_actions ORDER BY block_number"
  );
  const corporateActions = corporateActionRows.map(asCorporateActionRecord);
  console.log(`   Total corporate actions: ${corporateActions.length}`);
  
  if (corporateActions.length > 0) {
    console.log("   Corporate actions:");
    corporateActions.forEach((ca) => {
      console.log(
        `     - ${ca.actionType} at block ${ca.blockNumber} (logIndex ${ca.logIndex})`
      );
    });
    console.log(`   ✅ Corporate actions table has data\n`);
  } else {
    console.log(`   ⚠️  No corporate actions found in database\n`);
  }

  // Check meta table for last indexed block
  console.log("5️⃣ Checking indexer state...");
  const lastIndexedBlock = queryOne<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'last_indexed_block'"
  );
  if (lastIndexedBlock) {
    console.log(`   Last indexed block: ${lastIndexedBlock.value}`);
  } else {
    console.log(`   ⚠️  No last indexed block found in meta table`);
  }

  // Summary
  console.log("\n📊 Summary:");
  console.log(`   Events: ${events.length}`);
  console.log(`   Transactions: ${transactions.length}`);
  console.log(`   Shareholders: ${shareholders.length}`);
  console.log(`   Corporate Actions: ${corporateActions.length}`);

  // Expected counts
  // Note: Minting (Issued) also emits Transfer events (from 0x0 address) - this is standard ERC20 behavior
  const expectedIssued = 2;
  const expectedTransfer = 3; // 2 from minting (0x0 -> recipient) + 1 actual transfer
  const expectedSplit = 1;
  const expectedCorporate = 1;

  let allPassed = true;

  if (eventTypes["Issued"] !== expectedIssued) {
    console.log(`\n   ⚠️  Expected ${expectedIssued} Issued events, got ${eventTypes["Issued"] || 0}`);
    allPassed = false;
  }
  if (eventTypes["Transfer"] !== expectedTransfer) {
    console.log(`\n   ⚠️  Expected ${expectedTransfer} Transfer events (2 from minting + 1 actual transfer), got ${eventTypes["Transfer"] || 0}`);
    console.log(`   Note: Minting emits Transfer events from 0x0 address - this is standard ERC20 behavior`);
    allPassed = false;
  }
  if (eventTypes["SplitExecuted"] !== expectedSplit) {
    console.log(`\n   ⚠️  Expected ${expectedSplit} SplitExecuted events, got ${eventTypes["SplitExecuted"] || 0}`);
    allPassed = false;
  }
  if (eventTypes["CorporateActionRecorded"] !== expectedCorporate) {
    console.log(`\n   ⚠️  Expected ${expectedCorporate} CorporateActionRecorded events, got ${eventTypes["CorporateActionRecorded"] || 0}`);
    allPassed = false;
  }

  if (allPassed && events.length > 0) {
    console.log("\n✅ All verification checks passed!");
  } else {
    console.log("\n⚠️  Some verification checks failed - see details above");
  }
}

main();

