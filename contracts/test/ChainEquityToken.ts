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

    const ChainEquityToken = await hre.ethers.getContractFactory(
      "ChainEquityToken"
    );
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

    it("emits Deployed event on deployment", async function () {
      const [owner] = await hre.ethers.getSigners();
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      const token = await ChainEquityToken.deploy(
        "Test Inc. Equity",
        "TEST",
        TOTAL_AUTH
      );

      await expect(token.deploymentTransaction())
        .to.emit(token, "Deployed")
        .withArgs("Test Inc. Equity", "TEST", TOTAL_AUTH);
    });

    it("reverts when totalAuthorized is 0", async function () {
      const ChainEquityToken = await hre.ethers.getContractFactory(
        "ChainEquityToken"
      );
      await expect(
        ChainEquityToken.deploy("Test Inc. Equity", "TEST", 0)
      ).to.be.revertedWith("ChainEquityToken: totalAuthorized must be > 0");
    });

    it("initializes totalSupply to 0", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);
      expect(await token.totalSupply()).to.equal(0n);
    });
  });

  describe("Allowlist", function () {
    it("allows owner to approve a wallet", async function () {
      const { token, owner, alice } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await expect(token.approveWallet(alice.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, alice.address);

      expect(await token.isApproved(alice.address)).to.equal(true);
    });

    it("reverts when approving zero address", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      await expect(
        token.approveWallet(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("ChainEquityToken: cannot approve zero address");
    });

    it("reverts when approving already approved wallet", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await token.approveWallet(alice.address);
      await expect(token.approveWallet(alice.address)).to.be.revertedWith(
        "ChainEquityToken: wallet already approved"
      );
    });

    it("allows owner to revoke wallet approval", async function () {
      const { token, owner, alice } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      expect(await token.isApproved(alice.address)).to.equal(true);

      await expect(token.revokeWallet(alice.address))
        .to.emit(token, "WalletRevoked")
        .withArgs(owner.address, alice.address);

      expect(await token.isApproved(alice.address)).to.equal(false);
    });

    it("reverts when revoking unapproved wallet", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await expect(token.revokeWallet(alice.address)).to.be.revertedWith(
        "ChainEquityToken: wallet not approved"
      );
    });

    it("allows re-approving a revoked wallet", async function () {
      const { token, owner, alice } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      await token.revokeWallet(alice.address);
      expect(await token.isApproved(alice.address)).to.equal(false);

      await expect(token.approveWallet(alice.address))
        .to.emit(token, "WalletApproved")
        .withArgs(owner.address, alice.address);

      expect(await token.isApproved(alice.address)).to.equal(true);
    });

    it("isApproved returns false for unapproved wallet", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      expect(await token.isApproved(alice.address)).to.equal(false);
    });
  });

  describe("Minting", function () {
    it("allows owner to mint to an approved wallet", async function () {
      const { token, owner, alice } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);

      await expect(token.mint(alice.address, MINT_100))
        .to.emit(token, "Issued")
        .withArgs(alice.address, MINT_100);

      const bal = await token.balanceOf(alice.address);
      expect(bal).to.equal(MINT_100);
    });

    it("reverts when minting to unapproved wallet", async function () {
      const { token, bob } = await loadFixture(deployChainEquityTokenFixture);

      await expect(token.mint(bob.address, MINT_10)).to.be.revertedWith(
        "ChainEquityToken: recipient not approved"
      );
    });

    it("reverts when minting to zero address", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      await expect(
        token.mint(hre.ethers.ZeroAddress, MINT_10)
      ).to.be.revertedWith("ChainEquityToken: cannot mint to zero address");
    });

    it("allows multiple mints to same address", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);
      await token.mint(alice.address, MINT_50);

      const bal = await token.balanceOf(alice.address);
      expect(bal).to.equal(MINT_100 + MINT_50);
    });

    it("updates totalSupply correctly on mint", async function () {
      const { token, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      await token.approveWallet(bob.address);

      expect(await token.totalSupply()).to.equal(0n);

      await token.mint(alice.address, MINT_100);
      expect(await token.totalSupply()).to.equal(MINT_100);

      await token.mint(bob.address, MINT_50);
      expect(await token.totalSupply()).to.equal(MINT_100 + MINT_50);
    });

    it("reverts when minting exceeds totalAuthorized", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await token.approveWallet(alice.address);
      const totalAuth = await token.totalAuthorized();

      await token.mint(alice.address, totalAuth);
      expect(await token.totalSupply()).to.equal(totalAuth);

      await expect(token.mint(alice.address, 1n)).to.be.revertedWith(
        "ChainEquityToken: exceeds authorized supply"
      );
    });

    it("allows minting when transfersRestricted is false", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await token.approveWallet(alice.address);
      await token.setTransfersRestricted(false);

      await expect(token.mint(alice.address, MINT_100))
        .to.emit(token, "Issued")
        .withArgs(alice.address, MINT_100);

      const bal = await token.balanceOf(alice.address);
      expect(bal).to.equal(MINT_100);
    });
  });

  describe("Transfers (restricted)", function () {
    it("reverts transfer when sender is not approved and restricted", async function () {
      const { token, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      await token.approveWallet(bob.address);
      await token.mint(alice.address, MINT_50);

      // Revoke alice's approval
      await token.revokeWallet(alice.address);

      const tokenAsAlice = token.connect(alice);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
        tokenAsAlice.transfer(bob.address, TRANSFER_10)
      ).to.be.revertedWith("ChainEquityToken: sender not approved");
    });

    it("reverts transfer when recipient is not approved and restricted", async function () {
      const { token, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_50);

      const tokenAsAlice = token.connect(alice);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
        tokenAsAlice.transfer(bob.address, TRANSFER_10)
      ).to.be.revertedWith("ChainEquityToken: recipient not approved");
    });

    it("allows transfer between approved wallets when restricted", async function () {
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

      const tokenAsAlice = token.connect(alice);
      // @ts-expect-error - TypeScript can't infer contract methods from connect()
      await tokenAsAlice.transfer(bob.address, TRANSFER_10);

      const balA = await token.balanceOf(alice.address);
      const balB = await token.balanceOf(bob.address);
      expect(balA).to.equal(BALANCE_40);
      expect(balB).to.equal(TRANSFER_10);
    });

    it("allows transfer between any wallets when restrictions disabled", async function () {
      const { token, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      // Approve alice to mint, but don't approve bob
      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_50);

      // Disable restrictions
      await token.setTransfersRestricted(false);

      // Now alice can transfer to bob even though bob is not approved
      const tokenAsAlice = token.connect(alice);
      // @ts-expect-error - TypeScript can't infer contract methods from connect()
      await tokenAsAlice.transfer(bob.address, TRANSFER_10);

      const balA = await token.balanceOf(alice.address);
      const balB = await token.balanceOf(bob.address);
      expect(balA).to.equal(BALANCE_40);
      expect(balB).to.equal(TRANSFER_10);
    });

    it("allows transfer from approved wallet when restrictions disabled", async function () {
      const { token, alice, bob } = await loadFixture(
        deployChainEquityTokenFixture
      );

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_50);
      await token.setTransfersRestricted(false);

      const tokenAsAlice = token.connect(alice);
      // @ts-expect-error - TypeScript can't infer contract methods from connect()
      await tokenAsAlice.transfer(bob.address, TRANSFER_10);

      expect(await token.balanceOf(bob.address)).to.equal(TRANSFER_10);
    });
  });

  describe("Virtual Split", function () {
    it("executes a 7-for-1 stock split virtually", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

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

      const invalidMultiplier = parse("0.5");
      await expect(token.executeSplit(invalidMultiplier)).to.be.revertedWith(
        "ChainEquityToken: split multiplier must be >= 1"
      );
    });

    it("reverts when split multiplier equals current splitFactor", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      const currentFactor = await token.splitFactor();
      await expect(token.executeSplit(currentFactor)).to.be.revertedWith(
        "ChainEquityToken: split factor unchanged"
      );
    });

    it("allows multiple splits (replaces previous factor)", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      // First split: 2-for-1
      await token.executeSplit(parse("2"));
      let effBal = await token.effectiveBalanceOf(alice.address);
      expect(effBal).to.equal(MINT_100 * 2n);
      expect(await token.splitFactor()).to.equal(parse("2"));

      // Second split: 3-for-1 (replaces previous, so effective is 3x, not 6x)
      await token.executeSplit(parse("3"));
      effBal = await token.effectiveBalanceOf(alice.address);
      expect(effBal).to.equal(MINT_100 * 3n); // 3x, not 6x (replaces previous factor)
      expect(await token.splitFactor()).to.equal(parse("3"));

      // Verify base balance unchanged
      expect(await token.balanceOf(alice.address)).to.equal(MINT_100);
    });

    it("effectiveBalanceOf returns 0 for zero balance", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await token.executeSplit(SPLIT_7X);
      const effBal = await token.effectiveBalanceOf(alice.address);
      expect(effBal).to.equal(0n);
    });

    it("effectiveBalanceOf applies split factor correctly", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      await token.approveWallet(alice.address);
      await token.mint(alice.address, MINT_100);

      // Test with different split factors
      await token.executeSplit(parse("2"));
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        MINT_100 * 2n
      );

      await token.executeSplit(parse("3"));
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        MINT_100 * 3n // Replaces previous factor
      );

      await token.executeSplit(parse("1.5"));
      expect(await token.effectiveBalanceOf(alice.address)).to.equal(
        (MINT_100 * 15n) / 10n // 1.5x replaces previous factor
      );
    });

    it("splitFactor persists across transactions", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      await token.executeSplit(SPLIT_7X);
      const factor1 = await token.splitFactor();
      expect(factor1).to.equal(SPLIT_7X);

      // Perform another operation
      await token.setTransfersRestricted(false);
      const factor2 = await token.splitFactor();
      expect(factor2).to.equal(SPLIT_7X);
    });

    it("allows split with multiplier = 1e18 when factor is different", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      // First set a different factor
      await token.executeSplit(SPLIT_7X);

      // Now try to set it back to 1x
      await token.executeSplit(SPLIT_1X);
      expect(await token.splitFactor()).to.equal(SPLIT_1X);
    });
  });

  describe("Symbol Change", function () {
    it("emits SymbolChanged event when changing symbol", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      const oldSymbol = await token.symbol();
      await expect(token.changeSymbol("NEWSYM"))
        .to.emit(token, "SymbolChanged")
        .withArgs(oldSymbol, "NEWSYM");
    });

    it("allows changing symbol multiple times", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      await token.changeSymbol("SYM1");
      await expect(token.changeSymbol("SYM2"))
        .to.emit(token, "SymbolChanged")
        .withArgs("ACME", "SYM2");
    });

    it("allows changing symbol with empty string", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      const oldSymbol = await token.symbol();
      await expect(token.changeSymbol(""))
        .to.emit(token, "SymbolChanged")
        .withArgs(oldSymbol, "");
    });

    it("allows changing symbol with very long string", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      const longSymbol = "A".repeat(100);
      const oldSymbol = await token.symbol();
      await expect(token.changeSymbol(longSymbol))
        .to.emit(token, "SymbolChanged")
        .withArgs(oldSymbol, longSymbol);
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

    it("allows toggling multiple times", async function () {
      const { token } = await loadFixture(deployChainEquityTokenFixture);

      await token.setTransfersRestricted(false);
      await token.setTransfersRestricted(true);
      await token.setTransfersRestricted(false);
      await token.setTransfersRestricted(true);

      expect(await token.transfersRestricted()).to.equal(true);
    });

    it("reverts when non-owner tries to set transfer restrictions", async function () {
      const { token, alice } = await loadFixture(deployChainEquityTokenFixture);

      const tokenAsAlice = token.connect(alice);
      await expect(
        // @ts-expect-error - TypeScript can't infer contract methods from connect()
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
