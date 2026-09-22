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
    transactions = [],
    dataReadiness,
    capabilities,
    businessBuddyCalibration,
    loadDemoBusiness,
    hasDemoData,
    isLoadingDemo,
    businessProfile,
    driveConnection,
  } = useData();

  // Determine whether any real business data integration or catalog is connected/imported
  const isShopifyConnected = Boolean(
    businessProfile?.shopifyConnected &&
    businessProfile?.shopifyStatus !== 'Disconnected' &&
    businessProfile?.shopifyStatus !== 'Uninstalled' &&
    businessProfile?.shopifyStoreUrl
  );

  const isDriveConnected = Boolean(
    driveConnection &&
    (driveConnection.connectionStatus === 'Connected' || driveConnection.isConnected === true)
  );

  const hasRealDataImported = Boolean(
    businessProfile?.firstImportedAt ||
    products.some((p: any) => p && !p.isDemo && p.source !== 'DEMO') ||
    transactions.some((t: any) => t && !t.isDemo && t.source !== 'DEMO') ||
    businessProfile?.inventorySetupMethod === 'csv' ||
    businessProfile?.inventorySetupMethod === 'shopify'
  );

  // Hide the "Load Demo" action button once Shopify, Google Drive, or a CSV file is connected / imported
  const shouldHideLoadDemo = isShopifyConnected || isDriveConnected || hasRealDataImported;

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
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadDemoBusiness(businessProfile?.businessType || 'Retail')}
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
                    <span>{hasDemoData ? 'Reload Demo' : 'Load Demo'}</span>
                  </>
                )}
              </Button>
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
      <AddProductModal open={isAddProductOpen} onOpenChange={setIsAddProductOpen} />
      <AddSupplierModal open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen} />
      <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <AuditLogModal open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen} />
    </>
  );
}

