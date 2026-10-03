'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useData } from '@/context/data-context';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Crown,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ShieldAlert,
  Zap,
  Sparkles,
  ArrowRight,
  Download,
  History,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Bot,
  RefreshCw,
  Layers,
  BarChart3,
  Calendar,
  CreditCard,
  Users,
  UserPlus,
  ShieldCheck,
  Mail,
  Search,
  Boxes,
  PackageX,
  Coins,
  Clock,
  Trash2,
  Key,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  comparePeriods,
  calculateProfitBridge,
  generateRiskAndOpportunityMatrix,
  generateExecutiveScorecard,
  createReportSnapshot,
  getStoredReportSnapshots,
  deleteStoredReportSnapshot,
  clearAllStoredReportSnapshots,
  ReportSnapshot,
} from '@/lib/executive-intelligence-engine';
import {
  generateBusinessForecastingReport,
  evaluateScenario,
  ScenarioType,
} from '@/lib/forecasting-engine';
import {
  PLAN_CONFIGS,
  PlanType,
  checkUsageLimit,
  WorkspaceMember,
  WorkspaceInvitation,
  WorkspaceRole,
  logWorkspaceAction,
  getStoredWorkspaceMembers,
} from '@/lib/saas-engine';
import { CreatePurchaseOrderModal } from '@/components/create-purchase-order-modal';
import { DailyAILearningBanner } from '@/components/daily-ai-learning-banner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function ExecutiveIntelligencePageContent() {
  const {
    products,
    transactions,
    suppliers,
    orders,
    returns,
    businessProfile,
    activePlan,
    handleUpgrade,
    isProcessingPayment,
    aiQueryCount,
    reportCount,
    incrementReportCount,
    updateActivePlan,
    capabilities,
    dataReadiness,
    businessBuddyCalibration,
  } = useData();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Exact customer order density for progressive unlock counters
  const currentOrders = useMemo(() => {
    return dataReadiness?.totalOrders ?? (transactions || []).filter(t => t && (t.type === 'Sale' || !t.type)).length;
  }, [dataReadiness?.totalOrders, transactions]);

  // Unified Navigation Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'forecasting' | 'billing' | 'team'>('overview');
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const checkTabsScroll = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollTabsLeft(el.scrollLeft > 10);
    setCanScrollTabsRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 10);
  }, []);

  useEffect(() => {
    checkTabsScroll();
    window.addEventListener('resize', checkTabsScroll);
    return () => window.removeEventListener('resize', checkTabsScroll);
  }, [checkTabsScroll]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && ['overview', 'forecasting', 'billing', 'team'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [activeTab]);

  const handleTabClick = (tabKey: typeof activeTab, e?: React.MouseEvent<HTMLButtonElement>) => {
    setActiveTab(tabKey);
    if (e?.currentTarget) {
      e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  };

  const scrollTabs = (offset: number) => {
    tabsContainerRef.current?.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const [periodType, setPeriodType] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ReportSnapshot | null>(null);
  const [confirmData, setConfirmData] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [snapshotTick, setSnapshotTick] = useState(0);

  // Sync snapshot updates
  React.useEffect(() => {
    const syncSnaps = () => setSnapshotTick(t => t + 1);
    window.addEventListener('analyzeup_snapshots_updated', syncSnaps);
    return () => {
      window.removeEventListener('analyzeup_snapshots_updated', syncSnaps);
    };
  }, []);

  // Forecasting State
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('BASE');
  const [searchQuery, setSearchQuery] = useState('');
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [selectedReorderProductId, setSelectedReorderProductId] = useState<string | undefined>(undefined);

  // Dynamic Plan Key Resolution
  const resolvedPlanKey: PlanType = useMemo(() => {
    if (activePlan === 'Scale' || activePlan === 'SCALE' || activePlan === 'Enterprise Pro' || activePlan === 'Pro Plan' || activePlan === 'PRO') return 'PRO';
    if (activePlan === 'Growth' || activePlan === 'Growth Plan' || activePlan === 'GROWTH') return 'GROWTH';
    if (activePlan === 'Founder' || activePlan === 'FOUNDER' || activePlan === 'Starter Plan' || activePlan === 'STARTER') return 'STARTER';
    return 'FREE';
  }, [activePlan]);

  const [currentPlanKey, setCurrentPlanKey] = useState<PlanType>(resolvedPlanKey);

  useEffect(() => {
    setCurrentPlanKey(resolvedPlanKey);
  }, [resolvedPlanKey]);

  // Team State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('MANAGER');

  const [members, setMembers] = useState<WorkspaceMember[]>([
    {
      userId: user?.uid || 'user-1',
      email: user?.email || 'founder@business.com',
      name: user?.displayName || 'Business Founder',
      role: 'OWNER',
      joinedAt: '2026-01-15',
    },
    {
      userId: 'user-2',
      email: 'operations@business.com',
      name: 'Operations Manager',
      role: 'MANAGER',
      joinedAt: '2026-03-10',
    },
  ]);

  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([
    {
      id: 'inv-1',
      email: 'accountant@business.com',
      role: 'VIEWER',
      invitedBy: user?.email || 'founder@business.com',
      token: 'tok-9812',
      expiresAt: '2026-08-20',
      status: 'PENDING',
    },
  ]);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';
  const formatCur = (val: number) => {
    const isNeg = val < 0;
    const abs = Math.abs(Math.round(val)).toLocaleString('en-IN');
    return isNeg ? `-${currencySymbol}${abs}` : `${currencySymbol}${abs}`;
  };

  // Calculated Metrics
  const comparison = useMemo(() => {
    return comparePeriods(products, transactions, returns, businessProfile, periodType);
  }, [products, transactions, returns, businessProfile, periodType]);

  const profitBridge = useMemo(() => {
    return calculateProfitBridge(comparison, businessProfile);
  }, [comparison, businessProfile]);

  const scorecard = useMemo(() => {
    return generateExecutiveScorecard(products, transactions, suppliers, returns);
  }, [products, transactions, suppliers, returns]);

  const { risks, opportunities } = useMemo(() => {
    return generateRiskAndOpportunityMatrix(products, transactions, suppliers, orders, returns, businessProfile);
  }, [products, transactions, suppliers, orders, returns, businessProfile]);

  const isForecastingUnlocked = Boolean(
    businessBuddyCalibration?.isOverridden ||
    businessBuddyCalibration?.status === 'CALIBRATED' ||
    capabilities?.demandForecasting ||
    (dataReadiness?.totalOrders && dataReadiness.totalOrders >= 80) ||
    (dataReadiness?.historicalDays && dataReadiness.historicalDays >= 30) ||
    ((dataReadiness?.totalOrders ?? 0) >= 50 && (dataReadiness?.historicalDays ?? 0) >= 14) ||
    (dataReadiness?.level && dataReadiness.level !== 'LEARNING')
  );

  const forecastingReport = useMemo(() => {
    if (activeTab !== 'forecasting' && activeTab !== 'overview') {
      return { totalProjected30DayRevenue: 0, projectedExcessCapital: 0, criticalStockoutsCount: 0, stockoutProjections: [], velocities: [] } as any;
    }
    return generateBusinessForecastingReport(products, transactions, suppliers, orders, { capabilities, dataReadiness });
  }, [products, transactions, suppliers, orders, activeTab, capabilities, dataReadiness]);

  const scenarioTotals = useMemo(() => {
    if (activeTab !== 'forecasting') {
      return { projected30DayRevenue: 0, projected30DayProfit: 0, criticalStockouts: 0, demandMultiplier: 1 } as any;
    }
    return evaluateScenario(forecastingReport, activeScenario);
  }, [forecastingReport, activeScenario, activeTab]);

  const filteredProjections = useMemo(() => {
    if (activeTab !== 'forecasting') return [];
    const query = (searchQuery || '').toLowerCase().trim();
    return (forecastingReport.stockoutProjections || []).filter(
      (p: any) => !query || (p.productName || '').toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query)
    );
  }, [forecastingReport.stockoutProjections, searchQuery, activeTab]);

  const reportHistory = useMemo(() => {
    void historyDrawerOpen;
    void snapshotTick;
    return getStoredReportSnapshots();
  }, [historyDrawerOpen, snapshotTick]);

  // Dynamic Billing usage calculations
  const productCount = products.length;
  const currentAiQueryCount = aiQueryCount;
  const currentReportCount = reportCount;
  const [teamMemberCount, setTeamMemberCount] = useState<number>(1);

  React.useEffect(() => {
    setTeamMemberCount(getStoredWorkspaceMembers(user ? { uid: user.uid, email: user.email || '', displayName: user.displayName || '' } : undefined).length);
  }, [user]);

  const productUsage = checkUsageLimit(currentPlanKey, 'products', productCount);
  const aiUsage = checkUsageLimit(currentPlanKey, 'aiQueries', currentAiQueryCount);
  const reportUsage = checkUsageLimit(currentPlanKey, 'reports', currentReportCount);
  const teamUsage = checkUsageLimit(currentPlanKey, 'teamMembers', teamMemberCount);

  // Handlers
  const handleGenerateSnapshot = (type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY') => {
    const snap = createReportSnapshot(type, products, transactions, suppliers, orders, returns, businessProfile);
    incrementReportCount(1);
    setSelectedSnapshot(snap);
    toast({
      title: `📷 Report Snapshot Generated`,
      description: `Immutable ${type} Executive Report snapshot created.`,
    });
  };

  const handleDeleteSnapshot = (snapshotId: string, title?: string) => {
    deleteStoredReportSnapshot(snapshotId);
    if (selectedSnapshot?.id === snapshotId) {
      setSelectedSnapshot(null);
    }
    toast({
      title: 'Snapshot Deleted',
      description: title ? `Deleted "${title}".` : 'Report snapshot removed.',
    });
  };

  const handleClearAllSnapshots = () => {
    if (reportHistory.length === 0) return;
    if (window.confirm('Are you sure you want to delete all report snapshots? This cannot be undone.')) {
      clearAllStoredReportSnapshots();
      setSelectedSnapshot(null);
      toast({
        title: 'All Snapshots Cleared',
        description: 'All saved report snapshots have been deleted.',
      });
    }
  };

  const handleExportCSV = () => {
    const csvContent =
      `Category,Current Value,Prior Value,Change %\n` +
      `Revenue,${comparison.currentPeriod.revenue},${comparison.priorPeriod.revenue},${comparison.revenueChangePercent}%\n` +
      `Gross Profit,${comparison.currentPeriod.grossProfit},${comparison.priorPeriod.grossProfit},${comparison.profitChangePercent}%\n` +
      `Profit Margin,${comparison.currentPeriod.profitMarginPercent}%,${comparison.priorPeriod.profitMarginPercent}%,${comparison.marginChangePercentagePoints} pts\n` +
      `Total Orders,${comparison.currentPeriod.totalOrders},${comparison.priorPeriod.totalOrders},${comparison.ordersChangePercent}%\n` +
      `Inventory Value,${comparison.currentPeriod.inventoryValue},${comparison.priorPeriod.inventoryValue},${comparison.inventoryValueChangePercent}%\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AnalyzeUp_Executive_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Export Complete', description: 'Executive report CSV downloaded.' });
  };

  const handleAskCopilot = (prompt: string) => {
    const customEvt = new CustomEvent('analyzeup_open_copilot', {
      detail: { query: prompt },
    });
    window.dispatchEvent(customEvt);
  };

  const handleSelectUpgrade = async (planKey: PlanType) => {
    if (planKey === currentPlanKey) return;
    const plan = PLAN_CONFIGS[planKey];
    try {
      await handleUpgrade(`${planKey.toLowerCase()}_monthly`, plan.priceMonthly, plan.name);
      await updateActivePlan(plan.name);
      setCurrentPlanKey(planKey);
      toast({
        title: `🎉 Subscribed to ${plan.name}`,
        description: `Your workspace features and limits have been unlocked.`,
      });
    } catch (err) {
      console.error('Upgrade failed:', err);
    }
  };

  const handleSendInvite = () => {
    if (!inviteEmail) return;
    const newInvite: WorkspaceInvitation = {
      id: `inv-${Date.now()}`,
      email: inviteEmail,
      role: inviteRole,
      invitedBy: user?.email || 'founder@business.com',
      token: `tok-${Math.floor(Math.random() * 10000)}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'PENDING',
    };
    setInvitations(prev => [...prev, newInvite]);
    logWorkspaceAction(user?.uid || 'sys', user?.displayName || 'Owner', 'OWNER', 'USER_INVITED', `Invited ${inviteEmail} as ${inviteRole}`, 'INVITATION');
    toast({ title: '📧 Invitation Sent', description: `Invitation link sent to ${inviteEmail}.` });
    setInviteEmail('');
    setInviteModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            Executive Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified executive summary, predictive demand forecasting, subscription billing, and team role permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryDrawerOpen(true)}
            className="rounded-xl text-xs gap-1.5 border-border/40"
          >
            <History className="w-3.5 h-3.5" /> Snapshots ({reportHistory.length})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl text-xs gap-1.5 border-border/40"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>

          <Button
            size="sm"
            onClick={() => handleGenerateSnapshot('MONTHLY')}
            className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground"
          >
            <FileText className="w-3.5 h-3.5" /> Record Snapshot
          </Button>
        </div>
      </div>

      {/* Unified Executive Pill Tab Navigation Selector */}
      <div className="relative group/tabs flex items-center">
        {canScrollTabsLeft && (
          <Button
            size="icon"
            variant="secondary"
            onClick={() => scrollTabs(-240)}
            className="absolute left-1 z-20 h-8 w-8 rounded-full shadow-lg bg-background/95 border border-border/60 hover:bg-background text-foreground shrink-0 backdrop-blur-md transition-all active:scale-95"
            title="Scroll tabs left"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        <div
          ref={tabsContainerRef}
          onScroll={checkTabsScroll}
          className="flex items-center gap-2 p-2 bg-secondary/40 border border-border/40 rounded-2xl overflow-x-auto scroll-smooth w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-px-4 pr-10"
        >
          <button
            ref={(el) => { tabRefs.current['overview'] = el; }}
            onClick={(e) => handleTabClick('overview', e)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Crown className="w-4.5 h-4.5" /> Executive Overview
          </button>

          <button
            ref={(el) => { tabRefs.current['forecasting'] = el; }}
            onClick={(e) => handleTabClick('forecasting', e)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'forecasting'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <TrendingUp className="w-4.5 h-4.5" /> Demand Forecasting
            {!isForecastingUnlocked && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Learning
              </span>
            )}
          </button>

          <button
            ref={(el) => { tabRefs.current['team'] = el; }}
            onClick={(e) => handleTabClick('team', e)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'team'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Users className="w-4.5 h-4.5" /> Team & Governance ({members.length})
          </button>
        </div>

        {canScrollTabsRight && (
          <Button
            size="icon"
            variant="secondary"
            onClick={() => scrollTabs(240)}
            className="absolute right-1 z-20 h-8 w-8 rounded-full shadow-lg bg-background/95 border border-border/60 hover:bg-background text-foreground shrink-0 backdrop-blur-md transition-all active:scale-95"
            title="Scroll tabs right"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive Business Scorecard */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="ios-glass rounded-2xl border-primary/20 col-span-2">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Overall Business Health</span>
                  <Badge className="bg-primary/20 text-primary text-xs font-bold">Primary</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground">{scorecard.businessHealthScore}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{scorecard.statusSentence}</p>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Financial</span>
                <span className="text-xl font-black text-emerald-400 block">
                  {products.length > 0 ? `${scorecard.financialHealthScore}/100` : '—'}
                </span>
                <span className="text-xs text-emerald-400/90 font-semibold block">
                  {products.length > 0 ? (scorecard.financialHealthScore >= 70 ? 'Strong Margin' : 'Moderate Margin') : 'Awaiting Data'}
                </span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Inventory</span>
                <span className="text-xl font-black text-amber-400 block">
                  {products.length > 0 ? `${scorecard.inventoryHealthScore}/100` : '—'}
                </span>
                <span className="text-xs text-amber-400/90 font-semibold block">
                  {products.length > 0 ? `${risks.filter(r => r.category === 'Inventory').length} Stockout Risks` : '0 Stockout Risks'}
                </span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Suppliers</span>
                <span className="text-xl font-black text-primary block">
                  {suppliers.length > 0 ? `${scorecard.supplierHealthScore}/100` : '—'}
                </span>
                <span className="text-xs text-primary/90 font-semibold block">
                  {suppliers.length > 0 ? `${suppliers.length} Connected` : 'No Suppliers'}
                </span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Forecast Conf.</span>
                <span className={`text-xl font-black block ${!isForecastingUnlocked ? 'text-amber-400' : 'text-indigo-400'}`}>
                  {!isForecastingUnlocked
                    ? 'LEARNING'
                    : (products.length > 0 ? scorecard.forecastConfidence : 'AWAITING DATA')}
                </span>
                <span className="text-xs text-muted-foreground font-semibold block">
                  {!isForecastingUnlocked
                    ? 'Requires 30d Baseline'
                    : (products.length > 0 ? '30D Projected' : 'No Transactions')}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Period Comparison Bar */}
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Period Comparison & Growth Trajectory
                </CardTitle>
                <CardDescription className="text-sm">
                  Comparing actual current business performance against prior period benchmarks.
                </CardDescription>
              </div>

              <div className="flex items-center gap-1.5 bg-secondary/50 p-1.5 rounded-xl overflow-x-auto w-full md:w-auto shrink-0 scrollbar-none">
                {(['MONTH', 'QUARTER', 'YEAR'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodType(p)}
                    className={`px-3 md:px-4 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 whitespace-nowrap ${
                      periodType === p ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p === 'MONTH' ? 'This Month vs Last' : p === 'QUARTER' ? 'This Quarter vs Last' : 'This Year vs Last'}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const aov = comparison.currentPeriod.totalOrders > 0
                  ? Math.round(comparison.currentPeriod.revenue / comparison.currentPeriod.totalOrders)
                  : 0;
                const totalOrders = comparison.currentPeriod.totalOrders;
                const totalReturns = comparison.currentPeriod.totalReturns;
                const returnRate = totalOrders > 0
                  ? ((totalReturns / totalOrders) * 100).toFixed(1)
                  : '0.0';
                const ordersChange = comparison.ordersChangePercent;
                const returnsChange = comparison.returnsChangePercent;
                const currentMargin = comparison.currentPeriod.profitMarginPercent;
                const marginPts = comparison.marginChangePercentagePoints;
                const currentCogs = comparison.currentPeriod.cogs;
                const inventoryVal = comparison.currentPeriod.inventoryValue;
                const invChange = comparison.inventoryValueChangePercent;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-sm">
                    {/* Box 1: Revenue & AOV */}
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-2.5 hover:bg-secondary/40 transition-all flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider truncate">
                          <Coins className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Revenue & AOV
                        </span>
                        {comparison.currentPeriod.revenue > 0 || comparison.priorPeriod.revenue > 0 ? (
                          <span className={`text-[11px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-lg whitespace-nowrap shrink-0 ${
                            comparison.revenueChangePercent >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                          }`}>
                            {comparison.revenueChangePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {comparison.revenueChangePercent >= 0 ? `+${comparison.revenueChangePercent}%` : `${comparison.revenueChangePercent}%`}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">0% vs prior</span>
                        )}
                      </div>

                      <div>
                        <span className="text-2xl font-black text-foreground block tracking-tight">
                          {formatCur(comparison.currentPeriod.revenue)}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Prior Period: {formatCur(comparison.priorPeriod.revenue)}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">Avg Order Value (AOV):</span>
                        <span className="font-bold text-foreground text-xs">{formatCur(aov)}</span>
                      </div>
                    </div>

                    {/* Box 2: Gross Profit & Margin (Combines Profit, Margin % & COGS) */}
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-2.5 hover:bg-secondary/40 transition-all flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider truncate">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Gross Profit & Margin
                        </span>
                        {comparison.currentPeriod.grossProfit > 0 || comparison.priorPeriod.grossProfit > 0 ? (
                          <span className={`text-[11px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-lg whitespace-nowrap shrink-0 ${
                            comparison.profitChangePercent >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                          }`}>
                            {comparison.profitChangePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {comparison.profitChangePercent >= 0 ? `+${comparison.profitChangePercent}%` : `${comparison.profitChangePercent}%`}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">0% vs prior</span>
                        )}
                      </div>

                      <div>
                        <span className="text-2xl font-black text-foreground block tracking-tight">
                          {formatCur(comparison.currentPeriod.grossProfit)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-bold text-emerald-400">
                            {currentMargin}% Margin
                          </span>
                          <span className={`text-[10px] font-semibold ${marginPts >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ({marginPts >= 0 ? `+${marginPts}` : `${marginPts}`} pts vs prior)
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">COGS Cost Base:</span>
                        <span className="font-semibold text-muted-foreground text-xs">{formatCur(currentCogs)}</span>
                      </div>
                    </div>

                    {/* Box 3: Orders & Customer Returns (Combines Orders, Returns & Return Rate) */}
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-2.5 hover:bg-secondary/40 transition-all flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider truncate">
                          <PackageX className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Orders & Returns
                        </span>
                        <span className={`text-[11px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-lg whitespace-nowrap shrink-0 ${
                          ordersChange >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {ordersChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {ordersChange >= 0 ? `+${ordersChange}%` : `${ordersChange}%`}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-foreground tracking-tight">
                            {totalOrders}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">Total Orders</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Prior Period: {comparison.priorPeriod.totalOrders} Orders
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">Returns ({returnRate}% rate):</span>
                        <span className="text-xs font-bold text-foreground">
                          {totalReturns} ({returnsChange >= 0 ? `+${returnsChange}%` : `${returnsChange}%`})
                        </span>
                      </div>
                    </div>

                    {/* Box 4: Inventory & Working Capital */}
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-2.5 hover:bg-secondary/40 transition-all flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider truncate">
                          <Boxes className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Inventory & Capital
                        </span>
                        <span className={`text-[11px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-lg whitespace-nowrap shrink-0 ${
                          invChange >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {invChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {invChange >= 0 ? `+${invChange}%` : `${invChange}%`}
                        </span>
                      </div>

                      <div>
                        <span className="text-2xl font-black text-foreground block tracking-tight">
                          {formatCur(inventoryVal)}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Catalog: {products.length} Products
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">Runway Status:</span>
                        <span className="font-semibold text-foreground text-xs">
                          {products.filter(p => p.stock <= (p.minStock || 5)).length > 0
                            ? `${products.filter(p => p.stock <= (p.minStock || 5)).length} Reorders Needed`
                            : 'Healthy Stock Buffer'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Deterministic Profit Bridge */}
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="w-5 h-5 text-muted-foreground" /> Deterministic Profit Bridge Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const priorProfit = profitBridge.priorProfit;
                const currentProfit = profitBridge.currentProfit;
                const netDelta = currentProfit - priorProfit;
                const netPercent = priorProfit > 0 ? Math.round((netDelta / priorProfit) * 1000) / 10 : 0;
                const absDelta = Math.abs(netDelta);
                const varianceDrivers = profitBridge.components.filter(c => c.type !== 'base' && c.type !== 'total');

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 text-xs">
                    {/* Box 1: Profit Progression Anchor (Combines Prior Profit, Current Profit & Net Delta in 1 box!) */}
                    <div className="p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/40 border border-border/50 hover:border-border/70 space-y-3 flex flex-col justify-between shadow-xs transition-all">
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-foreground/90 uppercase tracking-wider">
                          Profit Trajectory
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 border border-border/50 bg-secondary/60 text-muted-foreground">
                          {netPercent >= 0 ? `+${netPercent}%` : `${netPercent}%`}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                          Net Shift
                        </span>
                        <div className="flex items-center gap-1.5">
                          {netDelta >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span className={`text-xl font-extrabold tracking-tight ${
                            netDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {netDelta >= 0 ? `+${formatCur(netDelta)}` : formatCur(netDelta)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-border/30 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Prior Period:</span>
                          <span className="font-semibold text-foreground">{formatCur(priorProfit)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Realized Profit:</span>
                          <span className="font-bold text-foreground">{formatCur(currentProfit)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Boxes 2-5: The 4 Distinct Variance Drivers */}
                    {varianceDrivers.map((c, i) => {
                      const share = absDelta > 0 ? Math.round((Math.abs(c.amount) / absDelta) * 1000) / 10 : 0;
                      const isPositive = c.amount > 0;
                      const isNegative = c.amount < 0;

                      return (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-secondary/25 hover:bg-secondary/35 border border-border/50 hover:border-border/70 space-y-3 flex flex-col justify-between transition-all shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-xs font-bold text-foreground leading-tight line-clamp-1" title={c.label}>
                              {c.label}
                            </span>
                            {share > 0 && (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 border border-border/50 bg-secondary/60 text-muted-foreground"
                                title={`${share}% share of total variance`}
                              >
                                {share}% impact
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {isPositive ? (
                                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : isNegative ? (
                                <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                              ) : null}
                              <span className={`text-xl font-extrabold tracking-tight ${
                                isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-foreground'
                              }`}>
                                {isPositive ? `+${formatCur(c.amount)}` : formatCur(c.amount)}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                              {c.description}
                            </p>
                          </div>

                          <div className="pt-2.5 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Driver Category:</span>
                            <span className="font-semibold text-foreground/90 px-1.5 py-0.5 rounded-md bg-secondary/50 text-[10px]">
                              {c.label.includes('Revenue')
                                ? 'Sales Volume'
                                : c.label.includes('Supplier')
                                ? 'Procurement'
                                : c.label.includes('Returns')
                                ? 'Operations'
                                : 'Catalog Mix'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEMAND & REVENUE FORECASTING */}
      {/* ========================================================================= */}
      {activeTab === 'forecasting' && (
        !isForecastingUnlocked ? (
          <div className="space-y-6">
            {/* Live Daily Adaptive AI Learning Engine with Tokenized Privacy Shield */}
            <DailyAILearningBanner />

            <Card className="p-6 md:p-8 rounded-3xl ios-glass border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background/60 to-background shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-3 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/35 text-amber-300 text-xs font-semibold">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Adaptive Intelligence Guardrail Active
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                    Observing Your Catalog's Sales Rhythm
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    AnalyzeUp enforces strict statistical sufficiency standards to protect your business. Full macro 30-day forecast curves calibrate as sales history accumulates. Daily velocity learning is actively executed using tokenized zero-PII data to observe demand rhythm.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-secondary/30 border border-border/40 space-y-2 min-w-[220px] shrink-0 text-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Current Readiness</span>
                  <div className="text-3xl font-black text-amber-400 font-mono">
                    {dataReadiness?.score ?? 0}<span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px] font-semibold">
                    {dataReadiness?.level === 'EARLY_INSIGHTS'
                      ? 'Level 2 • Early Insights'
                      : dataReadiness?.level === 'PREDICTIVE'
                      ? 'Level 3 • Predictive'
                      : dataReadiness?.level === 'OPTIMIZATION'
                      ? 'Level 4 • Optimization'
                      : 'Level 1 • Learning'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/30">
                <div className="p-4 rounded-2xl bg-secondary/20 border border-border/30 space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" /> Sales History
                  </span>
                  <div className="text-base font-bold text-foreground font-mono">
                    {dataReadiness?.historicalDays ?? 0} / 30 Days
                  </div>
                  <p className="text-[10px] text-amber-400">
                    {(dataReadiness?.historicalDays ?? 0) >= 30 ? 'Target achieved' : 'Baseline calibrating'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/20 border border-border/30 space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Order Density
                  </span>
                  <div className="text-base font-bold text-foreground font-mono">
                    {dataReadiness?.totalOrders ?? 0} / 50 Orders ({Math.min(100, Math.round(((dataReadiness?.totalOrders ?? 0) / 50) * 100))}%)
                  </div>
                  <p className="text-[10px] text-emerald-400 font-semibold">
                    {(dataReadiness?.totalOrders ?? 0) >= 50 ? 'Threshold reached' : 'Calibrating order density'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/20 border border-border/30 space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Active Catalog
                  </span>
                  <div className="text-base font-bold text-foreground font-mono">
                    {products.length} SKUs Tracked
                  </div>
                  <p className="text-[10px] text-emerald-400">100% catalog monitored</p>
                </div>
              </div>
            </Card>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Scenario Simulator */}
          <Card className="ios-glass rounded-2xl border-border/50 shadow-md overflow-hidden">
            <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/30">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Forecast Scenario Simulator
                </CardTitle>
                <CardDescription className="text-xs">
                  Model business demand shifts (+20% Surge / -20% Slowdown) to evaluate cash flow.
                </CardDescription>
              </div>

              <div className="flex items-center gap-1.5 bg-secondary/50 p-1 rounded-xl overflow-x-auto w-full md:w-auto shrink-0 scrollbar-none">
                {(['BASE', 'HIGH_DEMAND', 'LOW_DEMAND'] as const).map(sc => (
                  <button
                    key={sc}
                    onClick={() => setActiveScenario(sc)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
                      activeScenario === sc ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sc === 'BASE' ? 'Base Case (1.0x)' : sc === 'HIGH_DEMAND' ? 'High Demand (+20%)' : 'Low Demand (-20%)'}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Projected 30D Revenue</span>
                  <div className="text-2xl font-black text-foreground font-mono">{formatCur(scenarioTotals.projected30DayRevenue)}</div>
                  <span className="text-[11px] text-muted-foreground">Demand Multiplier: {scenarioTotals.demandMultiplier}x</span>
                </div>

                <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Projected 30D Profit</span>
                  <div className="text-2xl font-black text-foreground font-mono">{formatCur(scenarioTotals.projected30DayProfit)}</div>
                  <span className="text-[11px] text-muted-foreground">Estimated gross profit</span>
                </div>

                <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Imminent Stockouts</span>
                  <div className="text-2xl font-black text-rose-400 font-mono">{scenarioTotals.criticalStockouts} SKUs</div>
                  <span className="text-[11px] text-muted-foreground">Action Required</span>
                </div>

                <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold">Excess Capital Risk</span>
                  <div className="text-2xl font-black text-amber-400 font-mono">{formatCur(forecastingReport.projectedExcessCapital)}</div>
                  <span className="text-[11px] text-muted-foreground">In Slow Inventory</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demand & Stockout Table */}
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-bold">Demand & Stockout Date Projections</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search SKU or product..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="font-bold">Product</TableHead>
                    <TableHead className="font-bold text-center">Stock</TableHead>
                    <TableHead className="font-bold text-center">30D Forecast</TableHead>
                    <TableHead className="font-bold text-center">Projected Stockout</TableHead>
                    <TableHead className="font-bold text-center">Lead Time</TableHead>
                    <TableHead className="font-bold text-center">Risk</TableHead>
                    <TableHead className="font-bold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjections.map((item: any) => (
                    <TableRow key={item.productId} className="border-border/30">
                      <TableCell>
                        <span className="font-bold text-foreground block">{item.productName}</span>
                        <span className="text-[10px] text-muted-foreground block">{item.sku}</span>
                      </TableCell>
                      <TableCell className="text-center font-bold">{item.currentStock} units</TableCell>
                      <TableCell className="text-center font-bold text-primary">{Math.round(item.recommendedReorderQty * 0.8)} units</TableCell>
                      <TableCell className="text-center font-semibold">
                        {item.projectedStockoutDate
                          ? new Date(item.projectedStockoutDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                          : 'No stockout'}
                      </TableCell>
                      <TableCell className="text-center">{item.supplierLeadTimeDays} days</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[10px] font-bold ${item.stockoutRiskLevel === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {item.stockoutRiskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-7 text-[11px] font-bold rounded-xl bg-primary text-primary-foreground"
                          onClick={() => {
                            setSelectedReorderProductId(item.productId);
                            setReorderModalOpen(true);
                          }}
                        >
                          Reorder {item.recommendedReorderQty}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        )
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BILLING & SUBSCRIPTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="ios-glass rounded-2xl border-primary/20 bg-primary/5 lg:col-span-1">
              <CardHeader className="pb-3">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Active Workspace Plan</span>
                <CardTitle className="text-xl font-black text-foreground flex items-center justify-between">
                  <span>{PLAN_CONFIGS[currentPlanKey].name}</span>
                  <Badge className="bg-primary text-primary-foreground font-bold text-xs">{currentPlanKey}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-background/60 border border-border/30 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Monthly Price</span>
                  <span className="text-lg font-extrabold text-foreground block">
                    {currencySymbol === '$'
                      ? `$${PLAN_CONFIGS[currentPlanKey].priceMonthlyUSD}/mo`
                      : `₹${PLAN_CONFIGS[currentPlanKey].priceMonthly.toLocaleString('en-IN')}/mo`}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/50 lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Live Workspace Usage Limits
                </CardTitle>
                <CardDescription className="text-xs">
                  Current monthly utilization against your active workspace subscription limits.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Products Meter */}
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <Boxes className="w-4 h-4 text-primary" /> Products & SKUs
                    </span>
                    <span className="font-bold text-foreground text-xs">
                      {productCount} / {productUsage.limit}
                    </span>
                  </div>
                  <Progress value={productUsage.usagePercent} className="h-2" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{productUsage.usagePercent}% used</span>
                    <span>{Math.max(0, productUsage.limit - productCount)} remaining</span>
                  </div>
                </div>

                {/* AI Queries Meter */}
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-4 h-4 text-primary" /> AI Copilot Queries
                    </span>
                    <span className="font-bold text-foreground text-xs">
                      {currentAiQueryCount} / {aiUsage.limit}
                    </span>
                  </div>
                  <Progress value={aiUsage.usagePercent} className="h-2" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{aiUsage.usagePercent}% used</span>
                    <span>{Math.max(0, aiUsage.limit - currentAiQueryCount)} remaining</span>
                  </div>
                </div>

                {/* Executive Reports Meter */}
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <FileText className="w-4 h-4 text-primary" /> Executive Reports
                    </span>
                    <span className="font-bold text-foreground text-xs">
                      {currentReportCount} / {reportUsage.limit}
                    </span>
                  </div>
                  <Progress value={reportUsage.usagePercent} className="h-2" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{reportUsage.usagePercent}% used</span>
                    <span>{Math.max(0, reportUsage.limit - currentReportCount)} remaining</span>
                  </div>
                </div>

                {/* Team Members Meter */}
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                      <Users className="w-4 h-4 text-primary" /> Team Seats
                    </span>
                    <span className="font-bold text-foreground text-xs">
                      {teamMemberCount} / {teamUsage.limit}
                    </span>
                  </div>
                  <Progress value={teamUsage.usagePercent} className="h-2" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{teamUsage.usagePercent}% used</span>
                    <span>{Math.max(0, teamUsage.limit - teamMemberCount)} remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(Object.keys(PLAN_CONFIGS) as PlanType[]).map(key => {
              const plan = PLAN_CONFIGS[key];
              const isCurrent = key === currentPlanKey;
              return (
                <Card key={key} className={`ios-glass rounded-2xl flex flex-col justify-between ${isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-border/40'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">{plan.name}</span>
                      {isCurrent && <Badge className="bg-primary text-primary-foreground text-[10px]">Active</Badge>}
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {currencySymbol === '$' ? `$${plan.priceMonthlyUSD}` : `₹${plan.priceMonthly.toLocaleString('en-IN')}`}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-4 flex-1 flex flex-col justify-between text-xs">
                    <ul className="space-y-2 text-muted-foreground text-xs py-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-foreground/90 font-medium text-xs">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      disabled={Boolean(isCurrent || isProcessingPayment)}
                      onClick={() => handleSelectUpgrade(key)}
                      className={`w-full rounded-xl text-xs font-bold ${
                        isCurrent
                          ? 'bg-secondary text-muted-foreground'
                          : 'bg-primary text-primary-foreground hover:brightness-110'
                      }`}
                    >
                      {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TEAM & GOVERNANCE */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" /> Active Workspace Roster ({members.length})
                </CardTitle>
              </div>
              <Button onClick={() => setInviteModalOpen(true)} className="rounded-xl text-xs bg-primary text-primary-foreground">
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite Member
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                {members.map(m => (
                  <div key={m.userId} className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/30 border border-border/30">
                    <div>
                      <h4 className="font-bold text-foreground text-xs">{m.name}</h4>
                      <span className="text-[10px] text-muted-foreground block">{m.email}</span>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">{m.role}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report History Drawer */}
      <Sheet open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-md p-6 ios-glass flex flex-col justify-between max-h-screen overflow-hidden">
          <SheetHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <SheetTitle className="text-base font-bold">Report Snapshots</SheetTitle>
              <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                {reportHistory.length}
              </Badge>
            </div>
            {reportHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllSnapshots}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer gap-1.5"
                title="Clear all report snapshots"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[11px]">Clear All</span>
              </Button>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {reportHistory.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary/50 border border-border/50 flex items-center justify-center mx-auto text-muted-foreground">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">No Snapshots Saved</p>
                  <p className="text-[11px] text-muted-foreground max-w-[240px] mx-auto">
                    Click "Record Snapshot" in the Executive dashboard to save point-in-time business health reports.
                  </p>
                </div>
              </div>
            ) : (
              reportHistory.map(snap => {
                const healthScore = snap.scorecard?.businessHealthScore ?? 80;
                const healthBadgeClass =
                  healthScore >= 80
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : healthScore >= 60
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30';

                const formattedDate = snap.generatedAt
                  ? new Date(snap.generatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : snap.periodLabel || 'Recent Snapshot';

                return (
                  <div
                    key={snap.id}
                    onClick={() => setSelectedSnapshot(snap)}
                    className="p-3.5 rounded-2xl bg-secondary/30 border border-border/40 hover:border-primary/40 hover:bg-secondary/50 transition-all text-xs flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-xs truncate">
                          {snap.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                        <span className="truncate">{formattedDate}</span>
                        <span>•</span>
                        <Badge className={cn('text-[9px] px-1.5 py-0 h-4 font-semibold border', healthBadgeClass)}>
                          Health: {healthScore}/100
                        </Badge>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSnapshot(snap.id, snap.title);
                      }}
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/15 transition-colors cursor-pointer shrink-0 opacity-70 group-hover:opacity-100"
                      title="Delete this snapshot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Snapshot Detail Modal */}
      <Dialog open={selectedSnapshot !== null} onOpenChange={(open) => { if (!open) setSelectedSnapshot(null); }}>
        <DialogContent className="sm:max-w-xl bg-zinc-950/95 border border-border/50 rounded-3xl ios-glass text-white shadow-2xl p-6 max-h-[88vh] flex flex-col overflow-hidden">
          {selectedSnapshot && (
            <>
              <DialogHeader className="pb-3 border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div className="flex items-center gap-2 min-w-0">
                    <History className="w-5 h-5 text-primary shrink-0" />
                    <DialogTitle className="text-base font-bold truncate text-zinc-100">
                      {selectedSnapshot.title}
                    </DialogTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary uppercase shrink-0">
                    {selectedSnapshot.reportType}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-zinc-400">
                  Captured on {new Date(selectedSnapshot.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 text-xs">
                {/* Scorecard Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1 text-center">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Health Score</span>
                    <p className="text-base font-extrabold text-emerald-400">{selectedSnapshot.scorecard?.businessHealthScore || 80}/100</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1 text-center">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Revenue</span>
                    <p className="text-base font-extrabold text-zinc-100">{formatCur(selectedSnapshot.comparison?.currentPeriod?.revenue || 0)}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1 text-center">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Gross Profit</span>
                    <p className="text-base font-extrabold text-zinc-100">{formatCur(selectedSnapshot.comparison?.currentPeriod?.grossProfit || 0)}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1 text-center">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Profit Margin</span>
                    <p className="text-base font-extrabold text-zinc-100">{selectedSnapshot.comparison?.currentPeriod?.profitMarginPercent || 0}%</p>
                  </div>
                </div>

                {/* AI Executive Brief Summary */}
                {selectedSnapshot.brief && (
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Executive Synthesis</span>
                    </div>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {selectedSnapshot.brief.overallStatus}
                    </p>
                    {selectedSnapshot.brief.recommendedActions?.length > 0 && (
                      <div className="pt-1.5 space-y-1">
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase">Key Actions:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-zinc-300 text-[11px]">
                          {selectedSnapshot.brief.recommendedActions.slice(0, 3).map((act, i) => (
                            <li key={i}>{act}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-3 border-t border-zinc-800/60 shrink-0 flex items-center justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSnapshot(selectedSnapshot.id, selectedSnapshot.title)}
                  className="rounded-xl text-xs text-destructive hover:bg-destructive/15 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Snapshot
                </Button>
                <Button
                  type="button"
                  onClick={() => setSelectedSnapshot(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs px-4"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reorder PO Modal */}
      <CreatePurchaseOrderModal
        open={reorderModalOpen}
        onOpenChange={setReorderModalOpen}
        defaultProductId={selectedReorderProductId}
      />

      {/* Invite Member Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md pr-10">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Email Address</Label>
              <Input
                placeholder="colleague@business.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSendInvite} className="rounded-xl text-xs bg-primary text-primary-foreground">
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmData !== null} onOpenChange={(open) => { if (!open) setConfirmData(null); }}>
        <DialogContent className="max-w-md bg-zinc-950/90 border border-amber-500/20 rounded-3xl ios-glass text-white shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 animate-bounce text-amber-400" />
              </div>
              <DialogTitle className="text-base font-bold text-white">Confirm Action</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              Are you sure you want to proceed with this decision?
            </DialogDescription>
          </DialogHeader>

          {confirmData && (
            <div className="py-2 text-xs space-y-3">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                <div className="text-zinc-200 font-bold">{confirmData.title}</div>
                <div className="text-zinc-300 leading-relaxed">{confirmData.description}</div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800/40">
            <Button
              variant="ghost"
              onClick={() => setConfirmData(null)}
              className="rounded-xl text-xs hover:bg-zinc-900 text-zinc-400 hover:text-white px-3"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmData) {
                  confirmData.onConfirm();
                  setConfirmData(null);
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-xs px-4"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ExecutiveIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading Executive Command Center...</div>}>
      <ExecutiveIntelligencePageContent />
    </Suspense>
  );
}
