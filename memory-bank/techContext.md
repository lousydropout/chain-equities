# Technical Context

## Development Environment

- **Local Development**: Hardhat + Anvil
- **Deployment**: Use `bunx hardhat ignition deploy ignition/modules/Counter.ts --network anvil`
- **Anvil Setup**: Requires running `anvil` first, then providing private key from anvil as environment variable

## Configuration

- Solidity version: 0.8.28
- Network: Anvil (localhost:8545, chainId: 31337)
- Accounts: Configured via `ANVIL_PRIVATE_KEY` environment variable

## Key Files

- `hardhat.config.ts` - Hardhat configuration
- `contracts/` - Solidity smart contracts
- `ignition/modules/` - Deployment modules
- `scripts/` - Utility scripts
- `test/` - Test files

