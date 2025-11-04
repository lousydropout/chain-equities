# Frontend Wallet Connection Layer — ChainEquity / Keyvault

## Overview

Implements MetaMask wallet connectivity using **Wagmi v2**, **Viem**, and **React Query**.

This layer forms the bridge between the **frontend React app** and the **EVM-based contracts** in `contracts/`.

It's designed to be **self-contained, declarative, and chain-agnostic**.

---

## Core Dependencies

```json
{
  "wagmi": "latest",
  "viem": "latest",
  "@tanstack/react-query": "^5.51.18"
}
```

---

## Implementation Structure

### 1. `src/config.ts`

Defines supported networks and RPC transports.

```typescript
import { createConfig, http } from "wagmi";
import { astar, hardhat } from "wagmi/chains";

export const config = createConfig({
  chains: [hardhat, astar],
  transports: {
    [hardhat.id]: http(),
    [astar.id]: http(),
  },
  autoConnect: true,
});
```

**Notes:**
- Multi-chain ready; simply extend the `chains` array.
- `autoConnect: true` enables session persistence on refresh.
- For local development with Anvil, use `hardhat` chain (chainId: 31337) pointing to `http://127.0.0.1:8545`.

---

### 2. `src/provider.tsx`

Wraps the React app with Wagmi + React Query providers.

```typescript
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config";

const queryClient = new QueryClient();

export function Web3Provider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Notes:**
- Every component beneath `Web3Provider` can use Wagmi hooks.
- React Query handles wallet + contract query caching.

**Usage in `main.tsx`:**
```typescript
import { Web3Provider } from "./provider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </StrictMode>
);
```

---

### 3. `src/Connect.tsx`

Provides a wallet connection UI limited to MetaMask.

```typescript
import { useAccount, useConnect, useDisconnect } from "wagmi";

const allowedWallets = new Set(["io.metamask"]);

export const Connect = () => {
  const account = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div>
      {account.isConnected ? (
        <div>
          <p>Connected: {account.address}</p>
          <button onClick={() => disconnect()}>Disconnect</button>
        </div>
      ) : (
        connectors
          .filter((c) => allowedWallets.has(c.id))
          .map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
            >
              Connect with MetaMask
            </button>
          ))
      )}
    </div>
  );
};
```

**Notes:**
- Wagmi automatically detects MetaMask via `window.ethereum`.
- No custom connectors or external wallet SDKs needed.
- MetaMask connector ID: `"io.metamask"`.

---

### 4. `src/WalletConnector.tsx` (optional)

Encapsulates connector button rendering (icon + label) for reuse in design system.

```typescript
import { Connector } from "wagmi";

interface WalletConnectorProps {
  connector: Connector;
  onClick: () => void;
}

export function WalletConnector({ connector, onClick }: WalletConnectorProps) {
  return (
    <button onClick={onClick}>
      <img src={connector.icon} alt={connector.name} />
      {connector.name}
    </button>
  );
}
```

---

## How It Works

1. Wagmi detects injected wallets (e.g. MetaMask).
2. `useConnect()` exposes available connectors.
3. `Connect.tsx` filters to `"io.metamask"`.
4. `connect({ connector })` triggers MetaMask's connection flow.
5. `useAccount()` exposes connection state + address.

---

## Integration into ChainEquity

### Frontend Contract Interactions

The frontend uses this layer for all wallet sessions and contract interactions.

**Example: Contract Write Operation**

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { abi } from "@chain-equity/contracts/artifacts/contracts/ChainEquityToken.sol/ChainEquityToken.json";

export function TransferButton({ to, amount }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  return (
    <button
      disabled={isPending || isLoading}
      onClick={() =>
        writeContract({
          address: "0xYourTokenAddress",
          abi,
          functionName: "transfer",
          args: [to, amount],
        })
      }
    >
      {isPending ? "Confirming..." : isSuccess ? "Transferred!" : "Transfer"}
    </button>
  );
}
```

**Example: Contract Read Operation**

```typescript
import { useReadContract } from "wagmi";
import { abi } from "@chain-equity/contracts/artifacts/contracts/ChainEquityToken.sol/ChainEquityToken.json";

export function BalanceDisplay({ address }) {
  const { data: balance, isLoading } = useReadContract({
    address: "0xYourTokenAddress",
    abi,
    functionName: "balanceOf",
    args: [address],
  });

  if (isLoading) return <span>Loading...</span>;
  return <span>Balance: {balance?.toString()}</span>;
}
```

