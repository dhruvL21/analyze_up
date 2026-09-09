'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/data-context';
import { AddProductModal } from '@/components/add-product-modal';
import { AddSupplierModal } from '@/components/add-supplier-modal';
import { DeadStockModal } from '@/components/dead-stock-modal';
import { ImportDialog } from '@/components/import-dialog';
import { AuditLogModal } from '@/components/audit-log-modal';
import {
  PlusCircle,
  FileSpreadsheet,
  ShoppingBag,
  PackageX,
  Truck,
  Zap,
  History,
} from 'lucide-react';

export function QuickActionsBar() {
  const { setShowShopifyModal } = useData();

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isDeadStockOpen, setIsDeadStockOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  return (
    <>
      <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-primary" />
            Founder Quick Actions
          </span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-xs">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAuditModalOpen(true)}
            className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-bold h-9 px-3.5"
          >
            <History className="w-4 h-4 text-primary" />
            View Audit Log
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddProductOpen(true)}
            className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3.5"
          >
            <PlusCircle className="w-4 h-4 text-primary" />
            Add Product
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Import CSV / Excel
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowShopifyModal(true)}
            className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3.5"
          >
            <ShoppingBag className="w-4 h-4 text-primary" />
            Connect Shopify
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsDeadStockOpen(true)}
            className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3.5"
          >
            <PackageX className="w-4 h-4 text-primary" />
            View Dead Stock
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddSupplierOpen(true)}
            className="rounded-xl text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-9 px-3.5"
          >
            <Truck className="w-4 h-4 text-primary" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Interactive Modals */}
      <AddProductModal open={isAddProductOpen} onOpenChange={setIsAddProductOpen} />
      <AddSupplierModal open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen} />
      <DeadStockModal open={isDeadStockOpen} onOpenChange={setIsDeadStockOpen} />
      <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      <AuditLogModal open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen} />
    </>
  );
}
