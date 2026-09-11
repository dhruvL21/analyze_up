'use client';

import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  MoreHorizontal,
  AlertCircle,
  Search,
  RotateCcw,
  Calendar,
  DollarSign,
  ClipboardList,
  Activity,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  ChevronDown,
  Check,
  Sparkles,
  Package,
  Link2,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { OperationsSubNav } from '@/components/operations-sub-nav';
import { determineReturnReason } from '@/lib/ingestion/shopify-adapter';
import type { ProductReturn } from '@/lib/types';

export default function ReturnsPage() {
  const {
    returns,
    products,
    transactions,
    addReturn,
    deleteReturn,
    updateReturn,
    updateReturnStatus,
    isLoading,
    autoSyncShopifyNow,
    isShopifySyncing,
    businessProfile,
  } = useData();
  const { toast } = useToast();

  const isShopifyConnected = Boolean(
    businessProfile?.shopifyConnected ||
    businessProfile?.shopifyStatus === 'Connected' ||
    businessProfile?.shopifyStoreUrl
  );

  // Automatically check for fresh Shopify returns when navigating to Returns page
  useEffect(() => {
    if (isShopifyConnected) {
      autoSyncShopifyNow(false);
    }
  }, [isShopifyConnected, autoSyncShopifyNow]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [returnsPage, setReturnsPage] = useState(1);
  const returnsPageSize = 25;

  // Log Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState<'Defective' | 'Wrong Item' | 'Unopened / Buyer Remorse' | 'Damaged in Transit' | 'Other'>('Unopened / Buyer Remorse');
  const [actionTaken, setActionTaken] = useState<'Restocked' | 'Disposed / Written Off'>('Restocked');
  const [refundStatus, setRefundStatus] = useState<'Refunded' | 'Store Credit' | 'Pending' | 'Rejected'>('Refunded');
  const [refundAmount, setRefundAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Assign Product & Classification State
  const [isAssignProductDialogOpen, setIsAssignProductDialogOpen] = useState(false);
  const [itemToAssign, setItemToAssign] = useState<ProductReturn | null>(null);
  const [assignProductId, setAssignProductId] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isAutoClassifying, setIsAutoClassifying] = useState(false);

  // Reset page when filter or search changes
  useEffect(() => {
    setReturnsPage(1);
  }, [searchQuery, reasonFilter, statusFilter]);

  // Auto-calculate suggested refund amount when product or quantity changes
  useEffect(() => {
    if (!selectedProductId) {
      setRefundAmount(0);
      return;
    }
    const product = products.find(p => p.id === selectedProductId);
    if (product) {
      setRefundAmount(product.price * quantity);
    }
  }, [selectedProductId, quantity, products]);

  // Scroll reveal animation trigger


  // Stats Calculations
  const stats = React.useMemo(() => {
    const totalReturnsCount = returns.length;
    
    // Total Items Sold
    const totalItemsSold = transactions
      .filter(t => t.type === 'Sale' && t.quantity > 0)
      .reduce((sum, t) => sum + t.quantity, 0) || 1; // avoid division by zero

    // Total Returned Quantity
    const totalReturnedQuantity = returns.reduce((sum, r) => sum + r.quantity, 0);

    // Return Rate: returned items / total items sold
    const returnRate = (totalReturnedQuantity / totalItemsSold) * 100;

    // Total Refunded Issued
    const totalRefunded = returns
      .filter(r => r.refundStatus === 'Refunded' || r.refundStatus === 'Store Credit')
      .reduce((sum, r) => sum + r.refundAmount, 0);

    // Damaged Goods Written-off Value (calculate cost basis)
    const writeOffValue = returns
      .filter(r => r.actionTaken === 'Disposed / Written Off')
      .reduce((sum, r) => {
        const product = products.find(p => p.id === r.productId);
        const costBasis = product?.costPrice || (product?.price ? product.price * 0.6 : 0);
        return sum + (r.quantity * costBasis);
      }, 0);

    return {
      totalReturnsCount,
      totalReturnedQuantity,
      returnRate,
      totalRefunded,
      writeOffValue
    };
  }, [returns, transactions, products]);

  // Reason Breakdown for Analytics
  const reasonBreakdown = React.useMemo(() => {
    const counts = {
      'Defective': 0,
      'Wrong Item': 0,
      'Unopened / Buyer Remorse': 0,
      'Damaged in Transit': 0,
      'Other': 0
    };
    
    returns.forEach(r => {
      if (counts[r.reason] !== undefined) {
        counts[r.reason] += r.quantity;
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([name, qty]) => ({
      name,
      qty,
      percentage: Math.round((qty / total) * 100)
    })).sort((a, b) => b.qty - a.qty);
  }, [returns]);

  // Quality Control Alerts (Products with Return Rate > 10% or High return count)
  const qualityAlerts = React.useMemo(() => {
    const productReturnMap: Record<string, { name: string; returned: number; sold: number; supplierId?: string }> = {};

    returns.forEach(r => {
      if (!productReturnMap[r.productId]) {
        const p = products.find(prod => prod.id === r.productId);
        productReturnMap[r.productId] = {
          name: r.productName,
          returned: 0,
          sold: 0,
          supplierId: p?.supplierId
        };
      }
      productReturnMap[r.productId].returned += r.quantity;
    });

    // Populate sold counts
    transactions.filter(t => t.type === 'Sale' && t.quantity > 0).forEach(t => {
      if (t.productId && productReturnMap[t.productId]) {
        productReturnMap[t.productId].sold += t.quantity;
      }
    });

    return Object.entries(productReturnMap)
      .map(([id, info]) => {
        const rate = info.sold > 0 ? (info.returned / (info.sold + info.returned)) * 100 : 100;
        return {
          id,
          name: info.name,
          returned: info.returned,
          sold: info.sold,
          rate,
          supplierId: info.supplierId
        };
      })
      .filter(item => item.returned >= 3 && item.rate > 8) // trigger when return counts are meaningful and rate is high
      .sort((a, b) => b.rate - a.rate);
  }, [returns, transactions, products]);

  // Filtered Returns (Safe against undefined properties)
  const filteredReturns = (returns || []).filter(r => {
    if (!r) return false;
    const query = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !query ||
      (r.customerName || '').toLowerCase().includes(query) ||
      (r.productName || '').toLowerCase().includes(query) ||
      (r.id || '').toLowerCase().includes(query);
      
    const matchesReason = reasonFilter === 'all' || r.reason === reasonFilter;
    const matchesStatus = statusFilter === 'all' || r.refundStatus === statusFilter;

    return matchesSearch && matchesReason && matchesStatus;
  });

  const totalReturnPages = Math.max(1, Math.ceil(filteredReturns.length / returnsPageSize));
  const safeReturnPage = Math.min(returnsPage, totalReturnPages);
  const paginatedReturns = React.useMemo(() => {
    const start = (safeReturnPage - 1) * returnsPageSize;
    return filteredReturns.slice(start, start + returnsPageSize);
  }, [filteredReturns, safeReturnPage, returnsPageSize]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a product.'
      });
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const returnData = {
      productId: selectedProductId,
      productName: product.name,
      quantity,
      customerName,
      reason,
      actionTaken,
      refundStatus,
      refundAmount,
      returnDate: new Date().toISOString(),
      notes
    };

    await addReturn(returnData);
    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity(1);
    setCustomerName('');
    setReason('Unopened / Buyer Remorse');
    setActionTaken('Restocked');
    setRefundStatus('Refunded');
    setRefundAmount(0);
    setNotes('');
  };

  // Count of returns with 'Other' or unassigned reason
  const otherReturnsCount = React.useMemo(() => {
    return returns.filter(r => r.reason === 'Other' || !r.reason).length;
  }, [returns]);

  // Check if a return record is linked to a catalog product
  const isProductLinked = React.useCallback((item: ProductReturn) => {
    return products.some(p =>
      p.id === item.productId ||
      (item.sku && p.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
      (p.shopifyProductId && item.productId && item.productId.includes(p.shopifyProductId))
    );
  }, [products]);

  const openAssignProductModal = (item: ProductReturn) => {
    setItemToAssign(item);
    // If there's an existing matching product in catalog, pre-select it
    const candidate = products.find(p =>
      p.id === item.productId ||
      (item.sku && p.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
      (p.shopifyProductId && item.productId && item.productId.includes(p.shopifyProductId)) ||
      (p.name && item.productName && p.name.trim().toLowerCase() === item.productName.trim().toLowerCase())
    );
    setAssignProductId(candidate?.id || '');
    setProductSearchQuery('');
    setIsAssignProductDialogOpen(true);
  };

  const handleUpdateReason = async (returnId: string, newReason: ProductReturn['reason']) => {
    try {
      await updateReturn(returnId, { reason: newReason });
      toast({
        title: 'Reason Updated',
        description: `Return reason set to "${newReason}".`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err?.message || 'Could not update return reason.'
      });
    }
  };

  const handleAutoClassifyReasons = async () => {
    setIsAutoClassifying(true);
    try {
      let reclassifiedCount = 0;
      for (const item of returns) {
        if (item.reason === 'Other' || !item.reason) {
          const textToAnalyze = `${item.notes || ''} ${item.productName || ''}`;
          let newReason = determineReturnReason(
            textToAnalyze,
            item.actionTaken === 'Restocked' ? 'return' : undefined,
            item.actionTaken === 'Restocked'
          );
          if (newReason === 'Other') {
            newReason = 'Unopened / Buyer Remorse';
          }
          await updateReturn(item.id, { reason: newReason });
          reclassifiedCount++;
        }
      }
      if (reclassifiedCount > 0) {
        toast({
          title: 'Reasons Assigned',
          description: `Assigned specific reasons to ${reclassifiedCount} return item(s).`
        });
      } else {
        toast({
          title: 'Up to Date',
          description: 'All returns already have specific reasons assigned.'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Classification Failed',
        description: err?.message || 'Could not auto-assign reasons.'
      });
    } finally {
      setIsAutoClassifying(false);
    }
  };

  const handleAssignProduct = async () => {
    if (!itemToAssign || !assignProductId) return;
    const targetProduct = products.find(p => p.id === assignProductId);
    if (!targetProduct) return;

    try {
      await updateReturn(itemToAssign.id, {
        productId: targetProduct.id,
        productName: targetProduct.name,
        sku: targetProduct.sku || '',
      });
      toast({
        title: 'Product Assigned',
        description: `Return linked to ${targetProduct.name}.`
      });
      setIsAssignProductDialogOpen(false);
      setItemToAssign(null);
      setAssignProductId('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Assignment Failed',
        description: err?.message || 'Could not assign product.'
      });
    }
  };

  const filteredCatalogProducts = React.useMemo(() => {
    const query = productSearchQuery.toLowerCase().trim();
    if (!query) return products.slice(0, 50);
    return products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query))
    ).slice(0, 50);
  }, [products, productSearchQuery]);

  return (
    <>
      <div className="flex flex-col gap-8">
        <OperationsSubNav />
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl tracking-tight">Returns Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Process customer returns, adjust stocks automatically, track refunds, and monitor product quality.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:self-center self-start flex-wrap">
            {isShopifyConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => autoSyncShopifyNow(true)}
                disabled={isShopifySyncing}
                className="gap-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isShopifySyncing ? 'animate-spin text-emerald-400' : ''}`} />
                {isShopifySyncing ? 'Syncing Shopify...' : 'Sync from Shopify'}
              </Button>
            )}
            <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-1.5 shadow-sm">
              <PlusCircle className="h-4 w-4" />
              Log Returned Order
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Returns</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReturnsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalReturnedQuantity} items returned by customers
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Return Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.returnRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Percent of total items sold returned
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Refunds Issued</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ₹{stats.totalRefunded.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Refunds & store credits processed
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Write-Off Losses</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ₹{stats.writeOffValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Value of disposed/damaged stock
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quality Alerts (if any) */}
        {qualityAlerts.length > 0 && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-3 flex flex-row items-start gap-4">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base text-amber-800 dark:text-amber-300">Product Quality Alerts Detected</CardTitle>
                <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                  The following items have unusually high customer return rates. Review specifications or check with suppliers to prevent stock losses.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {qualityAlerts.map(alert => (
                  <div key={alert.id} className="p-3.5 bg-background/50 backdrop-blur-sm rounded-xl border border-amber-500/10 flex flex-col justify-between">
                    <div>
                      <p className="font-semibold text-sm truncate">{alert.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5 bg-destructive/10 text-destructive border-destructive/20">
                          Return Rate: {alert.rate.toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">{alert.returned} returned / {alert.sold} sold</span>
                      </div>
                    </div>
                    {alert.supplierId && (
                      <p className="text-[11px] text-muted-foreground mt-3 italic">
                        Supplied by: {products.find(p => p.id === alert.id)?.supplierId ? 'Assigned Supplier' : 'Unknown'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Grid: Returns History & Analytics */}
        <div className="grid gap-6 grid-cols-1 xl:grid-cols-3 items-stretch">
          {/* Returns Log */}
          <Card className="xl:col-span-2 ios-glass rounded-3xl border-border/50 shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold">Returned Orders Log</CardTitle>
                    <CardDescription className="text-xs">
                      View, search, and update details for customer returns.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-secondary/30 border-border/40 self-start sm:self-auto">
                    {filteredReturns.length} {filteredReturns.length === 1 ? 'Record' : 'Records'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by customer, product..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 rounded-2xl border-border/50 bg-secondary/30 text-xs shadow-inner focus-visible:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Select value={reasonFilter} onValueChange={setReasonFilter}>
                      <SelectTrigger className="h-10 w-full sm:w-[150px] rounded-xl text-xs bg-secondary/30 border-border/50">
                        <SelectValue placeholder="All Reasons" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Reasons</SelectItem>
                        <SelectItem value="Defective">Defective</SelectItem>
                        <SelectItem value="Wrong Item">Wrong Item</SelectItem>
                        <SelectItem value="Unopened / Buyer Remorse">Remorse</SelectItem>
                        <SelectItem value="Damaged in Transit">Transit Damage</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-10 w-full sm:w-[140px] rounded-xl text-xs bg-secondary/30 border-border/50">
                        <SelectValue placeholder="All Refunds" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Refunded">Refunded</SelectItem>
                        <SelectItem value="Store Credit">Store Credit</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-border/40 bg-secondary/10">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Refund</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[80px]"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReturns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-44 text-center text-muted-foreground select-none">
                            <div className="flex flex-col items-center justify-center gap-2 py-4">
                              <RotateCcw className="h-8 w-8 text-muted-foreground/30 mb-1" />
                              <p className="font-medium text-sm text-foreground">No customer returns logged yet</p>
                              <p className="text-xs text-muted-foreground max-w-sm">
                                {isShopifyConnected
                                  ? 'If you recently processed a return or refund in Shopify, click below to sync it to your workspace.'
                                  : 'Process customer returns manually or connect your Shopify store to sync returns automatically.'}
                              </p>
                              {isShopifyConnected && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => autoSyncShopifyNow(true)}
                                  disabled={isShopifySyncing}
                                  className="mt-2 gap-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 text-xs"
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${isShopifySyncing ? 'animate-spin' : ''}`} />
                                  {isShopifySyncing ? 'Syncing...' : 'Sync from Shopify Now'}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedReturns.map((item) => (
                          <TableRow key={item.id} className="hover:bg-secondary/30 transition-colors">
                            <TableCell className="font-medium">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold">{item.customerName}</p>
                                  {item.source === 'SHOPIFY' && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                                      Shopify
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(item.returnDate).toLocaleDateString()}
                                  </span>
                                  {item.orderNumber && (
                                    <span className="text-[10px] bg-secondary/60 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                                      {item.orderNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium">{item.productName}</p>
                                  {!isProductLinked(item) && (
                                    <button
                                      type="button"
                                      onClick={() => openAssignProductModal(item)}
                                      className="text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                                      title="This return is not linked to an inventory product. Click to assign."
                                    >
                                      <Link2 className="h-2.5 w-2.5" />
                                      <span>Assign Product</span>
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-[10px] inline-flex items-center gap-1 font-medium bg-secondary/70 hover:bg-secondary border border-border/50 hover:border-primary/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer group"
                                        title="Click to reassign return reason"
                                      >
                                        <span>{item.reason}</span>
                                        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground group-hover:text-foreground" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="rounded-xl min-w-[200px] z-50">
                                      <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                        Assign Return Reason
                                      </DropdownMenuLabel>
                                      {(['Unopened / Buyer Remorse', 'Defective', 'Wrong Item', 'Damaged in Transit', 'Other'] as const).map((r) => (
                                        <DropdownMenuItem
                                          key={r}
                                          onClick={() => handleUpdateReason(item.id, r)}
                                          className={`flex items-center justify-between text-xs cursor-pointer ${item.reason === r ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                                        >
                                          <span>{r}</span>
                                          {item.reason === r && <Check className="h-3.5 w-3.5 text-primary ml-2" />}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>

                                  {item.sku ? (
                                    <span className="text-[10px] font-mono text-muted-foreground/70">
                                      {item.sku}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openAssignProductModal(item)}
                                      className="text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted cursor-pointer"
                                    >
                                      No SKU (Assign)
                                    </button>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-sm">
                              {item.quantity}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={item.actionTaken === 'Restocked' ? 'outline' : 'destructive'}
                                className={item.actionTaken === 'Restocked' ? 'border-primary/30 text-primary bg-primary/10' : ''}
                              >
                                {item.actionTaken === 'Restocked' ? 'Restocked' : 'Disposed'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.refundStatus === 'Refunded'
                                    ? 'secondary'
                                    : item.refundStatus === 'Store Credit'
                                    ? 'outline'
                                    : item.refundStatus === 'Pending'
                                    ? 'default'
                                    : 'destructive'
                                }
                              >
                                {item.refundStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm">
                              ₹{item.refundAmount.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-secondary">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-2xl min-w-[180px]">
                                  <DropdownMenuLabel className="bg-primary/10 text-primary text-[10px] uppercase font-bold text-center py-1 mb-1 rounded-lg">Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => openAssignProductModal(item)} className="text-xs flex items-center gap-2 cursor-pointer">
                                    <Package className="h-3.5 w-3.5" />
                                    <span>Assign Product</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                                      <Tag className="h-3.5 w-3.5 mr-2" />
                                      <span>Change Reason</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="rounded-xl min-w-[190px]">
                                      {(['Unopened / Buyer Remorse', 'Defective', 'Wrong Item', 'Damaged in Transit', 'Other'] as const).map((r) => (
                                        <DropdownMenuItem
                                          key={r}
                                          onClick={() => handleUpdateReason(item.id, r)}
                                          className={`flex items-center justify-between text-xs cursor-pointer ${item.reason === r ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                                        >
                                          <span>{r}</span>
                                          {item.reason === r && <Check className="h-3.5 w-3.5 text-primary ml-2" />}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  {item.refundStatus === 'Pending' && (
                                    <>
                                      <DropdownMenuItem onClick={() => updateReturnStatus(item.id, 'Refunded')} className="text-primary font-medium text-xs">
                                        Issue Refund
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateReturnStatus(item.id, 'Store Credit')} className="text-xs">
                                        Issue Store Credit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateReturnStatus(item.id, 'Rejected')} className="text-destructive text-xs">
                                        Reject Refund
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive text-xs">
                                        Delete Log
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently remove the returns transaction record. It will NOT undo any changes made to product inventory.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteReturn(item.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl">
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls Bar */}
                {filteredReturns.length > returnsPageSize && (
                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      Showing <span className="font-semibold text-foreground">{(safeReturnPage - 1) * returnsPageSize + 1}</span> to{' '}
                      <span className="font-semibold text-foreground">{Math.min(safeReturnPage * returnsPageSize, filteredReturns.length)}</span> of{' '}
                      <span className="font-semibold text-foreground">{filteredReturns.length.toLocaleString()}</span> return records
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeReturnPage <= 1}
                        onClick={() => setReturnsPage(1)}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeReturnPage <= 1}
                        onClick={() => setReturnsPage(p => Math.max(1, p - 1))}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <span className="px-2 font-bold text-foreground">
                        Page {safeReturnPage} of {totalReturnPages}
                      </span>

                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeReturnPage >= totalReturnPages}
                        onClick={() => setReturnsPage(p => Math.min(totalReturnPages, p + 1))}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeReturnPage >= totalReturnPages}
                        onClick={() => setReturnsPage(totalReturnPages)}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </div>
          </Card>

          {/* Reason Breakdown Card */}
          <Card className="ios-glass rounded-3xl border-border/50 shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold">Return Reasons Breakdown</CardTitle>
                    <CardDescription className="text-xs">Weekly return volume breakdown by reason.</CardDescription>
                  </div>
                  {otherReturnsCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoClassifyReasons}
                      disabled={isAutoClassifying}
                      className="h-7 px-2.5 text-xs gap-1.5 border-primary/40 hover:bg-primary/10 text-primary font-medium rounded-xl shrink-0"
                      title="Auto-assign specific return reasons to unclassified items"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${isAutoClassifying ? 'animate-spin' : ''}`} />
                      <span>Auto-Assign ({otherReturnsCount})</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {returns.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground border border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center gap-2">
                    <RotateCcw className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-xs font-semibold text-foreground/80">No returns logged yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px]">Return reasons and volume breakdown will appear here once returns are recorded.</p>
                  </div>
                ) : (
                  reasonBreakdown.map((item, index) => {
                    const isOther = item.name === 'Other';
                    return (
                      <div key={index} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{item.name}</span>
                            {isOther && item.qty > 0 && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-normal">
                                Needs reason
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground">{item.qty} units ({item.percentage}%)</span>
                        </div>
                        <div className="h-2.5 w-full bg-secondary/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                              isOther && item.qty > 0 ? 'bg-amber-500/70' : 'bg-primary'
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </div>
          </Card>
        </div>
      </div>

      {/* Log Return Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if(!isOpen) resetForm();
      }}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto ios-glass">
          <DialogHeader>
            <DialogTitle>Log Return Transaction</DialogTitle>
            <DialogDescription>Record a product return and trigger inventory adjustments.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="grid gap-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="productId" className="sm:text-right text-xs font-semibold">Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId} required>
                <SelectTrigger className="sm:col-span-3 text-sm">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(prod => (
                    <SelectItem key={prod.id} value={prod.id}>
                      {prod.name} (Stock: {prod.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="customerName" className="sm:text-right text-xs font-semibold">Customer</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="sm:col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="quantity" className="sm:text-right text-xs font-semibold">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="sm:col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="reason" className="sm:text-right text-xs font-semibold">Reason</Label>
              <Select value={reason} onValueChange={(val: any) => setReason(val)}>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Defective">Defective</SelectItem>
                  <SelectItem value="Wrong Item">Wrong Item / Size</SelectItem>
                  <SelectItem value="Unopened / Buyer Remorse">Buyer Remorse / Unopened</SelectItem>
                  <SelectItem value="Damaged in Transit">Damaged in Transit</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="actionTaken" className="sm:text-right text-xs font-semibold">Action</Label>
              <Select value={actionTaken} onValueChange={(val: any) => setActionTaken(val)}>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Restocked">Restock & resell item</SelectItem>
                  <SelectItem value="Disposed / Written Off">Dispose / Damaged write-off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="refundStatus" className="sm:text-right text-xs font-semibold">Refund Status</Label>
              <Select value={refundStatus} onValueChange={(val: any) => setRefundStatus(val)}>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Refunded">Refunded (Cash/UPI/Card)</SelectItem>
                  <SelectItem value="Store Credit">Store Credit</SelectItem>
                  <SelectItem value="Pending">Pending Approval</SelectItem>
                  <SelectItem value="Rejected">Rejected (No Refund)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="refundAmount" className="sm:text-right text-xs font-semibold">Refund (₹)</Label>
              <Input
                id="refundAmount"
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="sm:col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3">
              <Label htmlFor="notes" className="sm:text-right text-xs font-semibold pt-1">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Details about product defects or sizing details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="sm:col-span-3 min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit">Log Return</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Assign Product Dialog */}
      <Dialog
        open={isAssignProductDialogOpen}
        onOpenChange={(isOpen) => {
          setIsAssignProductDialogOpen(isOpen);
          if (!isOpen) {
            setItemToAssign(null);
            setAssignProductId('');
            setProductSearchQuery('');
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl ios-glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-primary" />
              <span>Assign Return to Catalog Product</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Link this return record to an item from your catalog to ensure accurate inventory and quality metrics.
            </DialogDescription>
          </DialogHeader>

          {itemToAssign && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/40 rounded-xl p-3 text-xs space-y-1.5 border border-border/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Item:</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">{itemToAssign.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span>{itemToAssign.customerName}</span>
                </div>
                {itemToAssign.orderNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order:</span>
                    <span className="font-mono text-muted-foreground">{itemToAssign.orderNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refund Amount:</span>
                  <span className="font-semibold text-emerald-400">₹{itemToAssign.refundAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Catalog Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search product name, SKU, or category..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-xl"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                  {filteredCatalogProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No matching products in catalog.
                    </div>
                  ) : (
                    filteredCatalogProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => setAssignProductId(p.id)}
                        className={`p-2.5 flex items-center justify-between hover:bg-secondary/50 cursor-pointer transition-colors text-xs ${
                          assignProductId === p.id ? 'bg-primary/10 border-l-2 border-primary font-medium' : ''
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            SKU: {p.sku || 'N/A'} • Stock: {p.stock} • ₹{p.price}
                          </p>
                        </div>
                        {assignProductId === p.id && (
                          <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAssignProductDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!assignProductId}
              onClick={handleAssignProduct}
              className="rounded-xl text-xs font-medium"
            >
              Assign Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
