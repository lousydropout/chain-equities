/**
 * Gas Analysis Test Suite
 * ------------------------
 * Task 1.7: Measure and analyze gas costs for all major contract operations
 *
 * Tests measure gas costs for:
 * - Contract deployment (ChainEquityToken, CapTable)
 * - Minting operations
 * - Transfer operations (with/without restrictions)
 * - Stock split execution
 * - Corporate action recording
 * - Token linking
 * - Wallet approval/revocation
 *
 * Results are logged but not asserted (gas costs vary by network conditions)
 */

import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Gas Analysis", function () {
  const parse = hre.ethers.parseEther;
  const TOTAL_AUTH = parse("1000000");
  const MINT_100 = parse("100");
  const TRANSFER_10 = parse("10");
  const SPLIT_7X = parse("7");

  async function deployContractsFixture() {
    const [owner, alice, bob] = await hre.ethers.getSigners();

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

    return { token, capTable, owner, alice, bob };
  }

  describe("Deployment Gas Costs", function () {
    it("measures ChainEquityToken deployment gas", async function () {
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const deployTx = await ChainEquityToken.deploy(
        "Test Token",
        "TEST",
        TOTAL_AUTH
      );
      const receipt = await deployTx.deploymentTransaction()?.wait();

      if (receipt) {
        console.log(
          `ChainEquityToken deployment gas: ${receipt.gasUsed.toString()}`
        );
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures CapTable deployment gas", async function () {
      const CapTable = await hre.ethers.getContractFactory("CapTable");
      const deployTx = await CapTable.deploy("Test Corp", "TEST");
      const receipt = await deployTx.deploymentTransaction()?.wait();

      if (receipt) {
        console.log(`CapTable deployment gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });
  });

  describe("Token Operations Gas Costs", function () {
    it("measures approveWallet gas cost", async function () {
      const { token, alice } = await loadFixture(deployContractsFixture);

      const tx = await token.approveWallet(alice.address);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`approveWallet gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures revokeWallet gas cost", async function () {
      const { token, alice } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      const tx = await token.revokeWallet(alice.address);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`revokeWallet gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures mint gas cost", async function () {
      const { token, alice } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      const tx = await token.mint(alice.address, MINT_100);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`mint gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures transfer gas cost (restricted)", async function () {
      const { token, alice, bob } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      await token.approveWallet(bob.address);
      await token.mint(alice.address, MINT_100);

      const tokenAsAlice = token.connect(alice);
      const tx = await tokenAsAlice.transfer(bob.address, TRANSFER_10);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`transfer (restricted) gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures transfer gas cost (unrestricted)", async function () {
      const { token, alice, bob } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);
      await token.setTransfersRestricted(false);

      const tokenAsAlice = token.connect(alice);
      const tx = await tokenAsAlice.transfer(bob.address, TRANSFER_10);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(
          `transfer (unrestricted) gas: ${receipt.gasUsed.toString()}`
        );
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures executeSplit gas cost", async function () {
      const { token } = await loadFixture(deployContractsFixture);

      const tx = await token.executeSplit(SPLIT_7X);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`executeSplit gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures changeSymbol gas cost", async function () {
      const { token } = await loadFixture(deployContractsFixture);

      const tx = await token.changeSymbol("NEWSYM");
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`changeSymbol gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures setTransfersRestricted gas cost", async function () {
      const { token } = await loadFixture(deployContractsFixture);

      const tx = await token.setTransfersRestricted(false);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(
          `setTransfersRestricted gas: ${receipt.gasUsed.toString()}`
        );
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });
  });

  describe("CapTable Operations Gas Costs", function () {
    it("measures linkToken gas cost", async function () {
      const { capTable, token } = await loadFixture(deployContractsFixture);

      const tx = await capTable.linkToken(await token.getAddress());
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`linkToken gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures recordCorporateAction gas cost", async function () {
      const { capTable, token } = await loadFixture(deployContractsFixture);

      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_7X]
      );

      const tx = await capTable.recordCorporateAction("SPLIT", splitData);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`recordCorporateAction gas: ${receipt.gasUsed.toString()}`);
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });

    it("measures recordCorporateAction with large data gas cost", async function () {
      const { capTable, token } = await loadFixture(deployContractsFixture);

      await capTable.linkToken(await token.getAddress());

      const largeArray = Array(50).fill(hre.ethers.parseEther("1"));
      const largeData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256[]"],
        [largeArray]
      );

      const tx = await capTable.recordCorporateAction("LARGE_DATA", largeData);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(
          `recordCorporateAction (large data) gas: ${receipt.gasUsed.toString()}`
        );
        expect(receipt.gasUsed).to.be.gt(0n);
      }
    });
  });

  describe("View Function Gas Costs", function () {
    it("measures effectiveBalanceOf gas cost", async function () {
      const { token, alice } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);
      await token.executeSplit(SPLIT_7X);

      // View functions don't cost gas in transactions, but we can measure
      // the gas used in a static call context
      const gasEstimate = await token.effectiveBalanceOf.estimateGas(
        alice.address
      );

      console.log(`effectiveBalanceOf gas estimate: ${gasEstimate.toString()}`);
      expect(gasEstimate).to.be.gt(0n);
    });

    it("measures getCorporateAction gas cost", async function () {
      const { capTable, token } = await loadFixture(deployContractsFixture);

      await capTable.linkToken(await token.getAddress());

      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_7X]
      );
      await capTable.recordCorporateAction("SPLIT", splitData);

      const gasEstimate = await capTable.getCorporateAction.estimateGas(1);

      console.log(`getCorporateAction gas estimate: ${gasEstimate.toString()}`);
      expect(gasEstimate).to.be.gt(0n);
    });
  });

  describe("Gas Optimization Analysis", function () {
    it("compares gas costs: restricted vs unrestricted transfers", async function () {
      const { token, alice, bob } = await loadFixture(deployContractsFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      // Restricted transfer
      await token.approveWallet(bob.address);
      const tokenAsAlice = token.connect(alice);
      const tx1 = await tokenAsAlice.transfer(bob.address, TRANSFER_10);
      const receipt1 = await tx1.wait();

      // Reset and try unrestricted
      await token.mint(alice.address, TRANSFER_10);
      await token.setTransfersRestricted(false);
      const tx2 = await tokenAsAlice.transfer(bob.address, TRANSFER_10);
      const receipt2 = await tx2.wait();

      if (receipt1 && receipt2) {
        const restrictedGas = receipt1.gasUsed;
        const unrestrictedGas = receipt2.gasUsed;
        const difference = restrictedGas - unrestrictedGas;

        console.log(`Restricted transfer gas: ${restrictedGas.toString()}`);
        console.log(`Unrestricted transfer gas: ${unrestrictedGas.toString()}`);
        console.log(`Difference: ${difference.toString()}`);

        // Restricted should cost more due to allowlist checks
        expect(restrictedGas).to.be.gte(unrestrictedGas);
      }
    });

    it("measures gas cost for multiple operations in sequence", async function () {
      const { token, capTable, alice, bob } = await loadFixture(
        deployContractsFixture
      );

      // Link token
      const linkTx = await capTable.linkToken(await token.getAddress());
      const linkReceipt = await linkTx.wait();

      // Approve wallets
      const approve1Tx = await token.approveWallet(alice.address);
      const approve1Receipt = await approve1Tx.wait();
      const approve2Tx = await token.approveWallet(bob.address);
      const approve2Receipt = await approve2Tx.wait();

      // Mint
      const mintTx = await token.mint(alice.address, MINT_100);
      const mintReceipt = await mintTx.wait();

      // Transfer
      const tokenAsAlice = token.connect(alice);
      const transferTx = await tokenAsAlice.transfer(bob.address, TRANSFER_10);
      const transferReceipt = await transferTx.wait();

      // Split
      const splitTx = await token.executeSplit(SPLIT_7X);
      const splitReceipt = await splitTx.wait();

      // Record action
      const splitData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [SPLIT_7X]
      );
      const actionTx = await capTable.recordCorporateAction("SPLIT", splitData);
      const actionReceipt = await actionTx.wait();

      if (
        linkReceipt &&
        approve1Receipt &&
        approve2Receipt &&
        mintReceipt &&
        transferReceipt &&
        splitReceipt &&
        actionReceipt
      ) {
        const totalGas =
          linkReceipt.gasUsed +
          approve1Receipt.gasUsed +
          approve2Receipt.gasUsed +
          mintReceipt.gasUsed +
          transferReceipt.gasUsed +
          splitReceipt.gasUsed +
          actionReceipt.gasUsed;

        console.log(`Total gas for full workflow: ${totalGas.toString()}`);
        console.log(`- Link token: ${linkReceipt.gasUsed.toString()}`);
        console.log(
          `- Approve wallets: ${(
            approve1Receipt.gasUsed + approve2Receipt.gasUsed
          ).toString()}`
        );
        console.log(`- Mint: ${mintReceipt.gasUsed.toString()}`);
        console.log(`- Transfer: ${transferReceipt.gasUsed.toString()}`);
        console.log(`- Split: ${splitReceipt.gasUsed.toString()}`);
        console.log(`- Record action: ${actionReceipt.gasUsed.toString()}`);

        expect(totalGas).to.be.gt(0n);
      }
    });
  });
});
