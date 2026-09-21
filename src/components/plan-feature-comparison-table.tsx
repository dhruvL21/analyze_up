'use client';

import React from 'react';
import {
  Check,
  Sparkles,
  Zap,
  ArrowRight,
  Database,
  BarChart3,
  Boxes,
  Network,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PLAN_CONFIGS,
  PLAN_FEATURE_CATEGORIES,
  PlanType,
  ORDERED_PLANS,
} from '@/lib/saas-engine';

interface PlanFeatureComparisonTableProps {
  billingCycle: 'monthly' | 'annual';
  currencySymbol?: string;
  currentPlanKey: PlanType;
  appliedCoupon: string | null;
  onSelectUpgrade: (key: PlanType) => void;
  isProcessingPayment?: string | null;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  '1. DATA & USAGE': <Database className="w-4 h-4 text-primary" />,
  '2. BUSINESS INTELLIGENCE': <BarChart3 className="w-4 h-4 text-emerald-400" />,
  '3. FORECASTING & AI': <Sparkles className="w-4 h-4 text-amber-400" />,
  '4. SUPPLIER & OPERATIONS': <Boxes className="w-4 h-4 text-blue-400" />,
  '5. INTEGRATIONS': <Network className="w-4 h-4 text-purple-400" />,
  '6. TEAM & SUPPORT': <Users className="w-4 h-4 text-pink-400" />,
};

