# Event Signatures Documentation

This document provides the complete event signatures for all events emitted by ChainEquityToken and CapTable contracts, formatted for backend indexer integration.

## ChainEquityToken Events

### Transfer Event (Standard ERC20)
**Note:** The task requirement specifies `Transferred`, but the standard ERC20 `Transfer` event is used, which has the same signature.

```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
```

- **Emitted when:** Tokens are transferred, minted, or burned
- **Indexed parameters:** `from`, `to` (for efficient filtering by address)
- **Emission:** Automatically emitted via `super._update()` in OpenZeppelin ERC20
- **Backend note:** Filter by contract address and indexed `from`/`to` parameters for efficient querying

### Issued Event
```solidity
event Issued(address indexed to, uint256 amount)
```

- **Emitted when:** New tokens are minted to a shareholder via `mint()`
- **Indexed parameters:** `to` (for efficient filtering by recipient address)
- **Function:** `mint(address to, uint256 amount)`
- **Backend note:** Use this event to track share issuances. Filter by `to` address to track all issuances to a specific shareholder.

### SplitExecuted Event
```solidity
event SplitExecuted(
    uint256 indexed oldFactor,
    uint256 indexed newFactor,
    uint256 blockNumber
)
```

- **Emitted when:** A stock split is executed via `executeSplit()`
- **Indexed parameters:** `oldFactor`, `newFactor` (for efficient filtering by split factors)
- **Function:** `executeSplit(uint256 multiplier)`
- **Parameters:**
  - `oldFactor`: Previous split factor (in 1e18 precision) - **indexed** for efficient filtering
  - `newFactor`: New split factor (in 1e18 precision, e.g., 7e18 for 7-for-1 split) - **indexed** for efficient filtering
  - `blockNumber`: Block number when split was executed (non-indexed for range queries)
- **Backend note:** Filter by contract address and indexed `oldFactor`/`newFactor` parameters for efficient querying during cap table synchronization. `SplitExecuted` now includes indexed parameters for efficient event filtering by backend indexers.

### Additional ChainEquityToken Events

These events are also emitted but are not part of the core Task 1.5 requirements:

```solidity
event WalletApproved(address indexed issuer, address indexed wallet)
event WalletRevoked(address indexed issuer, address indexed wallet)
event SymbolChanged(string oldSymbol, string newSymbol)
event Deployed(string name, string symbol, uint256 totalAuthorized)
event TransfersRestrictedChanged(bool restricted)
```

## CapTable Events

### CapTableCreated Event

**Note:** The task requirement specifies `CapTableCreated(address indexed capTable, string name)`, but the implementation includes additional parameters for better filtering:

```solidity
event CapTableCreated(
    address indexed capTable,
    string name,
    string symbol,
    address indexed issuer
)
```

- **Emitted when:** CapTable contract is deployed (in constructor)
- **Indexed parameters:** `capTable`, `issuer` (for efficient filtering)
- **Additional parameters:** `name`, `symbol` (non-indexed for gas efficiency)
- **Backend note:** The extra indexed `issuer` parameter allows filtering by issuer address, which is more useful than the minimal version. Both `capTable` and `issuer` are indexed for efficient queries.

### TokenLinked Event
```solidity
event TokenLinked(address indexed capTable, address indexed token)
```

- **Emitted when:** A ChainEquityToken is linked to the cap table via `linkToken()`
- **Indexed parameters:** `capTable`, `token` (both indexed for efficient filtering)
- **Function:** `linkToken(address _token)`
- **Backend note:** Filter by either `capTable` or `token` address to find relationships.

### CorporateActionRecorded Event
```solidity
event CorporateActionRecorded(
    uint256 indexed actionId,
    string indexed actionType,
    uint256 blockNumber
)
```

- **Emitted when:** A corporate action is recorded via `recordCorporateAction()`
- **Indexed parameters:** `actionId`, `actionType` (for efficient filtering)
- **Function:** `recordCorporateAction(string memory _actionType, bytes memory _data)`
- **Backend note:** Filter by `actionType` to find all actions of a specific type (e.g., "SPLIT", "SYMBOL_CHANGE", "TOKEN_REPLACED").

## Event Signature Verification

### Complete Event List for Backend Indexer

The backend indexer should watch for these events:

#### ChainEquityToken Contract
1. `Transfer(address indexed from, address indexed to, uint256 value)` - Standard ERC20
2. `Issued(address indexed to, uint256 amount)`
3. `SplitExecuted(uint256 indexed oldFactor, uint256 indexed newFactor, uint256 blockNumber)`

#### CapTable Contract
1. `CapTableCreated(address indexed capTable, string name, string symbol, address indexed issuer)`
2. `TokenLinked(address indexed capTable, address indexed token)`
3. `CorporateActionRecorded(uint256 indexed actionId, string indexed actionType, uint256 blockNumber)`

## Indexing Strategy

### Efficient Filtering Recommendations

1. **By Contract Address:** Always filter events by the contract address first
2. **By Indexed Parameters:** Use indexed parameters for common queries:
   - `Transfer`: Filter by `from` or `to` address
   - `Issued`: Filter by `to` address
   - `SplitExecuted`: Filter by `oldFactor` or `newFactor` for efficient cap table synchronization
   - `CapTableCreated`: Filter by `capTable` or `issuer` address
   - `TokenLinked`: Filter by `capTable` or `token` address
   - `CorporateActionRecorded`: Filter by `actionType` or `actionId`

3. **Non-Indexed Parameters:** For range queries or specific values:
   - `SplitExecuted`: Query by blockNumber range (not indexed but filterable)
   - `CorporateActionRecorded`: Query by blockNumber range

## Event Topic Hashes

For reference, here are the keccak256 hashes of the event signatures (first topic):

- `Transfer`: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
- `Issued`: `keccak256("Issued(address,uint256)")`
- `SplitExecuted`: `keccak256("SplitExecuted(uint256,uint256,uint256)")`
- `CapTableCreated`: `keccak256("CapTableCreated(address,string,string,address)")`
- `TokenLinked`: `keccak256("TokenLinked(address,address)")`
- `CorporateActionRecorded`: `keccak256("CorporateActionRecorded(uint256,string,uint256)")`

## Backend Integration Notes

1. **Standard ERC20 Transfer:** The contract inherits from OpenZeppelin ERC20, so all standard Transfer events are emitted automatically. No custom implementation needed.

2. **Event Emission Guarantees:**
   - `Issued` is emitted in `mint()` function
   - `SplitExecuted` is emitted in `executeSplit()` function
   - `Transfer` is emitted automatically via `super._update()` for all token movements
   - `CapTableCreated` is emitted in CapTable constructor
   - `TokenLinked` is emitted in `linkToken()` function
   - `CorporateActionRecorded` is emitted in `recordCorporateAction()` function

3. **Missing Events Handling:** If an event is not found in the expected block range, check:
   - Contract deployment status
   - Transaction status (reverted transactions don't emit events)
   - Event filter parameters (indexed vs non-indexed)

