// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title Roles
 * @notice Library defining standard role constants for ChainEquity system.
 * 
 * @dev This library provides standardized role definitions that are used consistently
 * across on-chain contracts and off-chain backend systems. The role constants are
 * defined as bytes32 values using keccak256 hashing for efficient on-chain storage
 * and comparison.
 * 
 * @custom:note Role enforcement:
 * - On-chain: Contracts use OpenZeppelin's Ownable pattern where owner = issuer role.
 *   Detailed role validation (admin vs issuer granularity) is handled off-chain.
 * - Off-chain: Backend manages role assignments and validation via database.
 * 
 * @custom:usage These constants are informational and ensure consistency between
 * contract and backend role definitions. Actual role enforcement is:
 * - Contract level: Owner-based (issuer functions)
 * - Backend level: Database-based (admin/issuer/investor granularity)
 */
library Roles {
    /// @notice Role constant for issuer (can mint and approve wallets)
    /// @dev Hash of "ROLE_ISSUER" - matches backend role definition
    bytes32 public constant ROLE_ISSUER = keccak256("ROLE_ISSUER");
    
    /// @notice Role constant for investor (can hold and transfer tokens)
    /// @dev Hash of "ROLE_INVESTOR" - matches backend role definition
    bytes32 public constant ROLE_INVESTOR = keccak256("ROLE_INVESTOR");
    
    /// @notice Role constant for admin (can manage system-wide settings)
    /// @dev Hash of "ROLE_ADMIN" - matches backend role definition
    /// @custom:note Admin role is enforced off-chain only, not in contracts
    bytes32 public constant ROLE_ADMIN = keccak256("ROLE_ADMIN");
}

