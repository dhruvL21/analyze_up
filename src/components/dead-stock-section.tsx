'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { logBusinessAction, getAuditLogs, BusinessAuditLog } from '@/lib/audit-store';
import { predictOptimalClearanceDiscount, ClearancePrediction } from '@/lib/ml/clearance-pricing-model';
import { evaluateSalesHistory } from '@/lib/sales-history-helper';
import { useRouter } from 'next/navigation';
import {
  PackageX,
  Tag,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Coins,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function DeadStockSection() {
  const {
    products = [],
    transactions = [],
    updateProduct,
    businessProfile,
    businessBuddyCalibration,
  } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const [confirmItem, setConfirmItem] = useState<{
    product: any;
    prediction: ClearancePrediction;
  } | null>(null);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [confirmPushItem, setConfirmPushItem] = useState<any | null>(null);
  const [recentLogs, setRecentLogs] = useState<BusinessAuditLog[]>([]);
  const [showItemsPreview, setShowItemsPreview] = useState(false);

  useEffect(() => {
    setRecentLogs(getAuditLogs());
    const handleAudit = () => setRecentLogs(getAuditLogs());
    window.addEventListener('analyzeup_audit_logged', handleAudit);
    return () => window.removeEventListener('analyzeup_audit_logged', handleAudit);
  }, []);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Dynamic 30-day Sales History Evaluation
  const salesHistory = React.useMemo(() => {
    return evaluateSalesHistory(products, transactions);
  }, [products, transactions]);

  // Dead Stock Items: Only evaluated if dataset has >= 30 days of recorded sales history
  const deadStockItems = React.useMemo(() => {
    if (!salesHistory.hasMinimumHistory) return [];
    return products.filter((p) => p && p.stock > 0 && salesHistory.isProductEligibleForDeadStock(p));
  }, [products, salesHistory]);

  // Track products that have already had a clearance discount executed in audit logs
  const discountedProductNames = React.useMemo(() => {
    return new Set(
      recentLogs
        .filter((log) => log.actionType === 'discount')
        .map((log) => log.productName.toLowerCase())
    );
  }, [recentLogs]);

  // Check whether product has already been liquidated in Firestore database or local actions
  const isItemLiquidated = React.useCallback((item: any) => {
    return (
      item.liquidationStatus === 'Liquidated' ||
      Boolean(item.compareAtPrice && item.compareAtPrice > item.price) ||
      discountedProductNames.has((item.name || '').toLowerCase())
    );
  }, [discountedProductNames]);

  // Active items that still need clearance action
  const pendingItems = React.useMemo(() => {
    return deadStockItems.filter((item) => !isItemLiquidated(item));
  }, [deadStockItems, isItemLiquidated]);

  // Resolved items that already have clearance active
  const resolvedItems = React.useMemo(() => {
    return deadStockItems.filter((item) => isItemLiquidated(item));
  }, [deadStockItems, isItemLiquidated]);

  const totalDeadCapital = React.useMemo(() => {
    return pendingItems.reduce(
      (acc, p) => acc + (p.stock || 0) * (p.costPrice || (p.price || 500) * 0.6),
      0
    );
  }, [pendingItems]);

  const executeApplyClearance = async (product: any, prediction: ClearancePrediction) => {
    setApplyingId(product.id);
    try {
      await updateProduct(
        {
          ...product,
          price: prediction.newPrice,
          compareAtPrice: prediction.oldPrice,
          discountPercent: prediction.discountPercent,
          liquidationStatus: 'Liquidated',
          updatedAt: new Date().toISOString(),
        },
        { silentToast: false, forceShopifySync: true }
      );

      logBusinessAction({
        title: `Clearance Applied (-${prediction.discountPercent}%)`,
        productName: product.name,
        actionType: 'discount',
        changeDetails: `AI-predicted clearance reduced price from ${currencySymbol}${prediction.oldPrice} to ${currencySymbol}${prediction.newPrice} (-${prediction.discountPercent}%). Rationale: ${prediction.aiRationale}`,
        impactValue: `-${prediction.discountPercent}% Clearance`,
        previousValue: `${currencySymbol}${prediction.oldPrice}`,
        newValue: `${currencySymbol}${prediction.newPrice}`,
      });

      toast({
        title: `🏷️ ${prediction.discountPercent}% Clearance Saved to Database!`,
        description: `Price of "${product.name}" updated to ${currencySymbol}${prediction.newPrice.toLocaleString('en-IN')} in database & live store. Marked as Liquidated.`,
      });
      setConfirmItem(null);
    } catch (err: any) {
      console.error('Error applying clearance to database:', err);
      toast({
        variant: 'destructive',
        title: 'Database Update Notice',
        description: err?.message || 'Could not update product in database.',
      });
    } finally {
      setApplyingId(null);
    }
  };

  if (businessBuddyCalibration?.status === 'LEARNING' || !salesHistory.hasMinimumHistory) {
    const currentDayNumber = salesHistory.historyDays || businessBuddyCalibration?.currentDayNumber || 1;
    const targetDays = 30;
    const intelligence = businessBuddyCalibration?.intelligence || {
      detectedIndustry: 'Footwear & Retail',
      holdingPeriodDays: 30,
    };
    return (
      <Card className="ios-glass rounded-3xl border-emerald-500/25 p-5 shadow-xl space-y-4 bg-gradient-to-br from-emerald-950/10 via-background to-background">
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-foreground">
                  Clearance &amp; Dead Stock: Observing Demand Flow
                </CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold">
                  Day {currentDayNumber} of {targetDays} Baseline
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Clearance markdowns are safely on hold to protect brand equity while observing {intelligence.detectedIndustry} purchase cycles (requires 30+ days of sales history).
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowItemsPreview(!showItemsPreview)}
              className="rounded-xl text-xs gap-1.5 border-border/60 hover:bg-secondary font-semibold"
            >
              {showItemsPreview ? 'Hide Preview' : `Preview Catalog Items (${pendingItems.length})`}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 space-y-3">
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 text-xs space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Why 20-30% markdowns are paused on newly imported inventory:</strong>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  For <strong>{intelligence.detectedIndustry}</strong>, standard category holding window is <strong>{intelligence.holdingPeriodDays} days</strong>. Marking freshly imported products as &quot;dead stock&quot; on Day 1 erodes up to 30% gross profit before buyers have had a natural chance to discover them.
                </p>
              </div>
            </div>
          </div>

          {showItemsPreview && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Catalog Items Currently In Holding Period ({pendingItems.length})</span>
                <span>Threshold: {intelligence.holdingPeriodDays} days</span>
              </div>
              <div className="divide-y divide-border/30 rounded-2xl border border-border/40 bg-secondary/20 max-h-72 overflow-y-auto">
                {pendingItems.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Stock: {item.stock} • Price: {currencySymbol}{item.price?.toLocaleString('en-IN')} • Status: Protected in Full-Price Lifecycle
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 shrink-0">
                      In Cycle
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="ios-glass rounded-3xl border-rose-500/25 p-5 shadow-xl space-y-4">
        {/* Header */}
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <PackageX className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                Dead Stock & Predictive Liquidation
                {pendingItems.length > 0 ? (
                  <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                    {pendingItems.length} Action Needed
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    ✓ All Resolved ({resolvedItems.length})
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Dynamic elasticity-based discount prediction tailored individually to each product's margin & capital risk
              </CardDescription>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/dashboard/inventory')}
            className="rounded-xl text-xs gap-1.5 border-border/60 hover:bg-secondary font-semibold shrink-0"
          >
            <span>View in Inventory</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </Button>
        </CardHeader>

        <CardContent className="p-0 space-y-4">
          {/* Metric Callout Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
                Locked Working Capital
              </span>
              <span className="text-xl font-extrabold text-foreground block">
                {currencySymbol}{Math.round(totalDeadCapital).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Annual Carrying Cost Risk
              </span>
              <span className="text-xl font-extrabold text-amber-400 block">
                ~{currencySymbol}{Math.round(totalDeadCapital * 0.18).toLocaleString('en-IN')} / yr
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Liquidation Status
              </span>
              <span className="text-xl font-extrabold text-foreground block">
                {resolvedItems.length} of {deadStockItems.length} Liquidated
              </span>
            </div>
          </div>

          {/* If all dead stock items are resolved */}
          {pendingItems.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto animate-pulse" />
              <h4 className="font-bold text-foreground text-sm">All Stagnant Products Resolved!</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Dynamic elasticity clearance promos have been activated for all dormant stock items.
              </p>
              {resolvedItems.length > 0 && (
                <div className="pt-3 space-y-2 text-left max-w-xl mx-auto">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Active Clearance Promos ({resolvedItems.length})
                    </span>
                    <span className="text-[11px] text-muted-foreground">Shopify Push Available</span>
                  </div>
                  <div className="divide-y divide-border/30 rounded-2xl border border-emerald-500/20 bg-background/50 overflow-hidden">
                    {resolvedItems.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Price: {currencySymbol}{item.price?.toLocaleString('en-IN')}
                            {item.compareAtPrice ? (
                              <span className="line-through ml-1.5 text-muted-foreground/70">
                                {currencySymbol}{item.compareAtPrice.toLocaleString('en-IN')}
                              </span>
                            ) : null}
                            {' '}• SKU: {item.sku || 'N/A'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={applyingId === item.id}
                          onClick={() => setConfirmPushItem(item)}
                          className="rounded-xl text-[11px] h-7 px-3 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5 shrink-0 font-semibold cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${applyingId === item.id ? 'animate-spin' : ''}`} />
                          {applyingId === item.id ? 'Syncing...' : 'Push to Shopify'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Pending Dead Stock Products List */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                <span>Stagnant Products ({pendingItems.length})</span>
                <span>AI Predicted Clearance Action</span>
              </div>

              <div className="divide-y divide-border/40 rounded-2xl border border-border/40 overflow-hidden bg-secondary/20 max-h-[420px] overflow-y-auto">
                {pendingItems.slice(0, 6).map((item) => {
                  const costPrice = item.costPrice || (item.price || 500) * 0.6;
                  const tiedCapital = (item.stock || 0) * costPrice;
                  const prediction = predictOptimalClearanceDiscount(item, totalDeadCapital);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm truncate">{item.name}</span>
                          <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/30 px-1.5 py-0 font-medium">
                            Zero Sales
                          </Badge>
                          <button
                            type="button"
                            onClick={() => setConfirmItem({ product: item, prediction })}
                            title="Click to view AI Pricing Rationale"
                            className="inline-flex"
                          >
                            <Badge
                              className={`text-[9px] px-1.5 py-0 font-bold hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-1 ${
                                prediction.liquidationStrategy === 'Aggressive Velocity'
                                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                  : prediction.liquidationStrategy === 'Balanced Markdown'
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {prediction.liquidationStrategy}
                              <Sparkles className="w-2.5 h-2.5 ml-0.5" />
                            </Badge>
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku || 'N/A'} • {item.stock} {item.unit || 'units'} in stock • Current: {currencySymbol}{item.price?.toLocaleString('en-IN')} (Margin: {prediction.grossMarginBefore}%)
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-xs font-bold text-rose-400 block">
                            {currencySymbol}{Math.round(tiedCapital).toLocaleString('en-IN')} tied
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            Target: {currencySymbol}{prediction.newPrice.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          disabled={applyingId === item.id}
                          onClick={() => setConfirmItem({ product: item, prediction })}
                          className="rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 px-3.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Apply {prediction.discountPercent}% Off
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {pendingItems.length > 6 && (
                  <div className="p-3 text-center bg-secondary/30 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/dashboard/inventory?q=find+dead+stock')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold gap-1"
                    >
                      View all {pendingItems.length.toLocaleString()} stagnant products in Catalog Table →
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog with Full AI Prediction Rationale & Warning */}
      <Dialog
        open={confirmItem !== null}
        onOpenChange={(open) => {
          if (!open && !applyingId) setConfirmItem(null);
        }}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-emerald-500/30 rounded-3xl ios-glass text-white shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">Confirm Price Change & Clearance</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Please review and confirm before modifying your database and Shopify store.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {confirmItem && (
            <div className="py-2 text-xs space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-200 font-bold text-sm truncate">{confirmItem.product.name}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                    -{confirmItem.prediction.discountPercent}% Clearance
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800">
                  <div>
                    <span className="text-zinc-400 block">Current Selling Price:</span>
                    <span className="line-through text-zinc-300 font-bold text-sm">{currencySymbol}{confirmItem.prediction.oldPrice.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">New Discounted Price:</span>
                    <span className="text-emerald-400 font-extrabold text-base">{currencySymbol}{confirmItem.prediction.newPrice.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800/80">
                  <div>
                    <span className="text-zinc-400 block">Margin Headroom:</span>
                    <span className="text-zinc-200 font-semibold">{confirmItem.prediction.grossMarginBefore}% → {confirmItem.prediction.grossMarginAfter}%</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Capital to Unlock:</span>
                    <span className="text-emerald-300 font-bold">{currencySymbol}{confirmItem.prediction.estimatedCashUnlocked.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 leading-relaxed">
                  <span className="text-emerald-400 font-bold block mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> AI Strategy: {confirmItem.prediction.liquidationStrategy}
                  </span>
                  {confirmItem.prediction.aiRationale}
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Confirmation Required:</strong> Applying this will immediately write the new price ({currencySymbol}{confirmItem.prediction.newPrice.toLocaleString('en-IN')}) to your Firestore database and sync it to your live Shopify store variants.
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800/40">
            <Button
              variant="ghost"
              disabled={Boolean(applyingId)}
              onClick={() => setConfirmItem(null)}
              className="rounded-xl text-xs hover:bg-zinc-900 text-zinc-400 hover:text-white px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={Boolean(confirmItem && applyingId === confirmItem.product.id)}
              onClick={() => {
                if (confirmItem) {
                  executeApplyClearance(confirmItem.product, confirmItem.prediction);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs px-4 flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              {confirmItem && applyingId === confirmItem.product.id ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  Updating Database...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Confirm & Apply Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Push to Shopify */}
      <Dialog
        open={confirmPushItem !== null}
        onOpenChange={(open) => {
          if (!open && !applyingId) setConfirmPushItem(null);
        }}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-emerald-500/30 rounded-3xl ios-glass text-white shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <RefreshCw className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">Confirm Shopify Price Push</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Verify the price before pushing live to your storefront.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {confirmPushItem && (
            <div className="py-2 text-xs space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                <span className="text-zinc-200 font-bold text-sm block truncate">{confirmPushItem.name}</span>
                <div className="text-xs text-zinc-300">
                  Target Price: <strong className="text-emerald-400">{currencySymbol}{confirmPushItem.price?.toLocaleString('en-IN')}</strong>
                  {confirmPushItem.compareAtPrice ? (
                    <span className="ml-2 text-zinc-500 line-through">
                      {currencySymbol}{confirmPushItem.compareAtPrice?.toLocaleString('en-IN')}
                    </span>
                  ) : null}
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-zinc-300">
                  Are you sure you want to push this price override to your live Shopify product variants?
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800/40">
            <Button
              variant="ghost"
              disabled={Boolean(applyingId)}
              onClick={() => setConfirmPushItem(null)}
              className="rounded-xl text-xs hover:bg-zinc-900 text-zinc-400 hover:text-white px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={Boolean(confirmPushItem && applyingId === confirmPushItem.id)}
              onClick={async () => {
                if (!confirmPushItem) return;
                setApplyingId(confirmPushItem.id);
                try {
                  await updateProduct(confirmPushItem, { forceShopifySync: true, silentToast: false });
                  setConfirmPushItem(null);
                } finally {
                  setApplyingId(null);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs px-4 flex items-center gap-1.5"
            >
              {confirmPushItem && applyingId === confirmPushItem.id ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  Pushing...
                </>
              ) : (
                'Confirm & Push to Shopify'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
