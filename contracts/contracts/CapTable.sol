// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CapTable
 * @notice Company-level registry contract that tracks metadata, links to ChainEquityToken instances,
 * and maintains a history of corporate actions for cap-table management.
 * 
 * @dev This contract serves as a company registry that links to a ChainEquityToken contract and
 * records corporate actions (splits, symbol changes, etc.). It uses OpenZeppelin's Ownable pattern
 * for access control, where the issuer (owner) is the only address that can link tokens and record
 * corporate actions. The contract is designed to be used by the Orchestrator contract (Task 1.3)
 * for managing multiple companies on a single platform.
 * 
 * @custom:interaction The Orchestrator contract will deploy CapTable instances and link them to
 * ChainEquityToken instances when creating new companies. The issuer should call recordCorporateAction()
 * after executing corporate actions on the linked token contract.
 */
contract CapTable is Ownable {
    // State variables
    string public name;
    string public symbol;
    address public token;
    uint256 public createdAt;
    uint256 public nextActionId;
    uint256 public corporateActionCount;
    
    // Mapping for efficient lookup by ID (preferred over array for gas efficiency)
    mapping(uint256 => CorporateAction) public corporateActionById;
    
    /**
     * @notice Struct representing a corporate action record
     * @dev Stores action metadata including type, block information, and encoded data.
     * The data field is flexible (bytes) to support different action types without requiring
     * a new struct for each action variant.
     */
    struct CorporateAction {
        uint256 id;              // Incremental action ID
        string actionType;       // "SPLIT", "SYMBOL_CHANGE", etc.
        uint256 blockNumber;     // Block when action was recorded
        uint256 timestamp;       // Timestamp when action was recorded
        bytes data;              // Encoded action-specific data
    }
    
    // Events
    /// @notice Emitted when a cap table is created
    event CapTableCreated(
        address indexed capTable,
        string name,
        string symbol,
        address indexed issuer
    );
    
    /// @notice Emitted when a ChainEquityToken is linked to this cap table
    event TokenLinked(
        address indexed capTable,
        address indexed token
    );
    
    /// @notice Emitted when a corporate action is recorded
    event CorporateActionRecorded(
        uint256 indexed actionId,
        string indexed actionType,
        uint256 blockNumber
    );
    
    /**
     * @notice Deploys a new cap table contract for a company
     * @dev Initializes the contract with company metadata and sets the deployer as owner.
     * The nextActionId starts at 1, and the token address is initially unset (address(0)).
     * 
     * @param _name Company name (e.g., "Acme Inc.")
     * @param _symbol Company symbol/ticker (e.g., "ACME")
     */
    constructor(
        string memory _name,
        string memory _symbol
    ) Ownable(msg.sender) {
        require(bytes(_name).length > 0, "CapTable: name cannot be empty");
        require(bytes(_symbol).length > 0, "CapTable: symbol cannot be empty");
        
        name = _name;
        symbol = _symbol;
        createdAt = block.timestamp;
        nextActionId = 1;
        corporateActionCount = 0;
        
        emit CapTableCreated(address(this), _name, _symbol, msg.sender);
    }
    
    /**
     * @notice Links a ChainEquityToken contract to this cap table
     * @dev Sets the token address and emits an event. This creates a one-way link from
     * CapTable to Token. The token address can only be set once to prevent accidental changes.
     * Only the contract owner (issuer) can call this function.
     * 
     * @custom:security Only the issuer (owner) can link tokens. The token address must be
     * non-zero and cannot be changed after initial linking to prevent unauthorized modifications.
     * 
     * @param _token Address of the ChainEquityToken contract to link
     */
    function linkToken(address _token) external onlyOwner {
        require(_token != address(0), "CapTable: token address cannot be zero");
        require(token == address(0), "CapTable: token already linked");
        
        token = _token;
        emit TokenLinked(address(this), _token);
    }
    
    /**
     * @notice Records a corporate action in the cap table history
     * @dev Creates a new CorporateAction record with an incremental ID and stores it in
     * the mapping. The action ID is assigned before incrementing nextActionId to ensure
     * consistent indexing. Only the contract owner (issuer) can record actions.
     * 
     * @custom:security Only the issuer (owner) can record corporate actions. This ensures
     * that only authorized corporate actions are tracked in the cap table history.
     * 
     * @custom:interaction The issuer should call this function after executing corporate
     * actions on the linked ChainEquityToken contract (e.g., after calling executeSplit()
     * or changeSymbol()). The data parameter should contain encoded action-specific
     * information for off-chain indexing and analysis.
     * 
     * @param _actionType Type of corporate action (e.g., "SPLIT", "SYMBOL_CHANGE")
     * @param _data Encoded action-specific data (e.g., split multiplier, new symbol)
     */
    function recordCorporateAction(
        string memory _actionType,
        bytes memory _data
    ) external onlyOwner {
        require(bytes(_actionType).length > 0, "CapTable: action type cannot be empty");
        require(token != address(0), "CapTable: token must be linked before recording actions");
        
        uint256 actionId = nextActionId;
        nextActionId++;
        
        CorporateAction memory action = CorporateAction({
            id: actionId,
            actionType: _actionType,
            blockNumber: block.number,
            timestamp: block.timestamp,
            data: _data
        });
        
        corporateActionById[actionId] = action;
        corporateActionCount++;
        
        emit CorporateActionRecorded(actionId, _actionType, block.number);
    }
    
    /**
     * @notice Returns a specific corporate action by ID
     * @dev Queries the corporateActionById mapping to retrieve action details.
     * 
     * @param id The action ID to query
     * @return CorporateAction struct containing action details
     */
    function getCorporateAction(uint256 id) external view returns (CorporateAction memory) {
        require(id > 0 && id < nextActionId, "CapTable: invalid action ID");
        return corporateActionById[id];
    }
    
    /**
     * @notice Returns the total number of corporate actions recorded
     * @dev Returns the corporateActionCount state variable for efficient querying.
     * 
     * @return uint256 Total number of corporate actions
     */
    function getCorporateActionCount() external view returns (uint256) {
        return corporateActionCount;
    }
    
    /**
     * @notice Checks if a token is linked to this cap table
     * @dev Returns true if the token address is not zero, false otherwise.
     * 
     * @return bool True if token is linked, false otherwise
     */
    function isTokenLinked() external view returns (bool) {
        return token != address(0);
    }
    
    /**
     * @notice Returns all company metadata in a single call
     * @dev Returns a tuple containing all key company information for efficient frontend/backend queries.
     * 
     * @return Company name
     * @return Company symbol
     * @return Issuer address (owner)
     * @return Linked token address
     * @return Creation timestamp
     */
    function getCompanyInfo() external view returns (
        string memory,
        string memory,
        address,
        address,
        uint256
    ) {
        return (name, symbol, owner(), token, createdAt);
    }
}

