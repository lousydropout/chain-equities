// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainEquityToken
 * @dev Tokenized equity contract with compliance gating via allowlist
 * 
 * This contract implements a tokenized security with:
 * - Transfer restrictions based on allowlist
 * - Corporate actions (stock splits, symbol changes)
 * - Issuer-controlled minting and approvals
 */
contract ChainEquityToken is ERC20, Ownable {
    // State variables
    bool public transfersRestricted;
    uint256 public splitFactor; // Uses 1e18 precision (1e18 = 1x, 7e18 = 7x)
    uint256 public totalAuthorized;
    
    // Allowlist mapping
    mapping(address => bool) public allowlist;
    
    // Events
    event WalletApproved(address indexed issuer, address indexed wallet);
    event WalletRevoked(address indexed issuer, address indexed wallet);
    event Issued(address indexed to, uint256 amount);
    event SplitExecuted(uint256 oldFactor, uint256 newFactor, uint256 blockNumber);
    event SymbolChanged(string oldSymbol, string newSymbol);
    event Deployed(string name, string symbol, uint256 totalAuthorized);
    event TransfersRestrictedChanged(bool restricted);
    
    /**
     * @dev Constructor
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
     * @dev Approve a wallet for transfers (KYC approval)
     * @param wallet Address to approve
     */
    function approveWallet(address wallet) external onlyOwner {
        require(wallet != address(0), "ChainEquityToken: cannot approve zero address");
        require(!allowlist[wallet], "ChainEquityToken: wallet already approved");
        
        allowlist[wallet] = true;
        emit WalletApproved(msg.sender, wallet);
    }
    
    /**
     * @dev Revoke approval for a wallet
     * @param wallet Address to revoke
     */
    function revokeWallet(address wallet) external onlyOwner {
        require(allowlist[wallet], "ChainEquityToken: wallet not approved");
        
        allowlist[wallet] = false;
        emit WalletRevoked(msg.sender, wallet);
    }
    
    /**
     * @dev Check if a wallet is approved
     * @param wallet Address to check
     * @return bool True if approved
     */
    function isApproved(address wallet) external view returns (bool) {
        return allowlist[wallet];
    }
    
    /**
     * @dev Mint tokens to an approved wallet
     * @param to Address to mint to
     * @param amount Amount to mint (in base token units)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "ChainEquityToken: cannot mint to zero address");
        require(allowlist[to], "ChainEquityToken: recipient not approved");
        require(totalSupply() + amount <= totalAuthorized, "ChainEquityToken: exceeds authorized supply");
        
        _mint(to, amount);
        emit Issued(to, amount);
    }
    
    /**
     * @dev Override _update hook to enforce allowlist restrictions
     * 
     * This hook is called for all token movements (mint, burn, transfer).
     * Using this pattern is the recommended approach in OpenZeppelin v5.
     * 
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
     * @dev Execute a stock split (e.g., 7-for-1)
     * @param multiplier Split multiplier (e.g., 7e18 for 7-for-1 split)
     * 
     * Note: This implementation uses Option C (virtual split) - balances remain unchanged
     * but splitFactor is updated. The indexer will multiply balances by splitFactor/1e18
     * when displaying cap-table. This is gas-efficient for large holder lists.
     */
    function executeSplit(uint256 multiplier) external onlyOwner {
        require(multiplier >= 1e18, "ChainEquityToken: split multiplier must be >= 1");
        require(multiplier != splitFactor, "ChainEquityToken: split factor unchanged");
        
        uint256 oldFactor = splitFactor;
        splitFactor = multiplier;
        
        emit SplitExecuted(oldFactor, multiplier, block.number);
    }
    
    /**
     * @dev Get effective balance after split factor
     * @param account Address to query
     * @return uint256 Effective balance (balance * splitFactor / 1e18)
     */
    function effectiveBalanceOf(address account) external view returns (uint256) {
        return (balanceOf(account) * splitFactor) / 1e18;
    }
    
    /**
     * @dev Change token symbol
     * 
     * Note: ERC20 symbol() is immutable in OpenZeppelin's implementation.
     * This emits an event that indexers can track. For full symbol change,
     * would need to deploy new contract or use proxy pattern.
     */
    function changeSymbol(string memory newSymbol) external onlyOwner {
        string memory oldSymbol = symbol();
        // Note: Actual symbol update requires contract upgrade or redeployment
        // This event signals the intent and indexers can track it
        emit SymbolChanged(oldSymbol, newSymbol);
    }
    
    /**
     * @dev Enable/disable transfer restrictions
     * @param restricted New restriction state
     */
    function setTransfersRestricted(bool restricted) external onlyOwner {
        transfersRestricted = restricted;
        emit TransfersRestrictedChanged(restricted);
    }
}

