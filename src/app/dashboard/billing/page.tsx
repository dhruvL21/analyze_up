'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Zap,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Building2,
  Lock,
  Boxes,
  Users,
  FileText,
  Receipt,
  Download,
  Check,
  Ticket,
  Tag,
  Loader2,
} from 'lucide-react';
import {
  PLAN_CONFIGS,
  PlanType,
  ORDERED_PLANS,
  checkUsageLimit,
  getStoredWorkspaceMembers,
} from '@/lib/saas-engine';
import PlanFeatureComparisonTable from '@/components/plan-feature-comparison-table';
import { PricingPlanCard } from '@/components/pricing-plan-card';
import { FindMyPlanModal } from '@/components/find-my-plan-modal';
import { AskPricingAiModal } from '@/components/ask-pricing-ai-modal';
import { PricingAssistanceCta } from '@/components/pricing-assistance-cta';
import { PricingFaq } from '@/components/pricing-faq';
import { getStoredReportSnapshots } from '@/lib/executive-intelligence-engine';

import { useUser } from '@/firebase';

export default function BillingPage() {
  const { user } = useUser();
  const {
    products,
    activePlan,
    handleUpgrade,
    isProcessingPayment,
    businessProfile,
    aiQueryCount,
    reportCount,
    updateActivePlan,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const [couponInput, setCouponInput] = useState<string>('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'comparison'>('cards');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isFindMyPlanOpen, setIsFindMyPlanOpen] = useState<boolean>(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState<boolean>(false);

  const resolvedPlanKey: PlanType = React.useMemo(() => {
    if (activePlan === 'Scale' || activePlan === 'SCALE' || activePlan === 'Enterprise Pro' || activePlan === 'Pro Plan' || activePlan === 'PRO') return 'PRO';
    if (activePlan === 'Growth' || activePlan === 'Growth Plan' || activePlan === 'GROWTH') return 'GROWTH';
    if (activePlan === 'Founder' || activePlan === 'FOUNDER' || activePlan === 'Starter Plan' || activePlan === 'STARTER') return 'STARTER';
    return 'FREE';
  }, [activePlan]);

  const [currentPlanKey, setCurrentPlanKey] = useState<PlanType>(resolvedPlanKey);
  const [teamMemberCount, setTeamMemberCount] = useState<number>(1);

  React.useEffect(() => {
    setCurrentPlanKey(resolvedPlanKey);
  }, [resolvedPlanKey]);

  React.useEffect(() => {
    setTeamMemberCount(getStoredWorkspaceMembers(user ? { uid: user.uid, email: user.email || '', displayName: user.displayName || '' } : undefined).length);
  }, [user]);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Live Usage Counts from actual workspace data
  const productCount = products.length;
  const currentAiQueryCount = aiQueryCount;
  const currentReportCount = reportCount;

  const productUsage = checkUsageLimit(currentPlanKey, 'products', productCount);
  const aiUsage = checkUsageLimit(currentPlanKey, 'aiQueries', currentAiQueryCount);
  const reportUsage = checkUsageLimit(currentPlanKey, 'reports', currentReportCount);
  const teamUsage = checkUsageLimit(currentPlanKey, 'teamMembers', teamMemberCount);

  const nextBillingDate = React.useMemo(() => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 30);
    return nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const targetCode = (codeToApply || couponInput).trim();
    if (!targetCode) {
      setCouponError('Please enter a promo code.');
      return;
    }
    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const res = await applyCoupon(targetCode);
      if (res.success) {
        setCouponInput('');
        setCurrentPlanKey('PRO');
        toast({
          title: '🎉 Promo Code Applied!',
          description: `${res.message} You now have 100% free access to Enterprise Pro.`,
        });
      } else {
        setCouponError(res.message);
        toast({
          title: 'Promo Code Invalid',
          description: res.message,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      setCouponError(e.message || 'Failed to apply promo code.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    setCurrentPlanKey('FREE');
    toast({
      title: 'Promo Code Removed',
      description: 'Workspace returned to baseline tier.',
    });
  };

  const handleSelectUpgrade = async (planKey: PlanType) => {
    if (planKey === currentPlanKey && !appliedCoupon) return;
    const plan = PLAN_CONFIGS[planKey];

    // If coupon is active and selecting Scale, activate without payment
    if (appliedCoupon && (planKey === 'PRO' || planKey === 'SCALE')) {
      await updateActivePlan(plan.name);
      setCurrentPlanKey('PRO');
      toast({
        title: `🎉 Scale Activated`,
        description: `Full Scale capabilities unlocked 100% free with promo code ${appliedCoupon}.`,
      });
      return;
    }
    if (planKey === 'FREE') {
      await updateActivePlan(plan.name);
      setCurrentPlanKey('FREE');
      toast({
        title: `Free Plan Active`,
        description: `Workspace active on baseline Free tier.`,
      });
      return;
    }

    try {
      const isAnnual = billingCycle === 'annual';
      const amount = isAnnual ? plan.priceYearly : plan.priceMonthly;
      const planId = `${planKey.toLowerCase()}_${billingCycle}`;
      await handleUpgrade(planId, amount, plan.name);
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

  const handleDownloadReceipt = (invoiceId: string) => {
    toast({
      title: '📄 Invoice Downloaded',
      description: `Receipt for ${invoiceId} has been exported as PDF.`,
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-36 max-w-7xl mx-auto w-full px-1 sm:px-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight md:text-2xl flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" /> Workspace Pricing & Plans
            </h1>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-extrabold uppercase">
              {currentPlanKey === 'FREE' ? 'Free Tier Active' : 'Active Subscription'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your workspace subscription tier, feature entitlements, live usage limits, and Razorpay billing records.
          </p>
        </div>
      </div>

      {/* 1. Subscription Overview & Live Usage Meters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="ios-glass rounded-2xl border-primary/20 bg-primary/5 lg:col-span-1 flex flex-col justify-between">
          <CardHeader className="pb-3 space-y-1.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Active Workspace Plan</span>
            <CardTitle className="text-xl font-black text-foreground flex items-center justify-between">
              <span>{PLAN_CONFIGS[currentPlanKey].name}</span>
              <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                {currentPlanKey}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {appliedCoupon
                ? `Promo Code Active: ${appliedCoupon} (100% Free Access)`
                : currentPlanKey === 'FREE'
                ? 'Permanent Free Tier • Upgrade anytime for expanded capacity'
                : `Billing Period: Auto-Renews on ${nextBillingDate}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-background/70 border border-border/40 space-y-1">
              <span className="text-muted-foreground block text-[11px] font-medium">Monthly Price</span>
              <span className="text-2xl font-black text-foreground block">
                {appliedCoupon ? (
                  <span className="text-emerald-400 flex items-center gap-2">
                    <span>₹0 / Free</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 font-bold">
                      100% OFF
                    </span>
                  </span>
                ) : currentPlanKey === 'FREE'
                  ? '₹0'
                  : currencySymbol === '$'
                  ? `$${PLAN_CONFIGS[currentPlanKey].priceMonthlyUSD}/mo`
                  : `₹${PLAN_CONFIGS[currentPlanKey].priceMonthly.toLocaleString('en-IN')}/mo`}
              </span>
            </div>

            <div className="space-y-2 text-muted-foreground text-[11px] pt-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{appliedCoupon ? `Promo Code Verified (${appliedCoupon})` : 'Razorpay 256-bit Encrypted Checkout'}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>Isolated Multi-Tenant Security Guarantee</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Progress Meters */}
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
                  {reportCount} / {reportUsage.limit}
                </span>
              </div>
              <Progress value={reportUsage.usagePercent} className="h-2" />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{reportUsage.usagePercent}% used</span>
                <span>{Math.max(0, reportUsage.limit - reportCount)} remaining</span>
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

      {/* 2. Interactive Plan Comparison Matrix & Coupon Code Bar */}
      <div className="space-y-4 pt-2">
        {/* Promo Code Redemption Bar */}
        <Card className="rounded-2xl border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-emerald-950/30 p-4 sm:p-5 relative overflow-hidden shadow-lg shadow-emerald-950/20">
          <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                {appliedCoupon ? (
                  <Badge className="bg-emerald-500 text-zinc-950 font-extrabold text-[10px] px-2 py-0.5">
                    ✓ Promo Code Active: {appliedCoupon} (100% Free)
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold text-[10px] px-2 py-0.5">
                    Scale Exclusive
                  </Badge>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-400" />
                {appliedCoupon
                  ? "Promo Code Active • Scale Unlocked"
                  : "Have a promo code?"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {appliedCoupon
                  ? `Promo code "${appliedCoupon}" is active. Full Scale capabilities, AI Copilot, and 50,000 product limits are unlocked with zero charge.`
                  : "Enter your promo code below to unlock the Scale plan 100% free."}
              </p>
            </div>

            {/* Input & Action */}
            <div className="shrink-0 flex items-center gap-2">
              {appliedCoupon ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Free Pass Active (₹0/mo)</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveCoupon}
                    className="h-9 text-xs rounded-xl border-border/60 hover:border-destructive/60 hover:text-destructive hover:bg-destructive/10"
                  >
                    Remove Code
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <div className="relative">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyCoupon();
                        }
                      }}
                      placeholder="Enter promo code"
                      className="h-9 px-3 py-1.5 rounded-xl bg-background/80 border border-border/80 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 text-xs font-mono font-bold uppercase placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground w-full sm:w-56"
                    />
                  </div>
                  <Button
                    onClick={() => handleApplyCoupon()}
                    disabled={isApplyingCoupon || !couponInput.trim()}
                    className="h-9 px-4 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                  >
                    {isApplyingCoupon ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Apply Code
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {couponError && (
            <p className="text-[11px] text-destructive font-medium mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {couponError}
            </p>
          )}
        </Card>

        {/* 2. Header & Controls: [ Plans ] [ Compare Features ] and [ Monthly ] [ Yearly ] */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              Compare Plans & Upgrade Entitlements
            </h3>
            <p className="text-xs text-muted-foreground">
              {appliedCoupon
                ? "Promo pass active. Full Scale capabilities are unlocked."
                : "Choose the perfect workspace plan to power your business growth."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Mode Toggle: [ Plans ] [ Compare Features ] */}
            <div className="flex items-center p-1 rounded-2xl bg-secondary/50 border border-border/60 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-card text-foreground shadow-md border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Plans
              </button>
              <button
                type="button"
                onClick={() => setViewMode('comparison')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'comparison'
                    ? 'bg-card text-foreground shadow-md border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Compare Features
              </button>
            </div>

            {/* Monthly / Yearly Billing Toggle */}
            <div className="flex items-center p-1 rounded-2xl bg-secondary/50 border border-border/60 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-card text-foreground shadow-md border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-card text-foreground shadow-md border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Yearly</span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                  Save ~2 months
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. Plan View: Either 4 Cards Grid or Full Comparison Table */}
        {viewMode === 'cards' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {ORDERED_PLANS.map((key) => {
                const plan = PLAN_CONFIGS[key];
                const isCurrent = key === currentPlanKey;
                const isProcessing = Boolean(isProcessingPayment);

                return (
                  <PricingPlanCard
                    key={`billing-card-${key}`}
                    planKey={key}
                    plan={plan}
                    isCurrent={isCurrent}
                    billingCycle={billingCycle}
                    appliedCoupon={appliedCoupon}
                    isProcessing={isProcessing}
                    onSelect={(k) => handleSelectUpgrade(k)}
                  />
                );
              })}
            </div>

            {/* "Which plan is right for you?" CTA Section */}
            <PricingAssistanceCta
              onOpenFindMyPlan={() => setIsFindMyPlanOpen(true)}
              onOpenAskAi={() => setIsAskAiOpen(true)}
              onCompareFeaturesClick={() => setViewMode('comparison')}
            />

            {/* Frequently Asked Questions */}
            <PricingFaq />
          </div>
        ) : (
          <div className="space-y-6">
            <div id="feature-comparison" className="space-y-3 pt-2">
              <PlanFeatureComparisonTable
                billingCycle={billingCycle}
                currencySymbol={currencySymbol}
                currentPlanKey={currentPlanKey}
                appliedCoupon={appliedCoupon}
                onSelectUpgrade={handleSelectUpgrade}
                isProcessingPayment={isProcessingPayment}
              />
            </div>

            {/* Frequently Asked Questions */}
            <PricingFaq />
          </div>
        )}
      </div>

      {/* 3. Razorpay Payment & Invoice History */}
      <Card className="ios-glass rounded-2xl border-border/50 overflow-hidden mb-6">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Billing & Invoice History
            </CardTitle>
            <CardDescription className="text-xs">
              Past payment transactions and subscription receipts processed securely.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] w-fit text-muted-foreground border-border/40">
            {appliedCoupon ? 'Promo Pass Verified' : 'PCI-DSS Compliant'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {currentPlanKey === 'FREE' && !appliedCoupon ? (
            <div className="p-8 text-center space-y-2">
              <Receipt className="w-8 h-8 text-muted-foreground/50 mx-auto" />
              <p className="text-xs font-semibold text-foreground">No Billing Transactions</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                You are currently on the Free Trial tier. Invoices will automatically appear here once an upgrade or coupon is processed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-xs font-semibold pl-5">Invoice #</TableHead>
                    <TableHead className="text-xs font-semibold">Plan</TableHead>
                    <TableHead className="text-xs font-semibold">Billing Date</TableHead>
                    <TableHead className="text-xs font-semibold">Gateway / Coupon</TableHead>
                    <TableHead className="text-xs font-semibold">Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right pr-8">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-secondary/30 transition-colors border-border/30">
                    <TableCell className="text-xs font-bold text-foreground pl-5">
                      {appliedCoupon
                        ? `#INV-PROMO-${new Date().getFullYear()}`
                        : `#INV-2026-${(currentPlanKey.charCodeAt(0) * 117).toString().padStart(4, '0')}`}
                    </TableCell>
                    <TableCell className="text-xs text-foreground font-medium">
                      {PLAN_CONFIGS[currentPlanKey].name} {appliedCoupon ? '(Promo Pass)' : '(Monthly)'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {appliedCoupon ? `Promo: ${appliedCoupon}` : 'Razorpay Secured'}
                    </TableCell>
                    <TableCell className="text-xs font-black text-foreground">
                      {appliedCoupon ? (
                        <span className="text-emerald-400">₹0 (100% Free)</span>
                      ) : currencySymbol === '$' ? (
                        `$${PLAN_CONFIGS[currentPlanKey].priceMonthlyUSD}`
                      ) : (
                        `₹${PLAN_CONFIGS[currentPlanKey].priceMonthly.toLocaleString('en-IN')}`
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                        {appliedCoupon ? 'Active Free Pass' : 'Paid & Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadReceipt(appliedCoupon ? `#INV-PROMO-2026` : `#INV-2026-8821`)}
                        className="h-7 text-xs rounded-lg gap-1.5 text-primary hover:bg-primary/10"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Plan Selection Assistance Modals */}
      <FindMyPlanModal
        isOpen={isFindMyPlanOpen}
        onClose={() => setIsFindMyPlanOpen(false)}
        onSelectPlan={(planKey) => handleSelectUpgrade(planKey)}
        onViewComparison={() => {
          const el = document.getElementById('feature-comparison');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      <AskPricingAiModal
        isOpen={isAskAiOpen}
        onClose={() => setIsAskAiOpen(false)}
        onSelectPlan={(planKey) => handleSelectUpgrade(planKey)}
        onViewComparison={() => {
          const el = document.getElementById('feature-comparison');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />
    </div>
  );
}
