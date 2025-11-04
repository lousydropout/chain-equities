// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainEquityToken
 * @notice Tokenized equity contract representing company shares on-chain with compliance gating.
 * 
 * @dev This contract implements a tokenized security instrument that enables on-chain cap-table
 * management for private companies. It uses an allowlist-based transfer restriction system to
 * enforce compliance (KYC/AML) requirements. The contract supports corporate actions including
 * virtual stock splits and symbol changes, with issuer-controlled minting and wallet approvals.
 * Built on OpenZeppelin v5's ERC20 and Ownable patterns for security and standardization.
 * 
 * @custom:roles Role-based access control:
 * - Owner (issuer role): The contract owner represents the ISSUER role and has exclusive access to
 *   mint tokens, approve/revoke wallets, execute splits, change symbols, and manage transfer restrictions.
 *   See IRoles.sol for role constant definitions.
 * - Investor role: Investor role validation is handled off-chain via the backend. On-chain, investors
 *   are represented by approved wallets in the allowlist. The backend validates investor permissions
 *   for API access and enforces role-based restrictions on business logic.
 * - Admin role: Admin role is enforced off-chain only (backend). Contracts use simple ownership model
 *   where owner = issuer. Admin vs issuer granularity is managed in the backend database.
 */
contract ChainEquityToken is ERC20, Ownable {
    // State variables
    bool public transfersRestricted;
    uint256 public splitFactor; // Uses 1e18 precision (1e18 = 1x, 7e18 = 7x)
    uint256 public totalAuthorized;
    
    // Allowlist mapping
    mapping(address => bool) public allowlist;
    
    // Events
    /// @notice Emitted when a wallet is approved for transfers (KYC completion)
    event WalletApproved(address indexed issuer, address indexed wallet);
    
    /// @notice Emitted when a wallet's approval is revoked
    event WalletRevoked(address indexed issuer, address indexed wallet);
    
    /// @notice Emitted when new tokens are minted to a shareholder
    event Issued(address indexed to, uint256 amount);
    
    /// @notice Emitted when a stock split is executed
    event SplitExecuted(uint256 oldFactor, uint256 newFactor, uint256 blockNumber);
    
    /// @notice Emitted when the token symbol is changed (via event, actual symbol requires redeployment)
    event SymbolChanged(string oldSymbol, string newSymbol);
    
    /// @notice Emitted upon contract deployment
    event Deployed(string name, string symbol, uint256 totalAuthorized);
    
    /// @notice Emitted when transfer restrictions are enabled or disabled
    event TransfersRestrictedChanged(bool restricted);
    
    /**
     * @notice Deploys a new tokenized equity contract for a company
     * @dev Initializes the contract with company metadata and sets the deployer as owner.
     * Transfer restrictions are enabled by default, and split factor is set to 1x (1e18).
     * @param name Token name (e.g., "Acme Inc. Equity")
     * @param symbol Token symbol (e.g., "ACME")
     * @param _totalAuthorized Total authorized shares (in token units, e.g., 1_000_000 * 1e18)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 _totalAuthorized
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(_totalAuthorized > 0, "ChainEquityToken: totalAuthorized must be > 0");
        
        totalAuthorized = _totalAuthorized;
        transfersRestricted = true;
        splitFactor = 1e18; // 1x baseline
        
        emit Deployed(name, symbol, _totalAuthorized);
    }
    
    /**
     * @notice Approves a wallet for token transfers (KYC/AML compliance)
     * @dev Adds the wallet to the allowlist, enabling it to receive and send tokens.
     * Only the contract owner (issuer role) can approve wallets. This function is idempotent-safe
     * and will revert if the wallet is already approved.
     * @custom:security This function enforces compliance by requiring issuer approval before
     * any wallet can participate in transfers. The allowlist mechanism is the core compliance
     * gating system for this tokenized security.
     * @custom:roles Requires issuer role (enforced via onlyOwner modifier). Owner = issuer role.
     * @param wallet Address to approve for transfers
     */
    function approveWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "ChainEquityToken: cannot approve zero address");
        require(!allowlist[wallet], "ChainEquityToken: wallet already approved");
        
        allowlist[wallet] = true;
        emit WalletApproved(msg.sender, wallet);
    }
    
    /**
     * @notice Revokes a wallet's approval, preventing future transfers
     * @dev Removes the wallet from the allowlist. The wallet retains its current balance
     * but cannot send or receive tokens until re-approved. Only the contract owner (issuer role) can revoke.
     * @custom:roles Requires issuer role (enforced via onlyOwner modifier). Owner = issuer role.
     * @param wallet Address to revoke approval from
     */
    function revokeWallet(address wallet) external onlyOwner {
        require(allowlist[wallet], "ChainEquityToken: wallet not approved");
        
        allowlist[wallet] = false;
        emit WalletRevoked(msg.sender, wallet);
    }
    
    /**
     * @notice Checks if a wallet is approved for transfers
     * @dev Queries the allowlist mapping to determine if a wallet can participate in transfers.
     * @param wallet Address to check approval status for
     * @return bool True if the wallet is approved, false otherwise
     */
    function isApproved(address wallet) external view returns (bool) {
        return allowlist[wallet];
    }
    
    /**
     * @notice Mints new tokens to an approved wallet (share issuance)
     * @dev Creates new tokens and assigns them to a wallet that must be pre-approved.
     * The total supply cannot exceed the authorized amount set at deployment.
     * Only the contract owner (issuer role) can mint tokens.
     * @custom:roles Requires issuer role (enforced via onlyOwner modifier). Owner = issuer role.
     * @param to Address to mint tokens to (must be approved)
     * @param amount Amount of tokens to mint (in base token units with 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "ChainEquityToken: cannot mint to zero address");
        require(allowlist[to], "ChainEquityToken: recipient not approved");
        require(totalSupply() + amount <= totalAuthorized, "ChainEquityToken: exceeds authorized supply");
        
        _mint(to, amount);
        emit Issued(to, amount);
    }
    
    /**
     * @notice Internal hook that enforces allowlist restrictions on all token movements
     * @dev Overrides OpenZeppelin v5's _update hook to add compliance gating. This hook
     * is called for all token movements (mints, burns, transfers). When transfers are
     * restricted, it validates that both sender and recipient are on the allowlist for
     * transfers, or just the recipient for mints. This pattern is the recommended approach
     * in OpenZeppelin v5 for adding custom transfer logic.
     * @custom:security This is the core security mechanism enforcing compliance. The allowlist
     * check ensures only KYC-approved wallets can participate in transfers, preventing
     * unauthorized trading of tokenized securities.
     * @param from Sender address (address(0) for mints)
     * @param to Recipient address (address(0) for burns)
     * @param value Amount being transferred
     */
    function _update(address from, address to, uint256 value) internal override {
        if (transfersRestricted) {
            // For transfers (not mints or burns), check both sender and recipient
            if (from != address(0) && to != address(0)) {
                require(allowlist[from], "ChainEquityToken: sender not approved");
                require(allowlist[to], "ChainEquityToken: recipient not approved");
            }
            // For mints, only check recipient (from is address(0))
            else if (from == address(0) && to != address(0)) {
                require(allowlist[to], "ChainEquityToken: recipient not approved");
            }
            // For burns, only check sender (to is address(0))
            // Note: Current implementation doesn't allow burns, but this covers it
            else if (from != address(0) && to == address(0)) {
                require(allowlist[from], "ChainEquityToken: sender not approved");
            }
        }
        
        super._update(from, to, value);
    }
    
    /**
     * @notice Executes a stock split (e.g., 7-for-1 split)
     * @dev Updates the split factor to reflect a stock split without modifying actual balances.
     * This virtual split approach is gas-efficient for large shareholder lists. The effective
     * balance (visible via effectiveBalanceOf) is calculated by multiplying the base balance
     * by splitFactor/1e18. Only the contract owner (issuer role) can execute splits.
     * @custom:roles Requires issuer role (enforced via onlyOwner modifier). Owner = issuer role.
     * @param multiplier Split multiplier in 1e18 precision (e.g., 7e18 for 7-for-1 split, must be >= 1e18)
     */
    function executeSplit(uint256 multiplier) external onlyOwner {
        require(multiplier >= 1e18, "ChainEquityToken: split multiplier must be >= 1");
        require(multiplier != splitFactor, "ChainEquityToken: split factor unchanged");
        
        uint256 oldFactor = splitFactor;
        splitFactor = multiplier;
        
        emit SplitExecuted(oldFactor, multiplier, block.number);
    }
    
    /**
     * @notice Returns the effective balance after applying the split factor
     * @dev Calculates the effective number of shares after accounting for stock splits.
     * This is the balance that should be displayed to users and used in cap-table calculations.
     * The base balance remains unchanged (gas-efficient), while this view function applies
     * the split factor for display purposes.
     * @param account Address to query effective balance for
     * @return uint256 Effective balance (base balance * splitFactor / 1e18)
     */
    function effectiveBalanceOf(address account) external view returns (uint256) {
        return (balanceOf(account) * splitFactor) / 1e18;
    }
    
    /**
     * @notice Signals a symbol change via event (for indexer tracking)
     * @dev Emits a SymbolChanged event that indexers can track. The actual ERC20 symbol()
     * is immutable in OpenZeppelin's implementation, so this event serves as a signal for
     * off-chain systems. A full symbol change would require contract redeployment or a proxy
     * upgrade pattern. Only the contract owner (issuer role) can trigger this event.
     * @custom:roles Requires issuer role (enforced via onlyOwner modifier). Owner = issuer role.
     * @param newSymbol The new symbol to be tracked (for indexer purposes)
     */
    function changeSymbol(string memory newSymbol) external onlyOwner {
        string memory oldSymbol = symbol();
        // Note: Actual symbol update requires contract upgrade or redeployment
        // This event signals the intent and indexers can track it
        emit SymbolChanged(oldSymbol, newSymbol);
    }
    
    /**
     * @notice Enables or disables transfer restrictions globally
     * @dev When restrictions are enabled, only allowlisted wallets can transfer tokens.
     * When disabled, any wallet can transfer (standard ERC20 behavior). This toggle allows
     * the issuer to control compliance requirements over time. Only the contract owner (issuer role)
     * can modify this setting.
     * @custom:roles Requires issuer role (enforced via onlyOwner modifier). Owner = issuer role.
     * @param restricted True to enable restrictions, false to disable
     */
    function setTransfersRestricted(bool restricted) external onlyOwner {
        transfersRestricted = restricted;
        emit TransfersRestrictedChanged(restricted);
    }
}

