/**
 * @file Event indexer service
 * @notice Watches and indexes blockchain events from CapTable and ChainEquityToken contracts
 * @notice Processes events, stores them in database, updates shareholder balances
 */

import {
  type PublicClient,
  type Log,
  parseEventLogs,
  type AbiEvent,
  type Address,
} from "viem";
import { getPublicClient, withRetry } from "./client";
import { CONTRACTS } from "../../config/contracts";
import {
  query,
  queryOne,
  execute,
  transaction,
  asEventRecord,
  asShareholderRecord,
  type EventRecord,
  type ShareholderRecord,
} from "../../db/index";
import type { MetaRecord } from "../../db/schema";

// Configuration
const START_BLOCK = Number(process.env.START_BLOCK) || 0;
const CONFIRMATION_BLOCKS = Number(process.env.CONFIRMATION_BLOCKS) || 3;
const BATCH_SIZE = 100; // Number of events to batch before committing

// Indexer state
let isRunning = false;
let watchers: (() => void)[] = [];
let publicClient: PublicClient;

/**
 * Get last indexed block from meta table
 */
function getLastIndexedBlock(): number {
  const meta = queryOne<MetaRecord>(
    "SELECT * FROM meta WHERE key = ?",
    ["last_indexed_block"]
  );

  if (!meta) {
    return START_BLOCK - 1;
  }

  return Number(meta.value);
}

/**
 * Set last indexed block in meta table
 */
function setLastIndexedBlock(blockNumber: number): void {
  execute(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?`,
    ["last_indexed_block", String(blockNumber), String(blockNumber)]
  );
}

/**
 * Set indexer version in meta table
 */
function setIndexerVersion(version: string): void {
  execute(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?`,
    ["indexer_version", version, version]
  );
}

/**
 * Store raw event in events table
 */
function storeEvent(
  log: Log,
  eventType: string,
  contractAddress: Address
): void {
  const topicsJson = JSON.stringify(log.topics);
  execute(
    `INSERT OR IGNORE INTO events (
      event_type, contract_address, topics, data,
      block_number, log_index, block_timestamp, tx_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventType,
      contractAddress,
      topicsJson,
      log.data || null,
      Number(log.blockNumber),
      log.logIndex,
      log.blockTimestamp || null,
      log.transactionHash || null,
    ]
  );
}

/**
 * Update shareholder balance
 * Queries splitFactor from contract to calculate effective balance
 */
async function updateShareholderBalance(
  address: Address,
  balance: bigint,
  blockNumber: number
): Promise<void> {
  // Query splitFactor from contract
  const splitFactor = await withRetry(() =>
    publicClient.readContract( {
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "splitFactor",
    })
  );

  // Calculate effective balance: balance * splitFactor / 1e18
  const effectiveBalance =
    (balance * BigInt(splitFactor)) / BigInt(10 ** 18);

  // Update or insert shareholder
  execute(
    `INSERT INTO shareholders (address, balance, effective_balance, last_updated_block)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(address) DO UPDATE SET
       balance = excluded.balance,
       effective_balance = excluded.effective_balance,
       last_updated_block = excluded.last_updated_block`,
    [
      address.toLowerCase(),
      balance.toString(),
      effectiveBalance.toString(),
      blockNumber,
    ]
  );
}

/**
 * Update all shareholder effective balances after split
 */
async function updateAllShareholderEffectiveBalances(): Promise<void> {
  // Query splitFactor from contract
  const splitFactor = await withRetry(() =>
    publicClient.readContract( {
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "splitFactor",
    })
  );

  // Get all shareholders
  const shareholders = query<ShareholderRecord>("SELECT * FROM shareholders");

  // Update each shareholder's effective balance
  for (const shareholder of shareholders) {
    const balance = BigInt(shareholder.balance);
    const effectiveBalance =
      (balance * BigInt(splitFactor)) / BigInt(10 ** 18);

    execute(
      `UPDATE shareholders SET effective_balance = ? WHERE address = ?`,
      [effectiveBalance.toString(), shareholder.address]
    );
  }
}

/**
 * Event handler registry
 */
const handlers: Record<string, (log: Log, skipStore?: boolean) => Promise<void>> = {
  TokenLinked: async (log: Log, skipStore = false) => {
    await handleTokenLinked(log, skipStore);
  },
  Issued: async (log: Log, skipStore = false) => {
    await handleIssued(log, skipStore);
  },
  Transfer: async (log: Log, skipStore = false) => {
    await handleTransferred(log, skipStore);
  },
  SplitExecuted: async (log: Log, skipStore = false) => {
    await handleSplitExecuted(log, skipStore);
  },
  CorporateActionRecorded: async (log: Log, skipStore = false) => {
    await handleCorporateActionRecorded(log, skipStore);
  },
};

/**
 * Handle TokenLinked event
 */
async function handleTokenLinked(log: Log, skipStore = false): Promise<void> {
  if (!skipStore) {
    storeEvent(log, "TokenLinked", CONTRACTS.capTable.address);
  }
  console.log(`📎 TokenLinked event at block ${log.blockNumber}`);
}

/**
 * Handle Issued event
 */
async function handleIssued(log: Log, skipStore = false): Promise<void> {
  if (!skipStore) {
    storeEvent(log, "Issued", CONTRACTS.token.address);
  }

  // Parse event
  const parsed = parseEventLogs({
    abi: CONTRACTS.token.abi,
    logs: [log],
  });

  if (parsed.length === 0) {
    console.warn(`⚠️  Failed to parse Issued event at block ${log.blockNumber}`);
    return;
  }

  const event = parsed[0];
  const to = event.args.to as Address;
  const amount = event.args.amount as bigint;

  // Store in transactions table
  execute(
    `INSERT OR IGNORE INTO transactions (
      tx_hash, from_address, to_address, amount,
      block_number, block_timestamp, log_index, event_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.transactionHash || "",
      null, // Issued events have no from_address
      to.toLowerCase(),
      amount.toString(),
      Number(log.blockNumber),
      log.blockTimestamp || null,
      log.logIndex,
      "ISSUED",
    ]
  );

  // Update shareholder balance
  await updateShareholderBalance(to, amount, Number(log.blockNumber));

  console.log(
    `✅ Issued ${amount.toString()} tokens to ${to} at block ${log.blockNumber}`
  );
}

