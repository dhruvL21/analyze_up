'use client';

import { useState, useEffect, useTransition } from 'react';
import { useData } from '@/context/data-context';
import { Sparkles, AlertTriangle, Coins, Loader2, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { generateAIBrief, AIBriefOutput } from '@/ai/flows/ai-brief-generator';
import { Skeleton } from '@/components/ui/skeleton';

export function AIBrief() {
  const { products, transactions } = useData();
  const [brief, setBrief] = useState<AIBriefOutput | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchBrief = () => {
    startTransition(async () => {
      try {
        const simplifiedProducts = products.map((p) => ({
          name: p.name,
          sku: p.sku || '',
          stock: p.stock || 0,
          price: p.price || 0,
          costPrice: p.costPrice || p.price * 0.6 || 0,
          averageDailySales: p.averageDailySales || 0,
          leadTimeDays: p.leadTimeDays || 7,
        }));

        const simplifiedTransactions = (transactions || []).slice(0, 30).map((t) => {
          // Format date safely as a string
          let dateStr = 'Recent';
          if (t.transactionDate) {
            if (typeof t.transactionDate === 'object' && t.transactionDate !== null && 'seconds' in t.transactionDate) {
              // It's a Firestore Timestamp
              dateStr = new Date((t.transactionDate as any).seconds * 1000).toLocaleDateString();
            } else if (t.transactionDate instanceof Date) {
              dateStr = t.transactionDate.toLocaleDateString();
            } else {
              dateStr = String(t.transactionDate);
            }
          }

          return {
            productName: t.productName || '',
            sku: t.sku || '',
            type: t.type,
            quantity: t.quantity || 0,
            price: t.price || 0,
            date: dateStr,
          };
        });

        const result = await generateAIBrief(simplifiedProducts, simplifiedTransactions);
        setBrief(result);
      } catch (err) {
        console.error('Failed to generate AI Brief:', err);
      }
    });
  };

  // Re-fetch AI brief when products or transactions change
  useEffect(() => {
    fetchBrief();
  }, [products.length, transactions.length]);

  // Determine health color based on score
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const getHealthTextColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-destructive';
  };

  if (!brief && isPending) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-xl animate-pulse bg-muted" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 animate-pulse bg-muted" />
              <Skeleton className="h-3 w-48 animate-pulse bg-muted" />
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[160px]">
            <div className="flex justify-between md:justify-end md:gap-3">
              <Skeleton className="h-4 w-20 animate-pulse bg-muted" />
              <Skeleton className="h-4 w-10 animate-pulse bg-muted" />
            </div>
            <Skeleton className="h-1.5 w-full md:w-[180px] animate-pulse bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-3.5 p-4 rounded-xl border border-border/30 bg-secondary/10">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg animate-pulse bg-muted" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-3 w-16 animate-pulse bg-muted" />
              <Skeleton className="h-4 w-1/2 animate-pulse bg-muted" />
              <Skeleton className="h-3.5 w-3/4 animate-pulse bg-muted" />
            </div>
          </div>
          <div className="flex gap-3.5 p-4 rounded-xl border border-border/30 bg-secondary/10">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg animate-pulse bg-muted" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-3 w-24 animate-pulse bg-muted" />
              <Skeleton className="h-4 w-1/2 animate-pulse bg-muted" />
              <Skeleton className="h-3.5 w-3/4 animate-pulse bg-muted" />
            </div>
          </div>
        </div>
        <Skeleton className="h-12 w-full mt-5 rounded-xl animate-pulse bg-muted" />
      </div>
    );
  }

  // Fallback if data loading failed completely
  const activeBrief = brief || {
    healthScore: 82,
    stockoutItem: {
      name: 'Waterproof Backpack',
      riskText: 'Stockout risk in 4 days.',
      reorderText: 'Suggested reorder: 25 units.',
      costText: 'Estimated cost: ₹12,500',
    },
    slowMovingItem: {
      name: 'Classic White T-Shirt',
      riskText: 'No sales in 32 days.',
      costText: '₹8,400 blocked.',
      actionText: 'Suggested action: 15% discount.',
    },
    savingsText: 'Potential monthly savings: ₹4,500',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary/40 scroll-reveal-item revealed">
      {/* Decorative top gradient glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/10 blur-[80px]" />
      <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/5 blur-[80px]" />

      {/* Header section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
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
        <div className="flex flex-col md:items-end gap-2.5 w-full md:w-auto">
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full">
            <button
              onClick={fetchBrief}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-md border border-border/30 bg-secondary/20 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Brief"
            >
              <RefreshCw className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
              <span>Analyze</span>
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-muted-foreground">Inventory Health</span>
              <span className={`font-bold ${getHealthTextColor(activeBrief.healthScore)}`}>
                {activeBrief.healthScore}/100
              </span>
            </div>
          </div>
          <Progress value={activeBrief.healthScore} className="h-1.5 w-full md:w-[180px] bg-secondary/80 [&>div]:transition-all [&>div]:duration-500" indicatorClassName={getHealthColor(activeBrief.healthScore)} />
        </div>
      </div>

      {/* Content grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-300 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        {/* Left Column: Stockout Risk */}
        <div className="relative group flex gap-3.5 p-4 rounded-xl border border-border/30 bg-secondary/20 hover:bg-secondary/30 transition-all duration-200 min-h-[140px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500/80">Stockout Risk</span>
            <h4 className="font-bold text-base text-foreground truncate">{activeBrief.stockoutItem.name}</h4>
            <div className="space-y-1 mt-1 text-sm">
              <p className="text-amber-400 font-medium">{activeBrief.stockoutItem.riskText}</p>
              <p className="text-muted-foreground">{activeBrief.stockoutItem.reorderText}</p>
              <p className="text-muted-foreground font-semibold">{activeBrief.stockoutItem.costText}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Dead Stock / Slow Sales */}
        <div className="relative group flex gap-3.5 p-4 rounded-xl border border-border/30 bg-secondary/20 hover:bg-secondary/30 transition-all duration-200 min-h-[140px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Coins className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Slow-Moving Inventory</span>
            <h4 className="font-bold text-base text-foreground truncate">{activeBrief.slowMovingItem.name}</h4>
            <div className="space-y-1 mt-1 text-sm">
              <p className="text-muted-foreground">{activeBrief.slowMovingItem.riskText}</p>
              <p className="text-emerald-400 font-semibold">{activeBrief.costText || activeBrief.slowMovingItem.costText}</p>
              <p className="text-primary font-medium">{activeBrief.slowMovingItem.actionText}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Banner */}
      <div className={`mt-5 flex items-center justify-between p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-sm font-semibold transition-opacity duration-300 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{activeBrief.savingsText}</span>
        </div>
        <span className="text-xs font-medium text-emerald-500/70 hidden sm:inline">Optimized via AI Copilot</span>
      </div>
    </div>
  );
}
