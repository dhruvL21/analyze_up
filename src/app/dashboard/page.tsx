'use client';

import React from 'react';
import { useData } from '@/context/data-context';
import { QuickActionsBar } from '@/components/quick-actions-bar';
import { AIBrief } from '@/components/ai-brief';
import { BusinessHealthCard } from '@/components/business-health-card';
import { AIActionCenter } from '@/components/ai-action-center';
import { ExecutiveKPIGrid } from '@/components/executive-kpi-grid';
import { OutOfStockSection } from '@/components/out-of-stock-section';
import { InventoryRecommendationsPanel } from '@/components/inventory-recommendations-panel';
import { RevenueProfitIntelligence } from '@/components/revenue-profit-intelligence';
import { DeadStockSection } from '@/components/dead-stock-section';
import { InventoryQualitySnapshot } from '@/components/inventory-quality-snapshot';
import { BusinessActivityTimeline } from '@/components/business-activity-timeline';
import { DataReadinessModal } from '@/components/data-readiness-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Store, Building2 } from 'lucide-react';

export default function DashboardPage() {
  const { products, transactions, businessProfile, dataReadiness } = useData();
  const [readinessModalOpen, setReadinessModalOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-full overflow-hidden">
      {/* Top Welcome Title with Business Logo & Data Readiness Score Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {businessProfile?.logoUrl ? (
            <div className="relative shrink-0">
              <img
                src={businessProfile.logoUrl}
                alt={businessProfile.businessName || 'Business Logo'}
                className="w-12 h-12 md:w-14 md:h-14 rounded-2xl object-cover border border-border/60 bg-secondary/30 shadow-md ring-1 ring-border/40"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" title="Active" />
            </div>
          ) : (
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/30 border border-border/60 flex items-center justify-center shrink-0 shadow-md">
              <Store className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl text-foreground">
                {businessProfile?.businessName || 'Business Copilot'}
              </h1>
              {businessProfile?.businessType && (
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2 bg-secondary/40 border-border/60 text-muted-foreground">
                  {businessProfile.businessType.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 font-medium">
              Welcome back, <span className="font-semibold text-foreground">{businessProfile?.businessName || 'Founder'}</span> — Know what&apos;s happening. Decide what matters.
            </p>
          </div>
        </div>

        {/* Data Readiness Interactive Badge */}
        {dataReadiness && (
          <button
            type="button"
            onClick={() => setReadinessModalOpen(true)}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl border border-emerald-500/25 bg-secondary/40 hover:bg-secondary/70 hover:border-emerald-500/40 transition-all text-xs cursor-pointer shadow-md group shrink-0 self-start sm:self-auto"
            title="Click to view Data Readiness Breakdown & Available Intelligence"
          >
            <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Data Readiness</span>
                <span className="text-xs font-extrabold text-foreground">
                  <strong className="text-emerald-400">{dataReadiness.score}</strong>/100
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 font-bold border ${
                    dataReadiness.level === 'OPTIMIZATION'
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                      : dataReadiness.level === 'PREDICTIVE'
                      ? 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10'
                      : dataReadiness.level === 'EARLY_INSIGHTS'
                      ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                      : 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                  }`}
                >
                  {dataReadiness.level === 'OPTIMIZATION'
                    ? 'Optimization'
                    : dataReadiness.level === 'PREDICTIVE'
                    ? 'Predictive'
                    : dataReadiness.level === 'EARLY_INSIGHTS'
                    ? 'Early Insights'
                    : 'Learning'}
                </Badge>
                <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                  Inspect →
                </span>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Progressive Intelligence Learning Banner for Level 1 */}
      {dataReadiness?.level === 'LEARNING' && (
        <div className="p-5 rounded-3xl ios-glass border border-blue-500/25 bg-gradient-to-r from-blue-950/20 via-background to-background shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                We&apos;re learning your business rhythm
              </span>
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/40 bg-blue-500/10 font-bold">
                Readiness: {dataReadiness.score}/100 • Level 1 (Learning)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              AnalyzeUp is observing your sales patterns. As real customer transactions accumulate, predictive dead stock, automated reordering, and clearance intelligence will unlock automatically without manual setup.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <span><strong>{dataReadiness.historicalDays}</strong> of ~30 baseline days</span>
              <span>•</span>
              <span><strong>{dataReadiness.totalOrders}</strong> of ~300 target orders</span>
              <span>•</span>
              <span><strong>{dataReadiness.qualityReport?.percentage ?? 100}%</strong> data quality</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReadinessModalOpen(true)}
            className="rounded-xl text-xs font-bold border-blue-500/30 text-blue-400 hover:bg-blue-500/10 shrink-0 cursor-pointer"
          >
            Inspect Data Readiness →
          </Button>
        </div>
      )}

      <DataReadinessModal open={readinessModalOpen} onOpenChange={setReadinessModalOpen} />

      {/* SINGLE UNIFIED EXECUTIVE COMMAND CONTAINER */}
      <div className="p-5 md:p-6 rounded-3xl ios-glass border border-emerald-500/20 shadow-2xl space-y-6">
        {/* Top Options / Quick Actions Bar */}
        <QuickActionsBar />

        {/* Subtle Separator */}
        <div className="border-t border-border/40" />

        {/* Today's AI Brief & Business Health Score Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 min-w-0">
            <AIBrief />
          </div>
          <div className="lg:col-span-5 min-w-0">
            <BusinessHealthCard />
          </div>
        </div>
      </div>

      {/* FEATURE 4: Executive KPI Grid (Trend & Interpretation) */}
      <ExecutiveKPIGrid />

      {/* Proactive AI Inventory Recommendations */}
      <InventoryRecommendationsPanel />

      {/* FEATURE 3: AI Action Center */}
      <AIActionCenter />

      {/* FEATURE 5 & 12: Revenue & Profit Intelligence */}
      <RevenueProfitIntelligence />

      {/* Dead Stock Warning & Stagnant Products */}
      <DeadStockSection />

      {/* Out of Stock & Urgent Restock Hub */}
      <OutOfStockSection />

      {/* FEATURE 6 & 11: Inventory Quality Snapshot & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col min-w-0">
          <InventoryQualitySnapshot />
        </div>
        <div className="flex flex-col min-w-0">
          <BusinessActivityTimeline />
        </div>
      </div>
    </div>
  );
}
