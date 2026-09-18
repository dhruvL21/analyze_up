'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { logBusinessAction } from '@/lib/audit-store';
import { ShoppingBag, Calendar, PackageCheck, AlertCircle, Loader2 } from 'lucide-react';

interface CreatePurchaseOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSupplierId?: string;
  defaultProductId?: string;
  defaultQuantity?: number;
}

export function CreatePurchaseOrderModal({
  open,
  onOpenChange,
  defaultSupplierId,
  defaultProductId,
  defaultQuantity,
}: CreatePurchaseOrderModalProps) {
  const { suppliers, products, addOrder, businessProfile } = useData();
  const { toast } = useToast();

  const [supplierId, setSupplierId] = useState<string>(defaultSupplierId || '');
  const [productId, setProductId] = useState<string>(defaultProductId || '');
  const [quantity, setQuantity] = useState<number>(defaultQuantity || 30);
  const [expectedLeadDays, setExpectedLeadDays] = useState<number>(5);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  useEffect(() => {
    if (defaultSupplierId) {
      setSupplierId(defaultSupplierId);
    } else if (!supplierId && suppliers.length > 0) {
      setSupplierId(suppliers[0].id);
    }
    if (defaultProductId) setProductId(defaultProductId);
    if (defaultQuantity && defaultQuantity > 0) setQuantity(defaultQuantity);
  }, [defaultSupplierId, defaultProductId, defaultQuantity, open, suppliers, supplierId]);

  // Reset confirmation state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setShowConfirm(false);
    }
  }, [open]);

  // When product changes, auto fill supplier & cost price
  useEffect(() => {
    if (productId) {
      const selectedProd = products.find(p => p.id === productId);
      if (selectedProd) {
        // Try finding matching supplier by ID or Name
        const matchingSup =
          suppliers.find(s => s.id === selectedProd.supplierId) ||
          suppliers.find(s => s.name.toLowerCase() === (selectedProd.supplier || '').toLowerCase());

        if (matchingSup) {
          setSupplierId(matchingSup.id);
        } else if (suppliers.length > 0 && !supplierId) {
          setSupplierId(suppliers[0].id);
        }

        setUnitCost(selectedProd.costPrice || Math.round((selectedProd.price || 500) * 0.6));
        if (selectedProd.minStock) setQuantity(Math.max(20, selectedProd.minStock * 3));
      }
    } else if (!supplierId && suppliers.length > 0) {
      setSupplierId(suppliers[0].id);
    }
  }, [productId, products, suppliers, supplierId]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !productId || quantity <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select a valid supplier, product, and quantity.',
        variant: 'destructive',
      });
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const now = new Date();
      const expectedDelivery = new Date(now.getTime() + expectedLeadDays * 24 * 60 * 60 * 1000).toISOString();
      const totalCost = Math.round(unitCost * quantity);

      await addOrder({
        supplierId,
        productId,
        quantity,
        unitCost,
        totalCost,
        orderDate: now.toISOString(),
        expectedDeliveryDate: expectedDelivery,
        status: 'Pending',
        notes,
      });

      const prod = products.find(p => p.id === productId);
      const sup = suppliers.find(s => s.id === supplierId);

      logBusinessAction({
        title: `Purchase Order Issued: ${quantity} units`,
        productName: prod?.name || 'Product',
        actionType: 'reorder',
        changeDetails: `Issued PO for ${quantity} units with "${sup?.name || 'Supplier'}" at ${currencySymbol}${unitCost}/unit. Total spend: ${currencySymbol}${totalCost.toLocaleString('en-IN')}.`,
        impactValue: `${currencySymbol}${totalCost.toLocaleString('en-IN')}`,
        previousValue: `Current Stock: ${prod?.stock || 0}`,
        newValue: `Lead Time: ${expectedLeadDays}d`,
      });

      toast({
        title: '📦 Purchase Order Created Successfully!',
        description: `Issued PO for ${quantity} units of "${prod?.name || 'Product'}" (${currencySymbol}${totalCost.toLocaleString('en-IN')}).`,
      });

      setShowConfirm(false);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      toast({
        title: 'Error Creating Purchase Order',
        description: 'An unexpected error occurred while writing to database.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find(p => p.id === productId);
  const totalAmount = Math.round((unitCost || 0) * (quantity || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto ios-glass border-border/50 p-6 shadow-2xl rounded-3xl">
        {showConfirm ? (
          <>
            <DialogHeader className="pb-2 text-left space-y-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                Confirm Purchase Order
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Please verify details before submitting order to database.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 text-xs space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Product:</span>
                  <span className="font-bold text-foreground truncate max-w-[200px]" title={selectedProduct?.name}>
                    {selectedProduct?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-bold text-foreground truncate max-w-[200px]">
                    {suppliers.find(s => s.id === supplierId)?.name || 'Unknown Supplier'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-bold text-foreground">{quantity} units</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Unit Cost:</span>
                  <span className="font-bold text-foreground">{currencySymbol}{unitCost}</span>
                </div>
                <div className="flex justify-between items-center pt-2 text-xs font-bold">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="text-sm font-black text-primary">{currencySymbol}{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 border-t border-border/30 mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs rounded-xl font-semibold"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
              >
                Back to Edit
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black px-4 gap-1.5"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Issuing...
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-3.5 h-3.5" />
                    Confirm & Issue
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="pb-2 text-left space-y-1 pr-8">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                Create Purchase Order
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Issue an official procurement order to your vendor. Tracks lead time and delivery fulfillment.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs mt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Select Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose Supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Select Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose Product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (SKU: {p.sku || 'N/A'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Order Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-9 text-xs"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Unit Cost ({currencySymbol})</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-9 text-xs"
                    value={unitCost}
                    onChange={e => setUnitCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expected Lead Time (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-9 text-xs"
                    value={expectedLeadDays}
                    onChange={e => setExpectedLeadDays(parseInt(e.target.value) || 5)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Calculated Total</Label>
                  <div className="h-9 px-3 rounded-md border border-input bg-secondary/50 flex items-center font-bold text-foreground text-xs">
                    {currencySymbol}{totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">PO Notes / Special Instructions</Label>
                <Input
                  placeholder="e.g. Expedited freight required"
                  className="h-9 text-xs"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 border-t border-border/30 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl font-semibold"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="gap-1.5 text-xs rounded-xl font-bold bg-primary text-primary-foreground hover:brightness-110 shadow-sm"
                >
                  <PackageCheck className="w-3.5 h-3.5" /> Issue Purchase Order
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
