'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { computeBusinessHealth } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import {
  Activity,
  ShieldCheck,
  Sparkles,
  Package,
  TrendingUp,
  Zap,
  Coins,
  Truck,
  CheckCircle2,
} from 'lucide-react';

export function BusinessHealthCard() {
  const { products, transactions, suppliers, returns = [], orders = [], isLoading } = useData();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick(prev => prev + 1);
    window.addEventListener('analyzeup_audit_logged', handleUpdate);
    window.addEventListener('analyzeup_tasks_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('analyzeup_audit_logged', handleUpdate);
      window.removeEventListener('analyzeup_tasks_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const health = React.useMemo(() => {
    return computeBusinessHealth(products, transactions, suppliers, returns, orders);
  }, [products, transactions, suppliers, returns, orders, tick]);

  if (isLoading && products.length === 0) {
    return (
      <Card className="ios-glass rounded-3xl border-emerald-500/20 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full min-h-[300px] animate-pulse">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-secondary/70" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-secondary/70 rounded-md" />
                <div className="h-3 w-40 bg-secondary/50 rounded-md" />
              </div>
            </div>
            <div className="h-6 w-20 bg-secondary/70 rounded-full" />
          </div>
          <div className="space-y-2 py-2">
            <div className="h-10 w-24 bg-secondary/70 rounded-lg" />
            <div className="h-3 w-52 bg-secondary/50 rounded-md" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 bg-secondary/40 rounded-xl" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const metricColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <Card className="ios-glass rounded-3xl border-emerald-500/20 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full transition-all duration-300">
      <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold text-foreground truncate">Business Health Score</CardTitle>
              <CardDescription className="text-xs truncate">6-factor real-time executive vitality index</CardDescription>
            </div>
          </div>
          <Badge className={`${health.badgeClass} text-xs px-3 py-1 font-bold tracking-wide uppercase transition-all whitespace-nowrap shrink-0`}>
            {health.category}
          </Badge>
        </div>

        {/* Score & Shield Display */}
        <div className="flex items-center justify-between py-1 gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight flex items-baseline gap-1 transition-all" style={{ color: health.color }}>
              {health.score}
              <span className="text-base font-semibold text-muted-foreground">/ 100</span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium leading-snug line-clamp-2">{health.summarySentence}</p>
          </div>

          <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center rounded-2xl bg-secondary/60 border border-border/50 shadow-inner shrink-0">
            <ShieldCheck className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 transition-colors duration-300" style={{ color: health.color }} />
          </div>
        </div>

        {/* 6-Factor Health Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-2.5 pt-1">
          {/* 1. Inventory Health */}
          <div className="space-y-1.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">Inventory Health</span>
              </span>
              <span className={`font-bold shrink-0 ${metricColor(health.factors.inventoryHealth)}`}>
                {health.factors.inventoryHealth}%
              </span>
            </div>
            <Progress value={health.factors.inventoryHealth} className="h-1.5 rounded-full bg-secondary/60" />
          </div>

          {/* 2. Profitability */}
          <div className="space-y-1.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Profitability</span>
              </span>
              <span className={`font-bold shrink-0 ${metricColor(health.factors.profitability)}`}>
                {health.factors.profitability}%
              </span>
            </div>
            <Progress value={health.factors.profitability} className="h-1.5 rounded-full bg-secondary/60" />
          </div>

          {/* 3. Sales & Revenue Health */}
          <div className="space-y-1.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Sales & Revenue</span>
              </span>
              <span className={`font-bold shrink-0 ${metricColor(health.factors.salesRevenueHealth)}`}>
                {health.factors.salesRevenueHealth}%
              </span>
            </div>
            <Progress value={health.factors.salesRevenueHealth} className="h-1.5 rounded-full bg-secondary/60" />
          </div>

          {/* 4. Capital Efficiency */}
          <div className="space-y-1.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                <Coins className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">Capital Efficiency</span>
              </span>
              <span className={`font-bold shrink-0 ${metricColor(health.factors.capitalEfficiency)}`}>
                {health.factors.capitalEfficiency}%
              </span>
            </div>
            <Progress value={health.factors.capitalEfficiency} className="h-1.5 rounded-full bg-secondary/60" />
          </div>

          {/* 5. Supplier Performance */}
          <div className="space-y-1.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">Supplier Performance</span>
              </span>
              <span className={`font-bold shrink-0 ${metricColor(health.factors.supplierPerformance)}`}>
                {health.factors.supplierPerformance}%
              </span>
            </div>
            <Progress value={health.factors.supplierPerformance} className="h-1.5 rounded-full bg-secondary/60" />
          </div>

          {/* 6. Order/Fulfillment Health */}
          <div className="space-y-1.5 p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:border-border/70 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="truncate">Order / Fulfillment</span>
              </span>
              <span className={`font-bold shrink-0 ${metricColor(health.factors.orderFulfillmentHealth)}`}>
                {health.factors.orderFulfillmentHealth}%
              </span>
            </div>
            <Progress value={health.factors.orderFulfillmentHealth} className="h-1.5 rounded-full bg-secondary/60" />
          </div>
        </div>
      </div>

      <div className="pt-3 mt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> 6-Factor Live Engine
        </span>
        <span className="font-mono text-emerald-400 font-semibold">Updated live</span>
      </div>
    </Card>
  );
}
