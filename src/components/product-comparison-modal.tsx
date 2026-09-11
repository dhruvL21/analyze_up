'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import { computeProductIntelligence } from '@/lib/product-intelligence-engine';
import { ArrowRightLeft, Sparkles } from 'lucide-react';

interface ProductComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductComparisonModal({ open, onOpenChange }: ProductComparisonModalProps) {
  const { products, transactions, returns, businessProfile, capabilities, dataReadiness } = useData();

  const [prodIdA, setProdIdA] = useState<string>(products[0]?.id || '');
  const [prodIdB, setProdIdB] = useState<string>(products[1]?.id || products[0]?.id || '');

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  const productA = products.find(p => p.id === prodIdA) || products[0];
  const productB = products.find(p => p.id === prodIdB) || products[1] || products[0];

  const readinessOpts = {
    isDeadStockEnabled: capabilities?.deadStockDetection,
    isVelocityEnabled: capabilities?.trendAnalysis,
    historicalDays: dataReadiness?.historicalDays,
  };
  const reportA = productA ? computeProductIntelligence(productA, transactions, returns, [], readinessOpts) : null;
  const reportB = productB ? computeProductIntelligence(productB, transactions, returns, [], readinessOpts) : null;

  const nameA = productA?.name || productA?.productName || 'Product A';
  const nameB = productB?.name || productB?.productName || 'Product B';

  const priceA = (productA?.price && productA.price > 0) ? productA.price : (productA?.costPrice ? Math.round(productA.costPrice * 1.4) : 0);
  const priceB = (productB?.price && productB.price > 0) ? productB.price : (productB?.costPrice ? Math.round(productB.costPrice * 1.4) : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto ios-glass p-6 md:p-8 border border-emerald-500/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-xl font-bold">
            <ArrowRightLeft className="w-6 h-6 text-emerald-400" />
            Product Decision Comparison Engine
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            Compare two products side-by-side across sales velocity, profit margins, turnover, and AI recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3 text-sm">
          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/40 p-5 rounded-2xl border border-border/50">
            <div className="space-y-2">
              <span className="font-bold text-muted-foreground block text-xs uppercase tracking-wider">Select Product A</span>
              <Select value={prodIdA} onValueChange={setProdIdA}>
                <SelectTrigger className="rounded-xl bg-background border-border/60 text-foreground font-semibold h-11 text-sm">
                  <SelectValue placeholder="Choose Product A" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border border-border shadow-xl max-h-60">
                  {products.map(p => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="text-sm font-semibold text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer py-2.5"
                    >
                      {p.name || p.productName || 'Unnamed Product'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-muted-foreground block text-xs uppercase tracking-wider">Select Product B</span>
              <Select value={prodIdB} onValueChange={setProdIdB}>
                <SelectTrigger className="rounded-xl bg-background border-border/60 text-foreground font-semibold h-11 text-sm">
                  <SelectValue placeholder="Choose Product B" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border border-border shadow-xl max-h-60">
                  {products.map(p => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="text-sm font-semibold text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer py-2.5"
                    >
                      {p.name || p.productName || 'Unnamed Product'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comparison Cards */}
          {reportA && reportB && productA && productB && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Product A Card */}
              <div className="p-5 rounded-2xl bg-secondary/40 border border-emerald-500/30 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <Badge className="bg-emerald-600 text-white text-xs mb-1 font-bold">Grade {reportA.performanceGrade}</Badge>
                    <h4 className="font-bold text-foreground text-base truncate max-w-[220px]">{nameA}</h4>
                  </div>
                  <Badge className={`${reportA.badgeClass} text-xs font-bold px-2.5 py-0.5`}>{reportA.healthStatus}</Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock Level</span>
                    <span className="font-bold text-foreground">{productA.stock ?? 0} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selling Price</span>
                    <span className="font-bold text-emerald-400">{currencySymbol}{priceA}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className="font-bold text-emerald-400">{reportA.profitMarginPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daily Sales Velocity</span>
                    <span className="font-bold text-foreground">{reportA.averageDailySales} units/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock Runway</span>
                    <span className="font-bold text-foreground">{reportA.daysOfStockRemaining} days</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-background/80 border border-border/50 space-y-1">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">AI Takeaway</span>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">{reportA.executiveSummary}</p>
                </div>
              </div>

              {/* Product B Card */}
              <div className="p-5 rounded-2xl bg-secondary/40 border border-emerald-500/30 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <Badge className="bg-emerald-600 text-white text-xs mb-1 font-bold">Grade {reportB.performanceGrade}</Badge>
                    <h4 className="font-bold text-foreground text-base truncate max-w-[220px]">{nameB}</h4>
                  </div>
                  <Badge className={`${reportB.badgeClass} text-xs font-bold px-2.5 py-0.5`}>{reportB.healthStatus}</Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock Level</span>
                    <span className="font-bold text-foreground">{productB.stock ?? 0} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selling Price</span>
                    <span className="font-bold text-emerald-400">{currencySymbol}{priceB}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span className="font-bold text-emerald-400">{reportB.profitMarginPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daily Sales Velocity</span>
                    <span className="font-bold text-foreground">{reportB.averageDailySales} units/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock Runway</span>
                    <span className="font-bold text-foreground">{reportB.daysOfStockRemaining} days</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-background/80 border border-border/50 space-y-1">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">AI Takeaway</span>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">{reportB.executiveSummary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Trade-off Verdict */}
          {reportA && reportB && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <span className="font-bold text-foreground flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-emerald-400" /> AI Comparison Decision Verdict
              </span>
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                {reportA.profitMarginPercent > reportB.profitMarginPercent
                  ? `"${nameA}" yields higher profit margins (${reportA.profitMarginPercent}% vs ${reportB.profitMarginPercent}%), while "${nameB}" provides steady sales volume.`
                  : `"${nameB}" yields higher profit margins (${reportB.profitMarginPercent}% vs ${reportA.profitMarginPercent}%), while "${nameA}" provides faster turnover.`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button variant="secondary" className="rounded-xl text-sm font-semibold px-5">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
