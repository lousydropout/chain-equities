/**
 * Integration Test Suite
 * -----------------------
 * Task 1.7: End-to-end workflow tests for complete system integration
 *
 * Tests cover:
 * - Full workflow: deploy → link → approve → mint → transfer → split → record action
 * - Multiple shareholders scenarios
 * - Complex corporate action sequences
 * - State consistency across contracts
 */

import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Integration Tests", function () {
  const parse = hre.ethers.parseEther;
  const TOTAL_AUTH = parse("1000000");
  const MINT_100 = parse("100");
  const MINT_200 = parse("200");
  const MINT_50 = parse("50");
  const TRANSFER_30 = parse("30");
  const TRANSFER_20 = parse("20");
  const SPLIT_2X = parse("2");
  const SPLIT_3X = parse("3");

  async function deployContractsFixture() {
    const [owner, alice, bob, charlie] = await hre.ethers.getSigners();

    const ChainEquityToken = await hre.ethers.getContractFactory(
      "ChainEquityToken"
    );
    const token = await ChainEquityToken.deploy(
      "Acme Inc. Equity",
      "ACME",
      TOTAL_AUTH
    );

    const CapTable = await hre.ethers.getContractFactory("CapTable");
    const capTable = await CapTable.deploy("Acme Inc.", "ACME");

    return { token, capTable, owner, alice, bob, charlie };
  }

  describe("Full Workflow Integration", function () {
    it("completes full workflow: deploy → link → approve → mint → transfer → split → record action", async function () {
      const { token, capTable, owner, alice, bob } = await loadFixture(
        deployContractsFixture
      );

      // Step 1: Link token to cap table
      await expect(capTable.linkToken(await token.getAddress()))
        .to.emit(capTable, "TokenLinked")
        .withArgs(await capTable.getAddress(), await token.getAddress());

      expect(await capTable.isTokenLinked()).to.equal(true);

      // Step 2: Approve wallets
      await expect(token.approveWallet(alice.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, alice.address);

      await expect(token.approveWallet(bob.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, bob.address);

      expect(await token.isApproved(alice.address)).to.equal(true);
      expect(await token.isApproved(bob.address)).to.equal(true);

      // Step 3: Mint tokens
      await expect(token.mint(alice.address, MINT_100))
        .to.emit(token, "Issued")
        .withArgs(alice.address, MINT_100);

      expect(await token.balanceOf(alice.address)).to.equal(MINT_100);
      expect(await token.totalSupply()).to.equal(MINT_100);

      // Step 4: Transfer tokens
      const tokenAsAlice = token.connect(alice);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
        tokenAsAlice.transfer(bob.address, TRANSFER_30)
      )
        .to.emit(token, "Transfer")
        .withArgs(alice.address, bob.address, TRANSFER_30);

      expect(await token.balanceOf(alice.address)).to.equal(MINT_100 - TRANSFER_30);
      expect(await token.balanceOf(bob.address)).to.equal(TRANSFER_30);

      // Step 5: Execute stock split
      const oldFactor = await token.splitFactor();
      const splitTx = await token.executeSplit(SPLIT_2X);
      const splitReceipt = await splitTx.wait();

      await expect(splitTx)
        .to.emit(token, "SplitExecuted")
        .withArgs(oldFactor, SPLIT_2X, splitReceipt!.blockNumber);

      // Verify effective balances reflect split
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        (MINT_100 - TRANSFER_30) * 2n
      );
      expect(await token.effectiveBalanceOf(bob.address)).to.equal(
        TRANSFER_30 * 2n
      );

      // Step 6: Record corporate action
      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_2X]
      );

      const actionTx = await capTable.recordCorporateAction("SPLIT", splitData);
      const actionReceipt = await actionTx.wait();

      await expect(actionTx)
        .to.emit(capTable, "CorporateActionRecorded")
        .withArgs(1n, "SPLIT", actionReceipt!.blockNumber);

      const action = await capTable.getCorporateAction(1);
      expect(action.actionType).to.equal("SPLIT");
      expect(action.blockNumber).to.equal(actionReceipt!.blockNumber);
    });

    it("maintains state consistency across contracts", async function () {
      const { token, capTable, owner, alice } = await loadFixture(
        deployContractsFixture
      );

      // Link contracts
      await capTable.linkToken(await token.getAddress());
      expect(await capTable.token()).to.equal(await token.getAddress());

      // Verify company info
      const [name, symbol, issuer, tokenAddr] = await capTable.getCompanyInfo();
      expect(name).to.equal("Acme Inc.");
      expect(symbol).to.equal("ACME");
      expect(issuer).to.equal(owner.address);
      expect(tokenAddr).to.equal(await token.getAddress());

      // Mint tokens
      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      // Verify token state
      expect(await token.balanceOf(alice.address)).to.equal(MINT_100);
      expect(await token.totalSupply()).to.equal(MINT_100);

      // Execute split and record action
      await token.executeSplit(SPLIT_2X);
      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_2X]
      );
      await capTable.recordCorporateAction("SPLIT", splitData);

      // Verify both contracts have correct state
      expect(await token.splitFactor()).to.equal(SPLIT_2X);
      expect(await capTable.corporateActionCount()).to.equal(1n);
    });
  });

  describe("Multiple Shareholders Integration", function () {
    it("handles multiple shareholders with transfers and splits", async function () {
      const { token, capTable, owner, alice, bob, charlie } = await loadFixture(
        deployContractsFixture
      );

      // Link token
      await capTable.linkToken(await token.getAddress());

      // Approve all shareholders
      await token.approveWallet(alice.address);
      await token.approveWallet(bob.address);
      await token.approveWallet(charlie.address);

      // Mint to multiple shareholders
      await token.mint(alice.address, MINT_100);
      await token.mint(bob.address, MINT_200);
      await token.mint(charlie.address, MINT_50);

      // Verify balances
      expect(await token.balanceOf(alice.address)).to.equal(MINT_100);
      expect(await token.balanceOf(bob.address)).to.equal(MINT_200);
      expect(await token.balanceOf(charlie.address)).to.equal(MINT_50);
      expect(await token.totalSupply()).to.equal(MINT_100 + MINT_200 + MINT_50);

      // Transfer between shareholders
      const tokenAsBob = token.connect(bob);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
        tokenAsBob.transfer(charlie.address, TRANSFER_20)
      )
        .to.emit(token, "Transfer")
        .withArgs(bob.address, charlie.address, TRANSFER_20);

      expect(await token.balanceOf(bob.address)).to.equal(MINT_200 - TRANSFER_20);
      expect(await token.balanceOf(charlie.address)).to.equal(MINT_50 + TRANSFER_20);

      // Execute split
      await token.executeSplit(SPLIT_3X);

      // Verify effective balances for all shareholders
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        MINT_100 * 3n
      );
      expect(await token.effectiveBalanceOf(bob.address)).to.equal(
        (MINT_200 - TRANSFER_20) * 3n
      );
      expect(await token.effectiveBalanceOf(charlie.address)).to.equal(
        (MINT_50 + TRANSFER_20) * 3n
      );

      // Record action
      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_3X]
      );
      await capTable.recordCorporateAction("SPLIT", splitData);

      expect(await capTable.corporateActionCount()).to.equal(1n);
    });

    it("handles complex transfer chains between multiple shareholders", async function () {
      const { token, capTable, alice, bob, charlie } = await loadFixture(
        deployContractsFixture
      );

      await capTable.linkToken(await token.getAddress());
      await token.approveWallet(alice.address);
      await token.approveWallet(bob.address);
      await token.approveWallet(charlie.address);

      // Initial mint
      await token.mint(alice.address, MINT_100);

      // Transfer chain: alice -> bob -> charlie
      const tokenAsAlice = token.connect(alice);
      await tokenAsAlice.transfer(bob.address, TRANSFER_30);

      const tokenAsBob = token.connect(bob);
      await tokenAsBob.transfer(charlie.address, TRANSFER_20);

      // Verify final balances
      expect(await token.balanceOf(alice.address)).to.equal(
        MINT_100 - TRANSFER_30
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        TRANSFER_30 - TRANSFER_20
      );
      expect(await token.balanceOf(charlie.address)).to.equal(TRANSFER_20);

      // Verify total supply unchanged
      expect(await token.totalSupply()).to.equal(MINT_100);
    });
  });

  describe("Complex Corporate Action Sequences", function () {
    it("handles multiple corporate actions in sequence", async function () {
      const { token, capTable, alice } = await loadFixture(
        deployContractsFixture
      );

      await capTable.linkToken(await token.getAddress());
      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      // Record split action
      await token.executeSplit(SPLIT_2X);
      const splitData1 = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_2X]
      );
      await capTable.recordCorporateAction("SPLIT", splitData1);

      // Record symbol change action
      await token.changeSymbol("NEWSYM");
      const symbolData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["string"],
        ["NEWSYM"]
      );
      await capTable.recordCorporateAction("SYMBOL_CHANGE", symbolData);

      // Record another split
      await token.executeSplit(SPLIT_3X);
      const splitData2 = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_3X]
      );
      await capTable.recordCorporateAction("SPLIT", splitData2);

      // Verify all actions recorded
      expect(await capTable.corporateActionCount()).to.equal(3n);

      const action1 = await capTable.getCorporateAction(1);
      const action2 = await capTable.getCorporateAction(2);
      const action3 = await capTable.getCorporateAction(3);

      expect(action1.actionType).to.equal("SPLIT");
      expect(action2.actionType).to.equal("SYMBOL_CHANGE");
      expect(action3.actionType).to.equal("SPLIT");

      // Verify split factor is correct (accumulative)
      expect(await token.splitFactor()).to.equal(SPLIT_3X);
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        MINT_100 * 3n
      );
    });

    it("handles TOKEN_REPLACED action type", async function () {
      const { capTable } = await loadFixture(deployContractsFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const oldToken = await ChainEquityToken.deploy(
        "Old Token",
        "OLD",
        TOTAL_AUTH
      );
      const newToken = await ChainEquityToken.deploy(
        "New Token",
        "NEW",
        TOTAL_AUTH
      );

      await capTable.linkToken(await oldToken.getAddress());

      // Record token replacement
      const replacementData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256"],
        [
          await oldToken.getAddress(),
          await newToken.getAddress(),
          await hre.ethers.provider.getBlockNumber(),
        ]
      );

      await capTable.recordCorporateAction("TOKEN_REPLACED", replacementData);

      const action = await capTable.getCorporateAction(1);
      expect(action.actionType).to.equal("TOKEN_REPLACED");

      // Decode and verify data
      const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["address", "address", "uint256"],
        action.data
      );
      expect(decoded[0].toLowerCase()).to.equal(
        (await oldToken.getAddress()).toLowerCase()
      );
      expect(decoded[1].toLowerCase()).to.equal(
        (await newToken.getAddress()).toLowerCase()
      );
    });
  });

  describe("Transfer Restriction Scenarios", function () {
    it("handles enabling/disabling transfer restrictions in workflow", async function () {
      const { token, alice, bob } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      // Initially restricted - can't transfer to unapproved bob
      const tokenAsAlice = token.connect(alice);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
        tokenAsAlice.transfer(bob.address, TRANSFER_30)
      ).to.be.revertedWith("ChainEquityToken: recipient not approved");

      // Disable restrictions
      await token.setTransfersRestricted(false);

      // Now can transfer
      await tokenAsAlice.transfer(bob.address, TRANSFER_30);
      expect(await token.balanceOf(bob.address)).to.equal(TRANSFER_30);

      // Re-enable restrictions
      await token.setTransfersRestricted(true);

      // Can't transfer to unapproved charlie
      const [charlie] = await hre.ethers.getSigners();
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
        tokenAsAlice.transfer(charlie.address, TRANSFER_20)
      ).to.be.revertedWith("ChainEquityToken: recipient not approved");
    });
  });

  describe("Error Recovery and Edge Cases", function () {
    it("handles minting up to totalAuthorized limit", async function () {
      const { token, alice, bob } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      await token.approveWallet(bob.address);

      const totalAuth = await token.totalAuthorized();

      // Mint up to limit
      await token.mint(alice.address, totalAuth);
      expect(await token.totalSupply()).to.equal(totalAuth);

      // Can't mint more
      await expect(token.mint(bob.address, 1n)).to.be.revertedWith(
        "ChainEquityToken: exceeds authorized supply"
      );
    });

    it("handles multiple splits correctly with effective balances", async function () {
      const { token, alice } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      // First split: 2x
      await token.executeSplit(SPLIT_2X);
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        MINT_100 * 2n
      );

      // Second split: 3x (replaces previous, so 3x not 6x)
      await token.executeSplit(SPLIT_3X);
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        MINT_100 * 3n // Replaces previous factor
      );

      // Base balance unchanged
      expect(await token.balanceOf(alice.address)).to.equal(MINT_100);
    });
  });
});

