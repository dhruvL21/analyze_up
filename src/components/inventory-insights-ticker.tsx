'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useData } from '@/context/data-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  AlertTriangle,
  PackageX,
  Truck,
  Coins,
  ChevronLeft,
  ChevronRight,
  Activity,
  ShieldCheck,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { computeBusinessHealth } from '@/lib/command-center-engine';
import { evaluateSalesHistory } from '@/lib/sales-history-helper';

export function InventoryInsightsTicker() {
  const { products, transactions, suppliers, returns = [], businessProfile, capabilities, businessBuddyCalibration } = useData();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Compute live Business Health Score
  const health = React.useMemo(() => {
    return computeBusinessHealth(products, transactions, suppliers, returns);
  }, [products, transactions, suppliers, returns]);

  // Evaluate dynamic sales history duration
  const salesHistory = React.useMemo(() => {
    return evaluateSalesHistory(products, transactions);
  }, [products, transactions]);

  // Capability status for dead stock detection (requires >= 30 days of history unless overridden)
  const isDeadStockActive = capabilities
    ? capabilities.deadStockDetection
    : (businessBuddyCalibration?.status !== 'LEARNING' && salesHistory.hasMinimumHistory);

  const insights = React.useMemo(() => {
    const list = [];

    // 1. Primary Dynamic Brand Health Score Insight
    if (products.length > 0) {
      list.push({
        id: 'ins-brand-score',
        icon: <Activity className="w-3.5 h-3.5 shrink-0 animate-pulse" style={{ color: health.color }} />,
        text: `Business Health Score: ${health.score}/100 (${health.category}) — ${health.summarySentence}`,
        tag: 'Brand Health',
        badgeClass: health.badgeClass,
      });
    }

    // 2. Dead Stock Insight (Calibrated by Brand Score / Sales History)
    if (!isDeadStockActive) {
      // During learning phase (<30 days history, e.g. 4 days), do NOT accuse products of being dead stock
      list.push({
        id: 'ins-dead-stock-learning',
        icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        text: `Baseline learning active (${salesHistory.historyDays ?? 0} days recorded) — Dead stock algorithms calibrate after 30 days.`,
        tag: 'Calibrating',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      });
    } else {
      const saleProductIds = new Set(transactions.filter((t) => t.type === 'Sale').map((t) => t.productId));
      const deadProducts = products.filter(
        (p) => p.stock > 0 && !saleProductIds.has(p.id) && salesHistory.isProductEligibleForDeadStock(p)
      );
      if (deadProducts.length > 0) {
        list.push({
          id: 'ins-dead-stock',
          icon: <PackageX className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
          text: `${deadProducts.length} products identified as dead stock — Apply clearance discounts to unlock working capital.`,
          tag: 'Dead Stock',
          badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        });
      }
    }

    // 3. Stockout & Inventory Vitality
    const zeroStockProducts = products.filter((p) => p.stock === 0);
    const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= (p.minStock || 5)).length;

    if (zeroStockProducts.length > 0) {
      // True Critical Stockout: 0 units remaining
      list.push({
        id: 'ins-stockout',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
        text: `${zeroStockProducts.length} product${zeroStockProducts.length > 1 ? 's' : ''} currently out of stock (0 units remaining) — Reorder required.`,
        tag: 'Stockout',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      });
    }

    if (lowStockCount > 0) {
      if (!isDeadStockActive) {
        // In learning mode (<30 days), don't trigger false critical stock alarms if vitality is high
        if (health.factors.inventoryHealth >= 75) {
          list.push({
            id: 'ins-inv-vitality',
            icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
            text: `Catalog inventory vitality holds strong at ${health.factors.inventoryHealth}% — ${lowStockCount} items monitored near safety buffer.`,
            tag: 'Inventory Vitality',
            badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          });
        } else {
          list.push({
            id: 'ins-inv-watch',
            icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
            text: `${lowStockCount} products approaching safety threshold — Monitoring velocity to establish reorder runway.`,
            tag: 'Inventory Watch',
            badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          });
        }
      } else {
        list.push({
          id: 'ins-low-stock',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
          text: `${lowStockCount} products entered low stock threshold — Reorder required to protect lead-time runway.`,
          tag: 'Low Stock',
          badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        });
      }
    }

    // 4. Catalog Valuation
    const totalValuation = products.reduce((sum, p) => sum + p.stock * p.price, 0);
    list.push({
      id: 'ins-valuation',
      icon: <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      text: `Total active catalog asset valuation holds at ${currencySymbol}${Math.round(totalValuation).toLocaleString('en-IN')}.`,
      tag: 'Valuation',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    });

    // 5. Margin Index Insight
    if (health.factors.marginHealth > 0) {
      const isHealthyMargin = health.factors.marginHealth >= 70;
      list.push({
        id: 'ins-margin',
        icon: isHealthyMargin ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ),
        text: isHealthyMargin
          ? `Profit margin index strong at ${health.factors.marginHealth}% benchmark efficiency.`
          : `Profit margin index at ${health.factors.marginHealth}% — Opportunity to review cost of goods & retail pricing.`,
        tag: 'Margin Index',
        badgeClass: isHealthyMargin
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      });
    }

    // 6. Supplier Performance Insight
    if (suppliers.length > 0) {
      const avgLead = Math.round(
        products.reduce((acc, p) => acc + (p.leadTimeDays || 7), 0) / (products.length || 1)
      );
      list.push({
        id: 'ins-suppliers',
        icon: <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        text: `Linked with ${suppliers.length} active suppliers. Supplier performance score is ${health.factors.supplierPerformance}% (Avg lead: ${avgLead}d).`,
        tag: 'Suppliers',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      });
    }

    return list;
  }, [products, transactions, suppliers, currencySymbol, health, salesHistory, isDeadStockActive]);

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    checkScrollability();
    const el = scrollContainerRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);

    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability, insights]);

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: offset,
        behavior: 'smooth',
      });
    }
  };

  if (insights.length === 0) return null;

  return (
    <div className="relative p-2.5 sm:p-3 rounded-2xl bg-secondary/40 border border-border/40 backdrop-blur-md flex items-center justify-between gap-2.5 text-xs group">
      {/* Label on Left */}
      <span className="flex items-center gap-1.5 font-bold text-emerald-400 shrink-0 uppercase tracking-wider text-[10px] pl-1 pr-1 border-r border-border/40 whitespace-nowrap">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span className="hidden sm:inline">Live Insights Feed:</span>
        <span className="sm:hidden">Live:</span>
      </span>

      {/* Horizontal Scroll Area */}
      <div className="relative flex-1 min-w-0 overflow-hidden">
        {/* Left Fade Gradient */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/90 to-transparent z-10 pointer-events-none" />
        )}

        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
        >
          {insights.map((ins) => (
            <div
              key={ins.id}
              className="flex items-center gap-1.5 shrink-0 bg-background/60 hover:bg-background/90 px-3 py-1.5 rounded-xl border border-border/30 transition-colors shadow-xs"
            >
              {ins.icon}
              <span className="text-foreground text-[11px] font-medium whitespace-nowrap">{ins.text}</span>
              <Badge className={`${ins.badgeClass} text-[9px] px-1.5 py-0 font-bold shrink-0`}>
                {ins.tag}
              </Badge>
            </div>
          ))}
        </div>

        {/* Right Fade Gradient */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/90 to-transparent z-10 pointer-events-none" />
        )}
      </div>

      {/* Interactive Navigation Arrows */}
      <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-border/40">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => scrollByAmount(-280)}
          disabled={!canScrollLeft}
          className={`h-7 w-7 rounded-lg transition-all ${
            canScrollLeft
              ? 'text-foreground hover:bg-secondary hover:text-foreground active:scale-95'
              : 'text-muted-foreground/30 opacity-40 cursor-not-allowed'
          }`}
          title="Scroll to previous insight"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => scrollByAmount(280)}
          disabled={!canScrollRight}
          className={`h-7 w-7 rounded-lg transition-all ${
            canScrollRight
              ? 'text-foreground hover:bg-secondary hover:text-foreground active:scale-95'
              : 'text-muted-foreground/30 opacity-40 cursor-not-allowed'
          }`}
          title="Scroll to next insight"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
