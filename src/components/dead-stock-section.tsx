'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { logBusinessAction, getAuditLogs, BusinessAuditLog } from '@/lib/audit-store';
import { predictOptimalClearanceDiscount, ClearancePrediction } from '@/lib/ml/clearance-pricing-model';
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
  const { products = [], transactions = [], updateProduct, businessProfile } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const [confirmItem, setConfirmItem] = useState<{
    product: any;
    prediction: ClearancePrediction;
  } | null>(null);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<BusinessAuditLog[]>([]);

  useEffect(() => {
    setRecentLogs(getAuditLogs());
    const handleAudit = () => setRecentLogs(getAuditLogs());
    window.addEventListener('analyzeup_audit_logged', handleAudit);
    return () => window.removeEventListener('analyzeup_audit_logged', handleAudit);
  }, []);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Memoized Products with stock > 0 but zero sales in transaction history
  const deadStockItems = React.useMemo(() => {
    const saleProductIds = new Set(transactions.filter((t) => t.type === 'Sale').map((t) => t.productId));
    return products.filter((p) => p.stock > 0 && !saleProductIds.has(p.id));
  }, [products, transactions]);

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
                          onClick={async () => {
                            setApplyingId(item.id);
                            try {
                              await updateProduct(item, { forceShopifySync: true, silentToast: false });
                            } finally {
                              setApplyingId(null);
                            }
                          }}
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
                          onClick={() => executeApplyClearance(item, prediction)}
                          className="rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 px-3.5 shadow-sm shadow-emerald-600/20"
                        >
                          {applyingId === item.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Updating Database...
                            </>
                          ) : (
                            <>
                              <Tag className="w-3.5 h-3.5" />
                              Apply {prediction.discountPercent}% Off
                            </>
                          )}
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

      {/* Confirmation Dialog with Full AI Prediction Rationale */}
      <Dialog
        open={confirmItem !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmItem(null);
        }}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-emerald-500/30 rounded-3xl ios-glass text-white shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <DialogTitle className="text-base font-bold text-white">AI Clearance Recommendation</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              Optimal discount calculated by the product margin & capital elasticity prediction model.
            </DialogDescription>
          </DialogHeader>

          {confirmItem && (
            <div className="py-2 text-xs space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-200 font-bold text-sm">{confirmItem.product.name}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    -{confirmItem.prediction.discountPercent}% Clearance
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800">
                  <div>
                    <span className="text-zinc-400 block">Current Price:</span>
                    <span className="line-through text-zinc-300 font-bold">{currencySymbol}{confirmItem.prediction.oldPrice}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Target Clearance Price:</span>
                    <span className="text-emerald-400 font-extrabold text-sm">{currencySymbol}{confirmItem.prediction.newPrice}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800/80">
                  <div>
                    <span className="text-zinc-400 block">Post-Promo Margin:</span>
                    <span className="text-zinc-200 font-semibold">{confirmItem.prediction.grossMarginAfter}%</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Cash Unlocked:</span>
                    <span className="text-emerald-300 font-bold">{currencySymbol}{confirmItem.prediction.estimatedCashUnlocked.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 leading-relaxed">
                  <span className="text-emerald-400 font-bold block mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> AI Pricing Rationale:
                  </span>
                  {confirmItem.prediction.aiRationale}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800/40">
            <Button
              variant="ghost"
              onClick={() => setConfirmItem(null)}
              className="rounded-xl text-xs hover:bg-zinc-900 text-zinc-400 hover:text-white px-3"
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
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs px-4 flex items-center gap-1.5"
            >
              {confirmItem && applyingId === confirmItem.product.id ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving to Database...
                </>
              ) : (
                'Confirm & Save to Database'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
