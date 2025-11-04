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
