'use client';

import Image from 'next/image';
import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import {
  PlusCircle,
  MoreHorizontal,
  Database,
  ArrowRightLeft,
  Eye,
  X,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShoppingBag,
  Boxes,
  PackageCheck,
  AlertOctagon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRESET_QUICK_QUERIES = [
  { label: 'Fast Moving', query: 'fast moving' },
  { label: 'Running Out Soon', query: 'running out this week' },
  { label: 'Dead Stock', query: 'find dead stock' },
  { label: 'Highest Margins', query: 'highest margin' },
  { label: 'Low Margin (<20%)', query: 'less than 20%' },
  { label: 'Overstocked', query: 'overstocked' },
];
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/context/data-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImportDialog } from '@/components/import-dialog';
import { AddProductModal } from '@/components/add-product-modal';
import { useToast } from '@/hooks/use-toast';
import { computeProductIntelligence, filterProductsByNaturalLanguage } from '@/lib/product-intelligence-engine';
import { InventoryInsightsTicker } from '@/components/inventory-insights-ticker';
import { InventoryRecommendationsPanel } from '@/components/inventory-recommendations-panel';
import { ProductIntelligenceDrawer } from '@/components/product-intelligence-drawer';
import { ProductComparisonModal } from '@/components/product-comparison-modal';

import { useSearchParams } from 'next/navigation';
import { OperationsSubNav } from '@/components/operations-sub-nav';