/**
 * Handle Transfer event
 */
async function handleTransferred(log: Log, skipStore = false): Promise<void> {
  if (!skipStore) {
    storeEvent(log, "Transfer", CONTRACTS.token.address);
  }

  // Parse event
  const parsed = parseEventLogs({
    abi: CONTRACTS.token.abi,
    logs: [log],
  });

  if (parsed.length === 0) {
    console.warn(
      `⚠️  Failed to parse Transfer event at block ${log.blockNumber}`
    );
    return;
  }

  const event = parsed[0];
  const from = event.args.from as Address;
  const to = event.args.to as Address;
  const value = event.args.value as bigint;

  // Skip if from is zero address (minting handled by Issued event)
  if (from === "0x0000000000000000000000000000000000000000") {
    return;
  }

  // Store in transactions table
  execute(
    `INSERT OR IGNORE INTO transactions (
      tx_hash, from_address, to_address, amount,
      block_number, block_timestamp, log_index, event_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.transactionHash || "",
      from.toLowerCase(),
      to.toLowerCase(),
      value.toString(),
      Number(log.blockNumber),
      log.blockTimestamp || null,
      log.logIndex,
      "TRANSFER",
    ]
  );

  // Update shareholder balances for both from and to
  // Query current balances from contract
  const [fromBalance, toBalance] = await Promise.all([
    withRetry(() =>
      publicClient.readContract( {
        address: CONTRACTS.token.address,
        abi: CONTRACTS.token.abi,
        functionName: "balanceOf",
        args: [from],
      })
    ),
    withRetry(() =>
      publicClient.readContract( {
        address: CONTRACTS.token.address,
        abi: CONTRACTS.token.abi,
        functionName: "balanceOf",
        args: [to],
      })
    ),
  ]);

  await Promise.all([
    updateShareholderBalance(from, fromBalance as bigint, Number(log.blockNumber)),
    updateShareholderBalance(to, toBalance as bigint, Number(log.blockNumber)),
  ]);

  console.log(
    `🔄 Transfer ${value.toString()} from ${from} to ${to} at block ${log.blockNumber}`
  );
}

/**
 * Handle SplitExecuted event
 */
async function handleSplitExecuted(log: Log, skipStore = false): Promise<void> {
  if (!skipStore) {
    storeEvent(log, "SplitExecuted", CONTRACTS.token.address);
  }

  // Update all shareholder effective balances
  await updateAllShareholderEffectiveBalances();

  // Parse event for logging
  const parsed = parseEventLogs({
    abi: CONTRACTS.token.abi,
    logs: [log],
  });

  if (parsed.length > 0) {
    const event = parsed[0];
    const oldFactor = event.args.oldFactor as bigint;
    const newFactor = event.args.newFactor as bigint;
    console.log(
      `📊 SplitExecuted: ${oldFactor.toString()} → ${newFactor.toString()} at block ${log.blockNumber}`
    );
  }
}

/**
 * Handle CorporateActionRecorded event
 */
async function handleCorporateActionRecorded(
  log: Log,
  skipStore = false
): Promise<void> {
  if (!skipStore) {
    storeEvent(log, "CorporateActionRecorded", CONTRACTS.capTable.address);
  }

  // Parse event
  const parsed = parseEventLogs({
    abi: CONTRACTS.capTable.abi,
    logs: [log],
  });

  if (parsed.length === 0) {
    console.warn(
      `⚠️  Failed to parse CorporateActionRecorded event at block ${log.blockNumber}`
    );
    return;
  }

  const event = parsed[0];
  const actionType = event.args.actionType as string;
  const actionId = event.args.actionId as bigint;

  // Get corporate action data from contract
  const actionData = await withRetry(() =>
    publicClient.readContract( {
      address: CONTRACTS.capTable.address,
      abi: CONTRACTS.capTable.abi,
      functionName: "getCorporateAction",
      args: [actionId],
    })
  );

  // Store in corporate_actions table
  const dataBytes = (actionData as any).data as `0x${string}`;
  execute(
    `INSERT OR IGNORE INTO corporate_actions (
      action_type, data, block_number, block_timestamp, log_index
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      actionType,
      dataBytes || null,
      Number(log.blockNumber),
      log.blockTimestamp || null,
      log.logIndex,
    ]
  );

  console.log(
    `📋 CorporateActionRecorded: ${actionType} (ID: ${actionId.toString()}) at block ${log.blockNumber}`
  );
}

