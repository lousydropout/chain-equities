# ChainEquity

Tokenized Security Prototype with Compliance Gating

## Background

Cap-table management, equity issuance, and secondary settlements for private companies remain painful—manual spreadsheets, slow transfer agents, and limited liquidity.

Tokenization on programmable blockchains offers a path forward: instant settlement, transparent ownership records, and automated compliance checks. But most "security token" platforms are black-box SaaS solutions that hide the core mechanics.

Your challenge: Build a working prototype showing how tokenized securities could function on-chain with compliance gating, corporate actions, and operator workflows—without making regulatory claims.

## Setup

This project requires:

- **Hardhat** (installed as a dependency)

To install dependencies:

```shell
npm install
```

## Local Development

This project uses Hardhat + Anvil for local development.

### Deployment

To deploy, run:

```shell
npm run node
npm run deploy:acme
```

## Script to run inside hardhat console

```ts
const tokenAddr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const capTableAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const Token = await ethers.getContractAt("ChainEquityToken", tokenAddr);
const CapTable = await ethers.getContractAt("CapTable", capTableAddr);
await Token.name(); // "Acme Inc. Equity"
```

### Approve two shareholders

```ts
const [owner, alice, bob, charlie] = await ethers.getSigners();

// approve alice
(await Token.isApproved(alice.address)).toString(); // false
await Token.approveWallet(alice.address);
(await Token.isApproved(alice.address)).toString(); // true

// approve bob
(await Token.isApproved(bob.address)).toString(); // false
await Token.approveWallet(bob.address);
(await Token.isApproved(bob.address)).toString(); // true
```

### Mint shares and transfer

```ts
await Token.mint(alice.address, ethers.parseEther("100"));
(await Token.balanceOf(alice.address)).toString(); // 100e18

const tokenAsAlice = Token.connect(alice);
await tokenAsAlice.transfer(bob.address, ethers.parseEther("30"));

(await Token.balanceOf(alice.address)).toString(); // 70e18
(await Token.balanceOf(bob.address)).toString(); // 30e18
```

### Record a Corporate Action

```ts
const data = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint256"],
  [ethers.parseEther("7")]
);
await CapTable.recordCorporateAction("SPLIT", data);

(await CapTable.corporateActionCount()).toString(); // "1"
await CapTable.getCorporateAction(1);
```
