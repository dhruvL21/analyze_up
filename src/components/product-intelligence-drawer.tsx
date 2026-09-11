'use client';

import React from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Product } from '@/lib/types';
import { computeProductIntelligence } from '@/lib/product-intelligence-engine';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { logBusinessAction, getAuditLogs, BusinessAuditLog } from '@/lib/audit-store';
import {
  Sparkles,
  TrendingUp,
  PackagePlus,
  ArrowRight,
  Truck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ProductIntelligenceDrawerProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductIntelligenceDrawer({ product, open, onOpenChange }: ProductIntelligenceDrawerProps) {
  const { products, transactions, returns, suppliers, updateProduct, addOrder, businessProfile, capabilities, dataReadiness } = useData();
  const { toast } = useToast();

  const [confirmData, setConfirmData] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [recentLogs, setRecentLogs] = React.useState<BusinessAuditLog[]>([]);

  React.useEffect(() => {
    setRecentLogs(getAuditLogs());
    const handleAudit = () => setRecentLogs(getAuditLogs());
    window.addEventListener('analyzeup_audit_logged', handleAudit);
    return () => window.removeEventListener('analyzeup_audit_logged', handleAudit);
  }, []);

  if (!product) return null;

  // Always resolve live, real-time product from React context / Firestore
  const liveProduct = products.find((p) => p.id === product.id || (p.sku && product.sku && p.sku === product.sku)) || product;

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';
  const report = computeProductIntelligence(liveProduct, transactions, returns, suppliers, {
    isDeadStockEnabled: capabilities?.deadStockDetection,
    isVelocityEnabled: capabilities?.trendAnalysis,
    historicalDays: dataReadiness?.historicalDays,
  });

  const hasRecentlyOptimizedPrice = recentLogs.some(
    (log) => log.productName.toLowerCase() === liveProduct.name.toLowerCase() && (log.actionType === 'price_up' || log.actionType === 'discount')
  );

  const handleExecuteReorder = () => {
    const reorderQty = report.reorderAdvice.suggestedQty || 20;
    const costPrice = liveProduct.costPrice || (liveProduct.price || 500) * 0.6;
    const totalCost = Math.round(costPrice * reorderQty);
    const leadTime = liveProduct.leadTimeDays || 7;

    setConfirmData({
      title: `Create Purchase Order for ${reorderQty} Units`,
      description: `Create purchase order with supplier "${liveProduct.supplier || suppliers[0]?.name || 'Supplier'}" for ${reorderQty} units of "${liveProduct.name}" at ${currencySymbol}${costPrice}/unit (Total: ${currencySymbol}${totalCost.toLocaleString('en-IN')}). The PO will be tracked as In Transit and stock will update when marked Received upon physical arrival.`,
      onConfirm: async () => {
        try {
          await addOrder({
            supplierId: liveProduct.supplierId || suppliers[0]?.id || 'sup-1',
            productId: liveProduct.id,
            quantity: reorderQty,
            unitCost: costPrice,
            totalCost: totalCost,
            orderDate: new Date().toISOString(),
            expectedDeliveryDate: new Date(Date.now() + leadTime * 86400000).toISOString(),
            status: 'Pending',
          });

          logBusinessAction({
            title: `PO Created (In Transit): ${reorderQty} units`,
            productName: liveProduct.name,
            actionType: 'reorder',
            changeDetails: `Issued purchase order for ${reorderQty} units at ${currencySymbol}${costPrice}/unit to "${liveProduct.supplier || 'Supplier'}". Expected delivery in ${leadTime} days.`,
            impactValue: `${currencySymbol}${totalCost.toLocaleString('en-IN')}`,
            previousValue: `Stock: ${liveProduct.stock}`,
            newValue: `In Transit: ${reorderQty} units`,
          });

          toast({
            title: '📦 Purchase Order Created (In Transit)!',
            description: `Order for ${reorderQty} units of "${liveProduct.name}" logged. Track and mark received in Orders Tracking when goods arrive.`,
          });
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  const handleApplyClearance = () => {
    const oldPrice = liveProduct.price || 500;
    const targetPrice = report.opportunityAdvice.targetPrice || Math.round(oldPrice * 0.8);

    setConfirmData({
      title: 'Apply 20% Clearance Discount',
      description: `Reduce the selling price of "${liveProduct.name}" from ${currencySymbol}${oldPrice} to ${currencySymbol}${targetPrice} (-20%) to liquidate dead stock. This updates catalog pricing.`,
      onConfirm: async () => {
        try {
          await updateProduct({
            ...liveProduct,
            price: targetPrice,
            updatedAt: new Date().toISOString(),
          });

          logBusinessAction({
            title: 'Clearance Promo Applied (-20%)',
            productName: liveProduct.name,
            actionType: 'discount',
            changeDetails: `Reduced catalog selling price by 20% from ${currencySymbol}${oldPrice} to ${currencySymbol}${targetPrice} to liquidate inventory.`,
            impactValue: `-20% off`,
            previousValue: `${currencySymbol}${oldPrice}`,
            newValue: `${currencySymbol}${targetPrice}`,
          });

          toast({
            title: '🏷️ Clearance Promo Applied!',
            description: `Updated selling price of "${liveProduct.name}" to ${currencySymbol}${targetPrice} in database.`,
          });
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  const handleApplyPriceUp = () => {
    const oldPrice = liveProduct.price || 500;
    const targetPrice = report.opportunityAdvice.targetPrice || Math.max(oldPrice + 10, Math.round(oldPrice * 1.08));
    const actionTitle = report.opportunityAdvice.title || 'Optimize Selling Price';

    setConfirmData({
      title: `${actionTitle}: ${currencySymbol}${targetPrice.toLocaleString('en-IN')}`,
      description: `Adjust selling price of "${liveProduct.name}" from ${currencySymbol}${oldPrice.toLocaleString('en-IN')} to ${currencySymbol}${targetPrice.toLocaleString('en-IN')} to protect product profitability and margin.`,
      onConfirm: async () => {
        try {
          await updateProduct({
            ...liveProduct,
            price: targetPrice,
            updatedAt: new Date().toISOString(),
          });

          logBusinessAction({
            title: actionTitle,
            productName: liveProduct.name,
            actionType: 'price_up',
            changeDetails: `Adjusted price from ${currencySymbol}${oldPrice} to ${currencySymbol}${targetPrice} to protect profit margins.`,
            impactValue: `${currencySymbol}${targetPrice}`,
            previousValue: `${currencySymbol}${oldPrice}`,
            newValue: `${currencySymbol}${targetPrice}`,
          });

          toast({
            title: '📈 Product Price Updated!',
            description: `Updated price of "${liveProduct.name}" to ${currencySymbol}${targetPrice.toLocaleString('en-IN')}.`,
          });
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  const formattedMargin = report.profitMarginPercent < -100 ? '-100%' : `${report.profitMarginPercent}%`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background/95 border border-border/60 rounded-3xl ios-glass shadow-2xl p-6 space-y-4">
          <DialogHeader className="space-y-2 border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 font-extrabold flex items-center justify-center text-base border border-amber-500/30 shrink-0">
                {liveProduct.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-bold text-foreground truncate">{liveProduct.name}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  SKU: {liveProduct.sku || 'N/A'} • {liveProduct.categoryId || 'General Category'} • {liveProduct.brand || 'Brand'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* AI Executive Summary Card */}
          <div className="p-4 rounded-2xl bg-secondary/40 border border-border/40 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-primary text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-primary" />
              AI Executive Summary
            </div>
            <p className="text-foreground/90 leading-relaxed font-normal">{report.executiveSummary}</p>
          </div>

          {/* Metric Quad Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/40 space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium block">Current Stock</span>
              <p className="text-lg font-bold text-foreground">{liveProduct.stock} {liveProduct.unit || 'Piece'}</p>
            </div>

            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/40 space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium block">Stock Runway</span>
              <p className="text-lg font-bold text-foreground">
                {report.daysOfStockRemaining >= 999 ? '∞ Days' : `~${report.daysOfStockRemaining} Days`}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/40 space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium block">Daily Velocity</span>
              <p className="text-lg font-bold text-foreground">{report.averageDailySales} / day</p>
            </div>

            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/40 space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium block">Profit Margin</span>
              <p className={`text-lg font-bold ${report.profitMarginPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formattedMargin}
              </p>
            </div>
          </div>

          {/* 1-Click Restock Action */}
          {report.reorderAdvice.needed ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <PackagePlus className="w-4 h-4" /> Restock Recommendation
                </span>
                <p className="text-muted-foreground">{report.reorderAdvice.reason}</p>
              </div>
              <Button
                size="sm"
                onClick={handleExecuteReorder}
                className="rounded-xl text-xs gap-1 bg-amber-600 hover:bg-amber-500 text-white shrink-0 font-semibold"
              >
                Execute Reorder PO ({report.reorderAdvice.suggestedQty} Units)
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-400 block">Inventory Runway Healthy</span>
                <p className="text-muted-foreground text-[11px]">
                  Current stock ({liveProduct.stock} units) covers expected sales demand across supplier delivery windows.
                </p>
              </div>
            </div>
          )}

          {/* 1-Click Pricing Opportunity / Confirmation */}
          {hasRecentlyOptimizedPrice ? (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-400 block">Pricing Optimized</span>
                <p className="text-muted-foreground text-[11px]">
                  Current price ({currencySymbol}{liveProduct.price.toLocaleString('en-IN')}) is calibrated with sales velocity and healthy profit margins.
                </p>
              </div>
            </div>
          ) : report.opportunityAdvice.hasOpportunity ? (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> {report.opportunityAdvice.title}
                </span>
                <p className="text-muted-foreground">{report.opportunityAdvice.description}</p>
              </div>
              <Button
                size="sm"
                onClick={report.opportunityAdvice.type === 'clearance' ? handleApplyClearance : handleApplyPriceUp}
                className="rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 font-semibold"
              >
                Execute 1-Click Action
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : null}

          {/* Supplier Procurement Intelligence */}
          {report.supplierIntelligence && (
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-primary" /> Supplier Intelligence: {report.supplierIntelligence.supplierName}
                </span>
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 font-semibold">
                  {report.supplierIntelligence.supplierStatus}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-muted-foreground block">Lead Time</span>
                  <span className="font-bold text-foreground">{report.supplierIntelligence.leadTimeDays} days</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">On-Time Delivery</span>
                  <span className="font-bold text-emerald-400">
                    {report.supplierIntelligence.onTimeDeliveryRate ? `${report.supplierIntelligence.onTimeDeliveryRate}%` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Supplier Score</span>
                  <span className="font-bold text-primary">
                    {report.supplierIntelligence.supplierScore ? `${report.supplierIntelligence.supplierScore}/100` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border/40">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="rounded-xl text-xs">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmData !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmData(null);
        }}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-amber-500/20 rounded-3xl ios-glass text-white shadow-2xl p-6">
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
