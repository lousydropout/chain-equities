# Contract Exports Documentation

This document describes the export format for ChainEquity contract ABIs and deployment addresses, and how to consume them in backend and frontend applications.

## Export Structure

The export system generates the following directory structure:

```
contracts/exports/
  ├── abis/
  │   ├── CapTable.json
  │   └── ChainEquityToken.json
  └── deployments.json
```

## Running the Export Script

To export both ABIs and deployment addresses:

```bash
npm run export
```

This script:
1. Extracts ABIs from compiled artifacts (`artifacts/contracts/`)
2. Exports deployment addresses from Hardhat Ignition deployments

**Note:** The address export requires a network connection (Hardhat node or Anvil). If you only need ABIs, you can run the ABI export script directly:

```bash
npx ts-node scripts/export-abis.ts
```

## ABI Export Format

Each ABI file in `exports/abis/` contains **only the ABI array** (no metadata):

```json
[
  {
    "inputs": [...],
    "name": "functionName",
    "outputs": [...],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  ...
]
```

### Available ABIs

- **CapTable.json**: CapTable contract ABI
- **ChainEquityToken.json**: ChainEquityToken contract ABI

## Deployment Addresses Format

The `exports/deployments.json` file follows this structure:

```json
{
  "networks": {
    "31337": {
      "AcmeInc": {
        "capTable": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "token": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
      }
    }
  }
}
```

The format is: `networks[chainId][companyName]` → `{ capTable, token }`

## Backend Usage (Viem)

### Loading ABIs

```typescript
import { readFileSync } from 'fs';
import { createPublicClient, http } from 'viem';
import { localhost } from 'viem/chains';

// Load ABI
const capTableAbi = JSON.parse(
  readFileSync('contracts/exports/abis/CapTable.json', 'utf-8')
);

// Load deployment addresses
const deployments = JSON.parse(
  readFileSync('contracts/exports/deployments.json', 'utf-8')
);

const chainId = '31337';
const company = deployments.networks[chainId]?.AcmeInc;

if (!company) {
  throw new Error(`No deployment found for chain ${chainId}`);
}

// Create Viem client
const client = createPublicClient({
  chain: localhost,
  transport: http(),
});

// Read contract data
const companyName = await client.readContract({
  address: company.capTable,
  abi: capTableAbi,
  functionName: 'name',
});
```

### Watching Events

```typescript
import { watchContractEvent } from 'viem';

// Watch for corporate actions
watchContractEvent(client, {
  address: company.capTable,
  abi: capTableAbi,
  eventName: 'CorporateActionRecorded',
  onLogs: (logs) => {
    console.log('Corporate action:', logs);
  },
});
```

## Frontend Usage (Ethers.js)

### Loading ABIs

```typescript
import { ethers } from 'ethers';
import capTableAbi from '../contracts/exports/abis/CapTable.json';
import deployments from '../contracts/exports/deployments.json';

// Get deployment addresses
const chainId = '31337';
const company = deployments.networks[chainId]?.AcmeInc;

if (!company) {
  throw new Error(`No deployment found for chain ${chainId}`);
}

// Connect to provider (e.g., MetaMask)
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Create contract instance
const capTable = new ethers.Contract(
  company.capTable,
  capTableAbi,
  signer
);

// Read contract data
const companyName = await capTable.name();
```

### Writing Transactions

```typescript
// Issue shares (requires issuer role)
const tx = await capTable.recordCorporateAction(
  'TOKEN_ISSUED',
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256'],
    [recipientAddress, amount]
  )
);

await tx.wait();
```

### Listening to Events

```typescript
// Listen for corporate actions
capTable.on('CorporateActionRecorded', (actionType, data, event) => {
  console.log('Corporate action recorded:', {
    actionType,
    data,
    blockNumber: event.blockNumber,
  });
});
```

## Frontend Usage (Wagmi)

If using Wagmi for React integration:

```typescript
import { useContractRead, useContractWrite } from 'wagmi';
import capTableAbi from '../contracts/exports/abis/CapTable.json';
import deployments from '../contracts/exports/deployments.json';

const chainId = '31337';
const company = deployments.networks[chainId]?.AcmeInc;

// Read contract data
function CompanyName() {
  const { data } = useContractRead({
    address: company.capTable,
    abi: capTableAbi,
    functionName: 'name',
  });

  return <div>Company: {data}</div>;
}

// Write contract data
function RecordAction() {
  const { write } = useContractWrite({
    address: company.capTable,
    abi: capTableAbi,
    functionName: 'recordCorporateAction',
  });

  return (
    <button onClick={() => write({
      args: ['TOKEN_ISSUED', encodedData],
    })}>
      Record Action
    </button>
  );
}
```

## Error Handling

### Missing Artifacts

If ABIs are missing, ensure contracts are compiled:

```bash
npx hardhat compile
```

### Missing Deployment Addresses

If deployment addresses are missing, ensure contracts are deployed:

```bash
bun run deploy:anvil  # or deploy:acme
```

The export script will provide clear error messages if artifacts or deployments are missing.

## Integration Checklist

- [ ] Compile contracts: `npx hardhat compile`
- [ ] Export ABIs and addresses: `bun run export`
- [ ] Copy `exports/abis/` to your application
- [ ] Copy `exports/deployments.json` to your application
- [ ] Load ABIs and addresses in your application code
- [ ] Configure network/chain ID based on deployment

## Notes

- ABIs are exported as pure JSON arrays (no metadata) for easier consumption
- Deployment addresses are organized by network and company for multi-chain support
- The export script can run standalone (ABIs) or after deployment (ABIs + addresses)
- Both ABIs and addresses are version-controlled and should be committed to the repository
