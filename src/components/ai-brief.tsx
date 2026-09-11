'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/context/data-context';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Sparkles, AlertTriangle, Coins, Loader2, RefreshCw, Lock, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { calculateDynamicBrief, type AIBriefOutput } from '@/ai/flows/ai-brief-generator';
import { ThreeTierBadge } from '@/components/three-tier-badge';
import { serializePlainData } from '@/lib/utils';
import type { Product, Transaction } from '@/lib/types';

export function AIBrief() {
  const { products, transactions, activePlan, setShowSubscriptionModal, returns = [], isLoading, capabilities, dataReadiness } = useData();
  const { user } = useUser();
  const firestore = useFirestore();

  const briefRef = useMemo(() => user && firestore ? doc(firestore, 'users', user.uid, 'analytics', 'ai_brief') : null, [user, firestore]);
  const { data: persistedBrief } = useDoc<AIBriefOutput>(briefRef);

  const [brief, setBrief] = useState<AIBriefOutput | null>(null);
  const isPaid = activePlan !== 'Free Trial';

  // Real-time dynamic brief calculated strictly from current live products & transactions
  const dynamicBrief = useMemo(() => {
    return calculateDynamicBrief(products, transactions, { capabilities, dataReadiness });
  }, [products, transactions, capabilities, dataReadiness]);

  // Check if persisted brief from Firestore matches the current live product catalog
  const isPersistedBriefValid = useMemo(() => {
    if (!persistedBrief || products.length === 0) return false;
    const currentNames = new Set(
      products.map((p) => String(p.name || (p as any).productName || '').trim().toLowerCase()).filter(Boolean)
    );
    const stockoutName = String(persistedBrief.stockoutItem?.name || '').trim().toLowerCase();
    const slowMovingName = String(persistedBrief.slowMovingItem?.name || '').trim().toLowerCase();
    return (currentNames.has(stockoutName) || currentNames.has(slowMovingName));
  }, [persistedBrief, products]);

  // Priority: manual refreshed brief -> valid persisted brief -> dynamic real-time brief
  const activeBrief = useMemo(() => {
    if (brief) return brief;
    if (isPersistedBriefValid && persistedBrief) return persistedBrief;
    return dynamicBrief;
  }, [brief, isPersistedBriefValid, persistedBrief, dynamicBrief]);

  // Calculate return stats in real-time with useMemo to eliminate render thrashing
  const { returnedQty, returnRate, topReturnedProduct, topReturnedQty } = useMemo(() => {
    const qty = returns.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    let totalItemsSold = 0;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i] as any;
      if (t.type === 'Sale' || t.type === 'sale') {
        totalItemsSold += Number(t.quantity || t.units_sold || 0);
      }
    }
    if (totalItemsSold <= 0) totalItemsSold = 1;
    const rate = (qty / totalItemsSold) * 100;

    const returnedProductMap: Record<string, number> = {};
    for (let i = 0; i < returns.length; i++) {
      const pName = returns[i].productName || 'General Item';
      returnedProductMap[pName] = (returnedProductMap[pName] || 0) + (Number(returns[i].quantity) || 0);
    }
    const entries = Object.entries(returnedProductMap);
    let bestProduct = 'None';
    let bestQty = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i][1] > bestQty) {
        bestProduct = entries[i][0];
        bestQty = entries[i][1];
      }
    }
    return {
      returnedQty: qty,
      returnRate: rate,
      topReturnedProduct: bestProduct,
      topReturnedQty: bestQty,
    };
  }, [returns, transactions]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBrief = useCallback(() => {
    if (!isPaid) {
      setShowSubscriptionModal(true);
      return;
    }
    
    setIsRefreshing(true);
    // Instant local computation (< 1ms)
    const result = calculateDynamicBrief(products, transactions, { capabilities, dataReadiness });
    setBrief(result);

    // Save to Firestore asynchronously in background without blocking UI
    if (firestore && user && briefRef) {
      setDoc(briefRef, serializePlainData({ ...result, updatedAt: new Date().toISOString() }), { merge: true })
        .catch((err) => console.warn('AI Brief background save:', err));
    }

    // Quick micro-pulse (150ms) for snappy visual confirmation then stop spinner immediately!
    setTimeout(() => {
      setIsRefreshing(false);
    }, 150);
  }, [products, transactions, capabilities, dataReadiness, isPaid, firestore, user, briefRef, setShowSubscriptionModal]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getHealthTextColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  if (products.length === 0) {
    if (isLoading) {
      return (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 shadow-xl backdrop-blur-md h-full min-h-[260px] flex flex-col justify-between animate-pulse">
          <div className="flex items-center justify-between pb-3 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-secondary/70" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-secondary/70 rounded-md" />
                <div className="h-3 w-48 bg-secondary/50 rounded-md" />
              </div>
            </div>
            <div className="h-5 w-24 bg-secondary/70 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-3">
            <div className="h-28 rounded-2xl bg-secondary/40 border border-border/30" />
            <div className="h-28 rounded-2xl bg-secondary/40 border border-border/30" />
            <div className="h-28 rounded-2xl bg-secondary/40 border border-border/30" />
          </div>
          <div className="h-8 rounded-xl bg-secondary/30 w-full" />
        </div>
      );
    }

    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-card/60 p-6 shadow-xl backdrop-blur-md text-center flex flex-col items-center justify-center h-full min-h-[260px]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-sm mb-3">
          <Sparkles className="h-6 w-6 text-emerald-400 animate-pulse" />
        </div>
        <h3 className="font-bold text-lg text-foreground mb-1.5">Welcome to AnalyzeUp!</h3>
        <p className="text-xs md:text-sm text-muted-foreground max-w-md mb-4">
          Your real-time AI diagnostics, stockout risks, customer returns analytics, and savings insights will appear here once you add products and transaction data.
        </p>
        <a
          href="/dashboard/inventory"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-5 font-semibold text-xs text-white shadow-md hover:bg-emerald-500 transition-all"
        >
          Add Your First Product
        </a>
      </div>
    );
  }

  return (
    <div data-tour="ai-brief" className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-card/60 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-emerald-500/40 h-full flex flex-col justify-between">
      {/* Header section */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 shadow-inner border border-emerald-500/20">
            {isRefreshing && isPaid ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 text-emerald-400 animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg tracking-tight text-foreground flex items-center gap-2">
              Today's AI Brief
            </h3>
            <p className="text-xs text-muted-foreground">AI-generated inventory diagnostics and cost saving actions</p>
          </div>
        </div>

        {/* Inventory Health Score and Refresh */}
        <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full">
            <button
              onClick={isPaid ? fetchBrief : () => setShowSubscriptionModal(true)}
              disabled={isRefreshing && isPaid}
              className="text-xs text-muted-foreground hover:text-emerald-400 flex items-center gap-1.5 px-3 py-1 rounded-xl border border-border/40 bg-secondary/30 transition-all active:scale-95 disabled:opacity-50 font-semibold"
              title={isPaid ? "Refresh Brief" : "Upgrade to Unlock"}
            >
              {isPaid ? (
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              ) : (
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>{isPaid ? 'Analyze' : 'Unlock'}</span>
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold text-muted-foreground">Inventory Health</span>
              <span className={`font-bold ${isPaid ? getHealthTextColor(activeBrief.healthScore) : 'text-muted-foreground/60'}`}>
                {isPaid ? `${activeBrief.healthScore}/100` : '--/100'}
              </span>
            </div>
          </div>
          <Progress value={isPaid ? activeBrief.healthScore : 0} className="h-1.5 w-full md:w-[180px] bg-secondary/80 [&>div]:transition-all [&>div]:duration-500" indicatorClassName={getHealthColor(activeBrief.healthScore)} />
        </div>
      </div>

      {/* Main Content Area with conditional blur */}
      <div className="relative flex-1 flex flex-col justify-between gap-4">
        {/* Content grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3.5 flex-1 transition-all duration-300 ${!isPaid ? 'blur-[5px] select-none pointer-events-none opacity-40' : (isRefreshing ? 'opacity-75 transition-opacity' : 'opacity-100')}`}>
          {Boolean(dataReadiness?.level === 'LEARNING' || (!capabilities?.stockoutPrediction && !capabilities?.slowMoverDetection)) ? (
            /* Left 2 Columns: Learning Stage Card for Predictive Stockout & Velocity */
            <div className="sm:col-span-2 relative group flex p-4 rounded-2xl border border-amber-500/25 bg-zinc-900/60 hover:bg-zinc-900/90 transition-all duration-200 flex-col justify-between shadow-sm space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-1 flex-wrap pb-2 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Stockout & Velocity Intelligence: Learning Stage
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] font-semibold">
                    Calibrating Baseline
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">Observing Catalog Demand Rhythm</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AnalyzeUp is observing your sales rhythm. Stockout risk runway unlocks at <strong className="text-foreground">14 days</strong> and demand velocity models unlock at <strong className="text-foreground">30 days</strong>. Speculative reorder quantities and premature price discounts are suppressed during baseline learning.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/30 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Stockout Risk Runway</span>
                    <p className="text-xs font-bold text-foreground font-mono">
                      {dataReadiness?.historicalDays ?? 0} / 14 Days
                    </p>
                    <p className="text-[10px] text-amber-400">Unlocks with early baseline</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/30 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Sales Velocity Models</span>
                    <p className="text-xs font-bold text-foreground font-mono">
                      {dataReadiness?.historicalDays ?? 0} / 30 Days
                    </p>
                    <p className="text-[10px] text-amber-400">Unlocks with 30-day history</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                <span>Ground-truth returns tracking active</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Returns Live
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Left Column: Stockout Risk */}
              <div className="relative group flex p-4 rounded-2xl border border-rose-500/20 bg-zinc-900/60 hover:bg-zinc-900/90 hover:border-rose-500/40 transition-all duration-200 flex-1 flex-col justify-between shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap pb-2 border-b border-border/30">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Stockout Risk</span>
                    </div>
                    <ThreeTierBadge
                      tier={Boolean(capabilities?.stockoutPrediction && !activeBrief.stockoutItem.riskText.includes('Out of stock')) ? "MODEL_2_PREDICTION" : "ACTUAL_DATA"}
                      size="sm"
                    />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 leading-snug line-clamp-2 pt-0.5">{activeBrief.stockoutItem.name}</h4>
                  <div className="space-y-1 text-xs">
                    <p className="text-rose-400 font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0"></span>
                      {activeBrief.stockoutItem.riskText}
                    </p>
                    <p className="text-zinc-400">{activeBrief.stockoutItem.reorderText}</p>
                  </div>
                </div>
                <div className="pt-2.5 mt-2 border-t border-border/30 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Est. Reorder Cost</span>
                  <span className="font-bold text-zinc-100 font-mono text-sm">{activeBrief.stockoutItem.costText.replace('Estimated cost: ', '')}</span>
                </div>
              </div>

              {/* Middle Column: Dead Stock / Slow Sales */}
              <div className="relative group flex p-4 rounded-2xl border border-amber-500/20 bg-zinc-900/60 hover:bg-zinc-900/90 hover:border-amber-500/40 transition-all duration-200 flex-1 flex-col justify-between shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap pb-2 border-b border-border/30">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                        <Coins className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        {Boolean(capabilities?.slowMoverDetection && dataReadiness?.level !== 'LEARNING') ? 'Slow-Moving' : 'Capital Asset'}
                      </span>
                    </div>
                    <ThreeTierBadge
                      tier={Boolean(capabilities?.slowMoverDetection && dataReadiness?.level !== 'LEARNING') ? "MODEL_2_PREDICTION" : "ACTUAL_DATA"}
                      size="sm"
                    />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 leading-snug line-clamp-2 pt-0.5">{activeBrief.slowMovingItem.name}</h4>
                  <div className="space-y-1 text-xs">
                    <p className="text-zinc-400">{activeBrief.slowMovingItem.riskText}</p>
                    <p className="text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                      {activeBrief.slowMovingItem.costText}
                    </p>
                  </div>
                </div>
                <div className="pt-2.5 mt-2 border-t border-border/30 flex items-center justify-between text-xs gap-2">
                  <span className="text-zinc-400 shrink-0">Action</span>
                  <span 
                    className="text-amber-300 font-semibold text-right"
                    title={activeBrief.slowMovingItem.actionText}
                  >
                    {activeBrief.slowMovingItem.actionText
                      .replace(/^Suggested action:\s*/i, '')
                      .replace(/^Action:\s*/i, '')
                      .replace(/\s*clearance discount\.?/i, ' Discount')
                      .trim() || (Boolean(capabilities?.slowMoverDetection && dataReadiness?.level !== 'LEARNING') ? '20% Discount' : 'Monitor Velocity')}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Right Column: Customer Returns */}
          <div className="relative group flex p-4 rounded-2xl border border-emerald-500/20 bg-zinc-900/60 hover:bg-zinc-900/90 hover:border-emerald-500/40 transition-all duration-200 flex-1 flex-col justify-between shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1 flex-wrap pb-2 border-b border-border/30">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Returns</span>
                </div>
                <ThreeTierBadge tier="ACTUAL_DATA" size="sm" />
              </div>
              <h4 className="font-bold text-sm text-zinc-100 leading-snug line-clamp-2 pt-0.5">
                {returnedQty > 0 ? `${returnedQty} Items Returned` : 'No Recent Returns'}
              </h4>
              <div className="space-y-1 text-xs">
                <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  Return Rate: {returnRate.toFixed(1)}%
                </p>
                <p className="text-zinc-400 line-clamp-1">
                  {topReturnedQty > 0 ? `Highest: ${topReturnedProduct} (${topReturnedQty} units)` : '0 return transactions logged.'}
                </p>
              </div>
            </div>
            <div className="pt-2.5 mt-2 border-t border-border/30 flex items-center justify-between text-xs">
              <a 
                href="/dashboard/returns"
                className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 hover:underline group"
              >
                <span>Manage Returns Hub</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Banner */}
        <div data-tour="ai-suggestions" className={`flex items-center justify-between px-4 py-3 rounded-2xl border border-blue-500/25 bg-gradient-to-r from-blue-950/50 via-indigo-950/30 to-zinc-900/70 shadow-sm transition-all duration-300 ${!isPaid ? 'blur-[5px] select-none pointer-events-none opacity-40' : (isRefreshing ? 'opacity-75 transition-opacity' : 'opacity-100')}`}>
          <div className="flex items-center gap-2.5 font-bold text-foreground">
            <Coins className="h-4 w-4 text-blue-400 shrink-0" />
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-zinc-300 font-medium">Cash Locked in Inventory:</span>
              <span className="font-bold text-white font-mono text-sm sm:text-base">
                {activeBrief.savingsText.replace('Cash Locked in Inventory: ', '')}
              </span>
            </div>
          </div>
        </div>

        {/* Paywall Overlay */}
        {!isPaid && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10 bg-card/20 rounded-xl backdrop-blur-[2px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg mb-3">
              <Lock className="h-6 w-6 text-emerald-400 animate-pulse" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-1">
              Unlock Today's AI Brief
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Get predictive inventory warnings, stockout predictions, and cash savings diagnostics.
            </p>
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-5 font-bold text-xs text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all cursor-pointer active:scale-95"
            >
              Upgrade to Pro (₹4,999/mo)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
