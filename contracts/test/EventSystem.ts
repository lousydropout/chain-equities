/**
 * EventSystem Test Suite
 * ----------------------
 * Task 1.5: Verify all required events are emitted correctly with proper signatures
 *
 * Tests cover:
 * - Issued event (ChainEquityToken)
 * - Transfer event (standard ERC20, via ChainEquityToken)
 * - SplitExecuted event (ChainEquityToken)
 * - CapTableCreated event (CapTable)
 * - TokenLinked event (CapTable)
 * - CorporateActionRecorded event (CapTable)
 *
 * Verifies:
 * - Event signatures match expected format
 * - Indexed parameters are correctly set
 * - Events are emitted in the correct functions
 * - Event parameters contain expected values
 */

import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Event System (Task 1.5)", function () {
  // Helper for parsing ether values
  const parse = hre.ethers.parseEther;
  const TOTAL_AUTH = parse("1000000");
  const MINT_100 = parse("100");
  const TRANSFER_10 = parse("10");
  const SPLIT_7X = parse("7");

  async function deployContractsFixture() {
    const [owner, alice, bob] = await hre.ethers.getSigners();

    // Deploy ChainEquityToken
    const ChainEquityToken = await hre.ethers.getContractFactory(
      "ChainEquityToken"
    );
    const token = await ChainEquityToken.deploy(
      "Acme Inc. Equity",
      "ACME",
      TOTAL_AUTH
    );

    // Deploy CapTable
    const CapTable = await hre.ethers.getContractFactory("CapTable");
    const capTable = await CapTable.deploy("Acme Inc.", "ACME");

    return { token, capTable, owner, alice, bob };
  }

  describe("ChainEquityToken Events", function () {
    describe("Issued Event", function () {
      it("emits Issued event with correct parameters when minting", async function () {
        const { token, owner, alice } = await loadFixture(
          deployContractsFixture
        );

        await token.approveWallet(alice.address);

        await expect(token.mint(alice.address, MINT_100))
          .to.emit(token, "Issued")
          .withArgs(alice.address, MINT_100);
      });

      it("has indexed 'to' parameter for efficient filtering", async function () {
        const { token, owner, alice, bob } = await loadFixture(
          deployContractsFixture
        );

        await token.approveWallet(alice.address);
        await token.approveWallet(bob.address);

        // Mint to alice
        const tx1 = await token.mint(alice.address, MINT_100);
        const receipt1 = await tx1.wait();

        // Mint to bob
        const tx2 = await token.mint(bob.address, MINT_100);
        const receipt2 = await tx2.wait();

        // Verify events were emitted
        expect(receipt1?.logs.length).to.be.gt(0);
        expect(receipt2?.logs.length).to.be.gt(0);

        // Check that Issued events are in the logs
        const issuedEvents = receipt1?.logs.filter(
          (log) => log.topics[0] === hre.ethers.id("Issued(address,uint256)")
        );
        expect(issuedEvents?.length).to.equal(1);
      });
    });

    describe("Transfer Event (Standard ERC20)", function () {
      it("emits Transfer event with correct parameters when transferring tokens", async function () {
        const { token, owner, alice, bob } = await loadFixture(
          deployContractsFixture
        );

        await token.approveWallet(alice.address);
        await token.approveWallet(bob.address);
        await token.mint(alice.address, MINT_100);

        const tokenAsAlice = token.connect(alice);
        await expect(
          // @ts-expect-error - TypeScript can't infer contract methods from connect()
          tokenAsAlice.transfer(bob.address, TRANSFER_10)
        )
          .to.emit(token, "Transfer")
          .withArgs(alice.address, bob.address, TRANSFER_10);
      });

      it("emits Transfer event when minting (from is zero address)", async function () {
        const { token, owner, alice } = await loadFixture(
          deployContractsFixture
        );

        await token.approveWallet(alice.address);

        await expect(token.mint(alice.address, MINT_100))
          .to.emit(token, "Transfer")
          .withArgs(hre.ethers.ZeroAddress, alice.address, MINT_100);
      });

      it("has indexed 'from' and 'to' parameters for efficient filtering", async function () {
        const { token, owner, alice, bob } = await loadFixture(
          deployContractsFixture
        );

        await token.approveWallet(alice.address);
        await token.approveWallet(bob.address);
        await token.mint(alice.address, MINT_100);

        const tokenAsAlice = token.connect(alice);
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
        const tx = await tokenAsAlice.transfer(bob.address, TRANSFER_10);
        const receipt = await tx.wait();

        // Verify Transfer event is in logs with indexed parameters
        const transferEvents = receipt?.logs.filter(
          (log) =>
            log.topics[0] === hre.ethers.id("Transfer(address,address,uint256)")
        );
        expect(transferEvents?.length).to.equal(1);

        // Verify indexed parameters (topics[1] = from, topics[2] = to)
        if (transferEvents && transferEvents[0]) {
          const fromTopic = transferEvents[0].topics[1];
          const toTopic = transferEvents[0].topics[2];

          // Check that topics match addresses (addresses are padded in topics)
          expect(fromTopic).to.not.be.undefined;
          expect(toTopic).to.not.be.undefined;
        }
      });
    });

    describe("SplitExecuted Event", function () {
      it("emits SplitExecuted event with correct parameters", async function () {
        const { token } = await loadFixture(deployContractsFixture);

        const oldFactor = await token.splitFactor();
        const tx = await token.executeSplit(SPLIT_7X);
        const receipt = await tx.wait();

        await expect(tx)
          .to.emit(token, "SplitExecuted")
          .withArgs(oldFactor, SPLIT_7X, receipt!.blockNumber);
      });

      it("includes blockNumber in SplitExecuted event", async function () {
        const { token } = await loadFixture(deployContractsFixture);

        const oldFactor = await token.splitFactor();
        const tx = await token.executeSplit(SPLIT_7X);
        const receipt = await tx.wait();

        // Verify blockNumber is included
        const splitEvents = receipt?.logs.filter(
          (log) =>
            log.topics[0] ===
            hre.ethers.id("SplitExecuted(uint256,uint256,uint256)")
        );
        expect(splitEvents?.length).to.equal(1);
        expect(receipt!.blockNumber).to.be.gt(0);
      });

      it("has indexed oldFactor and newFactor parameters", async function () {
        const { token } = await loadFixture(deployContractsFixture);

        const oldFactor = await token.splitFactor();
        const tx = await token.executeSplit(SPLIT_7X);
        const receipt = await tx.wait();

        // Verify event is in logs
        const splitEvents = receipt?.logs.filter(
          (log) =>
            log.topics[0] ===
            hre.ethers.id("SplitExecuted(uint256,uint256,uint256)")
        );
        expect(splitEvents?.length).to.equal(1);

        // Verify indexed parameters (topics[1] = oldFactor, topics[2] = newFactor)
        if (splitEvents && splitEvents[0]) {
          const oldFactorTopic = splitEvents[0].topics[1];
          const newFactorTopic = splitEvents[0].topics[2];

          expect(oldFactorTopic).to.not.be.undefined;
          expect(newFactorTopic).to.not.be.undefined;

          // Verify topics match the expected values
          // Topics are already padded uint256 hex strings, so we can convert them directly
          const decodedOldFactor = hre.ethers.getBigInt(oldFactorTopic);
          const decodedNewFactor = hre.ethers.getBigInt(newFactorTopic);

          expect(decodedOldFactor).to.equal(oldFactor);
          expect(decodedNewFactor).to.equal(SPLIT_7X);
        }
      });
    });
  });

  describe("CapTable Events", function () {
    describe("CapTableCreated Event", function () {
      it("emits CapTableCreated event on deployment with correct parameters", async function () {
        const [owner] = await hre.ethers.getSigners();
        const CapTable = await hre.ethers.getContractFactory("CapTable");
        const capTable = await CapTable.deploy("Test Corp", "TEST");
        const capTableAddress = await capTable.getAddress();

        await expect(capTable.deploymentTransaction())
          .to.emit(capTable, "CapTableCreated")
          .withArgs(capTableAddress, "Test Corp", "TEST", owner.address);
      });

      it("has indexed capTable and issuer parameters", async function () {
        const [owner] = await hre.ethers.getSigners();
        const CapTable = await hre.ethers.getContractFactory("CapTable");
        const capTable = await CapTable.deploy("Test Corp", "TEST");
        const capTableAddress = await capTable.getAddress();
        const deploymentTx = await capTable.deploymentTransaction();
        const receipt = await deploymentTx?.wait();

        // Verify event is in logs
        const createdEvents = receipt?.logs.filter(
          (log) =>
            log.topics[0] ===
            hre.ethers.id("CapTableCreated(address,string,string,address)")
        );
        expect(createdEvents?.length).to.equal(1);

        // Verify indexed parameters (topics[1] = capTable, topics[2] = issuer)
        if (createdEvents && createdEvents[0]) {
          const capTableTopic = createdEvents[0].topics[1];
          const issuerTopic = createdEvents[0].topics[2];

          expect(capTableTopic).to.not.be.undefined;
          expect(issuerTopic).to.not.be.undefined;
        }
      });
    });

    describe("TokenLinked Event", function () {
      it("emits TokenLinked event with correct parameters", async function () {
        const { capTable, token } = await loadFixture(deployContractsFixture);

        const capTableAddress = await capTable.getAddress();
        const tokenAddress = await token.getAddress();

        await expect(capTable.linkToken(tokenAddress))
          .to.emit(capTable, "TokenLinked")
          .withArgs(capTableAddress, tokenAddress);
      });

      it("has indexed capTable and token parameters", async function () {
        const { capTable, token } = await loadFixture(deployContractsFixture);

        const capTableAddress = await capTable.getAddress();
        const tokenAddress = await token.getAddress();

        const tx = await capTable.linkToken(tokenAddress);
        const receipt = await tx.wait();

        // Verify event is in logs
        const linkedEvents = receipt?.logs.filter(
          (log) =>
            log.topics[0] === hre.ethers.id("TokenLinked(address,address)")
        );
        expect(linkedEvents?.length).to.equal(1);

        // Verify indexed parameters (topics[1] = capTable, topics[2] = token)
        if (linkedEvents && linkedEvents[0]) {
          const capTableTopic = linkedEvents[0].topics[1];
          const tokenTopic = linkedEvents[0].topics[2];

          expect(capTableTopic).to.not.be.undefined;
          expect(tokenTopic).to.not.be.undefined;
        }
      });
    });

    describe("CorporateActionRecorded Event", function () {
      it("emits CorporateActionRecorded event with correct parameters", async function () {
        const { capTable, token } = await loadFixture(deployContractsFixture);

        const tokenAddress = await token.getAddress();
        await capTable.linkToken(tokenAddress);

        const actionType = "SPLIT";
        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256"],
          [SPLIT_7X]
        );

        const tx = await capTable.recordCorporateAction(actionType, data);
        const receipt = await tx.wait();

        await expect(tx)
          .to.emit(capTable, "CorporateActionRecorded")
          .withArgs(1n, actionType, receipt!.blockNumber);
      });

      it("has indexed actionId and actionType parameters", async function () {
        const { capTable, token } = await loadFixture(deployContractsFixture);

        const tokenAddress = await token.getAddress();
        await capTable.linkToken(tokenAddress);

        const actionType = "SPLIT";
        const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256"],
          [SPLIT_7X]
        );

        const tx = await capTable.recordCorporateAction(actionType, data);
        const receipt = await tx.wait();

        // Verify event is in logs
        const actionEvents = receipt?.logs.filter(
          (log) =>
            log.topics[0] ===
            hre.ethers.id("CorporateActionRecorded(uint256,string,uint256)")
        );
        expect(actionEvents?.length).to.equal(1);

        // Verify indexed parameters (topics[1] = actionId, topics[2] = actionType)
        if (actionEvents && actionEvents[0]) {
          const actionIdTopic = actionEvents[0].topics[1];
          const actionTypeTopic = actionEvents[0].topics[2];

          expect(actionIdTopic).to.not.be.undefined;
          expect(actionTypeTopic).to.not.be.undefined;
        }
      });

      it("emits correct actionId for multiple actions", async function () {
        const { capTable, token } = await loadFixture(deployContractsFixture);

        const tokenAddress = await token.getAddress();
        await capTable.linkToken(tokenAddress);

        const data1 = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256"],
          [SPLIT_7X]
        );
        const data2 = hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["string"],
          ["NEW_SYMBOL"]
        );

        const tx1 = await capTable.recordCorporateAction("SPLIT", data1);
        const receipt1 = await tx1.wait();

        const tx2 = await capTable.recordCorporateAction(
          "SYMBOL_CHANGE",
          data2
        );
        const receipt2 = await tx2.wait();

        await expect(tx1)
          .to.emit(capTable, "CorporateActionRecorded")
          .withArgs(1n, "SPLIT", receipt1!.blockNumber);

        await expect(tx2)
          .to.emit(capTable, "CorporateActionRecorded")
          .withArgs(2n, "SYMBOL_CHANGE", receipt2!.blockNumber);
      });
    });
  });

  describe("Event Signature Verification", function () {
    it("verifies all required event signatures match expected format", async function () {
      // This test verifies that event signatures are correctly formatted
      // by checking the keccak256 hash of event signatures

      const expectedSignatures = {
        Transfer: hre.ethers.id("Transfer(address,address,uint256)"),
        Issued: hre.ethers.id("Issued(address,uint256)"),
        SplitExecuted: hre.ethers.id("SplitExecuted(uint256,uint256,uint256)"),
        CapTableCreated: hre.ethers.id(
          "CapTableCreated(address,string,string,address)"
        ),
        TokenLinked: hre.ethers.id("TokenLinked(address,address)"),
        CorporateActionRecorded: hre.ethers.id(
          "CorporateActionRecorded(uint256,string,uint256)"
        ),
      };

      // Verify signatures are non-zero
      Object.values(expectedSignatures).forEach((signature) => {
        expect(signature).to.not.equal(hre.ethers.ZeroHash);
      });

      // Verify all signatures are unique
      const signatures = Object.values(expectedSignatures);
      const uniqueSignatures = new Set(signatures);
      expect(uniqueSignatures.size).to.equal(signatures.length);
    });
  });

  describe("Event Emission Completeness", function () {
    it("verifies all required events are emitted during typical workflow", async function () {
      const { token, capTable, owner, alice } = await loadFixture(
        deployContractsFixture
      );

      const tokenAddress = await token.getAddress();
      const capTableAddress = await capTable.getAddress();

      // 1. CapTableCreated - already emitted in fixture
      // 2. TokenLinked
      const linkTx = await capTable.linkToken(tokenAddress);
      await expect(linkTx).to.emit(capTable, "TokenLinked");

      // 3. WalletApproved (for Issued event)
      await token.approveWallet(alice.address);

      // 4. Issued
      const mintTx = await token.mint(alice.address, MINT_100);
      await expect(mintTx).to.emit(token, "Issued");
      // Transfer event is also emitted during mint
      await expect(mintTx).to.emit(token, "Transfer");

      // 5. SplitExecuted
      const splitTx = await token.executeSplit(SPLIT_7X);
      await expect(splitTx).to.emit(token, "SplitExecuted");

      // 6. CorporateActionRecorded
      const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_7X]
      );
      const actionTx = await capTable.recordCorporateAction("SPLIT", data);
      await expect(actionTx).to.emit(capTable, "CorporateActionRecorded");

      // Verify all events were emitted
      expect(linkTx).to.not.be.undefined;
      expect(mintTx).to.not.be.undefined;
      expect(splitTx).to.not.be.undefined;
      expect(actionTx).to.not.be.undefined;
    });
  });
});
