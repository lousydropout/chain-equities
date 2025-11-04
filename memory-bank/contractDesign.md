# Smart Contract Design

## ChainEquityToken Contract

### Overview

The `ChainEquityToken` contract implements a tokenized equity system with compliance gating. It represents company shares on-chain with transfer restrictions based on an allowlist mechanism.

### Contract Structure

```solidity
ChainEquityToken(
    string name,           // e.g., "Acme Inc. Equity"
    string symbol,         // e.g., "ACME"
    uint256 totalAuthorized // e.g., 1_000_000 * 1e18
)
```

### Key State Variables

- `issuer` - Company admin address (deployer)
- `transfersRestricted` - Boolean flag for transfer restrictions
- `splitFactor` - Multiplier for stock splits (starts at 1e18)
- `allowlist` - Mapping of approved wallet addresses
- `_balances` - Token balances per address
- `totalSupply` - Current total supply of tokens

### Core Functions

#### Wallet Management
- `approveWallet(address wallet)` - Add wallet to allowlist (issuer only)
- `revokeWallet(address wallet)` - Remove wallet from allowlist (issuer only)
- `isApproved(address wallet)` - Check if wallet is approved

#### Token Operations
- `mint(address to, uint256 amount)` - Mint tokens to approved wallet (issuer only)
- `transfer(address to, uint256 amount)` - Transfer tokens (requires both sender and recipient to be approved)
- `balanceOf(address account)` - Query balance

#### Corporate Actions
- `executeSplit(uint256 multiplier)` - Execute stock split (e.g., 7-for-1)
- `changeSymbol(string newSymbol)` - Update token symbol

### Events

- `WalletApproved(address indexed issuer, address indexed wallet)`
- `WalletRevoked(address indexed issuer, address indexed wallet)`
- `Issued(address indexed to, uint256 amount)` - Minting event
- `Transfer(address indexed from, address indexed to, uint256 value)` - Standard ERC20 transfer
- `SplitExecuted(uint256 oldFactor, uint256 newFactor, uint256 blockNumber)`
- `SymbolChanged(string oldSymbol, string newSymbol)`

### Example Flow: Acme Inc.

#### Step 1: Deploy Contract
```solidity
constructor("Acme Inc. Equity", "ACME", 1_000_000 * 1e18)
```
- Sets issuer = msg.sender
- transfersRestricted = true
- splitFactor = 1e18
- Empty allowlist

#### Step 2: Approve Shareholders
```solidity
approveWallet(alice)
approveWallet(bob)
approveWallet(carol)
```
- All three added to allowlist
- Events: `WalletApproved` for each

#### Step 3: Mint Initial Shares
```solidity
mint(alice, 500_000e18)  // 50%
mint(bob,   300_000e18)  // 30%
mint(carol, 200_000e18)  // 20%
```
- Total supply = 1,000,000
- Events: `Issued` and `Transfer` for each mint

#### Step 4: Transfer Restrictions
- Transfers only allowed between approved wallets
- Both sender and recipient must be on allowlist
- Reverts if either party is not approved

### Design Decisions

1. **Transfer Validation**: Checks both sender AND recipient (not just recipient)
2. **Split Factor**: Uses 1e18 precision to support fractional splits
3. **Event Heavy**: Emits events for all state changes to enable indexer
4. **Issuer Role**: Single admin (issuer) controls all operations
5. **Mint Restrictions**: Only approved wallets can receive tokens

### Integration Points

- **Indexer**: Listens to all events to build cap-table
- **Issuer Service**: Calls approve/mint functions
- **Operator UI**: Queries balances and allows admin operations

