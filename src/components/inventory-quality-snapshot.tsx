'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { computeInventoryQuality } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import { Boxes, PackageCheck, AlertTriangle, XCircle, Flame, Clock } from 'lucide-react';

export function InventoryQualitySnapshot() {
  const { products, transactions, businessProfile, capabilities, dataReadiness } = useData();

  const isDeadStockActive = capabilities?.deadStockDetection ?? false;
  const isVelocityActive = capabilities?.slowMoverDetection ?? false;

  const quality = React.useMemo(() => {
    return computeInventoryQuality(products, transactions, {
      isDeadStockEnabled: isDeadStockActive,
      isVelocityEnabled: isVelocityActive,
    });
  }, [products, transactions, isDeadStockActive, isVelocityActive]);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  return (
    <Card className="ios-glass rounded-3xl border-border/50 p-5 shadow-xl space-y-4 h-full flex flex-col justify-between">
      <div>
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Boxes className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold whitespace-nowrap">Inventory Quality Snapshot</CardTitle>
              <CardDescription className="text-xs truncate">Asset health & catalog composition analytics</CardDescription>
            </div>
          </div>

          <Badge variant="outline" className="text-xs font-semibold whitespace-nowrap shrink-0 px-2.5 py-1">
            {products.length} Total SKUs
          </Badge>
        </CardHeader>

        <CardContent className="p-0 pt-3 space-y-4 text-xs">
          {/* Quality Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
            {/* Healthy Stock */}
            <div 
              className="px-2 py-2.5 sm:px-2.5 sm:py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between min-h-[96px] transition-all hover:bg-emerald-500/15 hover:border-emerald-500/40 cursor-default"
              title="Products with healthy inventory and active turnover"
            >
              <div className="flex items-center gap-1 min-w-0">
                <PackageCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-semibold text-emerald-400 truncate">Healthy</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 my-0.5 tracking-tight">{quality.healthyCount}</p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">Optimal stock</span>
              </div>
            </div>

            {/* Low Stock */}
            <div 
              className="px-2 py-2.5 sm:px-2.5 sm:py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col justify-between min-h-[96px] transition-all hover:bg-amber-500/15 hover:border-amber-500/40 cursor-default"
              title="Products approaching or below minimum safety stock levels"
            >
              <div className="flex items-center gap-1 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-semibold text-amber-400 truncate">Low Stock</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 my-0.5 tracking-tight">{quality.lowStockCount}</p>
              <div className="flex items-center gap-1 text-[10px] text-amber-400/90 font-medium">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${quality.lowStockCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="truncate">{quality.lowStockCount > 0 ? `${quality.lowStockCount} need reorder` : 'Adequate'}</span>
              </div>
            </div>

            {/* Out of Stock */}
            <div 
              className="px-2 py-2.5 sm:px-2.5 sm:py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex flex-col justify-between min-h-[96px] transition-all hover:bg-rose-500/20 hover:border-rose-500/50 cursor-default"
              title="Products with zero remaining inventory"
            >
              <div className="flex items-center gap-1 min-w-0">
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-[11px] font-semibold text-rose-400 truncate">Out of Stock</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-rose-400 my-0.5 tracking-tight">{quality.criticalStockCount}</p>
              <div className="flex items-center gap-1 text-[10px] text-rose-400/90 font-medium">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${quality.criticalStockCount > 0 ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="truncate">{quality.criticalStockCount > 0 ? `${quality.criticalStockCount} zero stock` : 'Zero stockout'}</span>
              </div>
            </div>

            {/* Dead Stock */}
            <div 
              className="px-2 py-2.5 sm:px-2.5 sm:py-3 rounded-2xl bg-slate-500/10 border border-slate-500/25 flex flex-col justify-between min-h-[96px] transition-all hover:bg-slate-500/15 hover:border-slate-500/40 cursor-default"
              title={!isDeadStockActive ? `Learning phase: Requires 30 days of sales history (${dataReadiness?.historicalDays || 0}/30d completed)` : "Items with zero sales velocity over 60+ days"}
            >
              <div className="flex items-center gap-1 min-w-0">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-400 truncate">Dead Stock</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-300 my-0.5 tracking-tight">
                {isDeadStockActive ? quality.deadStockCount : 0}
              </p>
              <div className="flex items-center gap-1 text-[10px] font-medium truncate">
                {!isDeadStockActive ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="text-amber-400/90 truncate">Baseline {dataReadiness?.historicalDays || 0}/30d</span>
                  </>
                ) : (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${quality.deadStockCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span className="text-slate-400 truncate">{quality.deadStockCount > 0 ? `${quality.deadStockCount} stagnant` : 'Zero dead stock'}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Top Valuable Products Table */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Flame className="w-4 h-4 text-amber-400" /> Top 5 Highest Value Capital Assets
            </h4>

            <div className="divide-y divide-border/40 rounded-2xl border border-border/40 overflow-hidden bg-secondary/20">
              {quality.topValuableProducts.length > 0 ? (
                quality.topValuableProducts.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-secondary/40 transition-colors">
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-[240px]">{p.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{p.sku} • {p.stock} units</p>
                    </div>
                    <span className="font-bold text-emerald-400 shrink-0">{currencySymbol}{Math.round(p.value).toLocaleString('en-IN')}</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No inventory products recorded yet.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
