'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PlusCircle,
  MoreHorizontal,
  Truck,
  ShieldAlert,
  Sparkles,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Coins,
  Scale,
  Search,
  ShoppingBag,
  Building2,
  HelpCircle,
  FileText,
  DollarSign,
  Info,
  ExternalLink,
  Zap,
  X,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useData } from '@/context/data-context';
import { AddSupplierModal } from '@/components/add-supplier-modal';
import { CreatePurchaseOrderModal } from '@/components/create-purchase-order-modal';
import {
  calculateSupplierPerformanceScore,
  calculateSupplierCostIntelligence,
  detectProcurementRisks,
  calculateProcurementSavings,
  compareSuppliers,
  getMinimalRiskSignals,
  SupplierPerformanceMetrics,
  ProcurementRiskItem,
  ProcurementSavingsItem,
  ProductSupplierComparison,
} from '@/lib/supplier-intelligence-engine';
import { Supplier, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function SuppliersPageContent() {
  const { suppliers, products, orders, transactions, deleteSupplier, isLoading, businessProfile } = useData();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<'suppliers' | 'savings'>('suppliers');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && ['suppliers', 'savings'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [selectedSupplierForPo, setSelectedSupplierForPo] = useState<string | undefined>(undefined);
  const [selectedProductForPo, setSelectedProductForPo] = useState<string | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  // Selected supplier for Deep-Dive Intelligence Profile Drawer
  const [activeProfileSupplier, setActiveProfileSupplier] = useState<Supplier | null>(null);

  // Supplier Comparison Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState<string>('');
  const [showAllRisks, setShowAllRisks] = useState(false);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Calculate performance metrics for all suppliers
  const supplierMetricsMap = useMemo(() => {
    const map = new Map<string, SupplierPerformanceMetrics>();
    suppliers.forEach(s => {
      const metrics = calculateSupplierPerformanceScore(s, orders, products, transactions);
      map.set(s.id, metrics);
    });
    return map;
  }, [suppliers, orders, products, transactions]);

  // Compute Procurement Risks
  const procurementRisks = useMemo(() => {
    return detectProcurementRisks(products, suppliers, orders, transactions);
  }, [products, suppliers, orders, transactions]);

  // Compute Procurement Savings
  const procurementSavings = useMemo(() => {
    return calculateProcurementSavings(products, suppliers, orders, transactions);
  }, [products, suppliers, orders, transactions]);

  // Calculate Executive KPIs
  const executiveKPIs = useMemo(() => {
    const validScores = Array.from(supplierMetricsMap.values())
      .map(m => m.score)
      .filter((s): s is number => s !== null);

    const avgScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : null;

    const validLeadTimes = Array.from(supplierMetricsMap.values())
      .map(m => m.avgLeadTimeDays)
      .filter((l): l is number => l !== null);

    const avgLeadTime = validLeadTimes.length > 0
      ? (validLeadTimes.reduce((a, b) => a + b, 0) / validLeadTimes.length).toFixed(1)
      : null;

    const validOnTimeRates = Array.from(supplierMetricsMap.values())
      .map(m => m.onTimeDeliveryRate)
      .filter((r): r is number => r !== null);

    const avgOnTimeRate = validOnTimeRates.length > 0
      ? Math.round(validOnTimeRates.reduce((a, b) => a + b, 0) / validOnTimeRates.length)
      : null;

    const highRiskCount = Array.from(supplierMetricsMap.values()).filter(m => m.riskLevel === 'HIGH').length;

    return {
      totalSuppliers: suppliers.length,
      avgScore,
      avgLeadTime: avgLeadTime ? `${avgLeadTime}d` : 'N/A',
      avgOnTimeRate: avgOnTimeRate !== null ? `${avgOnTimeRate}%` : 'N/A',
      highRiskCount,
      totalPotentialSaving: procurementSavings.totalPotentialSaving,
    };
  }, [suppliers, supplierMetricsMap, procurementSavings]);

  // Filtered Suppliers List (Safe against undefined properties)
  const filteredSuppliers = useMemo(() => {
    const query = (searchQuery || '').toLowerCase().trim();
    return (suppliers || []).filter(s => {
      if (!s) return false;
      const metrics = supplierMetricsMap.get(s.id);
      const name = (s.name || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const contact = (s.contactName || '').toLowerCase();
      const matchesSearch = !query || name.includes(query) || email.includes(query) || contact.includes(query);

      if (!matchesSearch) return false;

      if (riskFilter === 'high') return metrics?.riskLevel === 'HIGH';
      if (riskFilter === 'medium') return metrics?.riskLevel === 'MEDIUM';
      if (riskFilter === 'low') return metrics?.riskLevel === 'LOW';
      if (riskFilter === 'insufficient') return metrics?.dataConfidence === 'INSUFFICIENT';
      return true;
    });
  }, [suppliers, searchQuery, riskFilter, supplierMetricsMap]);

  // Filtered Savings List (Safe against undefined properties)
  const filteredSavingsList = useMemo(() => {
    const query = (searchQuery || '').toLowerCase().trim();
    return (procurementSavings.savingsList || []).filter(item => {
      if (!item) return false;
      if (!query) return true;
      const prod = (item.productName || '').toLowerCase();
      const sku = (item.sku || '').toLowerCase();
      const currentSup = (item.currentSupplierName || '').toLowerCase();
      const altSup = (item.alternativeSupplierName || '').toLowerCase();
      return prod.includes(query) || sku.includes(query) || currentSup.includes(query) || altSup.includes(query);
    });
  }, [procurementSavings.savingsList, searchQuery]);

  const activeSupplierMetrics = activeProfileSupplier ? supplierMetricsMap.get(activeProfileSupplier.id) : null;

  // Compute comparison if comparison modal is open
  const comparisonResult: ProductSupplierComparison | null = useMemo(() => {
    if (!compareProductId || !products.length) return null;
    const targetProd = products.find(p => p.id === compareProductId) || products[0];
    return compareSuppliers(targetProd, suppliers, orders, transactions);
  }, [compareProductId, products, suppliers, orders, transactions]);

  return (
    <>
      <div className="flex flex-col gap-6 pb-12">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/30 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/25 text-primary shrink-0 mt-0.5 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
                Supplier Intelligence & Procurement Engine
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Real-time vendor scoring, lead-time tracking, margin impact chain & intelligent procurement decisioning.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-semibold h-9 rounded-xl"
              onClick={() => {
                if (products.length > 0) setCompareProductId(products[0].id);
                setCompareModalOpen(true);
              }}
            >
              <Scale className="w-3.5 h-3.5 text-primary" /> Compare Vendors
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs font-semibold h-9 rounded-xl"
              onClick={() => {
                setSelectedSupplierForPo(undefined);
                setPoModalOpen(true);
              }}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Issue PO
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs font-bold h-9 rounded-xl bg-primary text-primary-foreground hover:brightness-110 shadow-sm"
              onClick={() => setAddModalOpen(true)}
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Supplier
            </Button>
          </div>
        </div>

        {/* Executive Procurement KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Card className="ios-glass p-4 space-y-1 rounded-2xl border border-border/40 shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Active Vendors</span>
            <div className="text-2xl font-black text-foreground">{executiveKPIs.totalSuppliers}</div>
            <p className="text-[11px] text-muted-foreground">Managed in catalog</p>
          </Card>
          <Card className="ios-glass p-4 space-y-1 rounded-2xl border border-border/40 shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Avg Lead Time</span>
            <div className="text-2xl font-black text-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-muted-foreground" /> {executiveKPIs.avgLeadTime}
            </div>
            <p className="text-[11px] text-muted-foreground">Order to delivery</p>
          </Card>
          <Card className="ios-glass p-4 space-y-1 rounded-2xl border border-border/40 shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">On-Time Delivery</span>
            <div className="text-2xl font-black text-emerald-400 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-muted-foreground" /> {executiveKPIs.avgOnTimeRate}
            </div>
            <p className="text-[11px] text-muted-foreground">Fulfilled on schedule</p>
          </Card>
          <Card className="ios-glass p-4 space-y-1 rounded-2xl border border-border/40 shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">High Risk Vendors</span>
            <div className={`text-2xl font-black ${executiveKPIs.highRiskCount > 0 ? 'text-rose-400' : 'text-foreground'}`}>
              {executiveKPIs.highRiskCount}
            </div>
            <p className="text-[11px] text-muted-foreground">Require attention</p>
          </Card>
          <Card className="ios-glass p-4 space-y-1 rounded-2xl border border-border/40 shadow-sm">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Potential Savings</span>
            <div className="text-2xl font-black text-primary flex items-center gap-1.5 font-mono">
              <Coins className="w-4 h-4 text-muted-foreground" /> {currencySymbol}{Math.round(executiveKPIs.totalPotentialSaving).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-muted-foreground">Across catalog products</p>
          </Card>
        </div>

        {/* Procurement Risk Alerts Banner */}
        {procurementRisks.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-extrabold text-rose-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" /> Active Procurement Risks ({procurementRisks.length})
              </span>
              <div className="flex items-center gap-2">
                {procurementRisks.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllRisks(!showAllRisks)}
                    className="h-6 text-[11px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/20 px-2 rounded-lg font-medium"
                  >
                    {showAllRisks ? 'Show Top 4' : `View All (${procurementRisks.length})`}
                  </Button>
                )}
                <span className="text-[10px] text-rose-300/80 font-mono uppercase tracking-wider bg-rose-500/15 px-2 py-0.5 rounded-md border border-rose-500/25">
                  Action Recommended
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {(showAllRisks ? procurementRisks : procurementRisks.slice(0, 4)).map(risk => {
                const { primaryTag, metricTag, actionLabel } = getMinimalRiskSignals(risk);
                return (
                  <div
                    key={risk.id}
                    className="p-3 rounded-xl bg-background/90 border border-rose-500/25 hover:border-rose-500/40 transition-all flex flex-col justify-between gap-2 shadow-xs group"
                  >
                    {/* Header: Product Name + Supplier & Risk Level */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-foreground truncate" title={risk.productName}>
                          {risk.productName}
                        </h4>
                        <p className="text-[11px] text-muted-foreground truncate" title={risk.supplierName}>
                          Vendor: <span className="font-semibold text-foreground/80">{risk.supplierName}</span>
                        </p>
                      </div>
                      <Badge
                        variant="destructive"
                        className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 tracking-wider shrink-0 bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      >
                        {risk.riskLevel} RISK
                      </Badge>
                    </div>

                    {/* Metric Chips: Minimal, instant visual indicators instead of long text */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-300">
                        <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                        {primaryTag}
                      </span>
                      {metricTag && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50 text-[10px] font-medium text-foreground/80">
                          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                          {metricTag}
                        </span>
                      )}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[10px] font-semibold border border-amber-500/20">
                        Top Seller
                      </span>
                    </div>

                    {/* Footer: One-line compact action & inspect */}
                    <div className="pt-1.5 flex items-center justify-between border-t border-border/40 gap-2">
                      <div
                        className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0 truncate cursor-help"
                        title={risk.reason}
                      >
                        <span className="text-amber-400 shrink-0">💡</span>
                        <span className="text-foreground/90 font-medium truncate">{actionLabel}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2.5 font-bold rounded-xl border-border/60 hover:bg-secondary shrink-0"
                        onClick={() => {
                          const sup = suppliers.find(s => s.name === risk.supplierName);
                          if (sup) setActiveProfileSupplier(sup);
                        }}
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-secondary/30 p-2 rounded-2xl border border-border/40">
            <TabsList className="bg-secondary/60">
              <TabsTrigger value="suppliers" className="text-xs font-bold gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> All Vendors ({suppliers.length})
              </TabsTrigger>
              <TabsTrigger value="savings" className="text-xs font-bold gap-1.5">
                <Coins className="w-3.5 h-3.5 text-primary" /> Cost Savings ({procurementSavings.savingsList.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search vendor name, email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 text-xs h-8 bg-background/80"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <select
                value={riskFilter}
                onChange={e => setRiskFilter(e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-background/80 px-2 font-medium shrink-0"
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
                <option value="insufficient">Insufficient History</option>
              </select>
            </div>
          </div>

          {/* Vendors Tab Content */}
          <TabsContent value="suppliers" className="space-y-4">
            {filteredSuppliers.length === 0 ? (
              <Card className="p-8 text-center space-y-3">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-sm">No suppliers match criteria</h3>
                  <p className="text-xs text-muted-foreground">Try clearing search query or adjusting risk filter.</p>
                </div>
                {(searchQuery || riskFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold rounded-xl"
                    onClick={() => {
                      setSearchQuery('');
                      setRiskFilter('all');
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredSuppliers.map((supplier) => {
                  const metrics = supplierMetricsMap.get(supplier.id);
                  const score = metrics?.score;
                  const hasScore = score !== null && score !== undefined;

                  return (
                    <Card
                      key={supplier.id || supplier.name}
                      className="hover:border-primary/50 transition-all cursor-pointer group space-y-3 p-5 rounded-2xl bg-card/70 border border-border/60 shadow-md"
                      onClick={() => setActiveProfileSupplier(supplier)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <h3 className="font-extrabold text-foreground group-hover:text-primary transition-colors text-base flex items-center gap-1.5">
                            {supplier.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">{supplier.email || 'No email registered'}</p>
                        </div>

                        {/* Supplier Performance Score Badge */}
                        <div className="text-right">
                          {hasScore ? (
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-black text-primary leading-none">
                                {score}<span className="text-xs font-normal text-muted-foreground">/100</span>
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] mt-1 font-bold ${
                                  metrics?.status === 'EXCELLENT' || metrics?.status === 'GOOD'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : metrics?.status === 'AVERAGE'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {metrics?.status}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Insufficient History
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Supporting Metrics Summary */}
                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/40 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">On-Time</span>
                          <span className="font-bold text-foreground">
                            {metrics?.onTimeDeliveryRate !== null ? `${metrics?.onTimeDeliveryRate}%` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Lead Time</span>
                          <span className="font-bold text-foreground">
                            {metrics?.avgLeadTimeDays ? `${metrics.avgLeadTimeDays} days` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Cost Trend</span>
                          <span className={`font-bold ${(metrics?.costTrendPercent || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {(metrics?.costTrendPercent || 0) > 0 ? `+${metrics?.costTrendPercent}%` : 'Stable'}
                          </span>
                        </div>
                      </div>

                      {/* Footer Info & Actions */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-muted-foreground">
                          Supplies <span className="font-bold text-foreground">{metrics?.suppliedProductsCount || 0}</span> product(s)
                        </span>

                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1"
                            onClick={() => {
                              setSelectedSupplierForPo(supplier.id);
                              setPoModalOpen(true);
                            }}
                          >
                            <ShoppingBag className="w-3 h-3 text-primary" /> PO
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setActiveProfileSupplier(supplier)}>
                                View Intelligence Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSupplierForPo(supplier.id);
                                  setPoModalOpen(true);
                                }}
                              >
                                Issue Purchase Order
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                    Delete Supplier
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="w-[95vw] sm:max-w-md rounded-xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete "{supplier.name}" and remove supplier associations from catalog products.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteSupplier(supplier.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Savings Tab Content */}
          <TabsContent value="savings" className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/40 to-transparent border border-primary/20 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary" /> Potential Annual Procurement Savings: {currencySymbol}{Math.round(procurementSavings.totalPotentialSaving).toLocaleString('en-IN')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calculated by analyzing price benchmarks across alternative suppliers supplying identical or similar product categories.
                </p>
              </div>
            </div>

            {filteredSavingsList.length === 0 ? (
              <Card className="p-8 text-center space-y-3">
                <Coins className="w-10 h-10 text-muted-foreground mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-bold text-foreground text-sm">No alternative supplier cost benchmark found</h4>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? 'No savings opportunities match your search query.' : 'Add more suppliers or product catalog items to unlock potential procurement savings.'}
                  </p>
                </div>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold rounded-xl"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredSavingsList.map((item, idx) => (
                  <Card key={idx} className="p-4 space-y-3 border border-border/40 hover:border-primary/40 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-extrabold text-foreground text-sm">{item.productName}</h4>
                        <span className="text-[11px] font-mono text-muted-foreground">SKU: {item.sku}</span>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold text-xs">
                        +{currencySymbol}{Math.round(item.potentialGrossSaving).toLocaleString('en-IN')}/yr
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-secondary/50 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-semibold">Current Supplier</span>
                        <span className="font-bold text-foreground">{item.currentSupplierName}</span>
                        <span className="text-muted-foreground block">₹{item.currentCost}/unit</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-primary block font-semibold">Alternative Vendor</span>
                        <span className="font-bold text-foreground">{item.alternativeSupplierName}</span>
                        <span className="text-emerald-400 block font-bold">₹{item.alternativeCost}/unit (-₹{item.unitSaving})</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      💡 <span className="text-foreground">{item.recommendation}</span>
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Deep-Dive Supplier Intelligence Profile Drawer / Modal */}
      {activeProfileSupplier && (
        <Dialog open={!!activeProfileSupplier} onOpenChange={open => !open && setActiveProfileSupplier(null)}>
          <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 ios-glass">
            <DialogHeader className="pb-3 border-b border-border/40 flex flex-row items-start justify-between pr-10">
              <div>
                <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                  {activeProfileSupplier.name}
                </DialogTitle>
                <DialogDescription className="text-xs font-mono mt-0.5">
                  {activeProfileSupplier.email || 'No email'} • {activeProfileSupplier.phone || 'No phone'} • {activeProfileSupplier.address || 'Address unlisted'}
                </DialogDescription>
              </div>

              <div className="text-right">
                {activeSupplierMetrics?.score !== null && activeSupplierMetrics?.score !== undefined ? (
                  <div>
                    <span className="text-2xl font-black text-primary leading-none">
                      {activeSupplierMetrics.score}<span className="text-xs font-normal text-muted-foreground">/100</span>
                    </span>
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                      Score: {activeSupplierMetrics.status}
                    </div>
                  </div>
                ) : (
                  <Badge variant="secondary" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                    Insufficient History
                  </Badge>
                )}
              </div>
            </DialogHeader>

            {/* AI Grounded Insight & Risk Level */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-secondary/40 to-transparent border border-primary/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" /> AI Supplier Intelligence Insight
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    activeSupplierMetrics?.riskLevel === 'HIGH'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : activeSupplierMetrics?.riskLevel === 'MEDIUM'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {activeSupplierMetrics?.riskLevel} RISK
                </Badge>
              </div>
              <p className="text-xs text-foreground leading-relaxed">{activeSupplierMetrics?.aiInsight}</p>
            </div>

            {/* Data Confidence Banner / Empty State Explanation */}
            {activeSupplierMetrics?.dataConfidence === 'INSUFFICIENT' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs text-amber-200">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                  <HelpCircle className="w-4 h-4" /> Insufficient Supplier History
                </span>
                <p className="text-muted-foreground">{activeSupplierMetrics.insufficientReason}</p>
              </div>
            )}

            {/* Supporting Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">On-Time Delivery</span>
                <div className="text-lg font-black text-foreground">
                  {activeSupplierMetrics?.onTimeDeliveryRate !== null ? `${activeSupplierMetrics?.onTimeDeliveryRate}%` : 'N/A'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Avg Lead Time</span>
                <div className="text-lg font-black text-foreground">
                  {activeSupplierMetrics?.avgLeadTimeDays ? `${activeSupplierMetrics.avgLeadTimeDays} days` : 'N/A'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">PO Fulfillment Rate</span>
                <div className="text-lg font-black text-foreground">
                  {activeSupplierMetrics?.fulfillmentRate !== null ? `${activeSupplierMetrics?.fulfillmentRate}%` : 'N/A'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary/50 border border-border/40 space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Total Purchase Value</span>
                <div className="text-lg font-black text-primary">
                  {currencySymbol}{Math.round(activeSupplierMetrics?.totalPurchaseValue || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Supplied Products List */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-xs text-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Products Supplied ({activeSupplierMetrics?.suppliedProducts.length || 0})</span>
                <span className="text-[11px] text-muted-foreground font-normal">Cost & Margin Impact</span>
              </h4>

              {activeSupplierMetrics?.suppliedProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 italic">No products assigned to this supplier yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeSupplierMetrics?.suppliedProducts.map(prod => {
                    const costItem = calculateSupplierCostIntelligence(prod, activeProfileSupplier, orders, transactions);
                    return (
                      <div key={prod.id} className="p-3 rounded-xl bg-secondary/40 border border-border/40 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-foreground block">{prod.name}</span>
                          <span className="text-[11px] font-mono text-muted-foreground">SKU: {prod.sku || 'N/A'} • Stock: {prod.stock}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground block">Cost: {currencySymbol}{costItem.currentCost}</span>
                          <span className="text-[11px] text-emerald-400 font-semibold block">Margin: {costItem.newMarginPercent}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Purchase Orders History */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-xs text-foreground uppercase tracking-wider">
                Recent Purchase Orders ({activeSupplierMetrics?.totalOrdersCount || 0})
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {orders
                  .filter(o => o.supplierId === activeProfileSupplier.id || o.supplierId === activeProfileSupplier.name)
                  .slice(0, 5)
                  .map(po => (
                    <div key={po.id} className="p-2.5 rounded-lg bg-secondary/30 border border-border/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-foreground">PO #{po.id}</span>
                        <span className="text-[11px] text-muted-foreground block">Qty: {po.quantity} units</span>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold ${
                            po.status === 'Fulfilled'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : po.status === 'Cancelled'
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {po.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          {po.orderDate ? new Date(po.orderDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setActiveProfileSupplier(null)}>
                Close
              </Button>
              <Button
                className="gap-1.5 font-bold"
                onClick={() => {
                  const sId = activeProfileSupplier.id;
                  setActiveProfileSupplier(null);
                  setSelectedSupplierForPo(sId);
                  setPoModalOpen(true);
                }}
              >
                <ShoppingBag className="w-4 h-4" /> Issue Purchase Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Supplier Comparison Modal */}
      {compareModalOpen && (
        <Dialog open={compareModalOpen} onOpenChange={setCompareModalOpen}>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 ios-glass">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" /> Product Supplier Comparison & Strategic Tradeoff
              </DialogTitle>
              <DialogDescription className="text-xs">
                Compare candidate vendors on lead time, unit cost, and delivery reliability to make optimal reorder decisions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Select Product to Compare</label>
              <select
                value={compareProductId}
                onChange={e => setCompareProductId(e.target.value)}
                className="w-full h-9 text-xs rounded-md border border-input bg-background px-3 font-medium"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current Cost: {currencySymbol}{p.costPrice || Math.round((p.price || 500) * 0.6)})
                  </option>
                ))}
              </select>
            </div>

            {comparisonResult && (
              <div className="space-y-4 pt-2">
                {/* AI Strategic Tradeoff Analysis Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-secondary/40 to-transparent border border-primary/25 space-y-1.5 text-xs">
                  <span className="font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" /> Strategic Tradeoff Analysis
                  </span>
                  <p className="text-foreground leading-relaxed">{comparisonResult.tradeoffAnalysis}</p>
                </div>

                {/* Side-by-side Suppliers Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {comparisonResult.suppliers.map(cand => (
                    <div
                      key={cand.supplierId}
                      className={`p-4 rounded-2xl border ${
                        cand.isPreferred
                          ? 'border-primary/50 bg-primary/5 shadow-md'
                          : 'border-border/40 bg-secondary/30'
                      } space-y-3`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-extrabold text-foreground text-sm block">{cand.supplierName}</span>
                          {cand.isPreferred && (
                            <Badge className="bg-primary text-primary-foreground text-[9px] font-bold mt-1">
                              RECOMMENDED VENDOR
                            </Badge>
                          )}
                        </div>
                        <span className="text-lg font-black text-primary">
                          {currencySymbol}{cand.unitPrice.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between border-b border-border/30 pb-1">
                          <span className="text-muted-foreground">On-Time Delivery:</span>
                          <span className="font-bold text-foreground">
                            {cand.onTimeDeliveryRate !== null ? `${cand.onTimeDeliveryRate}%` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border/30 pb-1">
                          <span className="text-muted-foreground">Lead Time:</span>
                          <span className="font-bold text-foreground">
                            {cand.leadTimeDays ? `${cand.leadTimeDays} days` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border/30 pb-1">
                          <span className="text-muted-foreground">Performance Score:</span>
                          <span className="font-bold text-foreground">
                            {cand.performanceScore !== null ? `${cand.performanceScore}/100` : 'Insufficient History'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setCompareModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Supplier Modal */}
      <AddSupplierModal open={addModalOpen} onOpenChange={setAddModalOpen} />

      {/* Create Purchase Order Modal */}
      <CreatePurchaseOrderModal
        open={poModalOpen}
        onOpenChange={setPoModalOpen}
        defaultSupplierId={selectedSupplierForPo}
        defaultProductId={selectedProductForPo}
      />
    </>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading Supplier Intelligence...</div>}>
      <SuppliersPageContent />
    </Suspense>
  );
}
