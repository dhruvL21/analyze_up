'use client';

import React from 'react';
import { useData } from '@/context/data-context';
import { QuickActionsBar } from '@/components/quick-actions-bar';
import { AIBrief } from '@/components/ai-brief';
import { BusinessHealthCard } from '@/components/business-health-card';
import { AIActionCenter } from '@/components/ai-action-center';
import { ExecutiveKPIGrid } from '@/components/executive-kpi-grid';
import { InventoryRecommendationsPanel } from '@/components/inventory-recommendations-panel';
import { RevenueProfitIntelligence } from '@/components/revenue-profit-intelligence';
import { DeadStockSection } from '@/components/dead-stock-section';
import { InventoryQualitySnapshot } from '@/components/inventory-quality-snapshot';
import { BusinessActivityTimeline } from '@/components/business-activity-timeline';
export default function DashboardPage() {
  const { products, transactions, businessProfile } = useData();

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Top Welcome Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl text-foreground">
            Business Copilot
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 font-medium">
            Welcome back, <span className="font-semibold text-foreground">{businessProfile?.businessName || 'Founder'}</span> — Know what&apos;s happening. Decide what matters.
          </p>
        </div>
      </div>

      {/* SINGLE UNIFIED EXECUTIVE COMMAND CONTAINER */}
      <div className="p-5 md:p-6 rounded-3xl ios-glass border border-emerald-500/20 shadow-2xl space-y-6">
        {/* Top Options / Quick Actions Bar */}
        <QuickActionsBar />

        {/* Subtle Separator */}
        <div className="border-t border-border/40" />

        {/* Today's AI Brief & Business Health Score Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7">
            <AIBrief />
          </div>
          <div className="lg:col-span-5">
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

      {/* FEATURE 6 & 11: Inventory Quality Snapshot & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col">
          <InventoryQualitySnapshot />
        </div>
        <div className="flex flex-col">
          <BusinessActivityTimeline />
        </div>
      </div>
    </div>
  );
}
