'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateActionTasks, ActionTask } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import { useUser } from '@/firebase';
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
  X,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
} from '@/components/ui/alert-dialog';

function renderImpactText(benefit: string) {
  if (!benefit) return null;
  const currencyRegex = /([₹$]\s*[\d,]+(?:\.\d+)?(?:\s*(?:Lakh|Cr|k|M))?)/gi;
  const parts = benefit.split(currencyRegex);

  if (parts.length <= 1) {
    return <span className="text-sm sm:text-base font-bold text-foreground">{benefit}</span>;
  }

  return (
    <div className="flex items-baseline gap-1.5 flex-wrap">
      {parts.map((part, i) => {
        if (!part) return null;
        if (currencyRegex.test(part)) {
          return (
            <span
              key={i}
              className="text-base sm:text-lg font-extrabold text-foreground font-mono tracking-tight"
            >
              {part}
            </span>
          );
        }
        return (
          <span key={i} className="text-xs sm:text-sm text-muted-foreground font-medium">
            {part}
          </span>
        );
      })}
    </div>
  );
}

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
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const hasNoData = (products?.length || 0) === 0 && (transactions?.length || 0) === 0;
  const currentOrders = dataReadiness?.totalOrders ?? (transactions.filter(t => t.type === 'Sale' || !t.type).length);
  const currentDays = dataReadiness?.historicalDays ?? 0;
  const currentScore = dataReadiness?.score ?? 0;

  // Fully dynamic criteria graduation: Early Insights unlocks at 50 orders OR 14 days with score >= 40, or Level !== LEARNING, or 100+ orders
  const criteriaGraduated = Boolean(
    businessBuddyCalibration?.isOverridden ||
    (currentScore >= 40 && (currentOrders >= 50 || currentDays >= 14)) ||
    (dataReadiness?.level && dataReadiness.level !== 'LEARNING') ||
    currentOrders >= 100
  );
  const isLearning = !criteriaGraduated && (dataReadiness?.level === 'LEARNING' || businessBuddyCalibration?.status === 'LEARNING');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'top' | 'other' | 'done'>('all');
  const [isOtherCollapsed, setIsOtherCollapsed] = useState(false);

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && user?.uid) {
      try {
        return JSON.parse(localStorage.getItem(`analyzeup_completed_tasks_${user.uid}`) || '[]');
      } catch {
        return [];
      }
    }
    return [];
  });

  const [cancelledTaskIds, setCancelledTaskIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && user?.uid) {
      try {
        return JSON.parse(localStorage.getItem(`analyzeup_cancelled_tasks_${user.uid}`) || '[]');
      } catch {
        return [];
      }
    }
    return [];
  });
  const [taskToCancel, setTaskToCancel] = useState<{ id: string; title: string; recommendation?: string } | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const toggleTaskExpanded = (id: string) => {
    setExpandedTaskIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (user?.uid) {
      try {
        setCompletedTaskIds(JSON.parse(localStorage.getItem(`analyzeup_completed_tasks_${user.uid}`) || '[]'));
        setCancelledTaskIds(JSON.parse(localStorage.getItem(`analyzeup_cancelled_tasks_${user.uid}`) || '[]'));
      } catch {
        setCompletedTaskIds([]);
        setCancelledTaskIds([]);
      }
    } else {
      setCompletedTaskIds([]);
      setCancelledTaskIds([]);
    }
  }, [user?.uid]);

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
      if (typeof window !== 'undefined' && user?.uid) {
        localStorage.setItem(`analyzeup_completed_tasks_${user.uid}`, JSON.stringify(next));
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

  const cancelTask = (taskId: string, title?: string) => {
    setCancelledTaskIds((prev) => {
      if (prev.includes(taskId)) return prev;
      const next = [...prev, taskId];
      if (typeof window !== 'undefined' && user?.uid) {
        localStorage.setItem(`analyzeup_cancelled_tasks_${user.uid}`, JSON.stringify(next));
      }
      return next;
    });

    if (title) {
      logBusinessAction({
        title: 'Cancelled Action Recommendation',
        productName: title,
        actionType: 'audit',
        changeDetails: 'Founder dismissed or cancelled recommended action for today.',
        impactValue: 'Action Cancelled',
      });
      toast({
        title: 'Action Cancelled',
        description: `"${title}" has been dismissed from active tasks.`,
      });
    }
  };

  const undoCompletedTask = (taskId: string, title: string) => {
    setCompletedTaskIds((prev) => {
      const next = prev.filter((id) => id !== taskId);
      if (typeof window !== 'undefined' && user?.uid) {
        localStorage.setItem(`analyzeup_completed_tasks_${user.uid}`, JSON.stringify(next));
      }
      return next;
    });
    toast({
      title: 'Task Reopened',
      description: `"${title}" moved back to active business actions.`,
    });
  };

  const undoCancelledTask = (taskId: string, title: string) => {
    setCancelledTaskIds((prev) => {
      const next = prev.filter((id) => id !== taskId);
      if (typeof window !== 'undefined' && user?.uid) {
        localStorage.setItem(`analyzeup_cancelled_tasks_${user.uid}`, JSON.stringify(next));
      }
      return next;
    });
    toast({
      title: 'Action Restored',
      description: `"${title}" moved back to active business actions.`,
    });
  };

  const resetCompletedTasks = () => {
    setCompletedTaskIds([]);
    setCancelledTaskIds([]);
    if (typeof window !== 'undefined') {
      if (user?.uid) {
        localStorage.removeItem(`analyzeup_completed_tasks_${user.uid}`);
        localStorage.removeItem(`analyzeup_cancelled_tasks_${user.uid}`);
      }
      localStorage.removeItem('analyzeup_completed_tasks');
      localStorage.removeItem('analyzeup_cancelled_tasks');
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
    const targetProd =
      products.find((p) => p.id === task.targetId) ||
      products.find((p) => task.sku && p.sku && p.sku.trim().toUpperCase() === task.sku.trim().toUpperCase()) ||
      products.find((p) => task.targetVariantId && p.shopifyVariantId === task.targetVariantId) ||
      products.find((p) => task.targetId && (p.id === task.targetId || p.sku === task.targetId)) ||
      products.find((p) => p.sku && task.title.includes(p.sku)) ||
      products.find((p) => p.name && task.targetName && p.name.trim().toLowerCase() === task.targetName.trim().toLowerCase());
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
              const discountPct = task.discountPercent || (targetProd.price && task.newPrice ? Math.round(((targetProd.price - task.newPrice) / targetProd.price) * 100) : 20);
              const newPrice = task.newPrice !== undefined ? task.newPrice : Math.round(oldPrice * (1 - discountPct / 100));

              await updateProduct(
                {
                  ...targetProd,
                  price: newPrice,
                  compareAtPrice: oldPrice,
                  discountPercent: discountPct,
                  liquidationStatus: 'Liquidated',
                  updatedAt: new Date().toISOString(),
                },
                { forceShopifySync: true, silentToast: false }
              );

              // If item belongs to a connected Google Drive spreadsheet/CSV, push exact variant update
              if (driveConnection?.accessToken || targetProd.driveFileId) {
                let driveFileId = targetProd.driveFileId;
                if (!driveFileId && typeof getGoogleDriveFiles === 'function') {
                  try {
                    const files = await getGoogleDriveFiles();
                    const inventoryFile = files.find(
                      (f: any) =>
                        f.type === 'inventory' ||
                        f.name?.toLowerCase().includes('inventory') ||
                        f.name?.toLowerCase().includes('catalog') ||
                        f.name?.toLowerCase().includes('product')
                    ) || files[0];
                    if (inventoryFile) {
                      driveFileId = inventoryFile.id || inventoryFile.fileId;
                    }
                  } catch (e) {
                    console.warn('[Drive Files Lookup Error]:', e);
                  }
                }

                if (driveFileId) {
                  const token = driveConnection?.accessToken;
                  fetch('/api/drive/update', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { 'x-drive-token': token } : {}),
                      ...(user?.uid ? { 'x-user-uid': user.uid } : {}),
                    },
                    body: JSON.stringify({
                      fileId: driveFileId,
                      fileName: targetProd.driveFileName || 'Inventory_Catalog.csv',
                      updates: [
                        {
                          sku: targetProd.sku,
                          productName: targetProd.name || pName,
                          productId: targetProd.id,
                          newPrice: newPrice,
                          compareAtPrice: oldPrice,
                          updateAllVariants: false,
                        },
                      ],
                    }),
                  }).catch(console.warn);
                }
              }

              logBusinessAction({
                title: `Liquidated Dead Stock (${discountPct}% Clearance)`,
                productName: pName,
                actionType: 'discount',
                changeDetails: `Reduced price of ${pName} from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (-${discountPct}%). Unlocked working capital without altering sibling sizes.`,
                impactValue: `-${discountPct}% Clearance`,
              });

              toast({
                title: '🏷️ Clearance Promo Applied & Saved to Audit!',
                description: `Reduced price of "${pName}" to ${currencySymbol}${newPrice}. Only this specific item/variant was updated.`,
              });
            }
          } else if (task.actionType === 'price_up') {
            if (targetProd) {
              const oldPrice = targetProd.price || 500;
              const newPrice = task.newPrice !== undefined ? task.newPrice : Math.round(oldPrice * 1.08);
              const hikePct = Math.round(((newPrice - oldPrice) / oldPrice) * 100);

              await updateProduct(
                {
                  ...targetProd,
                  price: newPrice,
                  updatedAt: new Date().toISOString(),
                },
                { forceShopifySync: true, silentToast: false }
              );

              // If item belongs to a connected Google Drive spreadsheet/CSV, push exact variant update
              if (driveConnection?.accessToken || targetProd.driveFileId) {
                let driveFileId = targetProd.driveFileId;
                if (!driveFileId && typeof getGoogleDriveFiles === 'function') {
                  try {
                    const files = await getGoogleDriveFiles();
                    const inventoryFile = files.find(
                      (f: any) =>
                        f.type === 'inventory' ||
                        f.name?.toLowerCase().includes('inventory') ||
                        f.name?.toLowerCase().includes('catalog') ||
                        f.name?.toLowerCase().includes('product')
                    ) || files[0];
                    if (inventoryFile) {
                      driveFileId = inventoryFile.id || inventoryFile.fileId;
                    }
                  } catch (e) {
                    console.warn('[Drive Files Lookup Error]:', e);
                  }
                }

                if (driveFileId) {
                  const token = driveConnection?.accessToken;
                  fetch('/api/drive/update', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { 'x-drive-token': token } : {}),
                      ...(user?.uid ? { 'x-user-uid': user.uid } : {}),
                    },
                    body: JSON.stringify({
                      fileId: driveFileId,
                      fileName: targetProd.driveFileName || 'Inventory_Catalog.csv',
                      updates: [
                        {
                          sku: targetProd.sku,
                          productName: targetProd.name || pName,
                          productId: targetProd.id,
                          newPrice: newPrice,
                          updateAllVariants: false,
                        },
                      ],
                    }),
                  }).catch(console.warn);
                }
              }

              logBusinessAction({
                title: `Optimized Price (+${hikePct}%)`,
                productName: pName,
                actionType: 'price_up',
                changeDetails: `Adjusted price from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (+${hikePct}%) for margin expansion.`,
                impactValue: `+${hikePct}% Price Boost`,
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

  // Filter tasks into Active vs Completed vs Cancelled
  const activeTasks = useMemo(() => {
    return tasks.filter((t) => !completedTaskIds.includes(t.id) && !cancelledTaskIds.includes(t.id));
  }, [tasks, completedTaskIds, cancelledTaskIds]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => completedTaskIds.includes(t.id));
  }, [tasks, completedTaskIds]);

  const cancelledTasks = useMemo(() => {
    return tasks.filter((t) => cancelledTaskIds.includes(t.id));
  }, [tasks, cancelledTaskIds]);

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
        className="p-4 sm:p-5 transition-all space-y-3.5"
      >
        {/* Top Header line of the task: single clean priority badge and title */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold border px-2 py-0.5 rounded-lg shrink-0 ${
                task.priority === 'High'
                  ? 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                  : 'border-border/60 text-muted-foreground bg-secondary/30'
              }`}
            >
              {task.priority} Priority
            </Badge>

            <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{task.title}</span>
          </div>

          {/* Quick Cross (X) icon to cancel / dismiss action */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTaskToCancel({ id: task.id, title: task.title, recommendation: task.recommendation })}
            className="h-7 w-7 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Cancel / Dismiss Action"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Minimal High-Signal Action Summary */}
        <div className="space-y-2.5">
          {/* Action Required: Neutral, clean, minimal */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border/40 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Action Required
            </span>
            <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed">
              {task.recommendation}
            </p>
          </div>

          {/* Minimal Key Drivers: Trigger & Impact in unified neutral style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Trigger */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Trigger
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {task.problem || task.reason}
              </p>
            </div>

            {/* Expected Benefit */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Expected Impact
              </span>
              <div className="leading-snug pt-0.5">
                {renderImpactText(task.estimatedBenefit)}
              </div>
            </div>
          </div>

          {/* Optional Collapsible Model Breakdown */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => toggleTaskExpanded(task.id)}
              className="text-[11px] text-muted-foreground/70 hover:text-foreground flex items-center gap-1 font-medium transition-colors cursor-pointer py-0.5"
            >
              <span>{expandedTaskIds[task.id] ? 'Hide Full Breakdown' : 'View Full Breakdown'}</span>
              {expandedTaskIds[task.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {expandedTaskIds[task.id] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1.5 animate-in fade-in duration-200">
                <div className="p-2.5 rounded-xl bg-secondary/15 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">1. Observed Fact</span>
                  <p className="text-[11px] text-muted-foreground">{task.problem}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/15 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">2. Root Cause</span>
                  <p className="text-[11px] text-muted-foreground">{task.reason}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/15 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">3. Forecast Projection</span>
                  <p className="text-[11px] text-muted-foreground">{task.impact}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/15 border border-border/30 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">4. Benefit Details</span>
                  <p className="text-[11px] text-foreground font-medium">{task.estimatedBenefit}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls & Direct Navigation: All 4 buttons intact */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end pt-2 border-t border-border/30 gap-2">
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(destination.route)}
              className="rounded-xl text-xs h-8 border border-border/40 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium px-3 gap-1.5"
              title={`View product/records in ${destination.label}`}
            >
              <span>Go to {destination.label}</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>


            <Button
              size="sm"
              variant="outline"
              onClick={() => markTaskCompleted(task.id, task.title, task.recommendation)}
              className="rounded-xl text-xs h-8 border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium px-3 gap-1.5"
              title="Mark this task as done for today"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark Done</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handleExecuteAction(task)}
              className="rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs gap-1.5 px-4"
            >
              <span>Execute Action</span>
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

            {!isLearning && cancelledTasks.length > 0 && (
              <Badge
                variant="outline"
                onClick={() => setActiveTab(activeTab === 'done' ? 'all' : 'done')}
                className="text-rose-400 border-rose-500/30 text-xs gap-1 font-semibold cursor-pointer hover:bg-rose-500/10 transition-colors py-1 px-2.5"
              >
                <X className="w-3.5 h-3.5" /> {cancelledTasks.length} Cancelled
              </Badge>
            )}
          </div>
        </CardHeader>

        {/* Filter / View Tabs: Only visible once past learning stage */}
        {!isLearning && (
          <div className="flex items-center gap-1.5 p-1 bg-secondary/30 rounded-2xl border border-border/40 max-w-full text-xs font-semibold overflow-x-auto [scrollbar-width:none]">
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
            {(completedTasks.length > 0 || cancelledTasks.length > 0) && (
              <button
                onClick={() => setActiveTab('done')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                  activeTab === 'done'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                }`}
              >
                <Check className="w-3 h-3" />
                Done & Dismissed ({completedTasks.length + cancelledTasks.length})
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
                    0 / 50 Orders
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
            <div className="p-6 md:p-8 text-center rounded-2xl bg-zinc-900/50 border border-amber-500/25 space-y-4">
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
                  {(dataReadiness?.historicalDays ?? 0) >= 14 ? (
                    <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 leading-tight" title="Enabled: Sales Trends, Stockout Risk Alerts & Safety Stock Buffers">
                      <Check className="w-3 h-3 shrink-0" /> Trends &amp; Restock Alerts Enabled
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-400">
                      {Math.max(0, 14 - (dataReadiness?.historicalDays ?? 0))} days left
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Customer Orders</span>
                  <p className="text-sm font-bold text-foreground font-mono">
                    {currentOrders} / 50 Orders
                  </p>
                  {currentOrders >= 50 ? (
                    <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 leading-tight" title="Enabled: 30-Day Demand Forecasting & Dead Stock Detection">
                      <Check className="w-3 h-3 shrink-0" /> Orders Baseline Met
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-400">
                      {Math.max(0, 50 - currentOrders)} orders left
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Readiness Score</span>
                  <p className="text-sm font-bold text-emerald-400 font-mono">
                    {dataReadiness?.score ?? 0} / 100
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(dataReadiness?.score ?? 0) >= 40 ? 'Early Insights Tier' : 'Level 1 • Learning'}
                  </p>
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

              {cancelledTasks.length > 0 && (
                <div className="pt-4 space-y-3 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Cancelled Actions ({cancelledTasks.length})
                    </span>
                  </div>

                  {cancelledTasks.map((task) => {
                    const dest = getActionDestination(task);
                    return (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-full bg-rose-500/15 text-rose-400 shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground line-through opacity-70">{task.title}</p>
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

                          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px]">
                            Cancelled
                          </Badge>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => undoCancelledTask(task.id, task.title)}
                            className="rounded-xl text-xs h-7 text-muted-foreground hover:text-foreground gap-1 px-2"
                            title="Restore action and move back to active tasks"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

                  <div className="space-y-4">
                    {topPriorityTasks.map((task, idx) => (
                      <React.Fragment key={task.id}>
                        {idx > 0 && (
                          <div className="flex items-center gap-3 py-2">
                            <div className="flex-1 border-t border-white/70" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 border border-white/40 shadow-xs">
                              <Target className="w-3 h-3 text-amber-400" /> Action Priority #{idx + 1}
                            </span>
                            <div className="flex-1 border-t border-white/70" />
                          </div>
                        )}
                        <div className="rounded-2xl border border-border/50 bg-card/60 hover:bg-card/75 transition-all shadow-sm overflow-hidden">
                          {renderTaskCard(task, true, idx)}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Section divider between Top Priorities and Other Actions */}
              {activeTab === 'all' && topPriorityTasks.length > 0 && otherTasks.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 border-t border-white/70" />
                  <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wider shrink-0 px-2.5 py-0.5 rounded-full bg-secondary/70 border border-white/30">
                    More Actions
                  </span>
                  <div className="flex-1 border-t border-white/70" />
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
                    <div className="space-y-4">
                      {otherTasks.map((task, idx) => (
                        <React.Fragment key={task.id}>
                          {idx > 0 && (
                            <div className="flex items-center gap-3 py-2">
                              <div className="flex-1 border-t border-white/70" />
                              <span className="text-[10px] font-semibold text-white uppercase tracking-wider shrink-0 px-2.5 py-0.5 rounded-full bg-secondary/80 border border-white/40">
                                Action #{idx + 1}
                              </span>
                              <div className="flex-1 border-t border-white/70" />
                            </div>
                          )}
                          <div className="rounded-2xl border border-border/40 bg-card/60 hover:bg-card/75 transition-all shadow-sm overflow-hidden">
                            {renderTaskCard(task, false)}
                          </div>
                        </React.Fragment>
                      ))}
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

      {/* Cancellation Confirmation Dialog */}
      <AlertDialog
        open={taskToCancel !== null}
        onOpenChange={(open) => {
          if (!open) setTaskToCancel(null);
        }}
      >
        <AlertDialogContent className="max-w-md bg-zinc-950/95 border border-rose-500/25 rounded-3xl ios-glass text-white shadow-2xl p-6">
          <AlertDialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-white">
                  Cancel Action Recommendation?
                </AlertDialogTitle>
                <p className="text-[11px] text-zinc-400">
                  This will dismiss this task from your active list today
                </p>
              </div>
            </div>

            <AlertDialogDescription asChild>
              <div className="py-2 text-xs space-y-3">
                <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1.5">
                  <div className="text-rose-200 font-semibold text-xs flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>{taskToCancel?.title}</span>
                  </div>
                  {taskToCancel?.recommendation && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {taskToCancel.recommendation}
                    </p>
                  )}
                </div>

                <p className="text-[12px] text-zinc-300 leading-relaxed">
                  Are you sure you want to dismiss this recommended action?
                </p>

                <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40 text-[11px] text-zinc-400 flex items-start gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    You can review or restore dismissed actions anytime in the{' '}
                    <strong className="text-zinc-200">Done & Dismissed</strong> tab.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 pt-4 border-t border-zinc-800/40 mt-1">
            <AlertDialogCancel
              onClick={() => setTaskToCancel(null)}
              className="rounded-xl text-xs hover:bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white px-3 h-8"
            >
              Keep Action
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToCancel) {
                  cancelTask(taskToCancel.id, taskToCancel.title);
                  setTaskToCancel(null);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs px-4 h-8 gap-1.5 shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              Yes, Cancel Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportDialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
    </>
  );
}