### Operator Dashboard Operations

For issuer/admin operations, the frontend can call:

```typescript
// Approve wallet
writeContract({
  address: tokenAddress,
  abi,
  functionName: "approveWallet",
  args: [walletAddress],
});

// Mint tokens
writeContract({
  address: tokenAddress,
  abi,
  functionName: "mint",
  args: [toAddress, amount],
});

// Execute stock split
writeContract({
  address: tokenAddress,
  abi,
  functionName: "executeSplit",
  args: [multiplier], // e.g., 7e18 for 7-for-1 split
});

// Change symbol
writeContract({
  address: tokenAddress,
  abi,
  functionName: "changeSymbol",
  args: [newSymbol],
});
```

### Backend Integration

* **Backend** does *not* manage wallets directly — instead, it can authenticate users via [Sign-In With Ethereum (SIWE)](https://login.xyz/).
* **Contracts** are invoked through `useWriteContract()` or `writeContract()` using ABIs from contract artifacts.
* Frontend sends signed transactions directly to the blockchain via wallet.
* Backend indexes events and provides enriched data via REST API.

### File Structure

```
frontend/
 ├── src/
 │   ├── config.ts          # Wagmi config
 │   ├── provider.tsx        # Web3Provider wrapper
 │   ├── Connect.tsx         # Wallet connection UI
 │   ├── WalletConnector.tsx # Connector button component (optional)
 │   ├── lib/
 │   │   └── wallet/         # Wallet-related utilities
 │   │       └── hooks.ts    # Custom hooks for contract interactions
 │   └── features/
 │       └── auth/            # Authentication components
```

---

## Best Practices

### ✅ Do

- Use `autoConnect: true` for seamless sessions across page refreshes.
- Include `useSwitchChain()` if multiple networks are supported.
- Scope wallet UI under `frontend/src/lib/wallet/` or `frontend/src/features/auth/`.
- Integrate with backend auth (SIWE) for secure "wallet-as-login."
- Use `useWaitForTransactionReceipt()` to track transaction status.
- Extract contract interaction logic into custom hooks for reusability.

### 🚫 Don't

- Avoid directly calling `window.ethereum` — Wagmi handles detection safely.
- Don't create custom connectors unless necessary — Wagmi auto-detects injected wallets.
- Don't skip React Query — it's required by Wagmi v2 for state management.
- Don't hardcode contract addresses — use environment variables or config.

---

## Chain Switching

For multi-chain support, use `useSwitchChain()`:

```typescript
import { useSwitchChain, useChainId } from "wagmi";

export function ChainSwitcher() {
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();

  return (
    <select
      value={chainId}
      onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
    >
      {chains.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
        </option>
      ))}
    </select>
  );
}
```

---

## Summary

| Feature                 | Status                         |
| ----------------------- | ------------------------------ |
| MetaMask Detection      | ✅ Built-in via Wagmi           |
| Multi-chain Support     | ✅ (Hardhat + Astar)            |
| Declarative React Hooks | ✅                              |
| State Caching           | ✅ via React Query              |
| Session Persistence     | ✅ via autoConnect              |
| Custom Wallet Logic     | ❌ Not required                 |
| Integration Points      | Contracts ↔ Backend ↔ Frontend |

---

## Key Design Principles

1. **Declarative**: Use React hooks, not imperative wallet calls
2. **Chain-Agnostic**: Easily add new chains via config
3. **Reactive**: React Query provides automatic cache invalidation
4. **Self-Contained**: Wallet logic isolated in dedicated modules
5. **AI-First**: Modular architecture aligns with AI-assisted development

---

## To Implement

1. Install dependencies: `bun add wagmi viem @tanstack/react-query`
2. Create `src/config.ts` with chain configuration
3. Create `src/provider.tsx` with WagmiProvider wrapper
4. Create `src/Connect.tsx` for wallet connection UI
5. Wrap app with `Web3Provider` in `main.tsx`
6. Use Wagmi hooks (`useAccount`, `useWriteContract`, `useReadContract`) in components
7. Import contract ABIs from `@chain-equity/contracts/artifacts/`

---

## Notes

- This setup turns the wallet into a **reactive session manager**, aligning perfectly with the **AI-first, modular architecture** of ChainEquity.
- The frontend stays declarative, the backend stays chain-agnostic, and the contracts remain the canonical source of truth.
- For local development with Anvil, ensure MetaMask is configured to connect to `localhost:8545` with chain ID `31337`.
