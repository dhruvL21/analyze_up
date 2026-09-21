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
import { useUser } from '@/firebase';
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
  ZoomIn,
  Camera,
  ImageIcon,
} from 'lucide-react';

/**
 * Resolves product image from multiple canonical and raw source attributes
 */
function resolveProductImage(p: Product | null | undefined): string | null {
  if (!p) return null;
  if (typeof p.imageUrl === 'string' && p.imageUrl.trim()) return p.imageUrl.trim();
  const rawObj = p as Record<string, any>;
  if (typeof rawObj.image === 'string' && rawObj.image.trim()) return rawObj.image.trim();
  if (typeof rawObj.image_url === 'string' && rawObj.image_url.trim()) return rawObj.image_url.trim();
  if (typeof rawObj.thumbnail === 'string' && rawObj.thumbnail.trim()) return rawObj.thumbnail.trim();
  if (Array.isArray(rawObj.images) && rawObj.images.length > 0) {
    const first = rawObj.images[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first?.src && typeof first.src === 'string') return first.src.trim();
    if (first?.url && typeof first.url === 'string') return first.url.trim();
  }
  const rawAttrs = rawObj.rawAttributes || rawObj.customAttributes || {};
  const rawSrc = rawAttrs['Image Src'] || rawAttrs['image_src'] || rawAttrs['Image URL'] || rawAttrs['image_url'] || rawAttrs['Image'] || rawAttrs['image'];
  if (typeof rawSrc === 'string' && rawSrc.trim()) return rawSrc.trim();
  return null;
}

interface ProductIntelligenceDrawerProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductIntelligenceDrawer({ product, open, onOpenChange }: ProductIntelligenceDrawerProps) {
  const { products, transactions, returns, suppliers, updateProduct, addOrder, businessProfile, capabilities, dataReadiness } = useData();
  const { toast } = useToast();

