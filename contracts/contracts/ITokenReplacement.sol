// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title ITokenReplacement
 * @notice Placeholder interface for future token replacement functionality
 * 
 * @dev This interface defines the structure for token replacement operations but is NOT
 * currently implemented. Token replacement is deferred until after Phase 2 (Backend API + Event Indexer)
 * is complete.
 * 
 * @custom:design-only This is a design placeholder. No implementation exists yet.
 * 
 * @custom:security Token replacement is a critical operation that requires:
 * - Exact balance preservation (1:1 or split-adjusted)
 * - Allowlist state transfer
 * - Event emission for indexer tracking
 * - Access control (only issuer/owner)
 * 
 * @custom:future Implementation will be added in a future phase after:
 * - Backend indexer is operational
 * - Event tracking infrastructure is tested
 * - Migration workflows are designed and tested off-chain
 * 
 * See TokenReplacement.md for complete design documentation.
 */
interface ITokenReplacement {
    /**
     * @notice Emitted when a token replacement migration is completed
     * @dev This event allows indexers to track token replacements and update their
     * state to watch both old and new token addresses.
     * 
     * @param oldToken Address of the old (replaced) token contract
     * @param newToken Address of the new (replacement) token contract
     * @param timestamp Block timestamp when replacement was recorded
     */
    event TokenReplaced(
        address indexed oldToken,
        address indexed newToken,
        uint256 timestamp
    );
    
    /**
     * @notice Migrates balances from an old token to a new token
     * @dev This function would handle the migration of all shareholder balances
     * from the old token to the new token, maintaining exact ownership percentages.
     * 
     * @custom:security This is a critical operation that must:
     * - Verify total supply matches between old and new tokens
     * - Preserve all shareholder balances exactly
     * - Transfer allowlist state
     * - Emit events for indexer tracking
     * 
     * @custom:future This function is not yet implemented. Current approach uses
     * off-chain migration with on-chain verification via recordCorporateAction().
     * 
     * @param oldToken Address of the old token contract to migrate from
     * @param newToken Address of the new token contract to migrate to
     */
    function migrateBalances(
        address oldToken,
        address newToken
    ) external;
}