/**
 * Process a batch of events
 */
async function processEventBatch(logs: Log[]): Promise<void> {
  // Sort by block number, then log index
  const sortedLogs = [...logs].sort((a, b) => {
    const blockDiff = Number(a.blockNumber) - Number(b.blockNumber);
    if (blockDiff !== 0) return blockDiff;
    return a.logIndex - b.logIndex;
  });

  // Process events in batch transaction
  transaction((db) => {
    for (const log of sortedLogs) {
      // Determine event type and contract from log
      let eventType: string | null = null;
      let contractAddress: Address | null = null;

      // Check if it's from token contract
      if (
        log.address?.toLowerCase() ===
        CONTRACTS.token.address.toLowerCase()
      ) {
        contractAddress = CONTRACTS.token.address;

        // Parse to determine event type
        try {
          const parsed = parseEventLogs({
            abi: CONTRACTS.token.abi,
            logs: [log],
          });

          if (parsed.length > 0) {
            eventType = parsed[0].eventName;
          }
        } catch (e) {
          // Ignore parse errors, will handle below
        }
      }

      // Check if it's from capTable contract
      if (
        log.address?.toLowerCase() ===
        CONTRACTS.capTable.address.toLowerCase()
      ) {
        contractAddress = CONTRACTS.capTable.address;

        // Parse to determine event type
        try {
          const parsed = parseEventLogs({
            abi: CONTRACTS.capTable.abi,
            logs: [log],
          });

          if (parsed.length > 0) {
            eventType = parsed[0].eventName;
          }
        } catch (e) {
          // Ignore parse errors, will handle below
        }
      }

      if (!eventType || !contractAddress) {
        console.warn(
          `⚠️  Unknown event at block ${log.blockNumber}, logIndex ${log.logIndex}`
        );
        continue;
      }

      // Store raw event
      const topicsJson = JSON.stringify(log.topics);
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO events (
          event_type, contract_address, topics, data,
          block_number, log_index, block_timestamp, tx_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run(
        eventType,
        contractAddress,
        topicsJson,
        log.data || null,
        Number(log.blockNumber),
        log.logIndex,
        log.blockTimestamp || null,
        log.transactionHash || null
      );

    }
  });

  // Process async handlers after transaction (skip storing events since already stored)
  for (const log of sortedLogs) {
    let eventType: string | null = null;

    // Determine event type
    if (
      log.address?.toLowerCase() ===
      CONTRACTS.token.address.toLowerCase()
    ) {
      try {
        const parsed = parseEventLogs({
          abi: CONTRACTS.token.abi,
          logs: [log],
        });
        if (parsed.length > 0) {
          eventType = parsed[0].eventName;
        }
      } catch (e) {
        // Ignore
      }
    }

    if (
      log.address?.toLowerCase() ===
      CONTRACTS.capTable.address.toLowerCase()
    ) {
      try {
        const parsed = parseEventLogs({
          abi: CONTRACTS.capTable.abi,
          logs: [log],
        });
        if (parsed.length > 0) {
          eventType = parsed[0].eventName;
        }
      } catch (e) {
        // Ignore
      }
    }

    if (eventType) {
      const handler = handlers[eventType];
      if (handler) {
        try {
          // Pass skipStore=true since we already stored the event in the transaction above
          await handler(log, true);
        } catch (error) {
          console.error(
            `❌ Error processing ${eventType} event at block ${log.blockNumber}:`,
            error
          );
        }
      }
    }
  }
}

/**
 * Scan block range for events
 */
async function scanBlockRange(
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  console.log(`🔍 Scanning blocks ${fromBlock} to ${toBlock}`);

  const allLogs: Log[] = [];

  // Get logs for each event type using getLogs
  const eventConfigs = [
    // Token events
    {
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      eventName: "Issued",
    },
    {
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      eventName: "Transfer",
    },
    {
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      eventName: "SplitExecuted",
    },
    // CapTable events
    {
      address: CONTRACTS.capTable.address,
      abi: CONTRACTS.capTable.abi,
      eventName: "TokenLinked",
    },
    {
      address: CONTRACTS.capTable.address,
      abi: CONTRACTS.capTable.abi,
      eventName: "CorporateActionRecorded",
    },
  ];

  // Get logs for each event type
  for (const config of eventConfigs) {
    try {
      const logs = await withRetry(() =>
        publicClient.getLogs({
          address: config.address,
          event: config.abi.find(
            (item) => item.type === "event" && item.name === config.eventName
          ) as AbiEvent,
          fromBlock,
          toBlock,
        })
      );
      allLogs.push(...(logs as Log[]));
    } catch (error) {
      console.error(
        `❌ Error getting logs for ${config.eventName}:`,
        error
      );
    }
  }

  // Process logs in batches
  for (let i = 0; i < allLogs.length; i += BATCH_SIZE) {
    const batch = allLogs.slice(i, i + BATCH_SIZE);
    await processEventBatch(batch);
    console.log(
      `✅ Processed batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} events)`
    );
  }

  console.log(
    `✅ Scanned ${allLogs.length} events from blocks ${fromBlock} to ${toBlock}`
  );
}

/**
 * Start event watchers
 */
function startWatchers(): void {
  console.log("👀 Starting event watchers...");

  // Watch TokenLinked events
  const unwatchTokenLinked = publicClient.watchContractEvent({
    address: CONTRACTS.capTable.address,
    abi: CONTRACTS.capTable.abi,
    eventName: "TokenLinked",
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleTokenLinked(log);
      }
    },
  });

  // Watch Issued events
  const unwatchIssued = publicClient.watchContractEvent({
    address: CONTRACTS.token.address,
    abi: CONTRACTS.token.abi,
    eventName: "Issued",
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleIssued(log);
      }
    },
  });

  // Watch Transfer events
  const unwatchTransferred = publicClient.watchContractEvent({
    address: CONTRACTS.token.address,
    abi: CONTRACTS.token.abi,
    eventName: "Transfer",
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleTransferred(log);
      }
    },
  });

  // Watch SplitExecuted events
  const unwatchSplitExecuted = publicClient.watchContractEvent({
    address: CONTRACTS.token.address,
    abi: CONTRACTS.token.abi,
    eventName: "SplitExecuted",
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleSplitExecuted(log);
      }
    },
  });

  // Watch CorporateActionRecorded events
  const unwatchCorporateActionRecorded = publicClient.watchContractEvent({
    address: CONTRACTS.capTable.address,
    abi: CONTRACTS.capTable.abi,
    eventName: "CorporateActionRecorded",
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleCorporateActionRecorded(log);
      }
    },
  });

  watchers = [
    unwatchTokenLinked,
    unwatchIssued,
    unwatchTransferred,
    unwatchSplitExecuted,
    unwatchCorporateActionRecorded,
  ];

  console.log("✅ Event watchers started");
}