  const { user } = useUser();
  const [confirmData, setConfirmData] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [recentLogs, setRecentLogs] = React.useState<BusinessAuditLog[]>(() => (user?.uid ? getAuditLogs(user.uid) : []));
  const [imageError, setImageError] = React.useState(false);
  const [isZoomOpen, setIsZoomOpen] = React.useState(false);
  const [isEditingImage, setIsEditingImage] = React.useState(false);
  const [imageUrlInput, setImageUrlInput] = React.useState('');
  const [isSavingImage, setIsSavingImage] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [product?.id]);

  React.useEffect(() => {
    setRecentLogs(user?.uid ? getAuditLogs(user.uid) : []);
    const handleAudit = (e: Event) => {
      const customEvt = e as CustomEvent;
      const targetUid = customEvt.detail?.userId;
      if (!targetUid || (user?.uid && targetUid === user.uid)) {
        setRecentLogs(user?.uid ? getAuditLogs(user.uid) : []);
      }
    };
    window.addEventListener('analyzeup_audit_logged', handleAudit);
    return () => window.removeEventListener('analyzeup_audit_logged', handleAudit);
  }, [user?.uid]);

  if (!product) return null;

  // Always resolve live, real-time product from React context / Firestore
  const liveProduct = products.find((p) => p.id === product.id || (p.sku && product.sku && p.sku === product.sku)) || product;

  const productImage = !imageError ? resolveProductImage(liveProduct) : null;

  const handleSaveImageUrl = async () => {
    if (!imageUrlInput.trim()) return;
    setIsSavingImage(true);
    try {
      await updateProduct(
        {
          ...liveProduct,
          imageUrl: imageUrlInput.trim(),
          updatedAt: new Date().toISOString(),
        },
        { silentToast: false }
      );
      setImageError(false);
      setIsEditingImage(false);
      toast({
        title: 'Product Image Saved ✨',
        description: `Updated image URL for "${liveProduct.name}".`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to update image',
        description: err?.message || 'Could not save image URL.',
      });
    } finally {
      setIsSavingImage(false);
    }
  };

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';
  const report = computeProductIntelligence(liveProduct, transactions, returns, suppliers, {
    isDeadStockEnabled: Boolean(capabilities?.deadStockDetection && dataReadiness?.level !== 'LEARNING'),
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
          await updateProduct(
            {
              ...liveProduct,
              price: targetPrice,
              compareAtPrice: oldPrice,
              discountPercent: 20,
              liquidationStatus: 'Liquidated',
              updatedAt: new Date().toISOString(),
            },
            { forceShopifySync: true, silentToast: false }
          );

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
            description: `Updated selling price of "${liveProduct.name}" to ${currencySymbol}${targetPrice} in database and Shopify.`,
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
          await updateProduct(
            {
              ...liveProduct,
              price: targetPrice,
              updatedAt: new Date().toISOString(),
            },
            { forceShopifySync: true, silentToast: false }
          );

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
          <DialogHeader className="space-y-3 border-b border-border/40 pb-4">
            <div className="flex items-start gap-3.5">
              {/* Product Image Thumbnail with Lightbox & Inline Edit */}
              <div className="relative group shrink-0">
                <div
                  onClick={() => {
                    if (productImage) {
                      setIsZoomOpen(true);
                    } else {
                      setImageUrlInput(liveProduct.imageUrl || '');
                      setIsEditingImage(true);
                    }
                  }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-border/60 bg-secondary/50 shadow-md flex items-center justify-center cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-primary/40 hover:border-primary/50 relative"
                  title={productImage ? 'Click to enlarge product image' : 'Click to add product image'}
                >
                  {productImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={productImage}
                        alt={liveProduct.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={() => setImageError(true)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <ZoomIn className="w-5 h-5 drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400 font-black flex flex-col items-center justify-center border border-amber-500/30 gap-1 p-1 text-center">
                      <span className="text-xl leading-none font-extrabold">{liveProduct.name.charAt(0).toUpperCase()}</span>
                      <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-0.5">
                        <ImageIcon className="w-2.5 h-2.5" /> Add Image
                      </span>
                    </div>
                  )}
                </div>

                {/* Edit / Set Image Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageUrlInput(liveProduct.imageUrl || productImage || '');
                    setIsEditingImage(true);
                  }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border border-border/60 shadow-md flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                  title={productImage ? 'Change Image URL' : 'Add Image URL'}
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>

              {/* Title & Metadata */}
              <div className="min-w-0 flex-1 space-y-1.5 pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-snug">
                    {liveProduct.name}
                  </DialogTitle>
                  <Badge className={`${report.badgeClass} text-[10px] px-2.5 py-0.5 font-semibold shrink-0 rounded-full shadow-sm`}>
                    {report.healthStatus}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono text-foreground/80">SKU: {liveProduct.sku || 'N/A'}</span>
                  <span>•</span>
                  <span>{liveProduct.category || liveProduct.categoryId || 'General Category'}</span>
                  <span>•</span>
                  <span>{liveProduct.brand || liveProduct.supplier || 'Brand'}</span>
                </DialogDescription>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-sm font-bold text-foreground">
                    {currencySymbol}{Number(liveProduct.price || 0).toLocaleString('en-IN')}
                  </span>
                  {liveProduct.compareAtPrice && liveProduct.compareAtPrice > liveProduct.price && (
                    <span className="text-xs text-muted-foreground line-through">
                      {currencySymbol}{Number(liveProduct.compareAtPrice).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
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

      {/* Product Image Lightbox / Zoom Dialog */}
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="max-w-md bg-background/95 border border-border/60 rounded-3xl ios-glass p-5 text-center space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold truncate">{liveProduct.name}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              SKU: {liveProduct.sku || 'N/A'} • {currencySymbol}{Number(liveProduct.price || 0).toLocaleString('en-IN')}
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-border/40 bg-secondary/30 flex items-center justify-center">
            {productImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productImage}
                alt={liveProduct.name}
                className="w-full h-full object-contain p-2"
              />
            )}
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsZoomOpen(false);
                setImageUrlInput(liveProduct.imageUrl || productImage || '');
                setIsEditingImage(true);
              }}
              className="rounded-xl text-xs gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              Change Image
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsZoomOpen(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Set Product Image URL Dialog */}
      <Dialog open={isEditingImage} onOpenChange={setIsEditingImage}>
        <DialogContent className="max-w-sm bg-background/95 border border-border/60 rounded-3xl ios-glass p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-primary" />
              Update Product Image
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide a direct image URL for &quot;{liveProduct.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://example.com/product-image.jpg"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl bg-secondary/50 border border-border/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {imageUrlInput.trim() && (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/40 bg-secondary/20 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrlInput.trim()}
                  alt="Preview"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingImage(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveImageUrl}
              disabled={isSavingImage || !imageUrlInput.trim()}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {isSavingImage ? 'Saving...' : 'Save Image'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
