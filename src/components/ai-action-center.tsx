'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateActionTasks, ActionTask } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { logBusinessAction } from '@/lib/audit-store';
import { AuditLogModal } from '@/components/audit-log-modal';
import { ThreeTierBadge } from '@/components/three-tier-badge';
import { ImportDialog } from '@/components/import-dialog';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  History,
  Check,
  AlertTriangle,
  Flame,
  CheckCircle2,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  Target,
  ExternalLink,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

function getActionDestination(task: ActionTask): { route: string; label: string } {
  if (task.actionType === 'reorder') {
    return { route: '/dashboard/orders', label: 'Orders & Inbound POs' };
  }
  if (task.actionType === 'supplier') {
    return { route: '/dashboard/suppliers', label: 'Suppliers' };
  }
  return { route: '/dashboard/inventory', label: 'Inventory' };
}

export function AIActionCenter() {
  const {
    products,
    transactions,
    suppliers,
    orders,
    returns,
    businessProfile,
    businessBuddyCalibration,
    activateRecommendationsNow,
    updateProduct,
    addOrder,
    capabilities,
    dataReadiness,
  } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const hasNoData = (products?.length || 0) === 0 && (transactions?.length || 0) === 0;
  const isLearning = dataReadiness?.level === 'LEARNING' || businessBuddyCalibration?.status === 'LEARNING';

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'top' | 'other' | 'done'>('all');
  const [isOtherCollapsed, setIsOtherCollapsed] = useState(false);

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('analyzeup_completed_tasks') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  });

  const [confirmData, setConfirmData] = useState<{
    task: ActionTask;
    title: string;
    description: string;
    targetRoute: string;
    targetPageName: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const generated = generateActionTasks(products, transactions, suppliers, orders, businessProfile, returns);
    setTasks(generated);
  }, [products, transactions, suppliers, orders, businessProfile, returns]);

  const markTaskCompleted = (taskId: string, title?: string, customRecommendation?: string) => {
    setCompletedTaskIds((prev) => {
      if (prev.includes(taskId)) return prev;
      const next = [...prev, taskId];
      if (typeof window !== 'undefined') {
        localStorage.setItem('analyzeup_completed_tasks', JSON.stringify(next));
      }
      return next;
    });

    if (title) {
      logBusinessAction({
        title: 'Marked Task Done for Today',
        productName: title,
        actionType: 'audit',
        changeDetails: customRecommendation || 'Marked as reviewed and completed for today.',
        impactValue: 'Done Today',
      });
      toast({
        title: '✅ Marked as Done for Today',
        description: `"${title}" has been moved to today's completed tasks.`,
      });
    }
  };

  const undoCompletedTask = (taskId: string, title: string) => {
    setCompletedTaskIds((prev) => {
      const next = prev.filter((id) => id !== taskId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('analyzeup_completed_tasks', JSON.stringify(next));
      }
      return next;
    });
    toast({
      title: 'Task Reopened',
      description: `"${title}" moved back to active business actions.`,
    });
  };

  const resetCompletedTasks = () => {
    setCompletedTaskIds([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('analyzeup_completed_tasks');
    }
    setActiveTab('all');
    toast({
      title: '🔄 Action Queue Refreshed',
      description: 'Loaded fresh daily growth, margin, and velocity tasks for your store.',
    });
  };

  const handleExecuteAction = (task: ActionTask) => {
    const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';
    const destination = getActionDestination(task);
    const targetProd = products.find(
      (p) =>
        (task.targetId && p.id === task.targetId) ||
        (p.name && task.targetName && p.name.toLowerCase() === task.targetName.toLowerCase()) ||
        (p.sku && task.title.includes(p.sku))
    );
    const pName = targetProd?.name || task.targetName || 'Product';

    setConfirmData({
      task,
      title: task.title,
      targetRoute: destination.route,
      targetPageName: destination.label,
      description: `Confirm execution of: "${task.recommendation}". This will update records in your database and reflect in ${destination.label}.`,
      onConfirm: async () => {
        // Immediately complete task in React state so card dismisses instantaneously
        markTaskCompleted(task.id);

        try {
          if (task.actionType === 'reorder') {
            const leadTime = targetProd?.leadTimeDays || 7;
            const velocity = targetProd?.averageDailySales || 1.2;
            const targetOptimalStock = Math.ceil(velocity * (leadTime + 21)); // 28 days of runway
            const currentStock = targetProd?.stock || 0;
            const reorderQty = Math.max(15, targetOptimalStock > currentStock ? targetOptimalStock - currentStock : Math.ceil(velocity * 21));
            const costPrice = targetProd?.costPrice || (targetProd?.price || 500) * 0.6;
            const totalCost = Math.round(costPrice * reorderQty);

            await addOrder({
              supplierId: targetProd?.supplierId || suppliers[0]?.id || 'sup-1',
              productId: targetProd?.id || 'prod-1',
              quantity: reorderQty,
              unitCost: costPrice,
              totalCost: totalCost,
              orderDate: new Date().toISOString(),
              expectedDeliveryDate: new Date(Date.now() + (leadTime || 7) * 86400000).toISOString(),
              status: 'Pending',
            });

            logBusinessAction({
              title: 'Purchase Order Created (In Transit)',
              productName: pName,
              actionType: 'reorder',
              changeDetails: `Issued PO for ${reorderQty} units at ${currencySymbol}${costPrice}/unit (${currencySymbol}${totalCost.toLocaleString('en-IN')}). Expected delivery in ${leadTime || 7} days.`,
              impactValue: `${reorderQty} Units In Transit`,
            });

            toast({
              title: '📦 Purchase Order Created (In Transit)',
              description: `Ordered ${reorderQty} units of "${pName}". Stock will update when marked Received in Orders Tracking.`,
            });
          } else if (task.actionType === 'discount') {
            if (targetProd) {
              const oldPrice = targetProd.price || 500;
              const newPrice = Math.round(oldPrice * 0.8);
              await updateProduct({
                ...targetProd,
                price: newPrice,
                updatedAt: new Date().toISOString(),
              });

              logBusinessAction({
                title: 'Liquidated Dead Stock (20% Clearance)',
                productName: pName,
                actionType: 'discount',
                changeDetails: `Reduced price from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (-20%). Unlocked working capital.`,
                impactValue: `-20% Clearance`,
              });

              toast({
                title: '🏷️ Clearance Promo Applied & Saved to Audit!',
                description: `Reduced price of "${pName}" to ${currencySymbol}${newPrice}. Changes reflect in ${destination.label}.`,
              });
            }
          } else if (task.actionType === 'price_up') {
            if (targetProd) {
              const oldPrice = targetProd.price || 500;
              const newPrice = Math.round(oldPrice * 1.08);
              await updateProduct({
                ...targetProd,
                price: newPrice,
                updatedAt: new Date().toISOString(),
              });

              logBusinessAction({
                title: 'Optimized Price (+8%)',
                productName: pName,
                actionType: 'price_up',
                changeDetails: `Adjusted price from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (+8%) for margin expansion.`,
                impactValue: `+8% Price Boost`,
              });

              toast({
                title: '📈 Price Optimized & Saved to Audit!',
                description: `Adjusted price of "${pName}" to ${currencySymbol}${newPrice}. Changes reflect in ${destination.label}.`,
              });
            }
          } else if (task.actionType === 'supplier') {
            logBusinessAction({
              title: 'Dispatched Supplier Expedite Notice',
              productName: task.targetName || 'Supplier',
              actionType: 'supplier',
              changeDetails: `Dispatched high-priority delivery expedite to supplier ${task.targetName}.`,
              impactValue: `Expedited`,
            });

            toast({
              title: '🚚 Supplier Expedite Dispatched',
              description: `High-priority delivery notice dispatched to ${task.targetName || 'supplier'}. Changes reflect in ${destination.label}.`,
            });
          }
        } catch (err) {
          console.error('Error executing action:', err);
          toast({
            title: 'Execution Error',
            description: 'Failed to apply recommendation changes.',
            variant: 'destructive',
          });
        }
      },
    });
  };

  // Filter tasks into Active vs Completed
  const activeTasks = useMemo(() => {
    return tasks.filter((t) => !completedTaskIds.includes(t.id));
  }, [tasks, completedTaskIds]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => completedTaskIds.includes(t.id));
  }, [tasks, completedTaskIds]);

  // Separate Top Priorities (#1, #2, #3) vs Other Actions
  const topPriorityTasks = useMemo(() => {
    return activeTasks.filter((t) => t.priority === 'High').slice(0, 3);
  }, [activeTasks]);

  const topPriorityIds = useMemo(() => new Set(topPriorityTasks.map((t) => t.id)), [topPriorityTasks]);

  const otherTasks = useMemo(() => {
    return activeTasks.filter((t) => !topPriorityIds.has(t.id));
  }, [activeTasks, topPriorityIds]);

  // Render a Single Task Card
  const renderTaskCard = (task: ActionTask, isTopPriority: boolean = false, rankIndex?: number) => {
    const destination = getActionDestination(task);

    return (
      <div
        key={task.id}
        className={`p-4 sm:p-5 rounded-2xl transition-all space-y-3.5 relative overflow-hidden ${
          isTopPriority
            ? 'bg-secondary/40 border-2 border-amber-500/40 shadow-md'
            : 'bg-secondary/20 border border-border/40 hover:bg-secondary/30'
        }`}
      >
        {isTopPriority && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/40 via-amber-500 to-amber-500/40" />
        )}

        {/* Top Header line of the task */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {isTopPriority && rankIndex !== undefined && (
              <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
                #{rankIndex + 1}
              </span>
            )}

            {isTopPriority && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-bold gap-1">
                <Flame className="w-3 h-3 text-amber-400" /> Must-Do Today
              </Badge>
            )}

            <Badge
              className={
                task.priority === 'High'
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-semibold text-[10px]'
                  : task.priority === 'Medium'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-semibold text-[10px]'
                  : 'bg-muted text-muted-foreground border-border font-semibold text-[10px]'
              }
            >
              {task.priority} Priority
            </Badge>

            <span className="text-xs font-bold text-foreground">{task.title}</span>
          </div>
        </div>

        {/* 5-Part Structured Explanation Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-background/80 border border-border/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">1. Observed Fact</span>
              <ThreeTierBadge tier="ACTUAL_DATA" size="sm" />
            </div>
            <p className="text-[11px] text-foreground leading-relaxed">{task.problem}</p>
          </div>

          <div className="p-3 rounded-xl bg-background/80 border border-border/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">2. Root Cause / Impact</span>
              <span className="text-[10px] text-muted-foreground font-semibold">Operational</span>
            </div>
            <p className="text-[11px] text-foreground leading-relaxed">{task.reason}</p>
          </div>

          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">3. Forecast Projection</span>
              <ThreeTierBadge tier="MODEL_2_PREDICTION" size="sm" />
            </div>
            <p className="text-[11px] text-purple-200/90 leading-relaxed">{task.impact}</p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">4. Estimated Benefit</span>
              <span className="text-[10px] text-emerald-400 font-semibold">Value Added</span>
            </div>
            <p className="text-[11px] text-emerald-300 font-bold leading-relaxed">{task.estimatedBenefit}</p>
          </div>
        </div>

        {/* Action Controls & Direct Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-border/40 gap-3">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground">5. Recommended Action:</span>
            <span className="text-foreground/90 font-medium">{task.recommendation}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(destination.route)}
              className="rounded-xl text-xs h-8 border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium px-2.5 gap-1"
              title={`View product/records in ${destination.label}`}
            >
              <span>Go to {destination.label}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => markTaskCompleted(task.id, task.title, task.recommendation)}
              className="rounded-xl text-xs h-8 border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium px-3 gap-1"
              title="Mark this task as done for today"
            >
              <Check className="w-3.5 h-3.5" />
              Mark Done
            </Button>

            <Button
              size="sm"
              onClick={() => handleExecuteAction(task)}
              className="rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20 gap-1.5 px-4"
            >
              Execute Action
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <>
      <Card className="ios-glass rounded-3xl border-emerald-500/20 p-5 shadow-xl space-y-5">
        {/* Header */}
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                AI Action Center
                {isLearning ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 font-bold">
                    In Learning Stage
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-bold">
                    {activeTasks.length} Pending
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Proactive business task assignments & daily execution engine
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={resetCompletedTasks}
              className="rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground font-semibold border border-border/40"
              title="Refresh daily predictive actions queue"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh Actions
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAuditModalOpen(true)}
              className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            >
              <History className="w-3.5 h-3.5" />
              Audit Log
            </Button>

            {!isLearning && completedTasks.length > 0 && (
              <Badge
                variant="outline"
                onClick={() => setActiveTab(activeTab === 'done' ? 'all' : 'done')}
                className="text-emerald-400 border-emerald-500/30 text-xs gap-1 font-semibold cursor-pointer hover:bg-emerald-500/10 transition-colors py-1 px-2.5"
              >
                <Check className="w-3.5 h-3.5" /> {completedTasks.length} Done Today
              </Badge>
            )}
          </div>
        </CardHeader>

        {/* Filter / View Tabs: Only visible once past learning stage */}
        {!isLearning && (
          <div className="flex items-center gap-1.5 p-1 bg-secondary/30 rounded-2xl border border-border/40 w-fit text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              All Pending ({activeTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('top')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                activeTab === 'top'
                  ? 'bg-amber-500 text-black font-bold shadow-xs'
                  : 'text-amber-400/90 hover:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <Flame className="w-3 h-3" />
              Today's Top Focus ({topPriorityTasks.length})
            </button>
            {otherTasks.length > 0 && (
              <button
                onClick={() => setActiveTab('other')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  activeTab === 'other'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                Other Actions ({otherTasks.length})
              </button>
            )}
            {completedTasks.length > 0 && (
              <button
                onClick={() => setActiveTab('done')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                  activeTab === 'done'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                }`}
              >
                <Check className="w-3 h-3" />
                Done Today ({completedTasks.length})
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        <CardContent className="p-0 space-y-6">
          {hasNoData ? (
            <div className="p-8 text-center rounded-2xl bg-zinc-900/50 border border-border/40 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="text-base font-bold text-foreground">Action Center Awaiting Business Data</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No products or transaction records are currently imported. Connect your store or upload a CSV / Excel catalog to activate the Action Center, generate automated restock recommendations, and unlock AI intelligence.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto pt-2 text-left">
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Sales History</span>
                  <p className="text-sm font-bold text-foreground font-mono">
                    0 / 14 Days
                  </p>
                  <p className="text-[10px] text-muted-foreground">Awaiting data</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Customer Orders</span>
                  <p className="text-sm font-bold text-foreground font-mono">
                    0 / 40 Orders
                  </p>
                  <p className="text-[10px] text-muted-foreground">Awaiting data</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Readiness Score</span>
                  <p className="text-sm font-bold text-muted-foreground font-mono">
                    0 / 100
                  </p>
                  <p className="text-[10px] text-muted-foreground">No records loaded</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                <Button
                  onClick={() => setIsImportModalOpen(true)}
                  className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-bold shadow-sm shadow-emerald-600/20"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Import Business Data
                </Button>
                <Button
                  onClick={() => router.push('/dashboard/integrations')}
                  variant="outline"
                  className="rounded-xl text-xs gap-1.5 border-border/60 hover:bg-secondary/40"
                >
                  Connect Shopify Store <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : isLearning ? (
            <div className="p-8 text-center rounded-2xl bg-zinc-900/50 border border-amber-500/25 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 animate-pulse text-amber-400" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="text-base font-bold text-foreground">Action Center is in Learning Stage</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AnalyzeUp is observing your catalog&apos;s sales rhythm. Proactive restocking assignments, purchase order recommendations, and supplier optimizations will automatically unlock once baseline transactions accumulate (Early Insights tier).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto pt-2 text-left">
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Sales History</span>
                  <p className="text-sm font-bold text-foreground font-mono">
                    {dataReadiness?.historicalDays ?? 0} / 14 Days
                  </p>
                  <p className="text-[10px] text-amber-400">Baseline calibrating</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Customer Orders</span>
                  <p className="text-sm font-bold text-foreground font-mono">
                    {dataReadiness?.totalOrders ?? 0} / 40 Orders
                  </p>
                  <p className="text-[10px] text-amber-400">Building volume</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Readiness Score</span>
                  <p className="text-sm font-bold text-emerald-400 font-mono">
                    {dataReadiness?.score ?? 0} / 100
                  </p>
                  <p className="text-[10px] text-muted-foreground">Level 1 • Learning</p>
                </div>
              </div>
            </div>
          ) : activeTasks.length === 0 && activeTab !== 'done' ? (
            <div className="p-8 text-center rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
              <h4 className="text-base font-bold text-foreground">All Today&apos;s Priority Actions Completed!</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Outstanding execution! All high-priority operational bottlenecks, restocking alerts, and price recommendations have been addressed for today.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                <Button
                  onClick={resetCompletedTasks}
                  size="sm"
                  className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-bold shadow-sm shadow-emerald-600/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Generate Next Growth Actions
                </Button>
                <Button
                  onClick={() => setIsAuditModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <History className="w-3.5 h-3.5" /> View Executed Change Audit Log
                </Button>
                {completedTasks.length > 0 && (
                  <Button
                    onClick={() => setActiveTab('done')}
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Review Completed ({completedTasks.length})
                  </Button>
                )}
              </div>
            </div>
          ) : activeTab === 'done' ? (
            /* Completed Today List */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Completed & Executed Today ({completedTasks.length})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetCompletedTasks}
                  className="rounded-xl text-xs h-7 text-muted-foreground hover:text-foreground gap-1 px-2.5"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Completed Queue
                </Button>
              </div>

              {completedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No tasks completed yet today.</p>
              ) : (
                completedTasks.map((task) => {
                  const dest = getActionDestination(task);
                  return (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground line-through opacity-80">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground">{task.recommendation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(dest.route)}
                          className="rounded-xl text-xs h-7 border border-border/50 text-muted-foreground hover:text-foreground gap-1 px-2.5"
                          title={`View in ${dest.label}`}
                        >
                          <span>Go to {dest.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Button>

                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                          Done Today
                        </Badge>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => undoCompletedTask(task.id, task.title)}
                          className="rounded-xl text-xs h-7 text-muted-foreground hover:text-foreground gap-1 px-2"
                          title="Reopen task and move back to pending"
                        >
                          <RotateCcw className="w-3 h-3" /> Reopen
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Pending Tasks View */
            <div className="space-y-6">
              {/* SECTION 1: TODAY'S MOST IMPORTANT / TOP FOCUS PRIORITIES */}
              {(activeTab === 'all' || activeTab === 'top') && topPriorityTasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <Target className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          Today&apos;s Top Business Priorities
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-bold">
                            High-Impact Focus
                          </Badge>
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Most urgent tasks demanding immediate founder decision today
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {topPriorityTasks.map((task, idx) => renderTaskCard(task, true, idx))}
                  </div>
                </div>
              )}

              {/* SECTION 2: OTHER ACTIONS & CONTINUOUS OPTIMIZATIONS */}
              {(activeTab === 'all' || activeTab === 'other') && otherTasks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Other Actionable Optimizations ({otherTasks.length})
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Medium & low priority catalog, pricing, and supplier audit recommendations
                        </p>
                      </div>
                    </div>

                    {activeTab === 'all' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsOtherCollapsed(!isOtherCollapsed)}
                        className="rounded-xl text-xs h-7 text-muted-foreground hover:text-foreground gap-1 px-2"
                      >
                        {isOtherCollapsed ? (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" /> Show ({otherTasks.length})
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" /> Collapse
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {!isOtherCollapsed && (
                    <div className="space-y-3">
                      {otherTasks.map((task) => renderTaskCard(task, false))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Modal */}
      <AuditLogModal open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen} />

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmData !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmData(null);
        }}
      >
        <DialogContent className="max-w-md bg-zinc-950/95 border border-amber-500/20 rounded-3xl ios-glass text-white shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 animate-bounce text-amber-400" />
              </div>
              <DialogTitle className="text-base font-bold text-white">Confirm Business Change</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-400">
              Are you sure you want to execute this change? This will write modifications directly to your database.
            </DialogDescription>
          </DialogHeader>

          {confirmData && (
            <div className="py-2 text-xs space-y-3">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                <div className="text-zinc-200 font-bold">{confirmData.title}</div>
                <div className="text-zinc-300 leading-relaxed">{confirmData.description}</div>
                <div className="pt-2 text-[11px] text-zinc-400 flex items-center gap-1.5 border-t border-zinc-800/60">
                  <span>Destination:</span>
                  <span className="font-semibold text-emerald-400">{confirmData.targetPageName} ({confirmData.targetRoute})</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800/40">
            <Button
              variant="ghost"
              onClick={() => setConfirmData(null)}
              className="rounded-xl text-xs hover:bg-zinc-900 text-zinc-400 hover:text-white px-3"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmData) {
                  confirmData.onConfirm();
                  setConfirmData(null);
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-xs px-4"
            >
              Confirm & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
    </>
  );
}
