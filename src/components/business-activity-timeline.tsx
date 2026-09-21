'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/data-context';
import { getAuditLogs, type BusinessAuditLog } from '@/lib/audit-store';
import { useUser } from '@/firebase';
import { parseDateTimestamp } from '@/lib/data-readiness-engine';
import {
  ShoppingCart,
  PackageCheck,
  Truck,
  RefreshCw,
  AlertOctagon,
  AlertTriangle,
  Sparkles,
  Clock,
  Search,
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  rawTime: number;
  type: 'sale' | 'purchase' | 'order' | 'return' | 'alert' | 'low_stock' | 'audit';
}

function formatRelativeTime(ts: number | null, fallback?: string): string {
  if (!ts || isNaN(ts) || ts <= 0) return fallback || 'Recent';
  const now = Date.now();
  const diffMs = now - ts;

  if (diffMs < 0) return 'Today';
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMs / (3600 * 1000));
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function BusinessActivityTimeline() {
  const {
    transactions = [],
    products = [],
    suppliers = [],
    orders = [],
    returns = [],
    businessProfile,
  } = useData();
  const { user } = useUser();

  const [activeFilter, setActiveFilter] = useState<'all' | 'sales' | 'orders' | 'alerts'>('all');
  const [auditLogs, setAuditLogs] = useState<BusinessAuditLog[]>(() => (user?.uid ? getAuditLogs(user.uid) : []));
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Listen for real-time local audit logs scoped to this authenticated user
  useEffect(() => {
    setAuditLogs(user?.uid ? getAuditLogs(user.uid) : []);
    const handleAudit = (e: Event) => {
      const customEvt = e as CustomEvent;
      const targetUid = customEvt.detail?.userId;
      if (!targetUid || (user?.uid && targetUid === user.uid)) {
        setAuditLogs(user?.uid ? getAuditLogs(user.uid) : []);
      }
    };
    window.addEventListener('analyzeup_audit_logged', handleAudit);
    return () => window.removeEventListener('analyzeup_audit_logged', handleAudit);
  }, [user?.uid]);

  // Fast Product Lookup Map
  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.sku) map.set(p.sku.toLowerCase(), p);
      if (p.name) map.set(p.name.toLowerCase(), p);
    });
    return map;
  }, [products]);

  // Fast Supplier Lookup Map
  const supplierMap = useMemo(() => {
    const map = new Map<string, any>();
    suppliers.forEach((s) => {
      if (s.id) map.set(s.id, s);
      if (s.name) map.set(s.name.toLowerCase(), s);
    });
    return map;
  }, [suppliers]);

  // Synthesize REAL chronological events across sales, POs, returns, stock levels, and audit trail
  const allEvents = useMemo(() => {
    const list: ActivityEvent[] = [];

    // 1. REAL Customer Sales Transactions
    transactions.forEach((t, i) => {
      const isSale = !t.type || t.type === 'Sale' || String(t.type).toLowerCase() === 'sale';
      const ts = parseDateTimestamp(t.transactionDate || t.createdAt) || (Date.now() - (i + 1) * 3600000 * 4);
      const matchedProd =
        productMap.get(t.productId) ||
        (t.sku ? productMap.get(t.sku.toLowerCase()) : null) ||
        (t.productName ? productMap.get(t.productName.toLowerCase()) : null);

      const prodName = t.productName || matchedProd?.name || 'Customer Order';
      const qty = Math.max(1, Number(t.quantity) || 1);

      if (isSale) {
        const unitPrice = Number(
          t.price ??
            t.unitPrice ??
            (t.totalRevenue && qty ? t.totalRevenue / qty : matchedProd?.price ?? 0)
        );
        const totalPrice = Number(t.totalRevenue ?? (unitPrice * qty));
        const orderId = t.orderNumber || t.transactionId;

        list.push({
          id: `tx-sale-${t.id || i}`,
          title: orderId ? `Customer Order #${orderId}: ${prodName}` : `Sale: ${prodName}`,
          description: `${qty} unit${qty > 1 ? 's' : ''}${
            totalPrice > 0 ? ` • ${currencySymbol}${Math.round(totalPrice).toLocaleString('en-IN')}` : ''
          }${t.paymentMethod ? ` (${t.paymentMethod})` : t.financialStatus ? ` (${t.financialStatus})` : ''}`,
          timestamp: formatRelativeTime(ts),
          rawTime: ts,
          type: 'sale',
        });
      } else {
        // Inbound purchase transaction
        const unitCost = Number(
          t.costPerUnit ??
            t.costPrice ??
            t.price ??
            (t.totalCost && qty ? t.totalCost / qty : matchedProd?.costPrice ?? 0)
        );
        const totalCost = Number(t.totalCost ?? (unitCost * qty));

        list.push({
          id: `tx-purchase-${t.id || i}`,
          title: `Restock Received: ${prodName}`,
          description: `${qty} unit${qty > 1 ? 's' : ''} received${
            totalCost > 0 ? ` • ${currencySymbol}${Math.round(totalCost).toLocaleString('en-IN')}` : ''
          }${t.supplier ? ` from ${t.supplier}` : ''}`,
          timestamp: formatRelativeTime(ts),
          rawTime: ts,
          type: 'purchase',
        });
      }
    });

    // 2. REAL Purchase Orders (Inbound & Fulfilled)
    orders.forEach((o, i) => {
      const ts = parseDateTimestamp(o.actualDeliveryDate || o.orderDate || o.createdAt) || (Date.now() - (i + 1) * 7200000);
      const isFulfilled = o.status === 'Fulfilled' || o.status === 'Delivered';
      const matchedProd = productMap.get(o.productId);
      const prodName = o.productName || matchedProd?.name || 'Inventory Restock';
      const matchedSup = supplierMap.get(o.supplierId);
      const supplierName = o.supplierName || matchedSup?.name || (o.supplierId ? `Supplier (${o.supplierId})` : 'Supplier');
      const totalCost = o.totalCost || (o.unitCost && o.quantity ? o.unitCost * o.quantity : 0);

      list.push({
        id: `order-po-${o.id || i}`,
        title: isFulfilled ? `PO Fulfilled: ${prodName}` : `PO In Transit: ${prodName}`,
        description: `${o.quantity} units from ${supplierName}${
          totalCost > 0 ? ` • ${currencySymbol}${Math.round(totalCost).toLocaleString('en-IN')}` : ''
        } (${o.status})`,
        timestamp: formatRelativeTime(ts),
        rawTime: ts,
        type: isFulfilled ? 'purchase' : 'order',
      });
    });

    // 3. REAL Customer Returns
    returns.forEach((r, i) => {
      const ts = parseDateTimestamp(r.returnDate || r.createdAt) || (Date.now() - (i + 1) * 14400000);
      const matchedProd = productMap.get(r.productId);
      const prodName = r.productName || matchedProd?.name || 'Product Return';

      list.push({
        id: `return-${r.id || i}`,
        title: `Customer Return: ${prodName}`,
        description: `${r.quantity || 1} unit (${r.reason || 'Returned'})${
          r.refundAmount ? ` • ${currencySymbol}${Math.round(r.refundAmount).toLocaleString('en-IN')}` : ''
        } (${r.refundStatus || 'Refunded'})`,
        timestamp: formatRelativeTime(ts),
        rawTime: ts,
        type: 'return',
      });
    });

    // 4. REAL Out of Stock Alerts
    const zeroStock = products.filter(
      (p) => p && (Number(p.stock) === 0 || p.stock === undefined || p.stock === null)
    );
    zeroStock.slice(0, 5).forEach((p, i) => {
      list.push({
        id: `alert-zero-${p.id || i}`,
        title: `Stockout Alert: ${p.name}`,
        description: `0 units remaining. Lost revenue risk • Supplier reorder required.`,
        timestamp: 'Active Now',
        rawTime: Date.now() + 1000 - i, // pin active critical alert to top
        type: 'alert',
      });
    });

    // 5. REAL Low Stock Buffer Warnings
    const lowStock = products.filter((p) => {
      const s = Number(p?.stock) || 0;
      const min = Number(p?.minStock) || 5;
      return s > 0 && s <= min;
    });
    lowStock.slice(0, 5).forEach((p, i) => {
      list.push({
        id: `alert-low-${p.id || i}`,
        title: `Low Stock: ${p.name}`,
        description: `Current stock level dropped to ${p.stock} units (Safety min: ${p.minStock || 5}).`,
        timestamp: 'Today',
        rawTime: Date.now() - (i + 1) * 1800000,
        type: 'low_stock',
      });
    });

    // 6. REAL Audit Logs (Founder Actions & Operations)
    auditLogs.slice(0, 10).forEach((l, i) => {
      list.push({
        id: `audit-${l.id || i}`,
        title: l.title || 'Founder Operational Action',
        description: l.changeDetails || l.productName || 'Action executed successfully.',
        timestamp: l.timestamp ? String(l.timestamp).slice(0, 16) : 'Recent',
        rawTime: Date.now() - (i + 1) * 3600000,
        type: 'audit',
      });
    });

    // Sort strictly by timestamp descending (newest first)
    list.sort((a, b) => b.rawTime - a.rawTime);

    return list;
  }, [transactions, products, suppliers, orders, returns, auditLogs, productMap, supplierMap, currencySymbol]);

  // Counts for each category
  const salesCount = useMemo(() => allEvents.filter((e) => e.type === 'sale').length, [allEvents]);
  const ordersCount = useMemo(
    () => allEvents.filter((e) => e.type === 'purchase' || e.type === 'order').length,
    [allEvents]
  );
  const alertsCount = useMemo(
    () => allEvents.filter((e) => e.type === 'alert' || e.type === 'low_stock' || e.type === 'return').length,
    [allEvents]
  );

  // Filtered by selected tab and search query
  const filteredEvents = useMemo(() => {
    let list = allEvents;
    if (activeFilter === 'sales') {
      list = allEvents.filter((e) => e.type === 'sale');
    } else if (activeFilter === 'orders') {
      list = allEvents.filter((e) => e.type === 'purchase' || e.type === 'order');
    } else if (activeFilter === 'alerts') {
      list = allEvents.filter((e) => e.type === 'alert' || e.type === 'low_stock' || e.type === 'return');
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.timestamp.toLowerCase().includes(q)
    );
  }, [allEvents, activeFilter, searchQuery]);

  // Displayed items respecting display limit (defaults to 100 so all activities can be seen)
  const displayedEvents = useMemo(() => {
    return filteredEvents.slice(0, displayLimit);
  }, [filteredEvents, displayLimit]);

  const getIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />;
      case 'purchase':
        return <PackageCheck className="w-3.5 h-3.5 text-cyan-400" />;
      case 'order':
        return <Truck className="w-3.5 h-3.5 text-blue-400" />;
      case 'return':
        return <RefreshCw className="w-3.5 h-3.5 text-purple-400" />;
      case 'alert':
        return <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />;
      case 'low_stock':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'audit':
      default:
        return <Sparkles className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const getTypeLabel = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'purchase':
        return 'Restock';
      case 'order':
        return 'PO';
      case 'return':
        return 'Return';
      case 'alert':
        return 'Critical';
      case 'low_stock':
        return 'Low Stock';
      case 'audit':
        return 'Audit';
      default:
        return 'Event';
    }
  };

  const getTypeBadgeStyle = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'sale':
        return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
      case 'purchase':
        return 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10';
      case 'order':
        return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
      case 'return':
        return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
      case 'alert':
        return 'border-rose-500/30 text-rose-400 bg-rose-500/10';
      case 'low_stock':
        return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
      case 'audit':
        return 'border-primary/30 text-primary bg-primary/10';
      default:
        return 'border-border text-muted-foreground';
    }
  };

  return (
    <Card className="ios-glass rounded-3xl border-border/50 p-5 shadow-xl space-y-3 h-full flex flex-col justify-between">
      <div className="space-y-3">
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold whitespace-nowrap">Business Activity Timeline</CardTitle>
              <CardDescription className="text-xs truncate">Real-time operational event feed ({allEvents.length} total)</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-semibold whitespace-nowrap shrink-0 px-2.5 py-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 flex items-center gap-1.5 shadow-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Live Feed
            </Badge>
          </div>
        </CardHeader>

        {/* Filter Pills & Quick Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-[11px]">
            <button
              type="button"
              onClick={() => {
                setActiveFilter('all');
                setDisplayLimit(100);
              }}
              className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              All Activity ({allEvents.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('sales');
                setDisplayLimit(100);
              }}
              className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                activeFilter === 'sales'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Sales ({salesCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('orders');
                setDisplayLimit(100);
              }}
              className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                activeFilter === 'orders'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Restocks & POs ({ordersCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveFilter('alerts');
                setDisplayLimit(100);
              }}
              className={`px-3 py-1 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                activeFilter === 'alerts'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              Alerts ({alertsCount})
            </button>
          </div>

          {/* Quick Search inside feed */}
          <div className="relative w-full sm:w-44 shrink-0">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feed..."
              className="pl-8 h-8 text-[11px] rounded-xl bg-secondary/30 border-border/40"
            />
          </div>
        </div>

        <CardContent className="p-0 pt-2 text-xs">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs rounded-2xl bg-secondary/20 border border-border/30 my-2">
              {searchQuery ? `No activity found matching "${searchQuery}".` : 'No activity logged under this category yet.'}
            </div>
          ) : (
            <div className="relative pl-6 space-y-3.5 max-h-[460px] overflow-y-auto pr-2 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
              {displayedEvents.map((evt) => (
                <div key={evt.id} className="relative flex items-start justify-between gap-3 group p-1.5 rounded-xl hover:bg-secondary/20 transition-colors">
                  <div className="absolute -left-6 top-1 p-1 rounded-full bg-background border border-border/60 shadow-xs group-hover:scale-110 transition-transform">
                    {getIcon(evt.type)}
                  </div>
                  <div className="min-w-0 space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h5 className="font-bold text-foreground truncate text-xs group-hover:text-primary transition-colors">
                        {evt.title}
                      </h5>
                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 font-semibold ${getTypeBadgeStyle(evt.type)}`}>
                        {getTypeLabel(evt.type)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px] line-clamp-1">{evt.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 whitespace-nowrap bg-secondary/50 px-2 py-0.5 rounded-md border border-border/40">
                    {evt.timestamp}
                  </span>
                </div>
              ))}

              {/* Load More / Show All Controls */}
              {filteredEvents.length > displayedEvents.length ? (
                <div className="pt-3 pb-1 flex items-center justify-between gap-2 border-t border-border/30">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Showing {displayedEvents.length} of {filteredEvents.length} activities
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDisplayLimit((prev) => Math.min(prev + 50, filteredEvents.length))}
                      className="rounded-xl text-xs font-bold border-border/50 text-foreground hover:bg-secondary/50 h-7 px-3 cursor-pointer"
                    >
                      Load 50 More
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setDisplayLimit(filteredEvents.length)}
                      className="rounded-xl text-xs font-bold h-7 px-3 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Show All ({filteredEvents.length})
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 pb-1 text-center border-t border-border/20">
                  <span className="text-[10px] text-muted-foreground/70 font-mono">
                    ✓ All {filteredEvents.length} activities loaded in real-time
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
