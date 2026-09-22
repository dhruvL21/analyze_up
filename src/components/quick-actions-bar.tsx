'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/data-context';
import { AddProductModal } from '@/components/add-product-modal';
import { AddSupplierModal } from '@/components/add-supplier-modal';
import { ImportDialog } from '@/components/import-dialog';
import { AuditLogModal } from '@/components/audit-log-modal';
import {
  PlusCircle,
  FileSpreadsheet,
  ShoppingBag,
  Truck,
  Zap,
  History,
  AlertOctagon,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuickActionsBar() {
  const {
    setShowShopifyModal,
    products = [],
    dataReadiness,
    capabilities,
    businessBuddyCalibration,
    loadDemoBusiness,
    hasDemoData,
    isLoadingDemo,
    businessProfile,
  } = useData();

  const isRestockUnlocked = Boolean(
    businessBuddyCalibration?.isOverridden ||
    (
      (dataReadiness?.score ?? 0) >= 40 &&
      dataReadiness?.level !== 'LEARNING' &&
      (capabilities?.reorderRecommendations ?? false)
    )
  );

  const outOfStockCount = React.useMemo(() => {
    return products.filter((p) => Number(p?.stock) === 0 || p?.stock === undefined || p?.stock === null).length;
  }, [products]);

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-primary" />
            Founder Quick Actions
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Left scroll arrow */}
          <button
            onClick={() => scroll('left')}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-border/50 bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable button row */}
          <div
            ref={scrollRef}
            className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-xs flex-1"
          >
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadDemoBusiness(businessProfile?.businessType || 'Retail')}
              disabled={isLoadingDemo}
              className={cn(
                "rounded-xl text-xs gap-1.5 shrink-0 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-bold h-9 px-3 transition-all shadow-sm",
                isLoadingDemo && "opacity-90 shadow-amber-500/30 animate-pulse cursor-wait"
              )}
            >
              {isLoadingDemo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{hasDemoData ? 'Reload Demo' : 'Demo'}</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAuditModalOpen(true)}
              className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-bold h-9 px-3"
            >
              <History className="w-3.5 h-3.5 text-primary" />
              Audit Log
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddProductOpen(true)}
              className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3"
            >
              <PlusCircle className="w-3.5 h-3.5 text-primary" />
              Add Product
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
              Import
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowShopifyModal(true)}
              className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-primary" />
              Shopify
            </Button>

            {isRestockUnlocked && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const el = document.getElementById('out-of-stock-hub');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-primary" />
                <span>Out of Stock{outOfStockCount > 0 ? ` (${outOfStockCount})` : ''}</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddSupplierOpen(true)}
              className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3"
            >
              <Truck className="w-3.5 h-3.5 text-primary" />
              Supplier
            </Button>
          </div>

          {/* Right scroll arrow */}
          <button
            onClick={() => scroll('right')}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-border/50 bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Modals */}
      <AddProductModal open={isAddProductOpen} onOpenChange={setIsAddProductOpen} />
      <AddSupplierModal open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen} />
      <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <AuditLogModal open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen} />
    </>
  );
}

