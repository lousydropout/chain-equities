/**
 * @file Instructions page for localnet setup
 * @notice Provides step-by-step instructions for setting up Anvil, deploying contracts, and configuring the backend
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Terminal, Server, Database } from 'lucide-react';

/**
 * Instructions page component
 * Provides comprehensive setup instructions for localnet development
 */
export function Instructions() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Localnet Setup Instructions</h1>
          <p className="text-muted-foreground">
            Follow these steps to set up ChainEquity for local development
          </p>
        </div>

        {/* Important Notice */}
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Important Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <strong>This site is only meant to be used with localnet.</strong> You must run
              Anvil (a local Ethereum node) and deploy the contracts locally for the site to work
              properly.
            </p>
            <p className="text-sm text-muted-foreground">
              The application is configured to connect to Anvil running on{' '}
              <code className="px-1.5 py-0.5 bg-background rounded text-xs">
                localhost:8545
              </code>{' '}
              with chain ID <code className="px-1.5 py-0.5 bg-background rounded text-xs">31337</code>
              .
            </p>
          </CardContent>
        </Card>

        {/* Prerequisites */}
        <Card>
          <CardHeader>
            <CardTitle>Prerequisites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Bun installed (for running scripts and backend)</li>
              <li>Node.js and npm (for Hardhat and contract deployment)</li>
              <li>Terminal access</li>
            </ul>
          </CardContent>
        </Card>

        {/* Step 1: Installing Anvil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Step 1: Install Anvil (Foundry)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anvil is part of Foundry, a toolkit for Ethereum application development. Install
              Foundry to get Anvil.
            </p>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Option A: Install via Foundryup (Recommended)</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">$</span> curl -L
                    https://foundry.paradigm.xyz | bash
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> foundryup
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Option B: Install via Package Manager</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground"># macOS (Homebrew)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> brew install foundry
                  </div>
                  <div className="mt-2">
                    <span className="text-muted-foreground"># Linux (apt)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> sudo apt install foundry
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Verify Installation</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div>
                  <span className="text-muted-foreground">$</span> anvil --version
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You should see the Anvil version number if installation was successful.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Starting Anvil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Step 2: Start Anvil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Start Anvil in a terminal window. Keep this terminal running while you use the
              application.
            </p>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Basic Command</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div>
                  <span className="text-muted-foreground">$</span> anvil
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">With State Persistence (Recommended)</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div>
                  <span className="text-muted-foreground">$</span> anvil --state ./anvil_state.json
                  --chain-id 31337
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This saves the blockchain state between restarts. You can also use the npm script
                from the contracts directory:
              </p>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div>
                  <span className="text-muted-foreground">$</span> cd contracts
                </div>
                <div>
                  <span className="text-muted-foreground">$</span> bun run local:node
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-900 dark:text-blue-100">
                <strong>Important:</strong> Anvil should be running on{' '}
                <code className="px-1 py-0.5 bg-background rounded">localhost:8545</code> with
                chain ID <code className="px-1 py-0.5 bg-background rounded">31337</code>. Keep
                this terminal window open.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Deploying Contracts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Step 3: Deploy Contracts to Localnet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deploy the ChainEquity contracts to your local Anvil network. Make sure Anvil is
              running before proceeding.
            </p>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Using npm Scripts (Recommended)</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">$</span> cd contracts
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> bun run deploy:acme
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    # or use deploy:anvil for explicit anvil network
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> bun run deploy:anvil
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                These scripts automatically deploy contracts, export addresses, and verify the
                deployment.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Manual Deployment</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">$</span> cd contracts
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> bunx hardhat ignition deploy
                    ignition/modules/AcmeCompany.ts --network anvil
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> bunx hardhat run
                    scripts/export-addresses.ts --network anvil
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> bunx hardhat run
                    scripts/verify-deployment.ts --network anvil
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-900 dark:text-green-100">
                After successful deployment, contract addresses are exported to{' '}
                <code className="px-1 py-0.5 bg-background rounded">
                  contracts/exports/deployments.json
                </code>
                . The backend will use these addresses to connect to your contracts.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Backend Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Step 4: Configure and Start Backend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure the backend to connect to your local Anvil network and start the server.
            </p>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">1. Configure Environment Variables</h4>
              <p className="text-xs text-muted-foreground">
                Navigate to the backend directory and create or update your <code>.env</code> file:
              </p>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">$</span> cd backend
                  </div>
                  <div>
                    <span className="text-muted-foreground">$</span> cp .env.example .env
                    <span className="text-xs text-muted-foreground ml-2"># if .env doesn't exist</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Set the following environment variables in your <code>.env</code> file:
              </p>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div className="space-y-1">
                  <div>
                    <span className="text-green-600 dark:text-green-400">CHAIN_ID</span>=31337
                  </div>
                  <div>
                    <span className="text-green-600 dark:text-green-400">RPC_URL</span>=http://127.0.0.1:8545
                  </div>
                  <div>
                    <span className="text-green-600 dark:text-green-400">WS_RPC_URL</span>=ws://127.0.0.1:8545
                    <span className="text-xs text-muted-foreground ml-2"># optional</span>
                  </div>
                  <div>
                    <span className="text-green-600 dark:text-green-400">PORT</span>=4000
                    <span className="text-xs text-muted-foreground ml-2"># optional, default is 4000</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">2. Reset Database (After Fresh Deployment)</h4>
              <p className="text-xs text-muted-foreground">
                If you've just deployed fresh contracts, reset the database to clear stale data:
              </p>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div>
                  <span className="text-muted-foreground">$</span> bun run db:reset --yes
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This clears all data and re-runs migrations. The indexer will populate the database
                as it processes events from the blockchain.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">3. Start Backend Server</h4>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <div>
                  <span className="text-muted-foreground">$</span> bun run dev
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The backend will connect to Anvil and start indexing events. It should be running
                on <code className="px-1 py-0.5 bg-background rounded">http://localhost:4000</code>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 5: Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Step 5: Verify Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verify that everything is set up correctly:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  1
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">Check Anvil is Running</p>
                  <p className="text-xs text-muted-foreground">
                    Verify Anvil is running on <code>localhost:8545</code>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  2
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">Verify Contracts Deployed</p>
                  <p className="text-xs text-muted-foreground">
                    Check that <code>contracts/exports/deployments.json</code> exists and contains
                    addresses for chain ID 31337
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  3
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">Check Backend Health</p>
                  <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto mt-1">
                    <div>
                      <span className="text-muted-foreground">$</span> curl
                      http://localhost:4000/ping
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Should return: <code>{`{"status":"ok"}`}</code>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm mb-1">Backend can't connect to Anvil</h4>
              <p className="text-xs text-muted-foreground">
                Make sure Anvil is running and check that <code>RPC_URL</code> in your backend{' '}
                <code>.env</code> is set to <code>http://127.0.0.1:8545</code>
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-1">Contracts not found</h4>
              <p className="text-xs text-muted-foreground">
                Ensure you've deployed contracts and that{' '}
                <code>contracts/exports/deployments.json</code> exists. The backend loads contract
                addresses from this file.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-1">Database errors</h4>
              <p className="text-xs text-muted-foreground">
                If you see database errors after deploying fresh contracts, run{' '}
                <code>bun run db:reset --yes</code> in the backend directory to reset the
                database.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-center gap-4 pt-4">
          <Button asChild variant="outline">
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

