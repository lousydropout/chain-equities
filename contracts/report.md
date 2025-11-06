# ChainEquity Technical Report

## Overview

**ChainEquity** is a prototype for an on-chain cap table system. It models company equity as an ERC-20-compatible token with transfer restrictions, issuer-controlled minting, and corporate actions such as stock splits and symbol change events.

The system demonstrates that equity ownership can be made transparent, auditable, and tamper-proof, while gas costs remain low enough for real-world use.

---

## Chain Selection

### Current Stance: Chain-Agnostic

The system is deployable to any **EVM-compatible chain**.
Local development uses Anvil (Foundry) or Hardhat networks for deterministic testing.

For production, **Ethereum mainnet** is the most likely target. Cap tables generate relatively few transactions, so Ethereum’s higher gas cost is acceptable in exchange for security and longevity.

At current rates (see [EVM Gas Tracker](https://evmgastracker.com/) — Ethereum: `1M gas ≈ 0.00025 ETH ≈ $1.12 USD`, Nov. 6th, 2025 3:54pm CT), a complete issuer workflow costs well under a dollar.

### Gas Benchmark

| Operation                   | Gas Used  | Approx. USD |
| --------------------------- | --------- | ----------- |
| **Deployment**              |           |             |
| ChainEquityToken deployment | 1,247,903 | ~$1.40      |
| CapTable deployment         | 1,061,836 | ~$1.19      |
| **Token Operations**        |           |             |
| Approve wallet              | 47,944    | $0.05       |
| Revoke wallet               | 25,955    | $0.03       |
| Mint shares                 | 77,212    | $0.09       |
| Transfer (restricted)       | 58,279    | $0.07       |
| Transfer (unrestricted)     | 53,756    | $0.06       |
| Execute split               | 30,702    | $0.03       |
| Change symbol               | 30,028    | $0.03       |
| Set transfers restricted    | 27,816    | $0.03       |
| **Cap Table Ops**           |           |             |
| Link token                  | 47,770    | $0.05       |
| Record corporate action     | 190,538   | $0.21       |
| Record action (large data)  | 1,332,439 | $1.47       |

A full workflow (link token → approve wallets → mint → transfer → split → record action) costs roughly **500k gas** (~$0.55 USD on mainnet).

---

## Corporate Actions

### Virtual Split Mechanism

Stock splits are handled via a **virtual multiplier** (`splitFactor`) instead of rebasing balances.
Balances remain constant; effective amounts scale by `balance * splitFactor / 1e18`.
Gas: ~30k per split, O(1) with shareholder count.
Frontend must use `effectiveBalanceOf()` to display accurate post-split balances.

### Symbol/Ticker Changes

ChainEquity **does not make the token symbol mutable**. Instead, a `SymbolChanged(old, new)` event is emitted purely for record-keeping.
This is intentional: DEXs and DeFi tooling generally assume ERC-20 symbols are immutable and may behave unpredictably if changed.

Because the token represents equity (shares), it is plausible that a company might later wish to list the token on a DEX as part of an ICO or liquidity event. Maintaining strict ERC-20 compatibility was therefore prioritized over cosmetic mutability.

### Corporate Action Recording

Corporate actions are recorded in the `CapTable` contract via `recordCorporateAction()`, which emits a `CorporateActionRecorded` event containing a unique ID, type, and encoded data payload.
Actions can be queried by ID for audit or compliance purposes.

---

## Core Architectural Decisions

### 1. Selective On-Chain Design

ChainEquity deliberately avoids the “everything on-chain” approach.
While the token contract and corporate actions form the **authoritative source of truth**, higher-level organization—such as managing multiple companies, user identities, and permissions—is handled **off-chain**.

This mirrors how systems like Carta operate: the blockchain handles the canonical equity record, while the organizational and identity layers remain in standard databases for flexibility and compliance.

### 2. Single-Company Model

The prototype models one company (Acme Inc.) with hard-coded contract addresses.
Scaling to multiple organizations would be managed off-chain, with each company’s cap table deployed to its own contract pair.

Future expansion could involve:

- assigning a dedicated admin per company, or
- using **account abstraction** to transfer admin authority without redeployment.

This design space is acknowledged but not yet implemented.

### 3. Off-Chain User and Wallet Linking

We assume all relevant users (admins and investors) are **pre-whitelisted** and able to:

1. Create accounts in the web app, and
2. Link their wallets to those accounts for on-chain operations.

This account-to-wallet linkage is off-chain and was not implemented in the prototype, though it underlies the access model used.

### 4. Simplified KYC Process

In production, wallet approval would follow full **KYC/AML** verification.
For the prototype, this step is replaced with an admin manually clicking “approve wallet.”
The intermediate compliance flow has been omitted pending proper design with legal and regulatory experts.

### 5. Role-Based Views

The admin/issuer interface differs from the investor interface:

- Admins can approve wallets, mint shares, and trigger corporate actions.
- Investors can view holdings and attempt transfers (subject to allowlist rules).

Role logic is enforced off-chain within the application.

### 6. Shareholder vs Investor Assumption

All shareholders are treated as investors in the current model.
This is a simplification; in reality, founders, advisors, and employees might hold distinct equity classes.
This assumption is stated explicitly for clarity and may be revisited later.

### 7. Allowlist-Based Transfer Gating

Both sender and recipient must be approved to transfer tokens.
This ensures regulatory compliance and prevents unauthorized holdings.
The enforcement logic lives in OpenZeppelin v5’s `_update()` hook.
Events `WalletApproved` and `WalletRevoked` provide on-chain auditability.

### 8. Event-Driven Indexing

The backend subscribes to contract events using a **Viem WebSocket client**.
Indexed data are persisted in **SQLite** for query performance and recovery.

This indexer assumes access to a functioning **RPC node**—either self-hosted or via a provider like **Alchemy**, **Infura**, or **QuickNode**.
RPC reliability is essential, as event streams are the backbone of the system’s data pipeline.

---

## Limitations and Risks

| Category      | Limitation                      | Mitigation                                            |
| ------------- | ------------------------------- | ----------------------------------------------------- |
| Architecture  | Single-company model            | Manage multi-org structure off-chain                  |
| Symbol        | Immutable by design             | Use events for display; maintain ERC-20 compatibility |
| Display logic | Requires `effectiveBalanceOf()` | Provide helper SDK for integrations                   |
| Ownership     | Single admin key risk           | Multi-sig or hardware wallet                          |
| Compliance    | KYC/AML skipped                 | Integrate licensed provider                           |
| Indexing      | RPC dependency                  | WebSocket/HTTP fallback; provider redundancy          |

---

## Security & Compliance

ChainEquity is a **technical proof of concept**, not a registered transfer agent system.
Production use requires:

- Contract audits and multi-sig administration
- KYC/AML integration
- Legal review for securities compliance
- Redundant RPC access and event rescan logic

---

## Conclusion

ChainEquity shows that an on-chain cap table can be transparent, auditable, and cost-efficient:

- Full administrative workflow costs **< $1 USD** on Ethereum
- Virtual splits scale to any shareholder count
- Indexing and auditability are real-time via WebSocket subscriptions

Architecturally, ChainEquity embraces a **hybrid design**: core ownership logic lives on-chain, while organizational and identity management stay off-chain.
This hybrid model aligns with how a true Carta-like platform would need to operate—balancing blockchain guarantees with the flexibility of conventional systems.
