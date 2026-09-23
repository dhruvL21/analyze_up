'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/data-context';
import {
  Trash2,
  Package,
  Truck,
  TrendingUp,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface ConfirmDeleteDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
}

export function ConfirmDeleteDemoDialog({
  open,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteDemoDialogProps) {
  const { clearDemoBusiness, isDeletingDemo } = useData();

  const handleConfirm = async () => {
    onOpenChange(false);
    if (onConfirm) {
      onConfirm();
    } else {
      await clearDemoBusiness();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0 shadow-sm">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Delete Demo Business Data
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Remove simulated catalog and sales history from your workspace
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2.5 my-2">
          <div className="p-3 rounded-xl bg-secondary/35 border border-border/40 text-xs text-muted-foreground space-y-2">
            <p className="text-foreground font-medium">
              The following demo records will be permanently deleted:
            </p>
            <ul className="space-y-1.5 pl-1">
              <li className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>200+ simulated products & SKU catalog</span>
              </li>
              <li className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>15+ simulated vendor & supplier profiles</span>
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>500+ generated sales transactions & orders</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11.5px] leading-relaxed">
              <strong className="text-emerald-300 font-semibold">Real Data Guaranteed Safe:</strong> Your Google Drive files, Shopify store integrations, CSV uploads, and manual products are protected and will NOT be touched.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeletingDemo}
            className="rounded-xl text-xs sm:text-sm font-semibold h-10 px-4 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isDeletingDemo}
            className="rounded-xl text-xs sm:text-sm gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold h-10 px-5 cursor-pointer shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
          >
            {isDeletingDemo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Deleting Demo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 text-white" />
                <span>Delete Demo</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
