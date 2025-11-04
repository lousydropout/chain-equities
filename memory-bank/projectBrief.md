# Project Brief

## ChainEquity

Tokenized Security Prototype with Compliance Gating

## Background

Cap-table management, equity issuance, and secondary settlements for private companies remain painful—manual spreadsheets, slow transfer agents, and limited liquidity.

Tokenization on programmable blockchains offers a path forward: instant settlement, transparent ownership records, and automated compliance checks. But most "security token" platforms are black-box SaaS solutions that hide the core mechanics.

## Challenge

Build a working prototype showing how tokenized securities could function on-chain with:
- Compliance gating (allowlist-based transfer restrictions)
- Corporate actions (stock splits, symbol changes)
- Operator workflows (wallet approval, minting, cap-table management)

**Constraints:**
- No regulatory claims - this is a technical prototype only
- Must implement core mechanics yourself (no turnkey security token platforms)
- Use testnets/devnets only, never real funds

## Tech Stack

- **Hardhat** - Development environment and testing framework
- **Anvil** (Foundry) - Local blockchain node
- **Solidity** - Smart contract language
- **TypeScript** - Scripting and tests
- **Bun** - Package manager and runtime

## Key Deliverables

1. Gated token contract (allowlist-based transfer restrictions)
2. Issuer service for wallet approval and token minting
3. Event indexer producing cap-table snapshots
4. Corporate action system (7-for-1 split, symbol change)
5. Operator UI or CLI for demonstrations
6. Test suite and gas benchmarks
7. Technical writeup with decision rationale

## Core Principles

- **Transparency**: All transfers are auditable on-chain
- **Automation**: Compliance checks happen programmatically
- **Efficiency**: Settlement is instant vs. T+2 traditional
- **Accuracy**: Cap-table is always correct and queryable

See `requirements.md` for detailed specifications.

