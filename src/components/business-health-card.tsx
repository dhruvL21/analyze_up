'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { computeBusinessHealth } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import { Activity, ShieldCheck, Sparkles } from 'lucide-react';

export function BusinessHealthCard() {
  const { products, transactions, suppliers, returns = [], isLoading } = useData();
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
    return computeBusinessHealth(products, transactions, suppliers, returns);
  }, [products, transactions, suppliers, returns, tick]);

  if (isLoading && products.length === 0) {
    return (
      <Card className="ios-glass rounded-3xl border-emerald-500/20 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full min-h-[260px] animate-pulse">
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
          <div className="space-y-3 pt-2">
            <div className="h-3 w-full bg-secondary/50 rounded-full" />
            <div className="h-3 w-full bg-secondary/50 rounded-full" />
            <div className="h-3 w-full bg-secondary/50 rounded-full" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="ios-glass rounded-3xl border-emerald-500/20 p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full transition-all duration-300">
      <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/40 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold text-foreground truncate">Business Health Score</CardTitle>
              <CardDescription className="text-xs truncate">Overall operational vitality & margin index</CardDescription>
            </div>
          </div>
          <Badge className={`${health.badgeClass} text-xs px-3 py-1 font-bold tracking-wide uppercase transition-all whitespace-nowrap shrink-0`}>
            {health.category}
          </Badge>
        </div>

        {/* Score & Gauge */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-1">
            <div className="text-4xl md:text-5xl font-black tracking-tight flex items-baseline gap-1 transition-all" style={{ color: health.color }}>
              {health.score}
              <span className="text-base font-semibold text-muted-foreground">/ 100</span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium leading-snug">{health.summarySentence}</p>
          </div>

          <div className="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-2xl bg-secondary/60 border border-border/50 shadow-inner shrink-0">
            <ShieldCheck className="w-9 h-9 md:w-10 md:h-10 transition-colors duration-300" style={{ color: health.color }} />
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <div className="flex justify-between text-xs md:text-sm font-semibold">
              <span className="text-muted-foreground">Inventory Health</span>
              <span className="text-emerald-400 font-bold">{health.factors.inventoryHealth}%</span>
            </div>
            <Progress value={health.factors.inventoryHealth} className="h-2 rounded-full bg-secondary/40" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs md:text-sm font-semibold">
              <span className="text-muted-foreground">Profit Margin Index</span>
              <span className="text-emerald-400 font-bold">{health.factors.marginHealth}%</span>
            </div>
            <Progress value={health.factors.marginHealth} className="h-2 rounded-full bg-secondary/40" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs md:text-sm font-semibold">
              <span className="text-muted-foreground">Capital Efficiency</span>
              <span className="text-emerald-400 font-bold">{health.factors.capitalEfficiency}%</span>
            </div>
            <Progress value={health.factors.capitalEfficiency} className="h-2 rounded-full bg-secondary/40" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs md:text-sm font-semibold">
              <span className="text-muted-foreground">Supplier Performance</span>
              <span className="text-emerald-400 font-bold">{health.factors.supplierPerformance}%</span>
            </div>
            <Progress value={health.factors.supplierPerformance} className="h-2 rounded-full bg-secondary/40" />
          </div>
        </div>
      </div>

      <div className="pt-3 mt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Auto-computed live
        </span>
        <span className="font-mono text-emerald-400 font-semibold">Updated just now</span>
      </div>
    </Card>
  );
}