function InventoryPageContent() {
  const searchParams = useSearchParams();
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    recordSale,
    isLoading,
    categories,
    suppliers,
    addCategory,
    addSupplier,
    transactions,
    returns,
    businessProfile,
    capabilities,
    dataReadiness,
    businessBuddyCalibration,
  } = useData();

  // Intelligence active flag: only show quick prediction/dead-stock queries when learning phase completes & predictive capabilities unlock
  const isIntelligenceActive = useMemo(() => {
    if (!dataReadiness) return false;
    const isLearning = dataReadiness.level === 'LEARNING' || businessBuddyCalibration?.status === 'LEARNING';
    const hasActivePredictiveCapabilities = Boolean(
      capabilities?.deadStockDetection ||
      capabilities?.demandForecasting ||
      capabilities?.trendAnalysis ||
      capabilities?.stockoutPrediction
    );
    return !isLearning && hasActivePredictiveCapabilities;
  }, [dataReadiness, businessBuddyCalibration, capabilities]);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>(undefined);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Debounce search query changes by 150ms to keep UI 100% smooth
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const qParam = searchParams?.get('q') || searchParams?.get('query');
    if (qParam) {
      setSearchQuery(qParam);
      setDebouncedSearchQuery(qParam);
    }
  }, [searchParams]);

  // Reset pagination on search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, pageSize]);

  const { toast } = useToast();

  const categoryToSelectRef = useRef<string | null>(null);
  const supplierToSelectRef = useRef<string | null>(null);

  useEffect(() => {
    if (categoryToSelectRef.current && categories.length > 0) {
      const found = categories.find(c => c.name.toLowerCase() === categoryToSelectRef.current?.toLowerCase());
      if (found) {
        setSelectedCategoryId(found.id);
        categoryToSelectRef.current = null;
      }
    }
  }, [categories]);

  useEffect(() => {
    if (supplierToSelectRef.current && suppliers.length > 0) {
      const found = suppliers.find(s => s.name.toLowerCase() === supplierToSelectRef.current?.toLowerCase());
      if (found) {
        setSelectedSupplierId(found.id);
        supplierToSelectRef.current = null;
      }
    }
  }, [suppliers]);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // 1. High-Performance Memoized Filter (runs only on debounced changes)
  const filteredProducts = useMemo(() => {
    // Unify duplicate entries sharing identical SKU, prioritizing authentic/integrated products
    const uniqueProductsMap = new Map<string, Product>();
    const withoutSkuProducts: Product[] = [];

    products.forEach(p => {
      const skuKey = (p.sku || '').trim().toUpperCase();
      if (!skuKey) {
        withoutSkuProducts.push(p);
        return;
      }

      if (!uniqueProductsMap.has(skuKey)) {
        uniqueProductsMap.set(skuKey, p);
      } else {
        const existing = uniqueProductsMap.get(skuKey)!;
        const existingIsShopify = Boolean(
          existing.shopifyProductId ||
          existing.shopifyVariantId ||
          existing.id?.startsWith('shopify_') ||
          existing.source === 'SHOPIFY' ||
          existing.source === 'shopify'
        );
        const currentIsShopify = Boolean(
          p.shopifyProductId ||
          p.shopifyVariantId ||
          p.id?.startsWith('shopify_') ||
          p.source === 'SHOPIFY' ||
          p.source === 'shopify'
        );

        if (currentIsShopify && !existingIsShopify) {
          uniqueProductsMap.set(skuKey, p);
        } else if (!currentIsShopify && !existingIsShopify) {
          if ((p.stock || 0) > 0 && (existing.stock || 0) === 0) {
            uniqueProductsMap.set(skuKey, p);
          }
        }
      }
    });

    const unifiedProducts = [...Array.from(uniqueProductsMap.values()), ...withoutSkuProducts];
    return filterProductsByNaturalLanguage(unifiedProducts, transactions, debouncedSearchQuery);
  }, [products, transactions, debouncedSearchQuery]);

  // 2. Pagination Calculations
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, startIndex, endIndex]);

  // 3. Pre-Indexed Fast Lookups (O(1) instead of O(N*M) lookups)
  const transactionsByProduct = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    transactions.forEach(t => {
      const keys = [t.productId, t.sku, t.productName?.toLowerCase()].filter(Boolean);
      keys.forEach(k => {
        if (!map.has(k!)) map.set(k!, []);
        map.get(k!)!.push(t);
      });
    });
    return map;
  }, [transactions]);

  const returnsByProduct = useMemo(() => {
    const map = new Map<string, typeof returns>();
    returns.forEach(r => {
      if (r.productId) {
        if (!map.has(r.productId)) map.set(r.productId, []);
        map.get(r.productId)!.push(r);
      }
    });
    return map;
  }, [returns]);

  // 4. Compute Intelligence ONLY for the current visible 25/50 items (Instant < 2ms execution)
  const computedPageReports = useMemo(() => {
    return paginatedProducts.map(p => {
      const pTx = transactionsByProduct.get(p.id) || transactionsByProduct.get(p.sku || '') || [];
      const pRet = returnsByProduct.get(p.id) || [];
      const report = computeProductIntelligence(p, pTx, pRet, suppliers, {
        isDeadStockEnabled: Boolean(capabilities?.deadStockDetection && dataReadiness?.level !== 'LEARNING'),
        isVelocityEnabled: capabilities?.trendAnalysis,
        historicalDays: dataReadiness?.historicalDays,
      });
      return { product: p, report };
    });
  }, [paginatedProducts, transactionsByProduct, returnsByProduct, suppliers, capabilities, dataReadiness]);

  const handleSellSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sellingProduct) return;
    
    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get('quantity'));
    
    await recordSale(sellingProduct.id, quantity);
    setIsSellDialogOpen(false);
    setSellingProduct(null);
  };

  // Operational Sales & Product Metrics
  const saleTransactions = useMemo(() => {
    return (transactions || []).filter(t => t && (t.type === 'Sale' || !t.type));
  }, [transactions]);

  const totalProductsSold = useMemo(() => {
    return saleTransactions.reduce((sum, t) => sum + Math.max(1, Number(t.quantity) || 1), 0);
  }, [saleTransactions]);

  const totalSalesRevenue = useMemo(() => {
    return saleTransactions.reduce(
      (sum, t) => sum + Number(t.totalRevenue || (Number(t.price || 0) * (Number(t.quantity) || 1))),
      0
    );
  }, [saleTransactions]);

  const totalStockUnits = useMemo(() => {
    return (products || []).reduce((sum, p) => sum + Math.max(0, Number(p.stock) || 0), 0);
  }, [products]);

  const totalInventoryCost = useMemo(() => {
    return (products || []).reduce((sum, p) => {
      const cost = Number(p.costPrice) || Math.round((Number(p.price) || 500) * 0.6);
      return sum + (Math.max(0, Number(p.stock) || 0) * cost);
    }, 0);
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return (products || []).filter(p => Number(p.stock) === 0 || p.stock === undefined || p.stock === null).length;
  }, [products]);

  const lowStockCount = useMemo(() => {
    return (products || []).filter(p => {
      const s = Number(p.stock) || 0;
      const m = Number(p.minStock) || 5;
      return s > 0 && s <= m;
    }).length;
  }, [products]);

  // Product sales map (for instant lookup of units sold per product in the table)
  const productSalesMap = useMemo(() => {
    const map = new Map<string, number>();
    saleTransactions.forEach(t => {
      const qty = Math.max(1, Number(t.quantity) || 1);
      if (t.productId) map.set(t.productId, (map.get(t.productId) || 0) + qty);
      if (t.sku) map.set(t.sku.toLowerCase(), (map.get(t.sku.toLowerCase()) || 0) + qty);
      if (t.productName) map.set(t.productName.toLowerCase(), (map.get(t.productName.toLowerCase()) || 0) + qty);
    });
    return map;
  }, [saleTransactions]);

  const openProductReport = (product: Product) => {
    setDrawerProduct(product);
    setIsDrawerOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <OperationsSubNav />

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              Inventory Intelligence
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Product decision engine, stock levels & unit sales performance analytics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsComparisonOpen(true)} className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Compare Products
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsImportDialogOpen(true)} className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium">
              <Database className="h-4 w-4 text-primary" />
              Import Database
            </Button>
            <Button size="sm" onClick={() => setIsAddProductOpen(true)} className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-md">
              <PlusCircle className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Operations Executive KPI Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="ios-glass rounded-2xl border border-emerald-500/25 bg-emerald-950/10 p-4 shadow-md transition-all hover:border-emerald-500/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">Total Products Sold</p>
                <h3 className="text-2xl font-black text-foreground mt-1 font-mono">
                  {totalProductsSold.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">Units</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Revenue generated:</span>
              <strong className="text-foreground font-mono">{currencySymbol}{Math.round(totalSalesRevenue).toLocaleString('en-IN')}</strong>
            </p>
          </Card>

          <Card className="ios-glass rounded-2xl border border-blue-500/25 bg-blue-950/10 p-4 shadow-md transition-all hover:border-blue-500/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-blue-400 font-bold uppercase tracking-wider">Active Catalog SKUs</p>
                <h3 className="text-2xl font-black text-foreground mt-1 font-mono">
                  {products.length.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">Products</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Categories:</span>
              <strong className="text-foreground">{categories.length} active</strong>
            </p>
          </Card>

          <Card className="ios-glass rounded-2xl border border-cyan-500/25 bg-cyan-950/10 p-4 shadow-md transition-all hover:border-cyan-500/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">Physical Stock on Hand</p>
                <h3 className="text-2xl font-black text-foreground mt-1 font-mono">
                  {totalStockUnits.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">Units</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Inventory asset value:</span>
              <strong className="text-foreground font-mono">{currencySymbol}{Math.round(totalInventoryCost).toLocaleString('en-IN')}</strong>
            </p>
          </Card>

          <Card className="ios-glass rounded-2xl border border-red-500/25 bg-red-950/10 p-4 shadow-md transition-all hover:border-red-500/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider">Stockout Radar</p>
                <h3 className="text-2xl font-black text-foreground mt-1 font-mono">
                  {outOfStockCount} <span className="text-xs font-normal text-muted-foreground">Out of Stock</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30">
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Low buffer items:</span>
              <strong className="text-amber-400">{lowStockCount} SKUs</strong>
            </p>
          </Card>
        </div>

        {/* FEATURE 16: Live Inventory Insights Feed */}
        <InventoryInsightsTicker />

        {/* FEATURE 18: Proactive AI Inventory Recommendations Panel */}
        <InventoryRecommendationsPanel />

        {/* Main Table Card */}
        <Card className="ios-glass rounded-3xl border-border/50 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">Catalog Intelligence Table</CardTitle>
                <CardDescription className="text-xs">
                  Click any row to open full AI Product Business Report
                </CardDescription>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search name, SKU, tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 h-9 rounded-xl border-border/50 bg-secondary/30 text-xs shadow-inner focus-visible:ring-primary"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1.5 bg-secondary/30 border-border/40 shrink-0">
                  {totalItems.toLocaleString()} {totalItems === 1 ? 'Product' : 'Products'}
                </Badge>
              </div>
            </div>

            {/* Quick NL Queries Option Bar - Only shown when app starts showing predictions and dead stocks */}
            {isIntelligenceActive && (
              <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-[11px]">
                <span className="text-muted-foreground font-semibold shrink-0 flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" /> Quick NL Queries:
                </span>

                {PRESET_QUICK_QUERIES.map((preset) => {
                  const isActive = searchQuery.toLowerCase() === preset.query.toLowerCase();
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setSearchQuery(isActive ? '' : preset.query)}
                      className={`px-3 py-1.5 rounded-xl font-medium border text-xs transition-all shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                          : 'bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-2.5 py-1.5 rounded-xl font-medium text-xs text-muted-foreground hover:text-rose-400 border border-dashed border-border/60 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Clear filter
                  </button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-center">Grade</TableHead>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Product Name & SKU</TableHead>
                    <TableHead>Health Status</TableHead>
                    <TableHead>AI Intelligence Badges</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className='h-8 w-8 bg-secondary rounded-xl animate-pulse mx-auto'/></TableCell>
                        <TableCell><div className="aspect-square rounded-lg bg-secondary w-12 h-12 animate-pulse" /></TableCell>
                        <TableCell><div className='h-5 w-32 bg-secondary rounded-md animate-pulse'/></TableCell>
                        <TableCell><div className='h-6 w-20 bg-secondary rounded-full animate-pulse'/></TableCell>
                        <TableCell><div className='h-5 w-24 bg-secondary rounded-md animate-pulse'/></TableCell>
                        <TableCell className="text-right"><div className='h-5 w-16 bg-secondary rounded-md animate-pulse ml-auto'/></TableCell>
                        <TableCell className="text-right"><div className='h-5 w-10 bg-secondary rounded-md animate-pulse ml-auto'/></TableCell>
                        <TableCell className="text-right"><div className='h-5 w-10 bg-secondary rounded-md animate-pulse ml-auto'/></TableCell>
                        <TableCell className="text-right"><div className='h-8 w-8 bg-secondary rounded-full animate-pulse ml-auto'/></TableCell>
                      </TableRow>
                    ))
                  ) : computedPageReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                        No products match your search query. Try typing 'low stock' or 'dead stock'.
                      </TableCell>
                    </TableRow>
                  ) : (
                    computedPageReports.map(({ product, report }) => {
                      return (
                        <TableRow
                          key={product.id}
                          className="hover:bg-secondary/40 transition-colors cursor-pointer"
                          onClick={() => openProductReport(product)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <span
                              className={`w-8 h-8 rounded-full font-black text-xs inline-flex items-center justify-center border shadow-sm ${
                                report.performanceGrade === 'A+' || report.performanceGrade === 'A'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : report.performanceGrade === 'B'
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                  : report.performanceGrade === 'C'
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {report.performanceGrade}
                            </span>
                          </TableCell>

                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Image
                              alt={product.name || 'Product Image'}
                              className="aspect-square rounded-xl object-cover border border-border/40"
                              height="48"
                              src={product.imageUrl || 'https://placehold.co/64x64'}
                              width="48"
                              unoptimized
                            />
                          </TableCell>

                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-bold text-foreground hover:text-emerald-400 transition-colors text-xs">{product.name || product.productName}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">{product.sku || 'N/A'}</p>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge className={`${report.badgeClass} text-[10px] px-2 py-0.5 font-semibold`}>
                              {report.healthStatus}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {report.tags.slice(0, 2).map(t => (
                                <Badge key={t} variant="outline" className="text-[9px] px-2 py-0.5 font-semibold bg-primary/15 text-primary border-primary/30">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>

                          <TableCell className="text-right font-semibold text-xs">
                            {currencySymbol}{typeof product.price === 'number' ? product.price.toLocaleString('en-IN') : '0'}
                          </TableCell>

                          <TableCell className="text-right font-bold text-xs">
                            {product.stock} <span className="text-[10px] font-normal text-muted-foreground">{product.unit || 'units'}</span>
                          </TableCell>

                          <TableCell className="text-right font-bold text-xs">
                            {(() => {
                              const unitsSold = productSalesMap.get(product.id) ||
                                (product.sku ? productSalesMap.get(product.sku.toLowerCase()) : 0) ||
                                (product.name ? productSalesMap.get(product.name.toLowerCase()) : 0) || 0;
                              return unitsSold > 0 ? (
                                <span className="text-emerald-400 font-mono">
                                  {unitsSold.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">sold</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60 text-xs font-mono">0 sold</span>
                              );
                            })()}
                          </TableCell>

                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openProductReport(product)}
                                className="h-8 px-2 rounded-xl text-xs text-emerald-400 gap-1 hover:bg-emerald-500/10"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Report
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="rounded-full h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to permanently delete "${product.name}"? This action cannot be undone.`)) {
                                        deleteProduct(product.id);
                                      }
                                    }}
                                    className="text-destructive cursor-pointer"
                                  >
                                    Delete Product
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls Bar */}
            {totalItems > 0 && (
              <div className="p-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{' '}
                    <span className="font-semibold text-foreground">{endIndex}</span> of{' '}
                    <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> products
                  </span>

                  <span className="text-border/80">•</span>

                  <div className="flex items-center gap-1.5">
                    <span>Rows per page:</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(val) => setPageSize(Number(val))}
                    >
                      <SelectTrigger className="h-7 w-16 text-xs rounded-lg bg-secondary/40 border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Page Navigation Buttons */}
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(1)}
                    className="h-8 w-8 rounded-lg"
                    title="First Page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="h-8 w-8 rounded-lg"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-1 px-1">
                    {/* Render page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = idx + 1;
                      } else if (safeCurrentPage <= 3) {
                        pageNum = idx + 1;
                      } else if (safeCurrentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + idx;
                      } else {
                        pageNum = safeCurrentPage - 2 + idx;
                      }

                      const isActive = pageNum === safeCurrentPage;

                      return (
                        <Button
                          key={pageNum}
                          size="sm"
                          variant={isActive ? 'default' : 'ghost'}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-8 w-8 p-0 rounded-lg text-xs font-semibold ${
                            isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-secondary/60'
                          }`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="h-8 w-8 rounded-lg"
                    title="Next Page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="h-8 w-8 rounded-lg"
                    title="Last Page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Record Sale Dialog */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl ios-glass">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Record Product Sale</DialogTitle>
            <DialogDescription className="text-xs">
              Record customer units sold for {sellingProduct?.name || sellingProduct?.productName}
            </DialogDescription>
          </DialogHeader>
          {sellingProduct && (
            <form onSubmit={handleSellSubmit} className="space-y-4 text-xs pt-2">
              <div className="space-y-1">
                <Label htmlFor="sale-qty">Quantity Sold</Label>
                <Input
                  id="sale-qty"
                  name="quantity"
                  type="number"
                  min="1"
                  max={sellingProduct.stock}
                  defaultValue="1"
                  required
                  className="rounded-xl"
                />
                <span className="text-[10px] text-muted-foreground">Available Stock: {sellingProduct.stock} units</span>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsSellDialogOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                  Confirm Sale
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Intelligence Drawer */}
      <ProductIntelligenceDrawer
        product={drawerProduct}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />

      {/* Product Comparison Modal */}
      <ProductComparisonModal
        open={isComparisonOpen}
        onOpenChange={setIsComparisonOpen}
      />

      {/* Import Database Modal */}
      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />

      {/* Quick Add Product Modal */}
      <AddProductModal
        open={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
      />
    </>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading Inventory Intelligence...</div>}>
      <InventoryPageContent />
    </Suspense>
  );
}

