'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  AlertOctagon,
  ShoppingBag,
  Truck,
  Search,
  Sparkles,
  ShieldCheck,
  TrendingDown,
  Clock,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/context/data-context';
import { CreatePurchaseOrderModal } from '@/components/create-purchase-order-modal';
import type { Product, Supplier } from '@/lib/types';

export interface CriticalItemAnalysis {
  product: Product;
  stock: number;
  isZero: boolean;
  minStock: number;
  costPrice: number;
  price: number;
  matchedSupplier?: Supplier;
  leadTimeDays: number;
  dailySales: number;
  totalSoldUnits: number;
  targetBufferDays: number;
  targetOptimalStock: number;
  suggestedQty: number;
  estimatedOrderCost: number;
  revenueAtRisk: number;
  daysOfRunway: number;
  aiRationale: string;
}

export function OutOfStockSection() {
  const {
    products = [],
    suppliers = [],
    transactions = [],
    businessProfile,
    dataReadiness,
    capabilities,
    businessBuddyCalibration,
  } = useData();

  // Progressive Feature Unlock Gate:
  // Critical Restock Radar & AI Reordering requires:
  // 1. Manual founder override (unlock all features) OR
  // 2. Data Readiness score >= 40 (graduated from LEARNING to EARLY_INSIGHTS, PREDICTIVE, or OPTIMIZATION)
  //    WITH reorder recommendation capability active.
  const isRestockUnlocked = Boolean(
    businessBuddyCalibration?.isOverridden ||
    (
      (dataReadiness?.score ?? 0) >= 40 &&
      dataReadiness?.level !== 'LEARNING' &&
      (capabilities?.reorderRecommendations ?? false)
    )
  );

  const [activeTab, setActiveTab] = useState<'out_of_stock' | 'low_stock' | 'all'>('out_of_stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSuggestedQty, setSelectedSuggestedQty] = useState<number | undefined>(undefined);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Supplier lookup map
  const supplierMap = useMemo(() => {
    const map = new Map<string, Supplier>();
    suppliers.forEach((s) => {
      if (s.id) map.set(s.id, s);
      if (s.name) map.set(s.name.toLowerCase(), s);
    });
    return map;
  }, [suppliers]);

  const getProductSupplier = (prod: Product): Supplier | undefined => {
    if (prod.supplierId && supplierMap.has(prod.supplierId)) {
      return supplierMap.get(prod.supplierId);
    }
    if (prod.supplier && supplierMap.has(prod.supplier.toLowerCase())) {
      return supplierMap.get(prod.supplier.toLowerCase());
    }
    return undefined;
  };

  // Comprehensive AI-driven critical restock calculation across products
  const { outOfStockItems, lowStockItems, allCriticalItems, totalRevenueAtRisk, totalRestockCapital } = useMemo(() => {
    const historicalDays = Math.max(7, dataReadiness?.historicalDays || 30);

    const analyzedItems: CriticalItemAnalysis[] = [];
    let sumRevenueAtRisk = 0;
    let sumRestockCapital = 0;

    for (const p of products) {
      if (!p || !p.id) continue;
      const stock = Number(p.stock) || 0;
      const isZero = Number(p.stock) === 0 || p.stock === undefined || p.stock === null;
      const minStock = Number(p.minStock) || 5;
      const isLowStock = !isZero && stock <= minStock;

      if (!isZero && !isLowStock) continue;

      const matchedSupplier = getProductSupplier(p);
      const leadTimeDays = p.leadTimeDays || matchedSupplier?.leadTimeDays || 7;

      // Calibrate Target Runway Buffer Days based on the brand's Data Readiness Level
      let targetBufferDays = Math.max(leadTimeDays + 14, 28); // 4-week standard buffer
      if (dataReadiness?.level === 'OPTIMIZATION') {
        targetBufferDays = Math.max(leadTimeDays + 21, 35); // 5-week optimization buffer
      } else if (dataReadiness?.level === 'PREDICTIVE') {
        targetBufferDays = Math.max(leadTimeDays + 18, 30); // 4+ week predictive buffer
      }

      // Compute actual daily sales velocity from sales transactions
      const pTx = transactions.filter(
        (t) =>
          t &&
          (t.type === 'Sale' || !t.type) &&
          (t.productId === p.id ||
            (p.sku && t.sku === p.sku) ||
            (t.productName && p.name && t.productName.toLowerCase() === p.name.toLowerCase()))
      );

      const totalSoldUnits = pTx.reduce((sum, t) => sum + Math.max(1, Number(t.quantity) || 1), 0);
      const txVelocity = totalSoldUnits > 0 ? totalSoldUnits / historicalDays : 0;
      const catalogVelocity = Number(p.averageDailySales) || 0;
      const dailySales =
        txVelocity > 0
          ? catalogVelocity > 0
            ? txVelocity * 0.7 + catalogVelocity * 0.3
            : txVelocity
          : catalogVelocity;

      // Target optimal stock & AI suggested reorder quantity
      const targetOptimalStock = Math.ceil(
        dailySales > 0 ? dailySales * targetBufferDays : minStock * 3
      );

      let suggestedQty: number;
      if (isZero) {
        suggestedQty = Math.max(minStock * 2, Math.max(10, targetOptimalStock));
      } else {
        suggestedQty = Math.max(minStock * 2, Math.max(10, targetOptimalStock - stock));
      }

      const retailPrice = Number(p.price) || (Number(p.costPrice) ? Number(p.costPrice) * 1.5 : 500);
      const unitCost = Number(p.costPrice) || Math.round(retailPrice * 0.6);
      const estimatedOrderCost = unitCost * suggestedQty;

      // Revenue at risk: for out of stock, estimated 30-day lost sales; for low stock, shortfall value
      let revenueAtRisk: number;
      if (isZero) {
        const monthlyLostUnits = dailySales > 0 ? Math.round(dailySales * 30) : suggestedQty;
        revenueAtRisk = Math.round(retailPrice * monthlyLostUnits);
      } else {
        const atRiskUnits = Math.max(0, suggestedQty - stock);
        revenueAtRisk = Math.round(retailPrice * atRiskUnits);
      }

      sumRevenueAtRisk += revenueAtRisk;
      sumRestockCapital += estimatedOrderCost;

      const daysOfRunway = isZero
        ? 0
        : dailySales > 0
        ? Math.round(stock / dailySales)
        : Math.max(1, stock);

      let aiRationale = '';
      if (isZero) {
        aiRationale =
          dailySales > 0
            ? `Zero inventory causing ~${currencySymbol}${revenueAtRisk.toLocaleString('en-IN')}/mo in lost revenue (${dailySales.toFixed(1)} units/day). Reorder ${suggestedQty} units to restore ${targetBufferDays}-day runway (${leadTimeDays}d lead time).`
            : `Zero inventory. Reorder ${suggestedQty} units to replenish safety buffer (${targetBufferDays}-day baseline target, ${leadTimeDays}d lead time).`;
      } else {
        aiRationale =
          dailySales > 0
            ? `Current stock (${stock} units) will deplete in ~${daysOfRunway} days, breaching ${leadTimeDays}-day supplier lead time. Restock ${suggestedQty} units immediately.`
            : `Stock of ${stock} units has dipped below configured safety threshold (${minStock} units). Reorder ${suggestedQty} units.`;
      }

      analyzedItems.push({
        product: p,
        stock,
        isZero,
        minStock,
        costPrice: unitCost,
        price: retailPrice,
        matchedSupplier,
        leadTimeDays,
        dailySales,
        totalSoldUnits,
        targetBufferDays,
        targetOptimalStock,
        suggestedQty,
        estimatedOrderCost,
        revenueAtRisk,
        daysOfRunway,
        aiRationale,
      });
    }

    const outList = analyzedItems.filter((item) => item.isZero);
    const lowList = analyzedItems.filter((item) => !item.isZero);

    return {
      outOfStockItems: outList,
      lowStockItems: lowList,
      allCriticalItems: analyzedItems,
      totalRevenueAtRisk: sumRevenueAtRisk,
      totalRestockCapital: sumRestockCapital,
    };
  }, [products, transactions, dataReadiness, supplierMap, currencySymbol]);

  // Filtered items based on active tab and search query
  const displayedItems = useMemo(() => {
    let baseList: CriticalItemAnalysis[] = [];
    if (activeTab === 'out_of_stock') {
      baseList = outOfStockItems;
    } else if (activeTab === 'low_stock') {
      baseList = lowStockItems;
    } else {
      baseList = allCriticalItems;
    }

    if (!searchQuery.trim()) return baseList;

    const q = searchQuery.toLowerCase().trim();
    return baseList.filter(
      (item) =>
        item.product.name?.toLowerCase().includes(q) ||
        item.product.sku?.toLowerCase().includes(q) ||
        item.product.supplier?.toLowerCase().includes(q) ||
        item.product.category?.toLowerCase().includes(q) ||
        item.matchedSupplier?.name.toLowerCase().includes(q)
    );
  }, [activeTab, outOfStockItems, lowStockItems, allCriticalItems, searchQuery]);

  const handleOpenReorder = (item: CriticalItemAnalysis) => {
    setSelectedProduct(item.product);
    setSelectedSuggestedQty(item.suggestedQty);
    setIsReorderModalOpen(true);
  };

  // If the brand does NOT come under the score required to unlock critical restock, DO NOT SHOW
  if (!isRestockUnlocked) {
    return null;
  }

  const readinessScore = dataReadiness?.score ?? 40;
  const readinessLevelLabel = dataReadiness?.level ? dataReadiness.level.replace('_', ' ') : 'EARLY INSIGHTS';

  return (
    <>
      <div id="out-of-stock-hub" className="scroll-mt-24 space-y-4">
        <Card className="rounded-3xl ios-glass border border-red-500/25 bg-gradient-to-b from-red-950/15 via-background to-background shadow-2xl overflow-hidden">
          <CardHeader className="p-6 md:p-8 pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="p-2 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400">
                    <AlertOctagon className="w-5 h-5 animate-pulse" />
                  </div>
                  <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10 font-mono text-[11px] font-bold px-2.5 py-0.5 tracking-wider">
                    CRITICAL RESTOCK RADAR
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono text-[11px] font-bold px-2.5 py-0.5 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI CALIBRATED (Score: {readinessScore}/100 • {readinessLevelLabel})
                  </Badge>
                  {outOfStockItems.length > 0 && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </div>
                <CardTitle className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                  Out of Stock & Urgent Restock Hub
                </CardTitle>
                <CardDescription className="text-xs md:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                  Identify zero-inventory items causing lost customer revenue. Restock quantities are automatically calibrated by AI sales velocity, supplier lead time, and safety runway bands.
                </CardDescription>
              </div>

              {/* Quick Summary Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 text-left space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-red-400 block tracking-wider">Out of Stock</span>
                  <p className="text-lg md:text-xl font-extrabold text-foreground font-mono">
                    {outOfStockItems.length}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">SKUs</span>
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 text-left space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">Low Buffer</span>
                  <p className="text-lg md:text-xl font-extrabold text-foreground font-mono">
                    {lowStockItems.length}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">SKUs</span>
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 text-left space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Revenue at Risk</span>
                  <p className="text-lg md:text-xl font-extrabold text-red-400 font-mono">
                    {currencySymbol}{Math.round(totalRevenueAtRisk).toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 text-left space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Restock Cost</span>
                  <p className="text-lg md:text-xl font-extrabold text-emerald-400 font-mono">
                    {currencySymbol}{Math.round(totalRestockCapital).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Controls & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-5 border-t border-border/30 mt-4">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as any)}
                className="w-full sm:w-auto"
              >
                <TabsList className="bg-secondary/40 border border-border/40 p-1 rounded-2xl h-10 w-full sm:w-auto flex">
                  <TabsTrigger
                    value="out_of_stock"
                    className="rounded-xl text-xs font-bold px-3.5 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 data-[state=active]:border-red-500/30 border border-transparent"
                  >
                    Out of Stock ({outOfStockItems.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="low_stock"
                    className="rounded-xl text-xs font-bold px-3.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/30 border border-transparent"
                  >
                    Low Stock Buffer ({lowStockItems.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="all"
                    className="rounded-xl text-xs font-bold px-3.5 data-[state=active]:bg-secondary data-[state=active]:text-foreground"
                  >
                    All Critical ({allCriticalItems.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search SKU, name, supplier..."
                  className="pl-9 h-9 text-xs rounded-2xl bg-secondary/30 border-border/40 focus:border-red-500/50"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 md:p-8 pt-0">
            {displayedItems.length === 0 ? (
              <div className="p-10 rounded-2xl bg-secondary/20 border border-border/40 text-center space-y-3 mt-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-foreground">
                    {searchQuery
                      ? 'No matching products found'
                      : activeTab === 'out_of_stock'
                      ? 'Zero Stockouts Detected!'
                      : 'All Stock Buffers Healthy'}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {searchQuery
                      ? `No items match "${searchQuery}". Try clearing your search query.`
                      : activeTab === 'out_of_stock'
                      ? 'Every product in your catalog currently has available inventory. No sales runway is at risk.'
                      : 'None of your active products have dipped below their defined safety stock levels.'}
                  </p>
                </div>
                {activeTab === 'out_of_stock' && lowStockItems.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('low_stock')}
                    className="rounded-xl text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold"
                  >
                    Inspect {lowStockItems.length} Low Stock Buffers →
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                <div className="divide-y divide-border/30 rounded-2xl border border-border/40 overflow-hidden bg-secondary/15">
                  {displayedItems.map((item) => {
                    const prod = item.product;
                    return (
                      <div
                        key={prod.id}
                        className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-secondary/30 transition-colors"
                      >
                        {/* Left: Product Info & AI Intelligence Breakdown */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl border border-border/50 overflow-hidden bg-secondary/40 shrink-0 relative flex items-center justify-center">
                            {prod.imageUrl ? (
                              <Image
                                src={prod.imageUrl}
                                alt={prod.name}
                                fill
                                unoptimized
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-muted-foreground/60" />
                            )}
                          </div>

                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground truncate max-w-md block">
                                {prod.name}
                              </span>
                              {item.isZero ? (
                                <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold px-2 py-0">
                                  0 Units (Out of Stock)
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2 py-0">
                                  {item.stock} Units Left (Low)
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50">
                                {prod.category || 'General'}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                              <span>SKU: <strong className="text-foreground font-semibold">{prod.sku || 'N/A'}</strong></span>
                              <span>•</span>
                              <span>Price: <strong className="text-foreground font-semibold">{currencySymbol}{item.price}</strong></span>
                              <span>•</span>
                              <span>Cost: <strong className="text-foreground font-semibold">{currencySymbol}{item.costPrice}</strong></span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5 text-primary" />
                                {item.matchedSupplier?.name || prod.supplier || 'Supplier Unassigned'}
                              </span>
                            </div>

                            {/* AI Calibration Tags & Rationale */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5 flex-wrap">
                              <Badge variant="secondary" className="bg-secondary/60 text-foreground text-[10px] font-semibold border border-border/40 py-0 px-2 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                {item.dailySales > 0 ? `${item.dailySales.toFixed(1)} units/day velocity` : `Safety buffer (${item.minStock}u)`}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                Lead Time: <strong className="text-foreground">{item.leadTimeDays}d</strong>
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                • Target Runway: <strong className="text-foreground">{item.targetBufferDays}d</strong>
                              </span>
                            </div>

                            <p className="text-[11px] text-muted-foreground/90 max-w-2xl leading-relaxed italic">
                              💡 {item.aiRationale}
                            </p>
                          </div>
                        </div>

                        {/* Right: Smart Reorder Recommendation & Action */}
                        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/20">
                          <div className="text-left lg:text-right space-y-0.5">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                              AI Suggested Restock
                            </span>
                            <p className="text-sm font-bold text-foreground font-mono">
                              {item.suggestedQty} Units
                              <span className="text-xs font-normal text-muted-foreground ml-1">
                                (~{currencySymbol}{item.estimatedOrderCost.toLocaleString('en-IN')})
                              </span>
                            </p>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleOpenReorder(item)}
                            className="rounded-xl text-xs font-extrabold gap-1.5 h-9 px-4 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 hover:shadow-red-600/30 transition-all cursor-pointer shrink-0"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>⚡ Reorder</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Embedded Purchase Order Reorder Modal with AI Suggested Quantity */}
      {selectedProduct && (
        <CreatePurchaseOrderModal
          open={isReorderModalOpen}
          onOpenChange={(open) => {
            setIsReorderModalOpen(open);
            if (!open) {
              setSelectedProduct(null);
              setSelectedSuggestedQty(undefined);
            }
          }}
          defaultProductId={selectedProduct.id}
          defaultSupplierId={getProductSupplier(selectedProduct)?.id}
          defaultQuantity={selectedSuggestedQty}
        />
      )}
    </>
  );
}
