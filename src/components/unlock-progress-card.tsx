'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Clock, ShoppingBag, ArrowRight, Sparkles, AlertCircle, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface UnlockProgressCardProps {
  title?: string;
  description?: string;
  currentOrders?: number;
  targetOrders?: number;
  currentDays?: number;
  targetDays?: number;
  currentScore?: number;
  targetScore?: number;
  mode?: 'card' | 'compact' | 'banner';
  accentColor?: 'amber' | 'blue' | 'emerald' | 'purple';
  featureName?: string;
  className?: string;
}

export function UnlockProgressCard({
  title,
  description,
  currentOrders = 0,
  targetOrders = 50,
  currentDays,
  targetDays,
  currentScore,
  targetScore,
  mode = 'compact',
  accentColor = 'amber',
  featureName = 'this section',
  className,
}: UnlockProgressCardProps) {
  const safeOrders = Math.max(0, currentOrders);
  const ordersPercent = Math.min(100, Math.round((safeOrders / Math.max(1, targetOrders)) * 100));
  const remainingOrders = Math.max(0, targetOrders - safeOrders);

  const daysPercent = targetDays
    ? Math.min(100, Math.round((Math.max(0, currentDays || 0) / Math.max(1, targetDays)) * 100))
    : null;
  const remainingDays = targetDays ? Math.max(0, targetDays - (currentDays || 0)) : null;

  const colorStyles = {
    amber: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      text: 'text-amber-400',
      subtext: 'text-amber-200/90',
      progress: 'bg-amber-500',
      glow: 'shadow-amber-500/10',
    },
    blue: {
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/10',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      text: 'text-blue-400',
      subtext: 'text-blue-200/90',
      progress: 'bg-blue-500',
      glow: 'shadow-blue-500/10',
    },
    emerald: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      text: 'text-emerald-400',
      subtext: 'text-emerald-200/90',
      progress: 'bg-emerald-500',
      glow: 'shadow-emerald-500/10',
    },
    purple: {
      border: 'border-purple-500/30',
      bg: 'bg-purple-500/10',
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      text: 'text-purple-400',
      subtext: 'text-purple-200/90',
      progress: 'bg-purple-500',
      glow: 'shadow-purple-500/10',
    },
  }[accentColor];

  // Compact mode: Designed for embedding directly inside existing cards (e.g. Bottlenecks & Risks)
  if (mode === 'compact') {
    return (
      <div className={cn('p-4 rounded-2xl border space-y-3.5', colorStyles.border, colorStyles.bg, className)}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={cn('text-xs font-bold flex items-center gap-1.5', colorStyles.text)}>
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Unlocks at {targetOrders} Orders</span>
          </span>
          <Badge variant="outline" className={cn('font-mono text-[11px] font-extrabold px-2 py-0.5', colorStyles.badgeBg)}>
            {safeOrders} / {targetOrders} Orders ({ordersPercent}%)
          </Badge>
        </div>

        {/* Progress Bar with Dual Labels */}
        <div className="space-y-1.5">
          <div className="w-full bg-secondary/60 h-2 rounded-full overflow-hidden p-0.5 border border-border/40">
            <div
              className={cn('h-full rounded-full transition-all duration-500', colorStyles.progress)}
              style={{ width: `${Math.max(4, ordersPercent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span className={colorStyles.text}>
              {remainingOrders > 0
                ? `${remainingOrders} more order${remainingOrders === 1 ? '' : 's'} needed`
                : 'Threshold reached • Calibrating'}
            </span>
            <span>{ordersPercent}% calibrated</span>
          </div>
        </div>

        {/* Informative Explanation */}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {description ||
            `AnalyzeUp is currently learning your sales velocity and fulfillment patterns. Automated detection of ${featureName} unlocks once your catalog reaches ${targetOrders} recorded orders to prevent inaccurate predictions.`}
        </p>

        {/* Call to action & Founder bypass */}
        <div className="pt-1 border-t border-border/20">
          <span className="text-[10px] text-muted-foreground">
            Want to unlock faster? Import historical order CSV.
          </span>
        </div>
      </div>
    );
  }

  // Full Card mode: Designed for standalone sections (e.g., Critical Restock Radar or Forecasting)
  return (
    <Card className={cn('ios-glass rounded-3xl p-6 shadow-xl relative overflow-hidden', colorStyles.border, colorStyles.bg, className)}>
      <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={cn('p-2 rounded-xl border', colorStyles.border, colorStyles.bg, colorStyles.text)}>
              <Clock className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg font-bold text-foreground">
              {title || `Observing Early Catalog Patterns: ${featureName}`}
            </CardTitle>
            <Badge className={cn('text-xs font-bold px-2.5 py-0.5', colorStyles.badgeBg)}>
              Calibrating • {ordersPercent}% Complete
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {description ||
              `Statistical sufficiency guardrail active. Advanced machine learning for ${featureName} activates automatically once your store logs ${targetOrders} orders to prevent premature capital misallocation.`}
          </CardDescription>
        </div>

        <div className="p-4 rounded-2xl bg-secondary/40 border border-border/40 text-center min-w-[200px] shrink-0 space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Unlock Counter
          </span>
          <div className={cn('text-3xl font-black font-mono', colorStyles.text)}>
            {safeOrders} <span className="text-sm text-muted-foreground font-normal">/ {targetOrders}</span>
          </div>
          <span className="text-[11px] text-muted-foreground block">
            Customer Orders Recorded
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Orders Counter Card */}
          <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Order Density
              </span>
              <span className="font-mono text-foreground font-bold">
                {safeOrders} / {targetOrders} Orders
              </span>
            </div>
            <Progress value={ordersPercent} className="h-2 bg-secondary" indicatorClassName={colorStyles.progress} />
            <span className={cn('text-[10px] font-medium block', colorStyles.text)}>
              {remainingOrders > 0
                ? `${remainingOrders} orders remaining to unlock`
                : '100% threshold reached'}
            </span>
          </div>

          {/* Days Counter Card (if applicable) */}
          {targetDays && (
            <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Sales History
                </span>
                <span className="font-mono text-foreground font-bold">
                  {currentDays ?? 0} / {targetDays} Days
                </span>
              </div>
              <Progress value={daysPercent || 0} className="h-2 bg-secondary" indicatorClassName="bg-blue-500" />
              <span className="text-[10px] text-blue-400 font-medium block">
                {remainingDays && remainingDays > 0
                  ? `${remainingDays} days remaining in baseline cycle`
                  : 'Holding window complete'}
              </span>
            </div>
          )}

          {/* Readiness Score (if applicable) */}
          {targetScore && (
            <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Readiness Score
                </span>
                <span className="font-mono text-foreground font-bold">
                  {currentScore ?? 0} / {targetScore} Pts
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.round(((currentScore || 0) / targetScore) * 100))}
                className="h-2 bg-secondary"
                indicatorClassName="bg-amber-500"
              />
              <span className="text-[10px] text-amber-400 font-medium block">
                {targetScore - (currentScore || 0) > 0
                  ? `${targetScore - (currentScore || 0)} points to graduate`
                  : 'Sufficient readiness score'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
