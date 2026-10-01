'use client';

import React from 'react';
import { Check, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlanConfig, PlanType } from '@/lib/saas-engine';

interface PricingPlanCardProps {
  planKey: PlanType;
  plan: PlanConfig;
  isCurrent: boolean;
  billingCycle: 'monthly' | 'annual';
  appliedCoupon?: string | null;
  isProcessing?: boolean;
  onSelect: (key: PlanType) => void;
}

const PLAN_SHORT_DESCRIPTIONS: Record<string, string> = {
  FREE: 'Essential inventory tracking & health metrics for early-stage shops.',
  STARTER: 'Automate stock reorders & Shopify sync for solo business owners.',
  FOUNDER: 'Automate stock reorders & Shopify sync for solo business owners.',
  GROWTH: 'Full forecasting, team collaboration & automated AI action center.',
  PRO: 'Multi-store operations, 180-day forecasts & executive intelligence.',
  SCALE: 'Multi-store operations, 180-day forecasts & executive intelligence.',
};

export function PricingPlanCard({
  planKey,
  plan,
  isCurrent,
  billingCycle,
  appliedCoupon = null,
  isProcessing = false,
  onSelect,
}: PricingPlanCardProps) {
  const isFree = planKey === 'FREE';
  const isGrowth = planKey === 'GROWTH';
  const isPro = planKey === 'PRO' || planKey === 'SCALE';
  const isAnnual = billingCycle === 'annual';

  const isFreePromoActive = isPro && appliedCoupon;

  const displayPrice = isFree
    ? '₹0'
    : isFreePromoActive
    ? 'FREE'
    : isAnnual
    ? `₹${plan.priceYearly.toLocaleString('en-IN')}`
    : `₹${plan.priceMonthly.toLocaleString('en-IN')}`;

  const pricePeriod = isFree
    ? '/month'
    : isFreePromoActive
    ? ''
    : isAnnual
    ? '/year'
    : '/month';

  const priceSubtext = isFree
    ? 'Free forever, no card needed'
    : isFreePromoActive
    ? '100% Free Access with Promo Code'
    : isAnnual
    ? 'Save ~2 months with yearly billing'
    : 'Billed monthly, cancel anytime';

  // Button label determination
  let ctaLabel = plan.ctaText || `Upgrade to ${plan.name}`;
  if (isCurrent) {
    ctaLabel = isFreePromoActive ? 'Current Plan (Free Pass)' : 'Current Plan';
  } else if (isFreePromoActive) {
    ctaLabel = 'Activate Scale (Free)';
  }

  const shortDesc = PLAN_SHORT_DESCRIPTIONS[planKey] || plan.description;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl p-5 sm:p-6 transition-all duration-300 border h-full ${
        isGrowth
          ? 'border-border/80 bg-secondary/30 shadow-lg ring-1 ring-white/10'
          : isCurrent
          ? 'border-border/50 bg-secondary/20 shadow-md'
          : isFreePromoActive
          ? 'border-emerald-500/30 bg-secondary/25'
          : 'border-border/40 bg-secondary/15 hover:border-border/70 shadow-sm'
      }`}
    >
      {/* Most Popular Badge for Growth */}
      {isGrowth && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="px-3 py-0.5 rounded-full bg-secondary border border-border/80 text-foreground text-[10px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-1 whitespace-nowrap">
            MOST POPULAR
          </span>
        </div>
      )}

      {/* Top Section */}
      <div className="space-y-4">
        {/* Header: Name, Tagline & Short Description */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {plan.name}
            </h3>
            {isCurrent && (
              <Badge className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-bold px-1.5 py-0.5">
                Active
              </Badge>
            )}
          </div>
          {plan.tagline && (
            <p className="text-xs text-zinc-400 mt-1 font-semibold">
              {plan.tagline}
            </p>
          )}
          <p className="text-[11px] text-zinc-400/90 mt-1 leading-relaxed min-h-[32px]">
            {shortDesc}
          </p>
        </div>

        {/* Pricing Block with Original Price Strikethrough on Promo */}
        <div className="pt-1 pb-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {isFreePromoActive && (
              <span className="text-sm line-through text-zinc-500 font-mono">
                ₹{(isAnnual ? plan.priceYearly : plan.priceMonthly).toLocaleString('en-IN')}
              </span>
            )}
            <span
              className={`text-3xl font-black tracking-tight font-mono ${
                isFreePromoActive ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {displayPrice}
            </span>
            {pricePeriod && (
              <span className="text-xs text-zinc-400 font-normal">
                {pricePeriod}
              </span>
            )}
            {isFreePromoActive && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                Promo Pass
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 font-normal">
            {priceSubtext}
          </p>
        </div>

        {/* Subtle Divider */}
        <div className="border-t border-zinc-800/80 my-2" />

        {/* Features Checklist */}
        <div>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
            What's included:
          </p>
          <ul className="space-y-2">
            {plan.features.map((feat, idx) => (
              <li key={`${planKey}-feat-${idx}`} className="flex items-start gap-2">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    isCurrent
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'bg-zinc-800/60 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span className="text-xs text-zinc-200 font-medium leading-snug">
                  {feat}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA Button */}
      <div className="pt-6 mt-6 border-t border-zinc-800/40">
        <Button
          onClick={() => onSelect(planKey)}
          disabled={isCurrent || isProcessing}
          className={`w-full rounded-xl h-10 text-xs font-semibold transition-all duration-200 ${
            isCurrent
              ? 'bg-secondary/40 text-muted-foreground border border-border/40 cursor-default hover:bg-secondary/40'
              : isFreePromoActive
              ? 'bg-foreground text-background font-bold hover:opacity-90 shadow-sm'
              : isGrowth
              ? 'bg-foreground text-background font-bold hover:opacity-90 shadow-sm'
              : 'bg-secondary/60 hover:bg-secondary text-foreground border border-border/60 shadow-sm hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Processing...
            </>
          ) : isCurrent ? (
            ctaLabel
          ) : isFreePromoActive ? (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1 text-zinc-950" />
              {ctaLabel}
            </>
          ) : (
            ctaLabel
          )}
        </Button>
      </div>
    </div>
  );
}