export default function PlanFeatureComparisonTable({
  billingCycle,
  currencySymbol = '₹',
  currentPlanKey,
  appliedCoupon,
  onSelectUpgrade,
  isProcessingPayment = null,
}: PlanFeatureComparisonTableProps) {
  const isAnnual = billingCycle === 'annual';

  const renderCellContent = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      if (value) {
        return (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-sm">
              <Check className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center">
          <span className="text-muted-foreground/40 font-bold text-base select-none">—</span>
        </div>
      );
    }

    return (
      <span className="text-xs font-semibold text-foreground/90 font-mono tracking-tight">
        {value}
      </span>
    );
  };

  const getPriceDisplay = (key: PlanType) => {
    const plan = PLAN_CONFIGS[key];
    const isPro = key === 'PRO';

    if (appliedCoupon && isPro) {
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span className="text-sm line-through text-muted-foreground/60 font-mono">
              ₹{isAnnual ? plan.priceYearly.toLocaleString('en-IN') : plan.priceMonthly.toLocaleString('en-IN')}
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono">FREE</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-400">(Promo Pass)</span>
        </div>
      );
    }

    if (plan.priceMonthly === 0) {
      return (
        <div className="flex flex-col items-center">
          <span className="text-lg font-black text-foreground font-mono">₹0</span>
          <span className="text-[10px] text-muted-foreground">Permanent Free</span>
        </div>
      );
    }

    if (isAnnual) {
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-foreground font-mono">
              ₹{plan.priceYearly.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-muted-foreground">/year</span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400">Save ~2 months</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black text-foreground font-mono">
            ₹{plan.priceMonthly.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-muted-foreground">/month</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Billed monthly</span>
      </div>
    );
  };

  const getCtaLabel = (key: PlanType) => {
    const isCurrent = key === currentPlanKey;
    const isPro = key === 'PRO';

    if (isCurrent) {
      return appliedCoupon && isPro ? 'Current Plan (Free Pass)' : 'Current Plan';
    }

    if (key === 'FREE') {
      return 'Start Free';
    }

    if (appliedCoupon && isPro) {
      return 'Activate Scale (Free)';
    }

    return `Upgrade to ${PLAN_CONFIGS[key].name}`;
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-zinc-950/80 shadow-2xl overflow-hidden backdrop-blur-xl">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border/50">
        <table className="w-full border-collapse text-left min-w-[760px]">
          {/* Table Header: Plan Titles, Pricing & CTAs */}
          <thead>
            <tr className="border-b border-border/60 bg-secondary/20">
              <th className="p-4 sm:p-5 w-[28%] sticky left-0 z-20 bg-zinc-950/95 backdrop-blur border-r border-border/50">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Full Feature Matrix
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-foreground">
                    Compare All Capabilities
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Detailed feature limits across all AnalyzeUp tiers.
                  </p>
                </div>
              </th>

              {ORDERED_PLANS.map((key) => {
                const plan = PLAN_CONFIGS[key];
                const isGrowth = key === 'GROWTH';
                const isPro = key === 'PRO';
                const isCurrent = key === currentPlanKey;

                return (
                  <th
                    key={key}
                    className={`p-4 text-center align-top w-[18%] transition-colors ${
                      isGrowth
                        ? 'bg-amber-500/[0.06] border-x border-amber-500/30'
                        : isPro && appliedCoupon
                        ? 'bg-emerald-500/[0.04] border-x border-emerald-500/30'
                        : 'border-r border-border/40 last:border-r-0'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-between h-full min-h-[160px] gap-2">
                      {/* Row 1: Fixed Height Badge Slot (24px) for perfect vertical alignment */}
                      <div className="h-6 w-full flex items-center justify-center">
                        {isGrowth ? (
                          <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 shadow-sm">
                            <Zap className="w-2.5 h-2.5 mr-0.5 fill-current" /> MOST POPULAR
                          </Badge>
                        ) : isPro && appliedCoupon ? (
                          <Badge className="bg-emerald-500 text-zinc-950 text-[9px] font-extrabold uppercase px-2 py-0.5">
                            ✓ Promo Pass Active
                          </Badge>
                        ) : null}
                      </div>

                      {/* Row 2: Fixed Height Plan Title (24px) */}
                      <div className="h-6 w-full flex items-center justify-center">
                        <h4 className="text-base font-black text-foreground tracking-tight">
                          {plan.name}
                        </h4>
                      </div>

                      {/* Row 3: Fixed Height Pricing Block (56px) */}
                      <div className="h-14 w-full flex flex-col items-center justify-center">
                        {getPriceDisplay(key)}
                      </div>

                      {/* Row 4: Top Action Button Slot (Aligned on the same line) */}
                      <div className="w-full flex items-center justify-center pt-1">
                        <Button
                          size="sm"
                          disabled={isCurrent || isProcessingPayment !== null}
                          onClick={() => onSelectUpgrade(key)}
                          className={`w-full max-w-[145px] h-8 text-[11px] font-bold rounded-xl transition-all ${
                            isCurrent
                              ? 'bg-secondary text-muted-foreground cursor-default'
                              : isPro && appliedCoupon
                              ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 text-zinc-950 font-black shadow-md shadow-emerald-500/20 hover:scale-[1.02]'
                              : isGrowth
                              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 font-extrabold shadow-md shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02]'
                              : 'bg-card hover:bg-secondary text-foreground border border-border/80 hover:border-primary/60 shadow-sm hover:scale-[1.02]'
                          }`}
                        >
                          {getCtaLabel(key)}
                        </Button>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body: 6 Structured Categories */}
          <tbody>
            {PLAN_FEATURE_CATEGORIES.map((group) => (
              <React.Fragment key={group.category}>
                {/* Category Header Row */}
                <tr className="border-t-2 border-b border-border/70 bg-secondary/40">
                  <td
                    colSpan={5}
                    className="py-2.5 px-4 sm:px-5 font-black text-xs uppercase tracking-wider text-foreground sticky left-0 z-20 bg-zinc-900/90 backdrop-blur"
                  >
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[group.category] || <BarChart3 className="w-4 h-4 text-primary" />}
                      <span>{group.category}</span>
                    </div>
                  </td>
                </tr>

                {/* Category Rows */}
                {group.rows.map((row, rowIdx) => (
                  <tr
                    key={row.name}
                    className={`border-b border-border/30 hover:bg-secondary/15 transition-colors ${
                      rowIdx % 2 === 0 ? 'bg-background/40' : 'bg-transparent'
                    }`}
                  >
                    {/* Feature Name */}
                    <td className="py-3 px-4 sm:px-5 text-xs font-medium text-foreground/90 sticky left-0 z-20 bg-zinc-950/95 backdrop-blur border-r border-border/40">
                      {row.name}
                    </td>

                    {/* Free */}
                    <td className="py-3 px-4 text-center border-r border-border/30">
                      {renderCellContent(row.free)}
                    </td>

                    {/* Founder */}
                    <td className="py-3 px-4 text-center border-r border-border/30">
                      {renderCellContent(row.founder)}
                    </td>

                    {/* Growth (Highlighted Column) */}
                    <td className="py-3 px-4 text-center bg-amber-500/[0.04] border-x border-amber-500/25">
                      {renderCellContent(row.growth)}
                    </td>

                    {/* Scale */}
                    <td
                      className={`py-3 px-4 text-center ${
                        appliedCoupon ? 'bg-emerald-500/[0.03]' : ''
                      }`}
                    >
                      {renderCellContent(row.scale)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}

            {/* Bottom Summary & Actions Row */}
            <tr className="border-t-2 border-border/60 bg-secondary/30">
              <td className="p-4 sm:p-5 sticky left-0 z-20 bg-zinc-950/95 backdrop-blur border-r border-border/50">
                <span className="text-xs font-bold text-foreground">Select Your Workspace Plan</span>
              </td>
              {ORDERED_PLANS.map((key) => {
                const isGrowth = key === 'GROWTH';
                const isPro = key === 'PRO';
                const isCurrent = key === currentPlanKey;

                return (
                  <td
                    key={key}
                    className={`p-3 text-center ${
                      isGrowth
                        ? 'bg-amber-500/[0.06] border-x border-amber-500/30'
                        : isPro && appliedCoupon
                        ? 'bg-emerald-500/[0.04] border-x border-emerald-500/30'
                        : 'border-r border-border/40 last:border-r-0'
                    }`}
                  >
                    <Button
                      size="sm"
                      disabled={isCurrent || isProcessingPayment !== null}
                      onClick={() => onSelectUpgrade(key)}
                      className={`w-full max-w-[140px] h-7 text-[10px] font-bold rounded-xl transition-all ${
                        isCurrent
                          ? 'bg-secondary text-muted-foreground cursor-default'
                          : isPro && appliedCoupon
                          ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 text-zinc-950 font-black shadow-md shadow-emerald-500/20'
                          : isGrowth
                          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 font-extrabold shadow-md shadow-amber-500/20'
                          : 'bg-card hover:bg-secondary text-foreground border border-border/80 hover:border-primary/60'
                      }`}
                    >
                      {getCtaLabel(key)}
                    </Button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
