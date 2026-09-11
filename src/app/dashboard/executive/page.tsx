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
  Rocket,
  Target,
  UserCheck,
  UserX,
  Repeat,
  Check,
  FlaskConical,
  Sliders,
  Save,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  comparePeriods,
  calculateProfitBridge,
  generateRiskAndOpportunityMatrix,
  generateExecutiveScorecard,
  generateAIExecutiveBrief,
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
  computeCustomerGrowthIntelligence,
  saveOpportunityStatus,
  getStoredOpportunityStatuses,
} from '@/lib/customer-growth-engine';
import {
  runBusinessSimulation,
  saveScenario,
  getSavedScenarios,
  deleteSavedScenario,
} from '@/lib/simulation-engine';
import { SimulationType } from '@/lib/types';
import {
  PLAN_CONFIGS,
  PlanType,
  checkUsageLimit,
  WorkspaceMember,
  WorkspaceInvitation,
  WorkspaceRole,
  logWorkspaceAction,
} from '@/lib/saas-engine';
import { CreatePurchaseOrderModal } from '@/components/create-purchase-order-modal';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function ExecutiveIntelligencePageContent() {
  const { products, transactions, suppliers, orders, returns, businessProfile, activePlan, handleUpgrade, isProcessingPayment, aiQueryCount, capabilities, dataReadiness } = useData();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Unified Navigation Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'forecasting' | 'growth' | 'simulation' | 'billing' | 'team'>('overview');
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
    if (tab && ['overview', 'forecasting', 'growth', 'simulation', 'billing', 'team'].includes(tab)) {
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
  const [growthTick, setGrowthTick] = useState(0);
  const [confirmData, setConfirmData] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // Simulation State
  const [simType, setSimType] = useState<SimulationType>('PRICE_CHANGE');
  const [simTargetProductId, setSimTargetProductId] = useState<string>('');
  const [simValue, setSimValue] = useState<number>(10);
  const [scenarioNameInput, setScenarioNameInput] = useState<string>('');
  const [savedSimTick, setSavedSimTick] = useState(0);
  const [snapshotTick, setSnapshotTick] = useState(0);

  // Sync opportunity status updates, simulation updates & snapshot updates
  React.useEffect(() => {
    const sync = () => setGrowthTick(t => t + 1);
    const syncSims = () => setSavedSimTick(t => t + 1);
    const syncSnaps = () => setSnapshotTick(t => t + 1);
    window.addEventListener('analyzeup_growth_opps_updated', sync);
    window.addEventListener('analyzeup_simulations_updated', syncSims);
    window.addEventListener('analyzeup_snapshots_updated', syncSnaps);
    return () => {
      window.removeEventListener('analyzeup_growth_opps_updated', sync);
      window.removeEventListener('analyzeup_simulations_updated', syncSims);
      window.removeEventListener('analyzeup_snapshots_updated', syncSnaps);
    };
  }, []);

  // Growth Intelligence Engine (computed when growth or overview tab is active)
  const growthReport = useMemo(() => {
    if (activeTab !== 'growth' && activeTab !== 'overview') {
      return { totalCustomers: 0, repeatPurchaseRatePercent: 0, atRiskCustomers: [], opportunities: [], rfmSegments: {} } as any;
    }
    void growthTick;
    return computeCustomerGrowthIntelligence(products, transactions, suppliers, orders, returns, businessProfile);
  }, [products, transactions, suppliers, orders, returns, businessProfile, growthTick, activeTab]);

  // Simulation Engine (computed only when simulation tab is active)
  const activeSimulation = useMemo(() => {
    if (activeTab !== 'simulation') {
      return null as any;
    }
    const pId = simTargetProductId || products[0]?.id || '';
    const params: Record<string, any> = {};
    if (simType === 'PRICE_CHANGE') params.priceChangePercent = simValue;
    else if (simType === 'DISCOUNT_PROMOTION') params.discountPercent = simValue;
    else if (simType === 'INVENTORY_PURCHASE') params.purchaseQty = simValue;
    else if (simType === 'DEMAND_CHANGE') params.demandShiftPercent = simValue;

    return runBusinessSimulation(simType, pId, params, products, transactions, suppliers, orders, businessProfile);
  }, [simType, simTargetProductId, simValue, products, transactions, suppliers, orders, businessProfile, activeTab]);

  const savedScenarios = useMemo(() => {
    if (activeTab !== 'simulation') return [];
    void savedSimTick;
    return getSavedScenarios();
  }, [savedSimTick, activeTab]);

  // Forecasting State
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('BASE');
  const [searchQuery, setSearchQuery] = useState('');
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [selectedReorderProductId, setSelectedReorderProductId] = useState<string | undefined>(undefined);

  // Dynamic Plan Key Resolution
  const resolvedPlanKey: PlanType = useMemo(() => {
    if (activePlan === 'Enterprise Pro' || activePlan === 'Pro Plan') return 'PRO';
    if (activePlan === 'Growth Plan') return 'GROWTH';
    if (activePlan === 'Starter Plan') return 'STARTER';
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
  const formatCur = (val: number) => `${currencySymbol}${Math.round(val).toLocaleString('en-IN')}`;

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

  const brief = useMemo(() => {
    return generateAIExecutiveBrief(comparison, scorecard, risks, opportunities, businessProfile);
  }, [comparison, scorecard, risks, opportunities, businessProfile]);

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
  const reportCount = reportHistory.length || 1;

  const productUsage = checkUsageLimit(currentPlanKey, 'products', productCount);
  const aiUsage = checkUsageLimit(currentPlanKey, 'aiQueries', currentAiQueryCount);

  // Handlers
  const handleGenerateSnapshot = (type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY') => {
    const snap = createReportSnapshot(type, products, transactions, suppliers, orders, returns, businessProfile);
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-400" /> Executive Intelligence
            </h1>
            <Badge variant="outline" className="text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border-amber-500/30">
              C-Suite Hub
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
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
            {(dataReadiness?.level === 'LEARNING' || !capabilities?.demandForecasting) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Learning
              </span>
            )}
          </button>

          <button
            ref={(el) => { tabRefs.current['growth'] = el; }}
            onClick={(e) => handleTabClick('growth', e)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'growth'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Rocket className="w-4.5 h-4.5" /> Growth & Retention
          </button>

          <button
            ref={(el) => { tabRefs.current['simulation'] = el; }}
            onClick={(e) => handleTabClick('simulation', e)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'simulation'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <FlaskConical className="w-4.5 h-4.5" /> AI Strategy Lab
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
                <span className={`text-xl font-black block ${dataReadiness?.level === 'LEARNING' || !capabilities?.demandForecasting ? 'text-amber-400' : 'text-indigo-400'}`}>
                  {dataReadiness?.level === 'LEARNING' || !capabilities?.demandForecasting
                    ? 'LEARNING'
                    : (products.length > 0 ? scorecard.forecastConfidence : 'AWAITING DATA')}
                </span>
                <span className="text-xs text-muted-foreground font-semibold block">
                  {dataReadiness?.level === 'LEARNING' || !capabilities?.demandForecasting
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
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Revenue</span>
                  <span className="text-lg font-bold text-foreground block">{formatCur(comparison.currentPeriod.revenue)}</span>
                  {comparison.currentPeriod.revenue > 0 || comparison.priorPeriod.revenue > 0 ? (
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${comparison.revenueChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {comparison.revenueChangePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5 inline" /> : <TrendingDown className="w-3.5 h-3.5 inline" />}
                      {comparison.revenueChangePercent >= 0 ? `+${comparison.revenueChangePercent}%` : `${comparison.revenueChangePercent}%`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">0% vs prior</span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Gross Profit</span>
                  <span className="text-lg font-bold text-foreground block">{formatCur(comparison.currentPeriod.grossProfit)}</span>
                  {comparison.currentPeriod.grossProfit > 0 || comparison.priorPeriod.grossProfit > 0 ? (
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${comparison.profitChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {comparison.profitChangePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5 inline" /> : <TrendingDown className="w-3.5 h-3.5 inline" />}
                      {comparison.profitChangePercent >= 0 ? `+${comparison.profitChangePercent}%` : `${comparison.profitChangePercent}%`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">0% vs prior</span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Profit Margin</span>
                  <span className="text-lg font-bold text-foreground block">{comparison.currentPeriod.profitMarginPercent}%</span>
                  {comparison.currentPeriod.revenue > 0 ? (
                    <span className={`text-xs font-bold ${comparison.marginChangePercentagePoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {comparison.marginChangePercentagePoints >= 0 ? `+${comparison.marginChangePercentagePoints} pts` : `${comparison.marginChangePercentagePoints} pts`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">0 pts</span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Total Orders</span>
                  <span className="text-lg font-bold text-foreground block">{comparison.currentPeriod.totalOrders}</span>
                  {comparison.currentPeriod.totalOrders > 0 || comparison.priorPeriod.totalOrders > 0 ? (
                    <span className="text-xs text-emerald-400 font-bold">+{comparison.ordersChangePercent}% vs prior</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">0 vs prior</span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Customer Returns</span>
                  <span className="text-lg font-bold text-foreground block">{comparison.currentPeriod.totalReturns}</span>
                  {comparison.currentPeriod.totalReturns > 0 ? (
                    <span className="text-xs text-amber-400 font-bold">+{comparison.returnsChangePercent}% rate</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">0% rate</span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">Inventory Value</span>
                  <span className="text-lg font-bold text-foreground block">{formatCur(comparison.currentPeriod.inventoryValue)}</span>
                  {comparison.currentPeriod.inventoryValue > 0 ? (
                    <span className="text-xs text-muted-foreground font-bold">+{comparison.inventoryValueChangePercent}% holding</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">₹0 holding</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deterministic Profit Bridge */}
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" /> Deterministic Profit Bridge Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                {profitBridge.components.map((c, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border space-y-1 text-center ${
                      c.type === 'base'
                        ? 'bg-secondary/40 border-border/40'
                        : c.type === 'positive'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : c.type === 'negative'
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-primary/10 border-primary/30 font-bold'
                    }`}
                  >
                    <span className="text-[10px] text-muted-foreground block truncate">{c.label}</span>
                    <span className={`text-sm font-black block ${c.type === 'positive' ? 'text-emerald-400' : c.type === 'negative' ? 'text-rose-400' : 'text-foreground'}`}>
                      {c.amount >= 0 ? `+${formatCur(c.amount)}` : `${formatCur(c.amount)}`}
                    </span>
                    <span className="text-[9px] text-muted-foreground block leading-snug">{c.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Executive Brief */}
          <Card className="ios-glass rounded-2xl border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-400">
                <Sparkles className="w-5 h-5 text-amber-400" /> AI Executive Brief
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-background/60 border border-border/30 space-y-1">
                    <span className="font-bold text-foreground text-xs block">Overall Business Status</span>
                    <p className="text-muted-foreground text-[11px]">{brief.overallStatus}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                    <span className="font-bold text-emerald-400 text-xs block">Biggest Positive Contribution</span>
                    <p className="text-muted-foreground text-[11px]">{brief.biggestPositiveChange}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-background/60 border border-border/30 space-y-1">
                    <span className="font-bold text-amber-400 text-xs block">Primary Operational Risk</span>
                    <p className="text-muted-foreground text-[11px]">{brief.mainRisk}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
                    <span className="font-bold text-primary text-xs block">Executive Action Priorities</span>
                    <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
                      {brief.recommendedActions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEMAND & REVENUE FORECASTING */}
      {/* ========================================================================= */}
      {activeTab === 'forecasting' && (
        (dataReadiness?.level === 'LEARNING' || !capabilities?.demandForecasting) ? (
          <div className="space-y-6">
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
                    AnalyzeUp enforces strict statistical sufficiency standards to protect your business. 30-Day demand forecasting and projected revenue trajectories require at least <strong className="text-foreground">30 days of recorded sales history</strong> or <strong className="text-foreground">80+ customer orders</strong>. Speculative forecasts and premature price discounts are suppressed during baseline learning.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-secondary/30 border border-border/40 space-y-2 min-w-[220px] shrink-0 text-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Current Readiness</span>
                  <div className="text-3xl font-black text-amber-400 font-mono">
                    {dataReadiness?.score || 38}<span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px] font-semibold">
                    Level 1 • Learning
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
                  <p className="text-[10px] text-amber-400">Baseline calibrating</p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/20 border border-border/30 space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Order Density
                  </span>
                  <div className="text-base font-bold text-foreground font-mono">
                    {dataReadiness?.totalOrders ?? 0} / 80 Orders
                  </div>
                  <p className="text-[10px] text-amber-400">Building sample volume</p>
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
          {/* Forecasting KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="ios-glass rounded-2xl border-primary/20">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold">Projected 30D Revenue</span>
                <div className="text-2xl font-black text-primary">{formatCur(scenarioTotals.projected30DayRevenue)}</div>
                <span className="text-[11px] text-emerald-400 font-bold">Demand Multiplier: {scenarioTotals.demandMultiplier}x</span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold">Projected 30D Profit</span>
                <div className="text-2xl font-black text-foreground">{formatCur(scenarioTotals.projected30DayProfit)}</div>
                <span className="text-[11px] text-muted-foreground">Estimated gross profit</span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-rose-500/20">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold">Imminent Stockouts</span>
                <div className="text-2xl font-black text-rose-400">{scenarioTotals.criticalStockouts} SKUs</div>
                <span className="text-[11px] text-rose-400 font-bold">Action Required</span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-amber-500/20">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold">Excess Capital Risk</span>
                <div className="text-2xl font-black text-amber-400">{formatCur(forecastingReport.projectedExcessCapital)}</div>
                <span className="text-[11px] text-amber-400 font-bold">In Slow Inventory</span>
              </CardContent>
            </Card>
          </div>

          {/* Scenario Simulator */}
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-xs">Products & SKUs</span>
                    <span className="font-bold text-foreground text-xs">{productCount} / {productUsage.limit}</span>
                  </div>
                  <Progress value={productUsage.usagePercent} className="h-2" />
                </div>

                <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-xs">AI Copilot Queries</span>
                    <span className="font-bold text-foreground text-xs">{aiQueryCount} / {aiUsage.limit}</span>
                  </div>
                  <Progress value={aiUsage.usagePercent} className="h-2" />
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

      {/* ========================================================================= */}
      {/* TAB: CUSTOMER GROWTH & RETENTION INTELLIGENCE */}
      {/* ========================================================================= */}
      {activeTab === 'growth' && (
        <div className="space-y-6">
          {/* Top Scorecard Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="ios-glass rounded-2xl border-primary/20 col-span-2 md:col-span-1">
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold block">Growth Health Score</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground">{growthReport.growthHealthScore}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
                <Badge className="bg-primary/20 text-primary text-[10px] font-bold">
                  {growthReport.scoreCategory}
                </Badge>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Repeat Purchase Rate</span>
                <span className="text-xl font-black text-emerald-400 block">{growthReport.repeatPurchaseRatePercent}%</span>
                <span className="text-xs text-muted-foreground font-semibold block">
                  {transactions.length > 0 ? (growthReport.repeatRateChangePoints >= 0 ? `+${growthReport.repeatRateChangePoints} pts vs prior` : `${growthReport.repeatRateChangePoints} pts vs prior`) : 'Awaiting Sales Data'}
                </span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Average Order Value</span>
                <span className="text-xl font-black text-foreground block">{formatCur(growthReport.avgOrderValue)}</span>
                <span className="text-xs text-muted-foreground font-semibold block">
                  {transactions.length > 0 ? 'Per Transaction' : 'No Orders'}
                </span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">At-Risk Customers</span>
                <span className="text-xl font-black text-rose-400 block">{growthReport.atRiskCustomers.length}</span>
                <span className="text-xs text-rose-400/90 font-semibold block">
                  {transactions.length > 0 ? 'Exceeded Interval' : '0 Churn Alerts'}
                </span>
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs text-muted-foreground block font-semibold">Concentration Risk</span>
                <Badge
                  className={`text-[10px] font-bold uppercase mt-1 ${
                    growthReport.revenueConcentration.riskLevel === 'High'
                      ? 'bg-rose-500 text-white'
                      : growthReport.revenueConcentration.riskLevel === 'Medium'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {growthReport.revenueConcentration.riskLevel} Risk
                </Badge>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {transactions.length > 0 ? `Top 3 SKUs: ${growthReport.revenueConcentration.top3ProductsPercent}%` : 'Top 3 SKUs: 0%'}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Drivers & Bottlenecks Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="ios-glass rounded-2xl border-emerald-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Positive Revenue Expansion Drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {growthReport.positiveDrivers.length === 0 ? (
                  <p className="text-muted-foreground text-xs py-3 text-center">
                    No sales transactions recorded. Upload sales history to identify expansion drivers.
                  </p>
                ) : (
                  growthReport.positiveDrivers.map((d: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-emerald-200 leading-snug">{d}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Operational Growth Bottlenecks & Risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {growthReport.growthBottlenecks.map((b: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-amber-200 leading-snug">{b}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Centralized Scored Growth Opportunities Table */}
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" /> Centralized Growth Opportunity Engine
                </CardTitle>
                <CardDescription className="text-sm">
                  Scored growth recommendations with calculated revenue impact and confidence.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto scrollbar-none">
              <Table className="min-w-[850px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap w-[70px]">Score</TableHead>
                    <TableHead className="text-xs min-w-[260px]">Opportunity & Target</TableHead>
                    <TableHead className="text-xs whitespace-nowrap min-w-[150px]">Category</TableHead>
                    <TableHead className="text-xs whitespace-nowrap min-w-[120px]">Est. Rev Impact</TableHead>
                    <TableHead className="text-xs whitespace-nowrap min-w-[120px]">Est. Profit Impact</TableHead>
                    <TableHead className="text-xs whitespace-nowrap min-w-[100px]">Confidence</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right min-w-[140px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {growthReport.opportunities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-xs text-muted-foreground">
                        No active growth opportunities detected. Catalog operations are balanced.
                      </TableCell>
                    </TableRow>
                  ) : (
                    growthReport.opportunities.map((opp: any) => (
                      <TableRow key={opp.id} className="hover:bg-secondary/30 transition-colors">
                        <TableCell>
                          <span className="w-8 h-8 rounded-full bg-primary/20 text-primary font-black text-xs inline-flex items-center justify-center border border-primary/30">
                            {opp.opportunityScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-bold text-foreground text-xs block">{opp.title}</span>
                            <span className="text-[11px] text-muted-foreground block max-w-sm leading-relaxed">{opp.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap px-3 py-1">
                            {opp.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-emerald-400 text-xs">
                          +{formatCur(opp.expectedAdditionalRevenue)}
                        </TableCell>
                        <TableCell className="font-bold text-foreground text-xs">
                          +{formatCur(opp.expectedAdditionalProfit)}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-primary/10 text-primary text-[10px]">
                            {opp.confidence}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {opp.status === 'ACCEPTED' ? (
                              <Badge className="bg-emerald-500 text-white text-[10px]">Accepted</Badge>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] rounded-lg border-border/40"
                                  onClick={() => {
                                    setConfirmData({
                                      title: `Dismiss Growth Opportunity: ${opp.title}`,
                                      description: `Are you sure you want to dismiss this growth opportunity? This will remove it from your active queue.`,
                                      onConfirm: () => {
                                        saveOpportunityStatus(opp.id, 'DISMISSED');
                                        toast({ title: 'Opportunity Dismissed', description: 'Removed from priority queue.' });
                                      }
                                    });
                                  }}
                                >
                                  Dismiss
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-[11px] rounded-lg gap-1 bg-primary text-primary-foreground font-bold"
                                  onClick={() => {
                                    setConfirmData({
                                      title: `Execute Growth Opportunity: ${opp.title}`,
                                      description: `Are you sure you want to accept and execute this opportunity? This will open Copilot with recommendation: "${opp.recommendation}".`,
                                      onConfirm: () => {
                                        saveOpportunityStatus(opp.id, 'ACCEPTED');
                                        handleAskCopilot(`How should I execute this growth opportunity: ${opp.title}? ${opp.recommendation}`);
                                        toast({ title: '🚀 Executing Opportunity', description: 'Copilot opened with execution plan.' });
                                      }
                                    });
                                  }}
                                >
                                  Execute <ArrowRight className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cross-Sell & Repeat Purchase Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="ios-glass rounded-2xl border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-primary" /> Verified Cross-Sell Product Combinations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {growthReport.crossSellOpportunities.length === 0 ? (
                  <p className="text-muted-foreground text-xs py-4 text-center">
                    No co-occurrence patterns detected yet. Record more multi-item orders.
                  </p>
                ) : (
                  growthReport.crossSellOpportunities.map((cs: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">{cs.primaryProductName} + {cs.suggestedProductName}</span>
                        <span className="text-emerald-400 font-bold text-[11px]">+{formatCur(cs.potentialRevenueImpact)} Impact</span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{cs.recommendation}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="ios-glass rounded-2xl border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" /> At-Risk Customer Retention Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {growthReport.atRiskCustomers.length === 0 ? (
                  <p className="text-muted-foreground text-xs py-4 text-center">
                    Zero customer churn alerts. All repeat buyers are purchasing within normal intervals.
                  </p>
                ) : (
                  growthReport.atRiskCustomers.map((cust: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">{cust.name} ({cust.segmentLabel})</span>
                        <Badge className="bg-rose-500 text-white text-[10px]">{cust.recencyDays}d Inactive</Badge>
                      </div>
                      <p className="text-rose-200 text-[11px]">{cust.atRiskReason}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: AI STRATEGY & BUSINESS SIMULATION LAB */}
      {/* ========================================================================= */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          {products.length === 0 ? (
            <Card className="ios-glass rounded-3xl border-border/40 p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-inner">
                  <FlaskConical className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">AI Strategy & Business Simulation Lab</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No products found in workspace. Once you import your inventory or upload your 22-column CSV database, you can test price adjustments, bulk reorder ROI, and supplier switches before taking real action.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/dashboard/inventory">
                    <Button className="rounded-xl text-xs font-bold gap-2 bg-primary text-primary-foreground">
                      <Boxes className="w-4 h-4" /> Go to Inventory & Import Data
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Header & What-If Templates Quick Selector */}
              <Card className="ios-glass rounded-2xl border-primary/30">
                <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <FlaskConical className="w-5 h-5 text-primary" /> AI Strategy & Business Simulation Lab
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Test "What-If" business decisions before taking real action. Simulations carry zero risk and never mutate real data.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary font-bold w-fit">
                    Deterministic Engine • Read-Only
                  </Badge>
                </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Template Pills */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground block">Predefined What-If Templates:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={simType === 'PRICE_CHANGE' && simValue === 10 ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-xl gap-1.5 border-border/40"
                    onClick={() => {
                      setSimType('PRICE_CHANGE');
                      setSimValue(10);
                    }}
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Price Increase (+10%)
                  </Button>

                  <Button
                    size="sm"
                    variant={simType === 'DISCOUNT_PROMOTION' && simValue === 20 ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-xl gap-1.5 border-border/40"
                    onClick={() => {
                      setSimType('DISCOUNT_PROMOTION');
                      setSimValue(20);
                    }}
                  >
                    Clearance Discount (-20%)
                  </Button>

                  <Button
                    size="sm"
                    variant={simType === 'INVENTORY_PURCHASE' && simValue === 300 ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-xl gap-1.5 border-border/40"
                    onClick={() => {
                      setSimType('INVENTORY_PURCHASE');
                      setSimValue(300);
                    }}
                  >
                    <Boxes className="w-3.5 h-3.5" /> Bulk Order (300 Units)
                  </Button>

                  <Button
                    size="sm"
                    variant={simType === 'SUPPLIER_SWITCH' ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-xl gap-1.5 border-border/40"
                    onClick={() => {
                      setSimType('SUPPLIER_SWITCH');
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Switch Supplier
                  </Button>

                  <Button
                    size="sm"
                    variant={simType === 'DEMAND_CHANGE' && simValue === 20 ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-xl gap-1.5 border-border/40"
                    onClick={() => {
                      setSimType('DEMAND_CHANGE');
                      setSimValue(20);
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" /> Demand Surge (+20%)
                  </Button>
                </div>
              </div>

              {/* Simulation Builder Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/30">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Target Product SKU</Label>
                  <Select
                    value={simTargetProductId || products[0]?.id}
                    onValueChange={v => setSimTargetProductId(v)}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} ({formatCur(p.price)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Simulation Scenario Lever</Label>
                  <Select
                    value={simType}
                    onValueChange={(v: any) => setSimType(v)}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select Lever" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRICE_CHANGE" className="text-xs">Price Shift (% Change)</SelectItem>
                      <SelectItem value="DISCOUNT_PROMOTION" className="text-xs">Promotional Discount (%)</SelectItem>
                      <SelectItem value="INVENTORY_PURCHASE" className="text-xs">Bulk Restock (Order Units)</SelectItem>
                      <SelectItem value="SUPPLIER_SWITCH" className="text-xs">Supplier Alternative Switch</SelectItem>
                      <SelectItem value="DEMAND_CHANGE" className="text-xs">Demand Market Shift (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {simType !== 'SUPPLIER_SWITCH' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      {simType === 'INVENTORY_PURCHASE' ? 'Purchase Quantity (Units)' : 'Shift Percentage (%)'}
                    </Label>
                    <Input
                      type="number"
                      value={simValue}
                      onChange={e => setSimValue(Number(e.target.value))}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Side-by-Side Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BASELINE CARD */}
            <Card className="ios-glass rounded-2xl border-border/40">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-muted-foreground" /> Current Baseline State
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  ACTUAL DATA
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Product Price</span>
                  <span className="font-bold text-foreground">{formatCur(activeSimulation.baseline.productPrice)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Unit Cost</span>
                  <span className="font-bold text-foreground">{formatCur(activeSimulation.baseline.productCost)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Monthly Revenue</span>
                  <span className="font-bold text-foreground">{formatCur(activeSimulation.baseline.revenue)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Monthly Gross Profit</span>
                  <span className="font-bold text-foreground">{formatCur(activeSimulation.baseline.grossProfit)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Profit Margin</span>
                  <span className="font-bold text-foreground">{activeSimulation.baseline.profitMarginPercent}%</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground">Stock Coverage</span>
                  <span className="font-bold text-foreground">{activeSimulation.baseline.stock} units ({activeSimulation.baseline.daysOfStock} days)</span>
                </div>
              </CardContent>
            </Card>

            {/* SIMULATED CARD */}
            <Card className="ios-glass rounded-2xl border-primary/40 bg-primary/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Sparkles className="w-4 h-4 text-primary" /> Simulated Scenario Result
                </CardTitle>
                <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                  SIMULATED ESTIMATE
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Simulated Price</span>
                  <span className="font-bold text-primary">{formatCur(activeSimulation.simulated.newPrice || activeSimulation.baseline.productPrice)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Projected Monthly Revenue</span>
                  <span className="font-bold text-emerald-400">
                    {formatCur(activeSimulation.simulated.projectedRevenue)}
                    <span className="text-[10px] ml-1">
                      ({activeSimulation.simulated.projectedRevenue >= activeSimulation.baseline.revenue ? '+' : ''}
                      {formatCur(activeSimulation.simulated.projectedRevenue - activeSimulation.baseline.revenue)})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Projected Gross Profit</span>
                  <span className="font-bold text-foreground">
                    {formatCur(activeSimulation.simulated.projectedProfit)}
                    <span className="text-[10px] ml-1">
                      ({activeSimulation.simulated.projectedProfit >= activeSimulation.baseline.grossProfit ? '+' : ''}
                      {formatCur(activeSimulation.simulated.projectedProfit - activeSimulation.baseline.grossProfit)})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Margin Shift</span>
                  <span className="font-bold text-foreground">
                    {activeSimulation.simulated.marginChangePercentagePoints >= 0 ? '+' : ''}
                    {activeSimulation.simulated.marginChangePercentagePoints} pts
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Working Capital Required/Recovered</span>
                  <span className="font-bold text-amber-400">
                    {activeSimulation.simulated.capitalRequired > 0
                      ? `-${formatCur(activeSimulation.simulated.capitalRequired)} (Required)`
                      : activeSimulation.simulated.capitalRecovered > 0
                      ? `+${formatCur(activeSimulation.simulated.capitalRecovered)} (Recovered)`
                      : '₹0'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground">Projected Stock Runway</span>
                  <span className="font-bold text-foreground">
                    {activeSimulation.simulated.daysOfStockRemaining} days remaining
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Strategic Diagnostics & Action Bridge */}
          <Card className="ios-glass rounded-2xl border-border/50">
            <CardHeader className="pb-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" /> Strategic Diagnostics & Assumptions
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary text-xs font-bold">
                  Opp Score: {activeSimulation.opportunityScore}/100
                </Badge>
                <Badge variant="outline" className="text-xs font-bold">
                  Risk Score: {activeSimulation.riskScore}/100
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                  Confidence: {activeSimulation.confidence}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assumptions & Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border/30">
                  <span className="font-bold text-foreground block">Simulation Model Assumptions:</span>
                  {activeSimulation.assumptions.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                  <span className="font-bold text-amber-300 block">Identified Operational Risks:</span>
                  {activeSimulation.risks.map((r: any, i: number) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Strategic Recommendation Box */}
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-foreground block">AI Strategic Executive Summary</span>
                  <p className="text-muted-foreground leading-relaxed">{activeSimulation.recommendation}</p>
                </div>
              </div>

              {/* Action Bridge & Save Scenario Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Name this scenario (e.g. Q4 Price Increase)"
                    value={scenarioNameInput}
                    onChange={e => setScenarioNameInput(e.target.value)}
                    className="h-8 text-xs rounded-xl w-full sm:w-64"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs rounded-xl gap-1.5 shrink-0"
                    onClick={() => {
                      saveScenario(scenarioNameInput || activeSimulation.title, activeSimulation, { simType, simValue });
                      toast({ title: '💾 Scenario Saved', description: 'Scenario saved to historical strategic simulations.' });
                      setScenarioNameInput('');
                    }}
                  >
                    <Save className="w-3.5 h-3.5" /> Save Scenario
                  </Button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs rounded-xl gap-1.5"
                    onClick={() => {
                      handleAskCopilot(`Explain the simulation results for: ${activeSimulation.title}`);
                    }}
                  >
                    <Bot className="w-3.5 h-3.5 text-primary" /> Ask Copilot
                  </Button>

                  {activeSimulation.suggestedActionPayload?.actionType === 'create_po' && (
                    <Button
                      size="sm"
                      className="h-8 text-xs rounded-xl gap-1.5 bg-primary text-primary-foreground font-bold"
                      onClick={() => {
                        setSelectedReorderProductId(activeSimulation.suggestedActionPayload?.targetId);
                        setReorderModalOpen(true);
                      }}
                    >
                      <Boxes className="w-3.5 h-3.5" /> Create Purchase Order
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saved Scenarios History */}
          <Card className="ios-glass rounded-2xl border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-primary" /> Saved Strategic Simulations ({savedScenarios.length})
              </CardTitle>
            </CardHeader>
            <CardContent className={savedScenarios.length === 0 ? "p-6" : "p-0 overflow-x-auto scrollbar-none"}>
              {savedScenarios.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No saved scenarios yet. Use the simulation controls above and click "Save Scenario" to store decisions.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Scenario Name</TableHead>
                      <TableHead className="text-xs">Target SKU</TableHead>
                      <TableHead className="text-xs">Opp Score</TableHead>
                      <TableHead className="text-xs">Confidence</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedScenarios.map(sc => (
                      <TableRow key={sc.id} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="text-xs text-muted-foreground">{sc.createdDate}</TableCell>
                        <TableCell className="font-bold text-foreground text-xs">{sc.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{sc.targetEntityName}</TableCell>
                        <TableCell>
                          <Badge className="bg-primary/20 text-primary text-[10px]">
                            {sc.result.opportunityScore}/100
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {sc.result.confidence}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] rounded-lg"
                              onClick={() => {
                                setSimType(sc.type);
                                if (sc.inputs?.simValue) setSimValue(sc.inputs.simValue);
                                toast({ title: 'Scenario Loaded', description: `Loaded parameters for ${sc.name}` });
                              }}
                            >
                              Load
                            </Button>
                            <Button
                               size="sm"
                               variant="ghost"
                               className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                               onClick={() => {
                                 setConfirmData({
                                   title: `Delete Saved Scenario: ${sc.name}`,
                                   description: `Are you sure you want to permanently delete this saved simulation scenario? This action cannot be undone.`,
                                   onConfirm: () => {
                                     deleteSavedScenario(sc.id);
                                     toast({ title: 'Deleted Scenario', description: 'Removed from saved simulations.' });
                                   }
                                 });
                               }}
                             >
                               <Trash2 className="w-3.5 h-3.5" />
                             </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
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
