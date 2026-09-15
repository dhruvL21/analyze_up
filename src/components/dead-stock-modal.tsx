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
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { PackageX, Tag, Check } from 'lucide-react';

interface DeadStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeadStockModal({ open, onOpenChange }: DeadStockModalProps) {
  const { products, transactions, updateProduct, businessProfile } = useData();
  const { toast } = useToast();

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  const saleProductIds = new Set(transactions.filter(t => t.type === 'Sale').map(t => t.productId));
  const deadStockItems = products.filter(p => p.stock > 0 && !saleProductIds.has(p.id));

  const totalDeadCapital = deadStockItems.reduce((acc, p) => acc + (p.stock * (p.costPrice || p.price * 0.6)), 0);

  const handleApplyDiscount = (product: any, percent: number) => {
    const oldPrice = product.price || 500;
    const newPrice = Math.round(oldPrice * (1 - percent / 100));
    updateProduct(
      {
        ...product,
        price: newPrice,
        compareAtPrice: oldPrice,
        discountPercent: percent,
        liquidationStatus: 'Liquidated',
        updatedAt: new Date().toISOString(),
      },
      { silentToast: false, forceShopifySync: true }
    );
    toast({
      title: 'Clearance Discount Applied!',
      description: `Reduced price of "${product.name}" by ${percent}% to ${currencySymbol}${newPrice}. Syncing with Shopify.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto ios-glass p-6 md:p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-destructive">
            <PackageX className="w-6 h-6 text-destructive" />
            Dead Stock & Locked Capital Inspector
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Identify stagnant inventory items with zero customer sales and clear locked working capital.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3 text-sm">
          {/* Summary Box */}
          <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-destructive uppercase tracking-wider block">Locked Working Capital</span>
              <span className="text-3xl font-extrabold text-foreground font-mono">{currencySymbol}{Math.round(totalDeadCapital).toLocaleString('en-IN')}</span>
            </div>
            <Badge className="bg-destructive text-destructive-foreground text-sm px-4 py-1.5 font-bold">
              {deadStockItems.length} Stagnant SKUs
            </Badge>
          </div>

          {/* List of items */}
          {deadStockItems.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
              <Check className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-bold text-base text-foreground">No Dead Stock Detected!</p>
              <p className="text-muted-foreground text-sm">All products in your inventory have active customer sales history.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40 rounded-2xl border border-border/40 overflow-hidden bg-secondary/20 max-h-[400px] overflow-y-auto">
              {deadStockItems.map((item) => {
                const tied = item.stock * (item.costPrice || item.price * 0.6);
                return (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/40 transition-colors">
                    <div className="space-y-1">
                      <p className="font-bold text-base text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono font-medium">
                        SKU: {item.sku || 'N/A'} • Stock: {item.stock} {item.unit || 'units'} • Price: {currencySymbol}{item.price}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-destructive text-sm pr-1">{currencySymbol}{Math.round(tied).toLocaleString('en-IN')} tied</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplyDiscount(item, 20)}
                        className="rounded-xl text-xs gap-1.5 h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-semibold px-3"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Apply 20% Off
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button variant="secondary" className="rounded-xl px-5 text-sm font-semibold">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
