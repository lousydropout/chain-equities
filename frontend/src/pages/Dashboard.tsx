/**
 * @file Company Dashboard page
 * @notice Main dashboard displaying company information, stats, and navigation
 */

import { Link } from 'react-router-dom';
import { useCompanyStats, useMyShareholder } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import type { Shareholder } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  ArrowRight,
  Users,
  Coins,
  Link2,
  HelpCircle,
  PieChart,
} from 'lucide-react';
import { formatAddress, formatTokenAmount, formatDate } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IssueSharesForm } from '@/components/IssueSharesForm';
import { TransferSharesForm } from '@/components/TransferSharesForm';
import { ProfileMenu } from '@/components/ProfileMenu';
import { useAccount } from 'wagmi';

/**
 * Company Dashboard component
 * Displays company information, statistics, and navigation to other sections
 *
 * @note This dashboard is accessible to all authenticated users (admin, issuer, investor).
 * It provides read-only company information and statistics. Role-specific dashboards
 * (admin dashboard, issuer dashboard, investor dashboard) are planned for Task 7.1.
 */
export function Dashboard() {
  const { data, isLoading, isError, error, refetch } = useCompanyStats();
  const { user } = useAuth();
  const { isConnected } = useAccount();

  // Fetch investor holdings data (only for investors)
  const {
    data: shareholderData,
    isLoading: isShareholderLoading,
    error: shareholderError,
  } = useMyShareholder();

  if (isLoading) {
    return <Skeletons />;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Couldn't load dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              {error?.message || 'Please check your connection or try again.'}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    name,
    symbol,
    issuer,
    createdAt,
    tokenLinked,
    tokenAddress,
    totalAuthorized,
    totalOutstanding,
    totalShareholders,
    decimals = 18,
  } = data || {};

  // Determine dashboard title based on user role
  const getDashboardTitle = () => {
    if (user?.role === 'admin') return 'Admin Dashboard';
    if (user?.role === 'investor') return 'Investor Dashboard';
    if (user?.role === 'issuer') return 'Issuer Dashboard';
    return 'Dashboard';
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      {/* Top Bar with Title and Profile Menu */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{getDashboardTitle()}</h1>
        <ProfileMenu />
      </div>

      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-2xl">
              {name ?? 'Company'}{' '}
              <span className="text-muted-foreground">({symbol ?? '—'})</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Founded on {formatDate(createdAt)} • Issuer{' '}
              {formatAddress(issuer)}
            </p>
            {user && (
              <p className="text-xs text-muted-foreground mt-1">
                Logged in as {user.email} ({user.role})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={tokenLinked ? 'default' : 'secondary'}
              className="uppercase"
            >
              {tokenLinked ? 'Token linked' : 'Token not linked'}
            </Badge>
            {tokenLinked && tokenAddress && (
              <CopyAddress address={tokenAddress} />
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Investor Holdings Card - only show for investors, appears first */}
        {user?.role === 'investor' && (
          <InvestorHoldingsCard
            shareholderData={shareholderData}
            isLoading={isShareholderLoading}
            error={shareholderError}
            decimals={decimals}
          />
        )}
        <StatCard
          title="Total Outstanding"
          description="Total shares currently issued and held by shareholders"
          value={
            totalOutstanding
              ? formatTokenAmount(totalOutstanding, decimals)
              : '—'
          }
          icon={<Coins className="h-5 w-5" aria-hidden />}
          testId="stat-total-outstanding"
        />
        <StatCard
          title="Total Shareholders"
          description="Number of unique addresses holding company shares"
          value={totalShareholders ?? '—'}
          icon={<Users className="h-5 w-5" aria-hidden />}
          testId="stat-total-shareholders"
        />
        <StatCard
          title="Authorized"
          description="Maximum number of shares that can be issued (set at token creation)"
          value={
            totalAuthorized ? formatTokenAmount(totalAuthorized, decimals) : '—'
          }
          icon={<Link2 className="h-5 w-5" aria-hidden />}
          testId="stat-total-authorized"
        />
      </div>

      {/* Issuer Actions Section */}
      {(user?.role === 'issuer' || user?.role === 'admin') && tokenAddress && (
        <Card>
          <CardHeader>
            <CardTitle>Issuer Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <IssueSharesForm tokenAddress={tokenAddress} />
          </CardContent>
        </Card>
      )}

      {/* Shareholder Actions Section */}
      {tokenAddress && isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Shareholder Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <TransferSharesForm
              tokenAddress={tokenAddress}
              decimals={decimals}
            />
          </CardContent>
        </Card>
      )}

      {/* Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NavCard
          to="/cap-table"
          title="Cap Table"
          description="Holders & allocations"
        />
        <NavCard
          to="/transactions"
          title="Transactions"
          description="Transfers & mints"
        />
        {(user?.role === 'issuer' || user?.role === 'admin') && (
          <NavCard
            to="/approvals"
            title="Wallet Approvals"
            description="Approve investor wallets"
          />
        )}
        <NavCard
          to="/api-test"
          title="API Test"
          description="Debug endpoints"
        />
      </div>
    </div>
  );
}

/**
 * Investor Holdings Card component
 * Displays effective shares and ownership percentage for investors
 */
function InvestorHoldingsCard({
  shareholderData,
  isLoading,
  error,
  decimals,
}: {
  shareholderData?: Shareholder | null;
  isLoading: boolean;
  error: unknown;
  decimals: number;
}) {
  // Determine what to display
  const getDisplayValue = () => {
    if (isLoading) return 'Loading...';
    if (error) {
      // Check if it's a 404 (wallet not linked)
      const is404 =
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 404;
      return is404 ? 'Wallet not linked' : '—';
    }
    if (!shareholderData?.effectiveBalance) return '—';
    return formatTokenAmount(shareholderData.effectiveBalance, decimals);
  };

  const getOwnershipPercentage = () => {
    if (isLoading || error || !shareholderData?.ownershipPercentage)
      return null;
    return shareholderData.ownershipPercentage;
  };

  const ownershipPercentage = getOwnershipPercentage();
  const displayValue = getDisplayValue();

  return (
    <Card data-testid="stat-investor-holdings">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Your Holdings</p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Your effective shares and ownership percentage of the company
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <PieChart className="h-5 w-5" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{displayValue}</div>
        {ownershipPercentage !== null && ownershipPercentage !== undefined && (
          <p className="text-sm text-muted-foreground mt-1">
            {ownershipPercentage.toFixed(2)}% ownership
          </p>
        )}
        {!isLoading && !error && !shareholderData && (
          <p className="text-xs text-muted-foreground mt-2">
            Link your wallet to see holdings
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Stat Card component for displaying statistics
 */
function StatCard({
  title,
  description,
  value,
  icon,
  testId,
}: {
  title: string;
  description?: string;
  value: string | number;
  icon: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value ?? '—'}</div>
        {/* {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )} */}
      </CardContent>
    </Card>
  );
}

/**
 * Navigation Card component with accessible Link
 */
function NavCard({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded-lg"
      aria-label={`Navigate to ${title}`}
    >
      <Card className="h-full transition hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {title} <ArrowRight className="h-4 w-4" aria-hidden />
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {description}
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Copy Address button component
 */
function CopyAddress({ address }: { address: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleCopy}
      aria-label="Copy token address"
    >
      {formatAddress(address)} <Copy className="ml-2 h-4 w-4" aria-hidden />
    </Button>
  );
}

/**
 * Loading Skeletons component
 */
function Skeletons() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6 animate-pulse">
      <div className="h-24 bg-muted rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
