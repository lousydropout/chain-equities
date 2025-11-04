# ChainEquity

Tokenized Security Prototype with Compliance Gating

## Background

Cap-table management, equity issuance, and secondary settlements for private companies remain painful—manual spreadsheets, slow transfer agents, and limited liquidity.

Tokenization on programmable blockchains offers a path forward: instant settlement, transparent ownership records, and automated compliance checks. But most "security token" platforms are black-box SaaS solutions that hide the core mechanics.

Your challenge: Build a working prototype showing how tokenized securities could function on-chain with compliance gating, corporate actions, and operator workflows—without making regulatory claims.

## Setup

This project requires:

- **Hardhat** (installed as a dependency)
- **Anvil** (installed via [Foundry](https://book.getfoundry.sh/getting-started/installation))

To install dependencies:

```shell
bun install
```

## Local Development

This project uses Hardhat + Anvil for local development.

### Deployment

To deploy, run `anvil` first, then:

```shell
bunx hardhat ignition deploy ignition/modules/Counter.ts --network anvil
```

Note: This expects you to provide a private key from anvil as an environment variable (see `.env.template`).
