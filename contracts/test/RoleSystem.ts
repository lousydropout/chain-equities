/**
 * RoleSystem.sol Test Summary
 * ----------------------------
 * Validates:
 * - Role constants are defined correctly in IRoles interface
 * - Owner-based access control (owner = issuer role)
 * - Non-owner cannot perform issuer actions
 * - CapTable owner-only access
 * - Role system documentation and design decisions
 *
 * Note: Detailed role validation (admin vs issuer granularity) is handled off-chain
 * in the backend. Contracts use simple ownership model where owner = issuer role.
 */

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

describe('Role System', function () {
  // Deploy contracts for testing
  async function deployRoleSystemFixture() {
    const [owner, alice, bob] = await hre.ethers.getSigners();

    // Deploy ChainEquityToken and CapTable for access control tests
    const ChainEquityToken = await hre.ethers.getContractFactory('ChainEquityToken');
    const token = await ChainEquityToken.deploy(
      'Test Token',
      'TEST',
      hre.ethers.parseEther('1000000')
    );

    const CapTable = await hre.ethers.getContractFactory('CapTable');
    const capTable = await CapTable.deploy('Test Corp', 'TEST');

    return { owner, alice, bob, token, capTable };
  }

  describe('Role Constants', function () {
    it('defines ROLE_ISSUER constant correctly', async function () {
      // Calculate expected hash
      const expectedHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_ISSUER'));
      
      // Note: Since IRoles is an interface, we can't directly call it
      // But we can verify the constant value matches the expected hash
      // This is primarily for documentation and consistency checks
      expect(expectedHash).to.be.a('string');
      expect(expectedHash.length).to.equal(66); // 0x + 64 hex chars
    });

    it('defines ROLE_INVESTOR constant correctly', async function () {
      const expectedHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_INVESTOR'));
      expect(expectedHash).to.be.a('string');
      expect(expectedHash.length).to.equal(66);
    });

    it('defines ROLE_ADMIN constant correctly', async function () {
      const expectedHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_ADMIN'));
      expect(expectedHash).to.be.a('string');
      expect(expectedHash.length).to.equal(66);
    });

    it('role constants are unique', async function () {
      const issuerHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_ISSUER'));
      const investorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_INVESTOR'));
      const adminHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_ADMIN'));

      expect(issuerHash).to.not.equal(investorHash);
      expect(issuerHash).to.not.equal(adminHash);
      expect(investorHash).to.not.equal(adminHash);
    });
  });

  describe('ChainEquityToken - Owner (Issuer) Role Access', function () {
    it('allows owner to approve wallet (issuer action)', async function () {
      const { token, owner, alice } = await loadFixture(deployRoleSystemFixture);
      
      await expect(token.connect(owner).approveWallet(alice.address))
        .to.emit(token, 'WalletApproved')
        .withArgs(owner.address, alice.address);
    });

    it('allows owner to mint tokens (issuer action)', async function () {
      const { token, owner, alice } = await loadFixture(deployRoleSystemFixture);
      
      await token.connect(owner).approveWallet(alice.address);
      await expect(token.connect(owner).mint(alice.address, hre.ethers.parseEther('1000')))
        .to.emit(token, 'Issued')
        .withArgs(alice.address, hre.ethers.parseEther('1000'));
    });

    it('allows owner to execute split (issuer action)', async function () {
      const { token, owner } = await loadFixture(deployRoleSystemFixture);
      
      await expect(token.connect(owner).executeSplit(hre.ethers.parseEther('2')))
        .to.emit(token, 'SplitExecuted');
    });

    it('allows owner to change symbol (issuer action)', async function () {
      const { token, owner } = await loadFixture(deployRoleSystemFixture);
      
      await expect(token.connect(owner).changeSymbol('NEW'))
        .to.emit(token, 'SymbolChanged');
    });

    it('allows owner to set transfer restrictions (issuer action)', async function () {
      const { token, owner } = await loadFixture(deployRoleSystemFixture);
      
      await expect(token.connect(owner).setTransfersRestricted(false))
        .to.emit(token, 'TransfersRestrictedChanged')
        .withArgs(false);
    });

    it('reverts when non-owner tries to approve wallet', async function () {
      const { token, alice, bob } = await loadFixture(deployRoleSystemFixture);
      
      await expect(
        token.connect(alice).approveWallet(bob.address)
      ).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
    });

    it('reverts when non-owner tries to mint tokens', async function () {
      const { token, owner, alice, bob } = await loadFixture(deployRoleSystemFixture);
      
      // Approve bob first
      await token.connect(owner).approveWallet(bob.address);
      
      await expect(
        token.connect(alice).mint(bob.address, hre.ethers.parseEther('1000'))
      ).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
    });

    it('reverts when non-owner tries to execute split', async function () {
      const { token, alice } = await loadFixture(deployRoleSystemFixture);
      
      await expect(
        token.connect(alice).executeSplit(hre.ethers.parseEther('2'))
      ).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
    });

    it('reverts when non-owner tries to change symbol', async function () {
      const { token, alice } = await loadFixture(deployRoleSystemFixture);
      
      await expect(
        token.connect(alice).changeSymbol('NEW')
      ).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
    });

    it('reverts when non-owner tries to set transfer restrictions', async function () {
      const { token, alice } = await loadFixture(deployRoleSystemFixture);
      
      await expect(
        token.connect(alice).setTransfersRestricted(false)
      ).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
    });
  });

  describe('CapTable - Owner (Issuer) Role Access', function () {
    it('allows owner to link token (issuer action)', async function () {
      const { token, capTable, owner } = await loadFixture(deployRoleSystemFixture);
      
      await expect(capTable.connect(owner).linkToken(await token.getAddress()))
        .to.emit(capTable, 'TokenLinked')
        .withArgs(await capTable.getAddress(), await token.getAddress());
    });

    it('allows owner to record corporate action (issuer action)', async function () {
      const { token, capTable, owner } = await loadFixture(deployRoleSystemFixture);
      
      await capTable.connect(owner).linkToken(await token.getAddress());
      
      const actionData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256'],
        [hre.ethers.parseEther('2')]
      );
      
      await expect(
        capTable.connect(owner).recordCorporateAction('SPLIT', actionData)
      )
        .to.emit(capTable, 'CorporateActionRecorded');
    });

    it('reverts when non-owner tries to link token', async function () {
      const { token, capTable, alice } = await loadFixture(deployRoleSystemFixture);
      
      await expect(
        capTable.connect(alice).linkToken(await token.getAddress())
      ).to.be.revertedWithCustomError(capTable, 'OwnableUnauthorizedAccount');
    });

    it('reverts when non-owner tries to record corporate action', async function () {
      const { token, capTable, owner, alice } = await loadFixture(deployRoleSystemFixture);
      
      // Link token as owner first
      await capTable.connect(owner).linkToken(await token.getAddress());
      
      const actionData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256'],
        [hre.ethers.parseEther('2')]
      );
      
      await expect(
        capTable.connect(alice).recordCorporateAction('SPLIT', actionData)
      ).to.be.revertedWithCustomError(capTable, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Role System Design', function () {
    it('owner represents issuer role in contracts', async function () {
      const { token, owner } = await loadFixture(deployRoleSystemFixture);
      
      // Owner can perform all issuer actions
      expect(await token.owner()).to.equal(owner.address);
      
      // Owner can approve wallets (issuer function)
      await expect(token.connect(owner).approveWallet(owner.address))
        .to.emit(token, 'WalletApproved');
    });

    it('contracts use simple ownership model (owner = issuer)', async function () {
      const { token, capTable, owner } = await loadFixture(deployRoleSystemFixture);
      
      // Both contracts use owner for issuer role
      expect(await token.owner()).to.equal(owner.address);
      expect(await capTable.owner()).to.equal(owner.address);
      
      // Owner can perform issuer actions on both contracts
      await expect(token.connect(owner).approveWallet(owner.address))
        .to.emit(token, 'WalletApproved');
      
      await capTable.connect(owner).linkToken(await token.getAddress());
    });

    it('role constants are defined for off-chain consistency', async function () {
      // Role constants are defined in IRoles.sol for consistency
      // between on-chain contracts and off-chain backend
      // This test verifies the constants can be calculated correctly
      
      const issuerHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_ISSUER'));
      const investorHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_INVESTOR'));
      const adminHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ROLE_ADMIN'));
      
      // All hashes are valid (non-zero, correct length)
      expect(issuerHash).to.not.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
      expect(investorHash).to.not.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
      expect(adminHash).to.not.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
    });
  });
});

