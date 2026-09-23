'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/data-context';
import { AddProductModal } from '@/components/add-product-modal';
import { AddSupplierModal } from '@/components/add-supplier-modal';
import { ImportDialog } from '@/components/import-dialog';
import { AuditLogModal } from '@/components/audit-log-modal';
import { ConfirmDemoDialog } from '@/components/confirm-demo-dialog';
import { ConfirmDeleteDemoDialog } from '@/components/confirm-delete-demo-dialog';
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
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function QuickActionsBar() {
  const {
    setShowShopifyModal,
    products = [],
    transactions = [],
    dataReadiness,
    capabilities,
    businessBuddyCalibration,
    loadDemoBusiness,
    hasDemoData,
    isLoadingDemo,
    isDeletingDemo,
    businessProfile,
    driveConnection,
  } = useData();

  // Determine whether Shopify is actively connected
  const isShopifyConnected = Boolean(
    businessProfile?.shopifyConnected &&
    businessProfile?.shopifyStatus === 'Connected' &&
    businessProfile?.shopifyStoreUrl
  );

  // Determine whether Google Drive is actively connected
  const isDriveConnected = Boolean(
    driveConnection &&
    (driveConnection.connectionStatus === 'Connected' || driveConnection.isConnected === true)
  );

  // Determine whether any real (non-demo) catalog products or sales transactions are currently present
  const hasRealCatalog = React.useMemo(() => {
    const hasRealProd = products.some((p: any) => {
      if (!p) return false;
      if (p.isDemo === true || p.source === 'DEMO' || p.source === 'demo') return false;
      const pid = String(p.id || '');
      if (
        pid.startsWith('prod-') ||
        pid.startsWith('demo_') ||
        pid.startsWith('prod-fashion-') ||
        pid.startsWith('prod-electronics-') ||
        pid.startsWith('prod-home-') ||
        pid.startsWith('prod-beauty-') ||
        pid.startsWith('prod-sports-') ||
        pid.startsWith('prod-food-')
      ) return false;
      return true;
    });

    const hasRealTx = transactions.some((t: any) => {
      if (!t) return false;
      if (t.isDemo === true || t.source === 'DEMO' || t.source === 'demo') return false;
      const tid = String(t.id || '');
      if (tid.startsWith('tx-') || tid.startsWith('tx_demo_') || tid.startsWith('demo_')) return false;
      return true;
    });

    return hasRealProd || hasRealTx;
  }, [products, transactions]);

  // Determine whether demo data is currently loaded in the workspace
  const isDemoLoaded = Boolean(
    hasDemoData ||
    products.some((p: any) => p?.isDemo === true || p?.source === 'DEMO' || p?.source === 'demo' || String(p?.id || '').startsWith('prod-') || String(p?.id || '').startsWith('demo_')) ||
    transactions.some((t: any) => t?.isDemo === true || t?.source === 'DEMO' || t?.source === 'demo' || String(t?.id || '').startsWith('tx-') || String(t?.id || '').startsWith('demo_'))
  );

  // Dynamically hide "Load Demo" / "Delete Demo" as soon as Shopify, Google Drive, or real CSV data is connected/uploaded.
  // As soon as the user disconnects or clears these, it dynamically reappears.
  const shouldHideLoadDemo = isShopifyConnected || isDriveConnected || hasRealCatalog;

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
  const [isConfirmDemoOpen, setIsConfirmDemoOpen] = useState(false);
  const [isDeleteDemoOpen, setIsDeleteDemoOpen] = useState(false);

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

        <div className="flex items-center gap-2">
          {/* Left scroll arrow */}
          <button
            onClick={() => scroll('left')}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable button row */}
          <div
            ref={scrollRef}
            className="flex items-center gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1"
          >
            {!shouldHideLoadDemo && (
              isDemoLoaded ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsDeleteDemoOpen(true)}
                  disabled={isDeletingDemo}
                  className={cn(
                    "rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/60 font-bold h-10 px-3.5 sm:px-4 transition-all shadow-sm cursor-pointer",
                    isDeletingDemo && "opacity-90 shadow-rose-500/30 animate-pulse cursor-wait"
                  )}
                >
                  {isDeletingDemo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                      <span>Deleting Demo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Delete Demo</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsConfirmDemoOpen(true)}
                  disabled={isLoadingDemo}
                  className={cn(
                    "rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-bold h-10 px-3.5 sm:px-4 transition-all shadow-sm cursor-pointer",
                    isLoadingDemo && "opacity-90 shadow-amber-500/30 animate-pulse cursor-wait"
                  )}
                >
                  {isLoadingDemo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Loading Demo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Load Demo</span>
                    </>
                  )}
                </Button>
              )
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAuditModalOpen(true)}
              className="rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10 px-3.5 sm:px-4 cursor-pointer shadow-sm"
            >
              <History className="w-4 h-4 text-primary" />
              <span>Audit Log</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddProductOpen(true)}
              className="rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10 px-3.5 sm:px-4 cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-primary" />
              <span>Add Product</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10 px-3.5 sm:px-4 cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <span>Import CSV / Excel</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowShopifyModal(true)}
              className="rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10 px-3.5 sm:px-4 cursor-pointer shadow-sm"
            >
              <ShoppingBag className="w-4 h-4 text-primary" />
              <span>Connect Shopify</span>
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
                className="rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10 px-3.5 sm:px-4 cursor-pointer shadow-sm"
              >
                <AlertOctagon className="w-4 h-4 text-primary" />
                <span>Out of Stock{outOfStockCount > 0 ? ` (${outOfStockCount})` : ''}</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddSupplierOpen(true)}
              className="rounded-xl text-xs sm:text-sm gap-2 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10 px-3.5 sm:px-4 cursor-pointer shadow-sm"
            >
              <Truck className="w-4 h-4 text-primary" />
              <span>Add Supplier</span>
            </Button>
          </div>

          {/* Right scroll arrow */}
          <button
            onClick={() => scroll('right')}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Modals */}
      <ConfirmDemoDialog open={isConfirmDemoOpen} onOpenChange={setIsConfirmDemoOpen} />
      <ConfirmDeleteDemoDialog open={isDeleteDemoOpen} onOpenChange={setIsDeleteDemoOpen} />
      <AddProductModal open={isAddProductOpen} onOpenChange={setIsAddProductOpen} />
      <AddSupplierModal open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen} />
      <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <AuditLogModal open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen} />
    </>
  );
}

