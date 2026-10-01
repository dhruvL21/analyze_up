'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusCircle,
  MoreHorizontal,
  Truck,
  CheckCircle2,
  Clock,
  PackageCheck,
  TrendingUp,
  Boxes,
  Building2,
  DollarSign,
  Search,
  Package,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
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
import { OperationsSubNav } from '@/components/operations-sub-nav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/context/data-context';
import { logBusinessAction } from '@/lib/audit-store';
import type { PurchaseOrder } from '@/lib/types';
import Image from 'next/image';

type OrderFilterTab = 'pending' | 'all' | 'fulfilled' | 'cancelled';

export default function OrdersPage() {
  const {
    orders,
    suppliers,
    products,
    addOrder,
    deleteOrder,
    receivePurchaseOrder,
    isLoading,
    businessProfile,
  } = useData();

  const [activeTab, setActiveTab] = useState<OrderFilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersPageSize = 25;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receivedQtyInput, setReceivedQtyInput] = useState<number>(0);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Fast pre-indexed lookups
  const suppliersMap = React.useMemo(() => {
    const map = new Map<string, typeof suppliers[0]>();
    suppliers.forEach(s => map.set(s.id, s));
    return map;
  }, [suppliers]);

  const productsMap = React.useMemo(() => {
    const map = new Map<string, typeof products[0]>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Sort orders newest first
  const sortedOrders = React.useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.orderDate || 0).getTime();
      const dateB = new Date(b.orderDate || 0).getTime();
      return dateB - dateA;
    });
  }, [orders]);

  const pendingOrders = React.useMemo(() => {
    return sortedOrders.filter(
      (o) => o.status === 'Pending' || o.status === 'Shipped' || o.status === 'Delivered'
    );
  }, [sortedOrders]);

  const fulfilledOrders = React.useMemo(() => {
    return sortedOrders.filter((o) => o.status === 'Fulfilled');
  }, [sortedOrders]);

  const cancelledOrders = React.useMemo(() => {
    return sortedOrders.filter((o) => o.status === 'Cancelled');
  }, [sortedOrders]);

  const filteredOrders = React.useMemo(() => {
    return sortedOrders.filter((order) => {
      if (activeTab === 'pending') {
        if (order.status === 'Fulfilled' || order.status === 'Cancelled') return false;
      } else if (activeTab === 'fulfilled') {
        if (order.status !== 'Fulfilled') return false;
      } else if (activeTab === 'cancelled') {
        if (order.status !== 'Cancelled') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sup = (suppliersMap.get(order.supplierId)?.name || order.supplierName || '').toLowerCase();
        const prod = (productsMap.get(order.productId)?.name || order.productName || '').toLowerCase();
        const id = order.id.toLowerCase();
        return sup.includes(q) || prod.includes(q) || id.includes(q);
      }
      return true;
    });
  }, [sortedOrders, activeTab, searchQuery, suppliersMap, productsMap]);

  // Pagination for orders table
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize));
  const safeOrderPage = Math.min(ordersPage, totalOrderPages);
  const paginatedOrders = React.useMemo(() => {
    const start = (safeOrderPage - 1) * ordersPageSize;
    return filteredOrders.slice(start, start + ordersPageSize);
  }, [filteredOrders, safeOrderPage, ordersPageSize]);

  // Reset pagination on tab or search change
  useEffect(() => {
    setOrdersPage(1);
  }, [activeTab, searchQuery]);

  // Calculate Inbound Metrics
  const totalInboundUnits = React.useMemo(() => {
    return pendingOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  }, [pendingOrders]);

  const totalInboundSpend = React.useMemo(() => {
    return pendingOrders.reduce((sum, o) => {
      const prod = productsMap.get(o.productId);
      const unitCost = o.unitCost || prod?.costPrice || (prod?.price || 500) * 0.6;
      return sum + unitCost * (o.quantity || 1);
    }, 0);
  }, [pendingOrders, productsMap]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const supplierId = formData.get('supplierId') as string;
    const productId = formData.get('productId') as string;
    const quantity = Number(formData.get('quantity'));
    const leadDays = Number(formData.get('leadDays')) || 7;

    const prod = products.find((p) => p.id === productId);
    const sup = suppliers.find((s) => s.id === supplierId);
    const unitCost = Number(prod?.costPrice) || Number(prod?.price || 500) * 0.6;
    const totalCost = Math.round(unitCost * quantity);

    const newOrderData = {
      supplierId,
      status: 'Pending' as const,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + leadDays * 86400000).toISOString(),
      quantity,
      productId,
      unitCost,
      totalCost,
    };

    addOrder(newOrderData);

    logBusinessAction({
      title: `Purchase Order Issued: ${quantity} units (In Transit)`,
      productName: prod?.name || 'Product',
      actionType: 'reorder',
      changeDetails: `Issued PO for ${quantity} units to "${sup?.name || 'Supplier'}". Expected delivery in ${leadDays} days. Stock will update upon receiving.`,
      impactValue: `${currencySymbol}${totalCost.toLocaleString('en-IN')}`,
      previousValue: `Stock: ${prod?.stock || 0}`,
      newValue: `In Transit: ${quantity} units`,
    });

    setDialogOpen(false);
  };

  const handleOpenReceiveModal = (order: PurchaseOrder) => {
    setReceivingOrder(order);
    setReceivedQtyInput(order.quantity);
  };

  const handleConfirmReceive = async () => {
    if (!receivingOrder) return;
    await receivePurchaseOrder(receivingOrder.id, receivedQtyInput || receivingOrder.quantity);
    setReceivingOrder(null);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <OperationsSubNav />

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Truck className="w-5 h-5" />
              </div>
              Purchase Orders & Inbound Tracking
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Track incoming supplier shipments. Physical inventory and metrics update when goods are marked as received.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 px-4 gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm"
              onClick={() => setDialogOpen(true)}
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Purchase Order</span>
            </Button>
          </div>
        </div>

        {/* Inbound KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="ios-glass rounded-2xl border border-border/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">In Transit Shipments</p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  {pendingOrders.length} <span className="text-xs font-normal text-muted-foreground">POs active</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/80 text-muted-foreground border border-border/40">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {totalInboundUnits} total units pending physical delivery
            </p>
          </Card>

          <Card className="ios-glass rounded-2xl border border-border/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Inbound Capital Committed</p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  {currencySymbol}{totalInboundSpend.toLocaleString('en-IN')}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/80 text-muted-foreground border border-border/40">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Cost value of incoming replenishment inventory
            </p>
          </Card>

          <Card className="ios-glass rounded-2xl border border-border/40 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Received & Restocked</p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  {fulfilledOrders.length} <span className="text-xs font-normal text-muted-foreground">fulfilled</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/80 text-muted-foreground border border-border/40">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Shipments successfully accepted into physical inventory
            </p>
          </Card>
        </div>

        {/* Main Orders Table & Filter Tabs */}
        <Card className="ios-glass rounded-3xl border border-border/40 p-5 shadow-xl space-y-4">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-secondary/30 rounded-2xl border border-border/40 w-fit text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'pending'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                In Transit & Pending ({pendingOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'all'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                All Orders ({sortedOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('fulfilled')}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'fulfilled'
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Received ({fulfilledOrders.length})
              </button>
              {cancelledOrders.length > 0 && (
                <button
                  onClick={() => setActiveTab('cancelled')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    activeTab === 'cancelled'
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  Cancelled ({cancelledOrders.length})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product, SKU or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-secondary/30 border-border/40"
              />
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Loading purchase orders...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-secondary/10 border border-border/30 space-y-2">
                <PackageCheck className="w-8 h-8 text-muted-foreground mx-auto" />
                <h4 className="text-sm font-bold text-foreground">No Purchase Orders Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {activeTab === 'pending'
                    ? 'No inbound shipments currently in transit. Create a purchase order or approve a restock recommendation in AI Action Center.'
                    : 'No orders match the current filter or search criteria.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-2xl border border-border/40">
                  <Table className="w-full">
                    <TableHeader className="bg-secondary/40">
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-xs font-bold text-muted-foreground py-3.5 pl-4 min-w-[220px]">
                          Product & SKU
                        </TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground py-3.5 min-w-[150px]">
                          Supplier
                        </TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-center min-w-[130px]">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-center min-w-[150px]">
                          Ordered / Expected
                        </TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-right min-w-[90px]">
                          Quantity
                        </TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-right min-w-[110px]">
                          Total Cost
                        </TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-right pr-4 min-w-[150px]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/30">
                      {paginatedOrders.map((order) => {
                        const sup = suppliersMap.get(order.supplierId);
                        const prod = productsMap.get(order.productId);
                        const pName = prod?.name || order.productName || 'Product';
                        const supName = sup?.name || order.supplierName || 'Supplier';
                        const unitCost = order.unitCost || prod?.costPrice || (prod?.price || 500) * 0.6;
                        const totalCost = order.totalCost || Math.round(unitCost * order.quantity);

                        const isPending = order.status !== 'Fulfilled' && order.status !== 'Cancelled';
                        const hasRealImage = prod?.imageUrl && prod.imageUrl.startsWith('http') && !prod.imageUrl.includes('placehold.co');

                        return (
                          <TableRow key={order.id} className="hover:bg-secondary/20 transition-colors">
                            {/* Product & SKU */}
                            <TableCell className="py-3 pl-4">
                              <div className="flex items-center gap-3">
                                {hasRealImage ? (
                                  <Image
                                    alt={pName}
                                    src={prod.imageUrl!}
                                    width={38}
                                    height={38}
                                    className="aspect-square rounded-xl object-cover border border-border/40 shrink-0"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-secondary/80 border border-border/50 flex items-center justify-center text-muted-foreground shrink-0">
                                    <Package className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="space-y-0.5">
                                  <p className="font-bold text-xs text-foreground leading-tight">{pName}</p>
                                  <p className="font-mono text-[10px] text-muted-foreground">
                                    {prod?.sku ? `SKU: ${prod.sku}` : `PO-${order.id.substring(0, 6)}`}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            {/* Supplier */}
                            <TableCell className="py-3">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs font-semibold text-foreground">{supName}</span>
                              </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell className="py-3 text-center">
                              {order.status === 'Fulfilled' ? (
                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Received
                                </Badge>
                              ) : order.status === 'Cancelled' ? (
                                <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] font-bold px-2.5 py-0.5">
                                  Cancelled
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold px-2.5 py-0.5">
                                  <Truck className="w-3 h-3 mr-1" /> In Transit
                                </Badge>
                              )}
                            </TableCell>

                            {/* Ordered / Expected */}
                            <TableCell className="py-3 text-center">
                              <div className="space-y-0.5 text-xs">
                                <p className="text-foreground font-medium whitespace-nowrap">
                                  {formatDate(order.orderDate)}
                                </p>
                                {order.expectedDeliveryDate && isPending && (
                                  <p className="text-amber-400 font-semibold text-[10px] flex items-center justify-center gap-1 whitespace-nowrap">
                                    <Clock className="w-2.5 h-2.5 shrink-0" />
                                    Exp: {formatDate(order.expectedDeliveryDate)}
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            {/* Quantity */}
                            <TableCell className="py-3 text-right">
                              <span className="font-black text-xs text-foreground">{order.quantity}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">units</span>
                            </TableCell>

                            {/* Total Cost */}
                            <TableCell className="py-3 text-right font-bold text-xs text-foreground font-mono">
                              {currencySymbol}{totalCost.toLocaleString('en-IN')}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="py-3 pr-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenReceiveModal(order)}
                                    className="rounded-xl h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm shadow-emerald-600/20 whitespace-nowrap"
                                  >
                                    <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>Receive PO</span>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setViewingOrder(order)}
                                    className="rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    Details
                                  </Button>
                                )}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8 rounded-xl shrink-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl ios-glass">
                                    <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                                      Options
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => setViewingOrder(order)}>
                                      View Full Order Details
                                    </DropdownMenuItem>
                                    {isPending && (
                                      <DropdownMenuItem onClick={() => handleOpenReceiveModal(order)} className="text-emerald-400 font-semibold">
                                        Mark as Received (+{order.quantity} units)
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive font-semibold">
                                          Delete Order
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-2xl ios-glass">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                                          <AlertDialogDescription className="text-xs">
                                            This will remove the PO record from tracking. If already fulfilled, stock count will remain unchanged.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteOrder(order.id)} className="bg-destructive rounded-xl">
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card List View */}
                <div className="md:hidden divide-y divide-border/30">
                  {paginatedOrders.map((order) => {
                    const sup = suppliersMap.get(order.supplierId);
                    const prod = productsMap.get(order.productId);
                    const pName = prod?.name || order.productName || 'Product';
                    const supName = sup?.name || order.supplierName || 'Supplier';
                    const unitCost = order.unitCost || prod?.costPrice || (prod?.price || 500) * 0.6;
                    const totalCost = order.totalCost || Math.round(unitCost * order.quantity);
                    const isPending = order.status !== 'Fulfilled' && order.status !== 'Cancelled';
                    const hasRealImage = prod?.imageUrl && prod.imageUrl.startsWith('http') && !prod.imageUrl.includes('placehold.co');

                    return (
                      <div key={order.id} className="p-4 space-y-3 hover:bg-secondary/20 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {hasRealImage ? (
                              <Image
                                alt={pName}
                                src={prod.imageUrl!}
                                width={36}
                                height={36}
                                className="aspect-square rounded-xl object-cover border border-border/40 shrink-0"
                                unoptimized
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-secondary/80 border border-border/50 flex items-center justify-center text-muted-foreground shrink-0">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-xs text-foreground">{pName}</p>
                              <p className="text-[10px] text-muted-foreground">{supName}</p>
                            </div>
                          </div>
                          {order.status === 'Fulfilled' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Received
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Truck className="w-3 h-3" /> In Transit
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400">
                              Cancelled
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/20 text-muted-foreground">
                          <span>Ordered: {formatDate(order.orderDate)}</span>
                          <span className="font-bold text-foreground">
                            {order.quantity} units ({currencySymbol}{totalCost.toLocaleString('en-IN')})
                          </span>
                        </div>

                        {isPending && (
                          <div className="pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleOpenReceiveModal(order)}
                              className="w-full rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm shadow-emerald-600/20"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              Mark as Received (Add +{order.quantity} to Stock)
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls Bar */}
                {filteredOrders.length > ordersPageSize && (
                  <div className="p-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      Showing <span className="font-semibold text-foreground">{(safeOrderPage - 1) * ordersPageSize + 1}</span> to{' '}
                      <span className="font-semibold text-foreground">{Math.min(safeOrderPage * ordersPageSize, filteredOrders.length)}</span> of{' '}
                      <span className="font-semibold text-foreground">{filteredOrders.length.toLocaleString()}</span> purchase orders
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeOrderPage <= 1}
                        onClick={() => setOrdersPage(1)}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeOrderPage <= 1}
                        onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <span className="px-2 font-bold text-foreground">
                        Page {safeOrderPage} of {totalOrderPages}
                      </span>

                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeOrderPage >= totalOrderPages}
                        onClick={() => setOrdersPage(p => Math.min(totalOrderPages, p + 1))}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={safeOrderPage >= totalOrderPages}
                        onClick={() => setOrdersPage(totalOrderPages)}
                        className="h-8 w-8 rounded-lg"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receive PO & Restock Confirmation Dialog */}
      <Dialog open={!!receivingOrder} onOpenChange={(open) => !open && setReceivingOrder(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto ios-glass border-emerald-500/30 p-6 rounded-3xl shadow-2xl">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <PackageCheck className="w-5 h-5" />
              </div>
              Confirm Goods Receipt & Stock Update
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Receiving this purchase order will transition it to Received and increment your physical inventory stock.
            </DialogDescription>
          </DialogHeader>

          {receivingOrder && (
            <div className="space-y-4 py-3 text-xs">
              {(() => {
                const prod = products.find((p) => p.id === receivingOrder.productId);
                const sup = suppliers.find((s) => s.id === receivingOrder.supplierId);
                const currentStock = prod?.stock || 0;
                const incomingQty = receivedQtyInput || receivingOrder.quantity;
                const newStock = currentStock + incomingQty;

                return (
                  <>
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-border/20">
                        <span className="text-muted-foreground">Product</span>
                        <span className="font-bold text-foreground text-right">{prod?.name || 'Product'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border/20">
                        <span className="text-muted-foreground">Supplier</span>
                        <span className="font-semibold text-foreground text-right">{sup?.name || 'Supplier'}</span>
                      </div>

                      {/* Stock Impact Comparison */}
                      <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" /> Inventory Impact
                        </p>
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="text-muted-foreground">Current Physical Stock:</span>
                          <span className="font-bold text-foreground">{currentStock} units</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="text-emerald-400 font-bold">+ Arriving Quantity:</span>
                          <span className="font-bold text-emerald-400">+{incomingQty} units</span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-xs pt-1.5 border-t border-emerald-500/20">
                          <span className="font-bold text-foreground">New Total Stock:</span>
                          <span className="font-black text-emerald-400 text-sm">{newStock} units</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="receivedQty" className="text-xs font-semibold text-foreground">
                        Confirm Received Quantity
                      </Label>
                      <Input
                        id="receivedQty"
                        type="number"
                        min="1"
                        value={receivedQtyInput}
                        onChange={(e) => setReceivedQtyInput(Number(e.target.value))}
                        className="rounded-xl h-9 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Adjust if supplier delivered partial or over-shipment.
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setReceivingOrder(null)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReceive}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirm & Update Inventory Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto ios-glass rounded-3xl p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              Create Purchase Order
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Issue an inbound purchase order to a supplier. The PO will be tracked as In Transit until received.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="supplierId" className="text-xs font-semibold">
                Supplier
              </Label>
              <Select name="supplierId" required defaultValue={suppliers[0]?.id}>
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id} className="text-xs">
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="productId" className="text-xs font-semibold">
                Product to Replenish
              </Label>
              <Select name="productId" required defaultValue={products[0]?.id}>
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {products.map((prod) => (
                    <SelectItem key={prod.id} value={prod.id} className="text-xs">
                      {prod.name} (Stock: {prod.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs font-semibold">
                  Order Quantity
                </Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  defaultValue={30}
                  min={1}
                  step={1}
                  className="rounded-xl text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leadDays" className="text-xs font-semibold">
                  Lead Time (Days)
                </Label>
                <Input
                  id="leadDays"
                  name="leadDays"
                  type="number"
                  defaultValue={7}
                  min={1}
                  step={1}
                  className="rounded-xl text-xs h-9"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1"
              >
                Create Order (In Transit)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Order Details Dialog */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto ios-glass rounded-3xl p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold">Purchase Order Details</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              PO ID: {viewingOrder?.id}
            </DialogDescription>
          </DialogHeader>

          {viewingOrder && (
            <div className="space-y-3 py-3 text-xs">
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Status</span>
                  <span>{viewingOrder.status}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-bold text-foreground text-right">
                    {products.find((p) => p.id === viewingOrder.productId)?.name || viewingOrder.productId}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Supplier</span>
                  <span className="font-semibold text-foreground text-right">
                    {suppliers.find((s) => s.id === viewingOrder.supplierId)?.name || viewingOrder.supplierId}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Quantity Ordered</span>
                  <span className="font-bold text-foreground">{viewingOrder.quantity} units</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/20">
                  <span className="text-muted-foreground">Order Date</span>
                  <span className="text-foreground">{formatDate(viewingOrder.orderDate)}</span>
                </div>
                {viewingOrder.expectedDeliveryDate && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Expected Delivery</span>
                    <span className="text-amber-400 font-semibold">
                      {formatDate(viewingOrder.expectedDeliveryDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {viewingOrder && viewingOrder.status !== 'Fulfilled' && (
              <Button
                type="button"
                onClick={() => {
                  const ord = viewingOrder;
                  setViewingOrder(null);
                  handleOpenReceiveModal(ord);
                }}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                Mark as Received
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setViewingOrder(null)} className="rounded-xl text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
