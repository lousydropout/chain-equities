/**
 * @file Generate test events for indexer testing
 * @notice Interacts with deployed contracts to generate events
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
} from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { CONTRACTS } from "../src/config/contracts";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY =
  process.env.ADMIN_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat account #0

async function main() {
  console.log("🎬 Generating test events...\n");

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: hardhat,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(RPC_URL),
  });

  try {
    // Get test accounts (using Hardhat default accounts)
    const alice = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
    const bob = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;

    console.log("1️⃣ Approving wallet for Alice...");
    const approveTx1 = await walletClient.writeContract({
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "approveWallet",
      args: [alice],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx1 });
    console.log(`   ✅ Approved: ${approveTx1}\n`);

    console.log("2️⃣ Approving wallet for Bob...");
    const approveTx2 = await walletClient.writeContract({
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "approveWallet",
      args: [bob],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx2 });
    console.log(`   ✅ Approved: ${approveTx2}\n`);

    console.log("3️⃣ Minting 1000 tokens to Alice (Issued event)...");
    const mintTx1 = await walletClient.writeContract({
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "mint",
      args: [alice, parseEther("1000")],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx1 });
    console.log(`   ✅ Minted: ${mintTx1}\n`);

    console.log("4️⃣ Minting 500 tokens to Bob (Issued event)...");
    const mintTx2 = await walletClient.writeContract({
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "mint",
      args: [bob, parseEther("500")],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx2 });
    console.log(`   ✅ Minted: ${mintTx2}\n`);

    // Wait a bit for indexer to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("5️⃣ Transferring 100 tokens from Alice to Bob (Transfer event)...");
    // Create a wallet client for Alice
    const aliceAccount = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`
    );
    const aliceWallet = createWalletClient({
      account: aliceAccount,
      chain: hardhat,
      transport: http(RPC_URL),
    });

    const transferTx = await aliceWallet.writeContract({
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "transfer",
      args: [bob, parseEther("100")],
    });
    await publicClient.waitForTransactionReceipt({ hash: transferTx });
    console.log(`   ✅ Transferred: ${transferTx}\n`);

    // Wait a bit for indexer to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("6️⃣ Executing 2-for-1 stock split (SplitExecuted event)...");
    const splitTx = await walletClient.writeContract({
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: "executeSplit",
      args: [parseEther("2")], // 2-for-1 split
    });
    await publicClient.waitForTransactionReceipt({ hash: splitTx });
    console.log(`   ✅ Split executed: ${splitTx}\n`);

    // Wait a bit for indexer to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("7️⃣ Recording corporate action (CorporateActionRecorded event)...");
    const actionTx = await walletClient.writeContract({
      address: CONTRACTS.capTable.address,
      abi: CONTRACTS.capTable.abi,
      functionName: "recordCorporateAction",
      args: ["TEST_ACTION", "0x1234"],
    });
    await publicClient.waitForTransactionReceipt({ hash: actionTx });
    console.log(`   ✅ Action recorded: ${actionTx}\n`);

    console.log("✅ All test events generated!\n");
    console.log("📊 Summary:");
    console.log("   - 2 Issued events (minting)");
    console.log("   - 1 Transfer event");
    console.log("   - 1 SplitExecuted event");
    console.log("   - 1 CorporateActionRecorded event");
  } catch (error) {
    console.error("❌ Error generating test events:", error);
    process.exit(1);
  }
}

main();