/**
 * Stop event watchers
 */
function stopWatchers(): void {
  console.log("🛑 Stopping event watchers...");
  for (const unwatch of watchers) {
    unwatch();
  }
  watchers = [];
  console.log("✅ Event watchers stopped");
}

/**
 * Start the indexer
 */
export async function start(): Promise<void> {
  if (isRunning) {
    console.warn("⚠️  Indexer is already running");
    return;
  }

  console.log("🚀 Starting event indexer...");
  isRunning = true;

  // Initialize public client
  publicClient = getPublicClient();

  // Set indexer version
  setIndexerVersion("1.0.0");

  // Get last indexed block
  const lastIndexedBlock = getLastIndexedBlock();
  console.log(`📊 Last indexed block: ${lastIndexedBlock}`);

  // Get current block and calculate safe block
  const currentBlock = await withRetry(() =>
    publicClient.getBlockNumber()
  );
  const safeBlock = currentBlock - BigInt(CONFIRMATION_BLOCKS);

  console.log(`📦 Current block: ${currentBlock}, Safe block: ${safeBlock}`);

  // Scan from last indexed block + 1 to safe block
  if (lastIndexedBlock < Number(safeBlock)) {
    const fromBlock = BigInt(lastIndexedBlock + 1);
    const toBlock = safeBlock;

    if (fromBlock <= toBlock) {
      console.log(`🔍 Catching up from block ${fromBlock} to ${toBlock}`);
      await scanBlockRange(fromBlock, toBlock);
      setLastIndexedBlock(Number(toBlock));
    }
  }

  // Start real-time watchers
  startWatchers();

  // Periodically update last indexed block (every 10 seconds)
  const updateInterval = setInterval(async () => {
    try {
      const currentBlock = await withRetry(() =>
        publicClient.getBlockNumber()
      );
      const safeBlock = currentBlock - BigInt(CONFIRMATION_BLOCKS);

      // Update last indexed block if we've progressed
      const lastIndexed = getLastIndexedBlock();
      if (Number(safeBlock) > lastIndexed) {
        setLastIndexedBlock(Number(safeBlock));
      }
    } catch (error) {
      console.error("❌ Error updating last indexed block:", error);
    }
  }, 10000); // Every 10 seconds

  // Store interval cleanup in watchers array (will be cleared on stop)
  watchers.push(() => clearInterval(updateInterval));

  console.log("✅ Event indexer started");
}

/**
 * Stop the indexer
 */
export async function stop(): Promise<void> {
  if (!isRunning) {
    return;
  }

  console.log("🛑 Stopping event indexer...");
  isRunning = false;

  stopWatchers();

  console.log("✅ Event indexer stopped");
}

/**
 * Rescan a block range
 */
export async function rescan(
  fromBlock: bigint,
  toBlock?: bigint
): Promise<void> {
  console.log(`🔄 Rescanning blocks ${fromBlock} to ${toBlock || "latest"}`);

  publicClient = getPublicClient();

  const endBlock = toBlock
    ? toBlock
    : (await withRetry(() => publicClient.getBlockNumber())) -
      BigInt(CONFIRMATION_BLOCKS);

  await scanBlockRange(fromBlock, endBlock);
  setLastIndexedBlock(Number(endBlock));

  console.log("✅ Rescan complete");
}

/**
 * Clean API export
 */
export const Indexer = {
  start,
  stop,
  rescan,
};

