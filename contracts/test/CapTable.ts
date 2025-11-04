/**
 * CapTable.sol Test Summary
 * --------------------------
 * Validates:
 * - Deployment metadata and constraints
 * - Token linking behavior and events
 * - Corporate action recording, retrieval, and validation
 * - Access control via Ownable
 * - View function correctness
 *
 * Excludes:
 * - Orchestrator integration (covered in Task 1.3)
 * - Gas optimization benchmarks (Task 1.7)
 *
 * Note: Gas reporting configuration will be added in Task 1.7.
 */

import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("CapTable", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployCapTableFixture() {
    const [owner, alice, bob] = await hre.ethers.getSigners();

    const CapTable = await hre.ethers.getContractFactory("CapTable");
    const capTable = await CapTable.deploy("Acme Inc.", "ACME");

    return { capTable, owner, alice, bob };
  }

  // Type helper to get the contract type from the fixture
  type CapTableContract = Awaited<
    ReturnType<typeof deployCapTableFixture>
  >["capTable"];

  describe("Deployment", function () {
    it("initializes correctly", async function () {
      const { capTable, owner } = await loadFixture(deployCapTableFixture);

      const [
        name,
        symbol,
        issuer,
        token,
        createdAt,
        nextActionId,
        actionCount,
      ] = await Promise.all([
        capTable.name(),
        capTable.symbol(),
        capTable.owner(),
        capTable.token(),
        capTable.createdAt(),
        capTable.nextActionId(),
        capTable.corporateActionCount(),
      ]);

      expect(name).to.equal("Acme Inc.");
      expect(symbol).to.equal("ACME");
      expect(issuer).to.equal(owner.address);
      expect(token).to.equal(hre.ethers.ZeroAddress);
      expect(createdAt).to.be.gt(0);
      expect(nextActionId).to.equal(1n);
      expect(actionCount).to.equal(0n);
    });

    it("createdAt timestamp is valid and reasonable", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const createdAt = await capTable.createdAt();
      const currentBlock = await hre.ethers.provider.getBlock("latest");
      const currentTimestamp = BigInt(currentBlock!.timestamp);

      // createdAt should be within last minute (allowing for test execution time)
      expect(createdAt).to.be.gt(0);
      expect(createdAt).to.be.lte(currentTimestamp);
      expect(currentTimestamp - createdAt).to.be.lt(60n); // Less than 60 seconds
    });

    it("emits CapTableCreated event on deployment", async function () {
      const [owner] = await hre.ethers.getSigners();
      const CapTable = await hre.ethers.getContractFactory("CapTable");
      const capTable = await CapTable.deploy("Test Corp", "TEST");
      const capTableAddress = await capTable.getAddress();

      await expect(capTable.deploymentTransaction())
        .to.emit(capTable, "CapTableCreated")
        .withArgs(capTableAddress, "Test Corp", "TEST", owner.address);
    });

    it("reverts when name is empty", async function () {
      const CapTable = await hre.ethers.getContractFactory("CapTable");
      await expect(CapTable.deploy("", "SYMBOL")).to.be.revertedWith(
        "CapTable: name cannot be empty"
      );
    });

    it("reverts when symbol is empty", async function () {
      const CapTable = await hre.ethers.getContractFactory("CapTable");
      await expect(CapTable.deploy("Name", "")).to.be.revertedWith(
        "CapTable: symbol cannot be empty"
      );
    });
  });

  describe("Token Linking", function () {
    it("allows owner to link a valid token address", async function () {
      const { capTable, owner } = await loadFixture(deployCapTableFixture);
      const [_, alice] = await hre.ethers.getSigners();

      // Deploy a mock token contract for testing
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );

      await expect(capTable.linkToken(await token.getAddress()))
        .to.emit(capTable, "TokenLinked")
        .withArgs(await capTable.getAddress(), await token.getAddress());

      const linkedToken = await capTable.token();
      expect(linkedToken).to.equal(await token.getAddress());
    });

    it("reverts when linking zero address", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      await expect(
        capTable.linkToken(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("CapTable: token address cannot be zero");
    });

    it("reverts when linking token twice", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );

      await capTable.linkToken(await token.getAddress());

      // Try to link again
      await expect(
        capTable.linkToken(await token.getAddress())
      ).to.be.revertedWith("CapTable: token already linked");
    });

    it("reverts when non-owner tries to link token", async function () {
      const { capTable, alice } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );

      const capTableAsAlice = capTable.connect(alice);
      await expect(
        capTableAsAlice.linkToken(await token.getAddress())
      ).to.be.revertedWithCustomError(capTable, "OwnableUnauthorizedAccount");
    });

    it("allows linking with different token contracts", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token1 = await ChainEquityToken.deploy(
        "Token 1",
        "T1",
        hre.ethers.parseEther("1000000")
      );
      const token2 = await ChainEquityToken.deploy(
        "Token 2",
        "T2",
        hre.ethers.parseEther("2000000")
      );

      // Link first token
      await capTable.linkToken(await token1.getAddress());
      expect(await capTable.token()).to.equal(await token1.getAddress());

      // Can't link second token (already linked)
      await expect(
        capTable.linkToken(await token2.getAddress())
      ).to.be.revertedWith("CapTable: token already linked");
    });

    it("token address persists after linking", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );

      await capTable.linkToken(await token.getAddress());
      const linkedToken = await capTable.token();
      expect(linkedToken).to.equal(await token.getAddress());

      // Verify it persists across multiple calls
      expect(await capTable.token()).to.equal(await token.getAddress());
      expect(await capTable.token()).to.equal(linkedToken);
    });
  });

  describe("Corporate Actions", function () {
    it("allows owner to record a split action", async function () {
      const { capTable, owner } = await loadFixture(deployCapTableFixture);

      // Link token first
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      const tx = await capTable.recordCorporateAction("SPLIT", splitData);
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(capTable, "CorporateActionRecorded")
        .withArgs(1n, "SPLIT", receipt!.blockNumber);

      const actionCount = await capTable.corporateActionCount();
      expect(actionCount).to.equal(1n);

      const nextId = await capTable.nextActionId();
      expect(nextId).to.equal(2n);
    });

    it("allows owner to record a symbol change action", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      // Link token first
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const symbolData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["string"],
        ["NEWSYMBOL"]
      );

      const tx = await capTable.recordCorporateAction(
        "SYMBOL_CHANGE",
        symbolData
      );
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(capTable, "CorporateActionRecorded")
        .withArgs(1n, "SYMBOL_CHANGE", receipt!.blockNumber);
    });

    it("reverts when recording action if token not linked", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      await expect(
        capTable.recordCorporateAction("SPLIT", splitData)
      ).to.be.revertedWith(
        "CapTable: token must be linked before recording actions"
      );
    });

    it("reverts when action type is empty", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      // Link token first
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      await expect(
        capTable.recordCorporateAction("", splitData)
      ).to.be.revertedWith("CapTable: action type cannot be empty");
    });

    it("reverts when non-owner tries to record action", async function () {
      const { capTable, alice } = await loadFixture(deployCapTableFixture);

      // Link token first
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      const capTableAsAlice = capTable.connect(alice);
      await expect(
        capTableAsAlice.recordCorporateAction("SPLIT", splitData)
      ).to.be.revertedWithCustomError(capTable, "OwnableUnauthorizedAccount");
    });

    it("stores actions with incremental IDs", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      // Link token first
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );
      const symbolData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["string"],
        ["NEWSYMBOL"]
      );

      // Record first action
      await capTable.recordCorporateAction("SPLIT", splitData);
      const action1 = await capTable.getCorporateAction(1);
      expect(action1.id).to.equal(1n);
      expect(action1.actionType).to.equal("SPLIT");

      // Record second action
      await capTable.recordCorporateAction("SYMBOL_CHANGE", symbolData);
      const action2 = await capTable.getCorporateAction(2);
      expect(action2.id).to.equal(2n);
      expect(action2.actionType).to.equal("SYMBOL_CHANGE");

      const actionCount = await capTable.corporateActionCount();
      expect(actionCount).to.equal(2n);

      const nextId = await capTable.nextActionId();
      expect(nextId).to.equal(3n);
    });

    it("reverts when getting invalid action ID", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      await expect(capTable.getCorporateAction(0)).to.be.revertedWith(
        "CapTable: invalid action ID"
      );

      await expect(capTable.getCorporateAction(1)).to.be.revertedWith(
        "CapTable: invalid action ID"
      );
    });

    it("allows recording TOKEN_REPLACED action type", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const oldToken = await ChainEquityToken.deploy(
        "Old Token",
        "OLD",
        hre.ethers.parseEther("1000000")
      );
      const newToken = await ChainEquityToken.deploy(
        "New Token",
        "NEW",
        hre.ethers.parseEther("1000000")
      );

      await capTable.linkToken(await oldToken.getAddress());

      // Encode TOKEN_REPLACED data: (address oldToken, address newToken, uint256 migrationBlockNumber)
      const replacementData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256"],
        [
          await oldToken.getAddress(),
          await newToken.getAddress(),
          await hre.ethers.provider.getBlockNumber(),
        ]
      );

      const tx = await capTable.recordCorporateAction(
        "TOKEN_REPLACED",
        replacementData
      );
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(capTable, "CorporateActionRecorded")
        .withArgs(1n, "TOKEN_REPLACED", receipt!.blockNumber);

      const action = await capTable.getCorporateAction(1);
      expect(action.actionType).to.equal("TOKEN_REPLACED");
      expect(action.data).to.equal(replacementData);
    });

    it("allows recording corporate action with empty data", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const emptyData = "0x";
      const tx = await capTable.recordCorporateAction("CUSTOM", emptyData);
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(capTable, "CorporateActionRecorded")
        .withArgs(1n, "CUSTOM", receipt!.blockNumber);

      const action = await capTable.getCorporateAction(1);
      expect(action.data).to.equal(emptyData);
    });

    it("allows recording corporate action with very large data", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      // Create large data (array of 100 uint256 values)
      const largeArray = Array(100).fill(hre.ethers.parseEther("1"));
      const largeData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[]"],
        [largeArray]
      );

      const tx = await capTable.recordCorporateAction("LARGE_DATA", largeData);
      const receipt = await tx.wait();

      await expect(tx)
        .to.emit(capTable, "CorporateActionRecorded")
        .withArgs(1n, "LARGE_DATA", receipt!.blockNumber);

      const action = await capTable.getCorporateAction(1);
      expect(action.data).to.equal(largeData);
    });

    it("allows recording multiple actions with same type", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData1 = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("2")]
      );
      const splitData2 = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("3")]
      );

      await capTable.recordCorporateAction("SPLIT", splitData1);
      await capTable.recordCorporateAction("SPLIT", splitData2);

      const action1 = await capTable.getCorporateAction(1);
      const action2 = await capTable.getCorporateAction(2);

      expect(action1.actionType).to.equal("SPLIT");
      expect(action2.actionType).to.equal("SPLIT");
      expect(action1.id).to.equal(1n);
      expect(action2.id).to.equal(2n);
    });

    it("can retrieve all action IDs correctly", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      // Record 5 actions
      for (let i = 0; i < 5; i++) {
        await capTable.recordCorporateAction("SPLIT", splitData);
      }

      // Retrieve all actions
      for (let i = 1; i <= 5; i++) {
        const action = await capTable.getCorporateAction(i);
        expect(action.id).to.equal(BigInt(i));
        expect(action.actionType).to.equal("SPLIT");
      }

      expect(await capTable.corporateActionCount()).to.equal(5n);
      expect(await capTable.nextActionId()).to.equal(6n);
    });

    it("timestamp and blockNumber are correct for actions", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      const tx = await capTable.recordCorporateAction("SPLIT", splitData);
      const receipt = await tx.wait();
      const block = await hre.ethers.provider.getBlock(receipt!.blockNumber!);

      const action = await capTable.getCorporateAction(1);
      expect(action.blockNumber).to.equal(receipt!.blockNumber);
      expect(action.timestamp).to.equal(block!.timestamp);
    });

    it("correctly encodes and decodes action data", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      // Test encoding/decoding split data
      const splitMultiplier = hre.ethers.parseEther("7");
      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [splitMultiplier]
      );

      await capTable.recordCorporateAction("SPLIT", splitData);
      const action = await capTable.getCorporateAction(1);

      // Decode the data
      const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256"],
        action.data
      );
      expect(decoded[0]).to.equal(splitMultiplier);
    });
  });

  describe("View Functions", function () {
    it("getCorporateActionCount returns 0 immediately after deployment", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      // Should return 0 before any actions are recorded (even before token linking)
      expect(await capTable.getCorporateActionCount()).to.equal(0n);
    });

    it("getCorporateActionCount returns correct count", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      expect(await capTable.getCorporateActionCount()).to.equal(0n);

      // Link token and record actions
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      await capTable.recordCorporateAction("SPLIT", splitData);
      expect(await capTable.getCorporateActionCount()).to.equal(1n);

      await capTable.recordCorporateAction("SPLIT", splitData);
      expect(await capTable.getCorporateActionCount()).to.equal(2n);
    });

    it("getCorporateAction returns correct data", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      // Link token first
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      const tx = await capTable.recordCorporateAction("SPLIT", splitData);
      const receipt = await tx.wait();
      const blockNumber = receipt!.blockNumber;

      const action = await capTable.getCorporateAction(1);
      expect(action.id).to.equal(1n);
      expect(action.actionType).to.equal("SPLIT");
      expect(action.blockNumber).to.equal(blockNumber);
      expect(action.timestamp).to.be.gt(0);
      expect(action.data).to.equal(splitData);
    });

    it("isTokenLinked returns false when token not linked", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      expect(await capTable.isTokenLinked()).to.equal(false);
    });

    it("isTokenLinked returns true when token is linked", async function () {
      const { capTable } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );

      expect(await capTable.isTokenLinked()).to.equal(false);

      await capTable.linkToken(await token.getAddress());

      expect(await capTable.isTokenLinked()).to.equal(true);
    });

    it("getCompanyInfo works before linking a token", async function () {
      const { capTable, owner } = await loadFixture(deployCapTableFixture);

      // Should not revert even when token is not linked
      const [name, symbol, issuer, tokenAddr, createdAt] =
        await capTable.getCompanyInfo();

      expect(name).to.equal("Acme Inc.");
      expect(symbol).to.equal("ACME");
      expect(issuer).to.equal(owner.address);
      expect(tokenAddr).to.equal(hre.ethers.ZeroAddress);
      expect(createdAt).to.be.gt(0);
    });

    it("getCompanyInfo returns all metadata", async function () {
      const { capTable, owner } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const [name, symbol, issuer, tokenAddr, createdAt] =
        await capTable.getCompanyInfo();

      expect(name).to.equal("Acme Inc.");
      expect(symbol).to.equal("ACME");
      expect(issuer).to.equal(owner.address);
      expect(tokenAddr).to.equal(await token.getAddress());
      expect(createdAt).to.be.gt(0);
    });
  });

  describe("Access Control", function () {
    it("only owner can link token", async function () {
      const { capTable, alice } = await loadFixture(deployCapTableFixture);

      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );

      const capTableAsAlice = capTable.connect(alice);
      await expect(
        capTableAsAlice.linkToken(await token.getAddress())
      ).to.be.revertedWithCustomError(capTable, "OwnableUnauthorizedAccount");
    });

    it("only owner can record corporate actions", async function () {
      const { capTable, alice } = await loadFixture(deployCapTableFixture);

      // Link token as owner first
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        hre.ethers.parseEther("1000000")
      );
      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [hre.ethers.parseEther("7")]
      );

      const capTableAsAlice = capTable.connect(alice);
      await expect(
        capTableAsAlice.recordCorporateAction("SPLIT", splitData)
      ).to.be.revertedWithCustomError(capTable, "OwnableUnauthorizedAccount");
    });
  });
});
