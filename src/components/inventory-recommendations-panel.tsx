'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { logBusinessAction } from '@/lib/audit-store';
import { AuditLogModal } from '@/components/audit-log-modal';
import { Sparkles, ArrowRight, CheckCircle2, TrendingUp, PackagePlus, Tag, ShieldCheck, RefreshCw, History, AlertTriangle, Clock } from 'lucide-react';
import { evaluateSalesHistory } from '@/lib/sales-history-helper';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function InventoryRecommendationsPanel() {
  const { products, transactions, updateProduct, addOrder, addTransaction, suppliers, businessProfile, dataReadiness, capabilities } = useData();
  const { toast } = useToast();

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('analyzeup_applied_recommendations');
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Dynamic Sales History Evaluation (verifies at least 1 month of sales history before predicting discounts / price hikes)
  const salesHistory = React.useMemo(() => {
    return evaluateSalesHistory(products, transactions);
  }, [products, transactions]);

  const markApplied = (key: string) => {
    setAppliedIds(prev => {
      const next = new Set(prev).add(key);
      if (typeof window !== 'undefined') {
        localStorage.setItem('analyzeup_applied_recommendations', JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const handleResetApplied = () => {
    setAppliedIds(new Set());
    if (typeof window !== 'undefined') {
      localStorage.removeItem('analyzeup_applied_recommendations');
    }
    toast({
      title: 'Recommendations Refreshed',
      description: 'Reset applied recommendation history to re-analyze full catalog.',
    });
  };

  // Candidate 1: Low Stock Reorder (Physical inventory truth: 0 units or stock <= minStock)
  const lowStockProd = React.useMemo(() => {
    return products.find(
      p => p && p.stock <= (p.minStock || 5) && !appliedIds.has(`${p.id}:reorder`)
    );
  }, [products, appliedIds]);

  // Candidate 2: Dead Stock Clearance
  // Centralized Capability Gate: Only unlocks when deadStockDetection capability is enabled
  const deadStockProd = React.useMemo(() => {
    if (!capabilities?.deadStockDetection && !salesHistory.hasMinimumHistory) return null;
    return products.find(
      p => p && p.stock > 0 && salesHistory.isProductEligibleForDeadStock(p) && !appliedIds.has(`${p.id}:clearance`)
    );
  }, [products, capabilities, salesHistory, appliedIds]);

  // Candidate 3: Price Increase Optimization
  // Centralized Capability Gate: Only unlocks when demandForecasting capability is enabled
  const priceUpProd = React.useMemo(() => {
    if (!capabilities?.demandForecasting && !salesHistory.hasMinimumHistory) return null;
    return products.find(
      p => p &&
        p.id !== deadStockProd?.id &&
        salesHistory.isProductEligibleForPriceUp(p) &&
        !appliedIds.has(`${p.id}:price_up`)
    );
  }, [products, capabilities, salesHistory, deadStockProd, appliedIds]);

  const handleReorder = (prod: any) => {
    const key = `${prod.id}:reorder`;
    const reorderQty = (prod.minStock || 5) * 4 || 50;
    const costPrice = prod.costPrice || (prod.price || 500) * 0.6;
    const totalCost = Math.round(costPrice * reorderQty);
    const pName = prod.name || prod.productName || 'Product';

    setConfirmData({
      title: `Create Purchase Order for ${reorderQty} Units`,
      description: `Create and fulfill a purchase order with supplier "${prod.supplier || suppliers[0]?.name || 'Supplier'}" for ${reorderQty} units of "${pName}" at a cost of ${currencySymbol}${costPrice}/unit (Total: ${currencySymbol}${totalCost.toLocaleString('en-IN')}). This will increment stock levels.`,
      onConfirm: async () => {
        setAnimatingId(key);
        try {
          await addOrder({
            supplierId: prod.supplierId || suppliers[0]?.id || 'sup-1',
            productId: prod.id,
            quantity: reorderQty,
            unitCost: costPrice,
            totalCost: totalCost,
            orderDate: new Date().toISOString(),
            expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            status: 'Fulfilled',
          });

          logBusinessAction({
            title: 'Executed Reorder Purchase Order',
            productName: pName,
            actionType: 'reorder',
            changeDetails: `Created PO for ${reorderQty} units with supplier ${prod.supplier || suppliers[0]?.name || 'Supplier'}. Total cost: ${currencySymbol}${totalCost.toLocaleString('en-IN')}. Stock updated.`,
            impactValue: `+${reorderQty} Units Restocked`,
          });

          setTimeout(() => {
            markApplied(key);
            setAnimatingId(null);
          }, 800);

          toast({
            title: '📦 Reorder PO Logged & Saved in History!',
            description: `Added ${reorderQty} units to "${pName}". Click "Change History" to view recorded audit.`,
          });
        } catch (err) {
          console.error(err);
          setAnimatingId(null);
        }
      }
    });
  };

  const handleClearance = (prod: any) => {
    const key = `${prod.id}:clearance`;
    const oldPrice = prod.price || 500;
    const newPrice = Math.round(oldPrice * 0.8);
    const pName = prod.name || prod.productName || 'Product';

    setConfirmData({
      title: 'Apply 20% Clearance Discount',
      description: `Reduce the selling price of "${pName}" from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (-20%) to liquidate dead stock. This will modify catalog pricing.`,
      onConfirm: async () => {
        setAnimatingId(key);
        try {
          await updateProduct({
            ...prod,
            price: newPrice,
            updatedAt: new Date().toISOString(),
          });

          logBusinessAction({
            title: 'Applied 20% Clearance Promo',
            productName: pName,
            actionType: 'discount',
            changeDetails: `Reduced selling price from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (-20%). Unlocked tied cash flow.`,
            impactValue: `-20% Price Clearance`,
          });

          setTimeout(() => {
            markApplied(key);
            setAnimatingId(null);
          }, 800);

          toast({
            title: '🏷️ Clearance Promo Applied & Saved in History!',
            description: `Reduced price of "${pName}" to ${currencySymbol}${newPrice}. Click "Change History" to view audit details.`,
          });
        } catch (err) {
          console.error(err);
          setAnimatingId(null);
        }
      }
    });
  };

  const handlePriceUp = (prod: any) => {
    const key = `${prod.id}:price_up`;
    const oldPrice = prod.price || 500;
    const newPrice = Math.round(oldPrice * 1.08);
    const pName = prod.name || prod.productName || 'Product';

    setConfirmData({
      title: 'Optimize Price (+8%)',
      description: `Increase the selling price of "${pName}" from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (+8%) for margin optimization. This will modify catalog pricing.`,
      onConfirm: async () => {
        setAnimatingId(key);
        try {
          await updateProduct({
            ...prod,
            price: newPrice,
            updatedAt: new Date().toISOString(),
          });

          logBusinessAction({
            title: 'Optimized Price (+8%)',
            productName: pName,
            actionType: 'price_up',
            changeDetails: `Adjusted selling price from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (+8%) for margin expansion.`,
            impactValue: `+8% Price Boost`,
          });

          setTimeout(() => {
            markApplied(key);
            setAnimatingId(null);
          }, 800);

          toast({
            title: '📈 Selling Price Optimized & Saved in History!',
            description: `Adjusted price of "${pName}" to ${currencySymbol}${newPrice}. Click "Change History" to view audit details.`,
          });
        } catch (err) {
          console.error(err);
          setAnimatingId(null);
        }
      }
    });
  };

  const isAllOptimized = salesHistory.hasMinimumHistory && !lowStockProd && !deadStockProd && !priceUpProd && appliedIds.size > 0;

  return (
    <>
      <Card className="ios-glass rounded-3xl border-emerald-500/20 p-5 shadow-xl space-y-3">
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 flex-wrap">
                Proactive AI Inventory Recommendations
                {appliedIds.size > 0 && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                    {appliedIds.size} Applied
                  </Badge>
                )}
                {!salesHistory.hasMinimumHistory && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {salesHistory.historyDays > 0 ? `${salesHistory.historyDays}/30 Days Sales Data` : 'Sales History Baseline'}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">Continuous 1-click optimization advice for your catalog</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 text-xs pt-1">
          {isAllOptimized ? (
            <div className="p-6 text-center space-y-2.5 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
              <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 w-12 h-12 mx-auto flex items-center justify-center border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-foreground text-sm">Catalog 100% Optimized!</h4>
              <p className="text-muted-foreground text-xs max-w-sm mx-auto">
                All active product prices, reorders, and clearance promotions have been executed and logged.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button onClick={() => setIsAuditModalOpen(true)} variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                  <History className="w-3.5 h-3.5" /> View Executed Change Audit Log
                </Button>
                {appliedIds.size > 0 && (
                  <Button onClick={handleResetApplied} variant="ghost" size="sm" className="rounded-xl text-xs gap-1 text-muted-foreground hover:text-foreground">
                    <RefreshCw className="w-3 h-3" /> Re-analyze
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Column 1: Reorder / Stock Buffer */}
              {lowStockProd ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <PackagePlus className="w-3.5 h-3.5 text-amber-400" /> Restock Urgently
                      </span>
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">High Priority</Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">{lowStockProd.name || lowStockProd.productName}</p>
                    <p className="text-muted-foreground text-[11px]">Current stock: {lowStockProd.stock} units. Reorder 50 units immediately to avoid stockout.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleReorder(lowStockProd)}
                    disabled={animatingId === `${lowStockProd.id}:reorder`}
                    className="w-full rounded-xl text-xs gap-1 bg-amber-600 hover:bg-amber-500 text-white shadow-sm h-8 cursor-pointer"
                  >
                    {animatingId === `${lowStockProd.id}:reorder` ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 animate-bounce" /> Applied!
                      </>
                    ) : (
                      <>
                        Execute Reorder PO <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <PackagePlus className="w-3.5 h-3.5 text-emerald-400" /> Restock Urgently
                      </span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">Optimal Buffer</Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">Stock Levels Healthy</p>
                    <p className="text-muted-foreground text-[11px]">All catalog items maintain stock above supplier lead-time reorder thresholds.</p>
                  </div>
                  <div className="h-8 w-full rounded-xl text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Buffer Maintained
                  </div>
                </div>
              )}

              {/* Column 2: Clearance & Dead Stock */}
              {deadStockProd ? (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <Tag className="w-3.5 h-3.5 text-rose-400" /> Liquidate Dead Stock
                      </span>
                      <Badge variant="outline" className="text-rose-400 border-rose-500/30 text-[10px]">Clear Capital</Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">{deadStockProd.name || deadStockProd.productName}</p>
                    <p className="text-muted-foreground text-[11px]">{deadStockProd.stock} units sitting unsold for 30+ days. Launch 20% discount to unlock cash flow.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleClearance(deadStockProd)}
                    disabled={animatingId === `${deadStockProd.id}:clearance`}
                    className="w-full rounded-xl text-xs gap-1 bg-rose-600 hover:bg-rose-500 text-white shadow-sm h-8 cursor-pointer"
                  >
                    {animatingId === `${deadStockProd.id}:clearance` ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 animate-bounce" /> Applied!
                      </>
                    ) : (
                      <>
                        Apply 20% Clearance <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              ) : !salesHistory.hasMinimumHistory ? (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <Tag className="w-3.5 h-3.5 text-blue-400" /> Liquidate Dead Stock
                      </span>
                      <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px]">
                        {salesHistory.historyDays > 0 ? `${salesHistory.historyDays}/30 Days History` : 'History Needed'}
                      </Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">Awaiting 30-Day Sales History</p>
                    <p className="text-muted-foreground text-[11px]">
                      Clearance discount predictions require at least 1 month of sales history to protect active stock from premature markdowns.
                    </p>
                  </div>
                  <div className="h-8 w-full rounded-xl text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Unlocks with 30+ days data</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <Tag className="w-3.5 h-3.5 text-emerald-400" /> Liquidate Dead Stock
                      </span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">Catalog Active</Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">Zero Dead Stock Detected</p>
                    <p className="text-muted-foreground text-[11px]">
                      All active catalog SKUs have recorded sales transactions within the 30-day cycle. No clearance required.
                    </p>
                  </div>
                  <div className="h-8 w-full rounded-xl text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Healthy Turnover
                  </div>
                </div>
              )}

              {/* Column 3: Margin & Price Boost */}
              {priceUpProd ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Optimize Margin (+8%)
                      </span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">High Demand</Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">{priceUpProd.name || priceUpProd.productName}</p>
                    <p className="text-muted-foreground text-[11px]">Strong 30-day velocity. Increase selling price to {currencySymbol}{Math.round((priceUpProd.price || 500) * 1.08)} for margin expansion.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePriceUp(priceUpProd)}
                    disabled={animatingId === `${priceUpProd.id}:price_up`}
                    className="w-full rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm h-8 cursor-pointer"
                  >
                    {animatingId === `${priceUpProd.id}:price_up` ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 animate-bounce" /> Applied!
                      </>
                    ) : (
                      <>
                        Optimize Price (+8%) <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              ) : !salesHistory.hasMinimumHistory ? (
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Optimize Margin (+8%)
                      </span>
                      <Badge variant="outline" className="text-purple-400 border-purple-500/30 text-[10px]">Observing Velocity</Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">Awaiting 30-Day Velocity Baseline</p>
                    <p className="text-muted-foreground text-[11px]">
                      Price increase recommendations require 30+ days of sustained sales data to verify elasticity without dampening conversions.
                    </p>
                  </div>
                  <div className="h-8 w-full rounded-xl text-[11px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>Unlocks with 30+ days data</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground flex items-center gap-1 text-xs">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Optimize Margin (+8%)
                      </span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">Margins Balanced</Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs">Optimal Pricing Across Catalog</p>
                    <p className="text-muted-foreground text-[11px]">
                      Current catalog prices match category velocity. No product candidates need immediate price hikes.
                    </p>
                  </div>
                  <div className="h-8 w-full rounded-xl text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Margins Optimized
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Modal */}
      <AuditLogModal
        open={isAuditModalOpen}
        onOpenChange={setIsAuditModalOpen}
      />

      <Dialog open={confirmData !== null} onOpenChange={(open) => { if (!open) setConfirmData(null); }}>
        <DialogContent className="max-w-md bg-zinc-950/90 border border-amber-500/20 rounded-3xl ios-glass text-white shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 animate-bounce text-amber-400" />
              </div>
              <DialogTitle className="text-base font-bold text-white">Confirm Business Change</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              Are you sure you want to execute this change? This will write modifications directly to your database.
            </DialogDescription>
          </DialogHeader>

          {confirmData && (
            <div className="py-2 text-xs space-y-3">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                <div className="text-zinc-200 font-bold">{confirmData.title}</div>
                <div className="text-zinc-300 leading-relaxed">{confirmData.description}</div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800/40">
            <Button
              variant="ghost"
              onClick={() => setConfirmData(null)}
              className="rounded-xl text-xs hover:bg-zinc-900 text-zinc-400 hover:text-white px-3"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmData) {
                  confirmData.onConfirm();
                  setConfirmData(null);
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-xs px-4"
            >
              Confirm & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
