import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

// Helper for parsing ether values
const parse = hre.ethers.parseEther;

// Shared constants
const TOTAL_AUTH = parse("1000000");
const MINT_100 = parse("100");
const MINT_50 = parse("50");
const MINT_10 = parse("10");
const TRANSFER_10 = parse("10");
const TRANSFER_30 = parse("30");
const BALANCE_0 = parse("0");
const BALANCE_40 = parse("40");
const BALANCE_70 = parse("70");
const BALANCE_700 = parse("700");
const BALANCE_490 = parse("490");
const BALANCE_210 = parse("210");
const SPLIT_1X = parse("1");
const SPLIT_7X = parse("7");

describe("ChainEquityToken", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployChainEquityTokenFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice, bob] = await hre.ethers.getSigners();

    const ChainEquityToken =
      await hre.ethers.getContractFactory("ChainEquityToken");
    const token = await ChainEquityToken.deploy(
      "Acme Inc. Equity",
      "ACME",
      TOTAL_AUTH
    );

    return { token, owner, alice, bob };
  }

  // Type helper to get the contract type from the fixture
  type TokenContract = Awaited<
    ReturnType<typeof deployChainEquityTokenFixture>
  >["token"];

  describe("Deployment", function () {
    it("initializes correctly", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      const [name, symbol, totalAuth, splitFactor, restricted] =
        await Promise.all([
          token.name(),
          token.symbol(),
          token.totalAuthorized(),
          token.splitFactor(),
          token.transfersRestricted(),
        ]);

      expect(name).to.equal("Acme Inc. Equity");
      expect(symbol).to.equal("ACME");
      expect(totalAuth).to.equal(TOTAL_AUTH);
      expect(splitFactor).to.equal(SPLIT_1X);
      expect(restricted).to.equal(true);
    });
  });

  describe("Allowlist + Minting", function () {
    it("allows owner to approve and mint to a wallet", async function () {
      const { token, owner, alice } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await expect(token.approveWallet(alice.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, alice.address);

      expect(await token.isApproved(alice.address)).to.equal(true);

      await expect(token.mint(alice.address, MINT_100))
        .to.emit(token, "Issued")
        .withArgs(alice.address, MINT_100);

      const bal = await token.balanceOf(alice.address);
      expect(bal).to.equal(MINT_100);
    });

    it("reverts when minting to unapproved wallet", async function () {
      const { token, owner, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await expect(token.mint(bob.address, MINT_10)).to.be.revertedWith(
        "ChainEquityToken: recipient not approved"
      );
    });
  });

  describe("Transfers (restricted)", function () {
    it("reverts transfer between unapproved wallets when restricted", async function () {
      const { token, owner, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_50);

      // Connected contract has the same interface as the original contract
      const tokenAsAlice = token.connect(alice);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect(), but runtime works correctly
        tokenAsAlice.transfer(bob.address, TRANSFER_10)
      ).to.be.revertedWith("ChainEquityToken: recipient not approved");
    });

    it("allows transfer between approved wallets", async function () {
      const { token, owner, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await expect(token.approveWallet(alice.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, alice.address);

      await expect(token.approveWallet(bob.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, bob.address);

      await token.mint(alice.address, MINT_50);

      // Connected contract has the same interface as the original contract
      const tokenAsAlice = token.connect(alice);
      // @ts-expect-error - TypeScript can't infer contract methods from connect(), but runtime works correctly
      await tokenAsAlice.transfer(bob.address, TRANSFER_10);

      const balA = await token.balanceOf(alice.address);
      const balB = await token.balanceOf(bob.address);
      expect(balA).to.equal(BALANCE_40);
      expect(balB).to.equal(TRANSFER_10);
    });
  });

  describe("Virtual Split", function () {
    it("executes a 7-for-1 stock split virtually", async function () {
      const { token, owner, alice } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      const oldFactor = await token.splitFactor();
      const tx = await token.executeSplit(SPLIT_7X);
      const receipt = await tx.wait();
      await expect(tx)
        .to.emit(token, "SplitExecuted")
        .withArgs(oldFactor, SPLIT_7X, receipt!.blockNumber);

      const effBal = await token.effectiveBalanceOf(alice.address);
      expect(effBal).to.equal(BALANCE_700);
    });

    it("reverts when split multiplier is less than 1", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      // Use a value less than 1e18 (1 in parseEther terms)
      const invalidMultiplier = parse("0.5");
      await expect(token.executeSplit(invalidMultiplier)).to.be.revertedWith(
        "ChainEquityToken: split multiplier must be >= 1"
      );
    });
  });

  describe("Restriction toggle", function () {
    it("toggles transfer restriction on and off", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      const before = await token.transfersRestricted();
      expect(before).to.equal(true);

      await expect(token.setTransfersRestricted(false))
        .to.emit(token, "TransfersRestrictedChanged")
        .withArgs(false);

      const after = await token.transfersRestricted();
      expect(after).to.equal(false);

      await expect(token.setTransfersRestricted(true))
        .to.emit(token, "TransfersRestrictedChanged")
        .withArgs(true);

      const afterAgain = await token.transfersRestricted();
      expect(afterAgain).to.equal(true);
    });

    it("reverts when non-owner tries to set transfer restrictions", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      // Connected contract has the same interface as the original contract
      const tokenAsAlice = token.connect(alice);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect(), but runtime works correctly
        tokenAsAlice.setTransfersRestricted(false)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("End-to-End Scenario", function () {
    it("runs through complete workflow: approve → mint → transfer → split → verify balances", async function () {
      const { token, owner, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      // Step 1: Approve two wallets
      await expect(token.approveWallet(alice.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, alice.address);

      await expect(token.approveWallet(bob.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, bob.address);

      expect(await token.isApproved(alice.address)).to.equal(true);
      expect(await token.isApproved(bob.address)).to.equal(true);

      // Step 2: Mint to Alice
      await expect(token.mint(alice.address, MINT_100))
        .to.emit(token, "Issued")
        .withArgs(alice.address, MINT_100);

      let aliceBalance = await token.balanceOf(alice.address);
      let bobBalance = await token.balanceOf(bob.address);
      expect(aliceBalance).to.equal(MINT_100);
      expect(bobBalance).to.equal(BALANCE_0);

      // Step 3: Transfer from Alice to Bob
      // Connected contract has the same interface as the original contract
      const tokenAsAlice = token.connect(alice);
      // @ts-expect-error - TypeScript can't infer contract methods from connect(), but runtime works correctly
      await tokenAsAlice.transfer(bob.address, TRANSFER_30);

      aliceBalance = await token.balanceOf(alice.address);
      bobBalance = await token.balanceOf(bob.address);
      expect(aliceBalance).to.equal(BALANCE_70);
      expect(bobBalance).to.equal(TRANSFER_30);

      // Step 4: Perform a 7-for-1 split
      const oldFactor = await token.splitFactor();
      const splitTx = await token.executeSplit(SPLIT_7X);
      const splitReceipt = await splitTx.wait();
      await expect(splitTx)
        .to.emit(token, "SplitExecuted")
        .withArgs(oldFactor, SPLIT_7X, splitReceipt!.blockNumber);

      // Step 5: Verify both balanceOf and effectiveBalanceOf
      // balanceOf should remain unchanged (virtual split)
      aliceBalance = await token.balanceOf(alice.address);
      bobBalance = await token.balanceOf(bob.address);
      expect(aliceBalance).to.equal(BALANCE_70);
      expect(bobBalance).to.equal(TRANSFER_30);

      // effectiveBalanceOf should reflect the split
      const aliceEffective = await token.effectiveBalanceOf(alice.address);
      const bobEffective = await token.effectiveBalanceOf(bob.address);
      expect(aliceEffective).to.equal(BALANCE_490); // 70 * 7
      expect(bobEffective).to.equal(BALANCE_210); // 30 * 7
    });
  });
});
