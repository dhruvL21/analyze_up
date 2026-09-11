'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/data-context';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  Tag,
  PackageCheck,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Database,
} from 'lucide-react';

interface DataReadinessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataReadinessModal({ open, onOpenChange }: DataReadinessModalProps) {
  const { dataReadiness } = useData();

  if (!dataReadiness) return null;

  const {
    score,
    level,
    historicalDays,
    totalOrders,
    totalProducts,
    hasInventoryData,
    hasCostData,
    hasPromotionHistory,
    qualityReport,
    capabilities,
    limitations,
    reasons,
  } = dataReadiness;

  const levelColor =
    level === 'OPTIMIZATION'
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : level === 'PREDICTIVE'
      ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
      : level === 'EARLY_INSIGHTS'
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : 'text-blue-400 border-blue-500/30 bg-blue-500/10';

  const levelBadgeLabel =
    level === 'OPTIMIZATION'
      ? 'Level 4 • Optimization'
      : level === 'PREDICTIVE'
      ? 'Level 3 • Predictive'
      : level === 'EARLY_INSIGHTS'
      ? 'Level 2 • Early Insights'
      : 'Level 1 • Learning';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-zinc-950/95 border border-emerald-500/30 rounded-3xl ios-glass text-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 pb-2 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                  Data Readiness &amp; Intelligence
                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-bold ${levelColor}`}>
                    {levelBadgeLabel}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  AnalyzeUp automatically inspects your actual imported data to verify statistical sufficiency.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-4 text-xs">
          {/* Top Score Banner */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Data Readiness Score
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white">{score}</span>
                <span className="text-zinc-500 text-sm font-semibold">/ 100</span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-1">
                {level === 'OPTIMIZATION' && 'Sufficient long-term volume unlocked for advanced seasonality & optimization.'}
                {level === 'PREDICTIVE' && 'Robust historical patterns detected for demand forecasting & risk models.'}
                {level === 'EARLY_INSIGHTS' && 'Early velocity patterns active. Forecasts are labeled as early estimates.'}
                {level === 'LEARNING' && 'Observing catalog sales rhythm. Basic analytics and inventory tracking active.'}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1 text-center min-w-28">
                <span className="text-[10px] text-zinc-400 block font-medium">Data Quality</span>
                <span className="text-base font-extrabold text-emerald-400">{qualityReport.percentage}%</span>
              </div>
            </div>
          </div>

          {/* Section 1: Why? (Data Evidence Breakdown) */}
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Database className="w-3.5 h-3.5 text-cyan-400" /> Why this readiness level?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-zinc-300">
                  <strong className="text-white">{historicalDays}</strong> days of recorded sales history
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-zinc-300">
                  <strong className="text-white">{totalOrders.toLocaleString()}</strong> customer orders processed
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2">
                {hasInventoryData ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-zinc-300">Inventory warehouse data available</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-200">Inventory data limited</span>
                  </>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-zinc-300">
                  <strong className="text-white">{qualityReport.percentage}%</strong> verified data quality
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2">
                {totalOrders >= 50 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-zinc-300">Strong order transaction density</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-zinc-300">Building transaction density</span>
                  </>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-2">
                {hasCostData ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-zinc-300">Product cost/margins available</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-200">Cost/margin data not entered</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Available Intelligence Capabilities */}
          <div className="space-y-2 pt-1">
            <h4 className="font-bold text-zinc-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-emerald-400" /> Available Intelligence Capabilities
            </h4>
            <div className="divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-zinc-200 font-medium">Basic Catalog &amp; Revenue Analytics</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  Active
                </Badge>
              </div>

              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {capabilities.trendAnalysis ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-zinc-200 font-medium">Sales Trends &amp; Velocity Changes</span>
                </div>
                <Badge className={capabilities.trendAnalysis ? 'bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 text-[10px]'}>
                  {capabilities.trendAnalysis ? 'Active' : 'Awaiting Data'}
                </Badge>
              </div>

              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {capabilities.demandForecasting ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-zinc-200 font-medium">Demand Forecasting (7 / 14 / 30 Days)</span>
                </div>
                <Badge className={capabilities.demandForecasting ? 'bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 text-[10px]'}>
                  {capabilities.demandForecasting ? (level === 'EARLY_INSIGHTS' ? 'Early Estimate' : 'Predictive') : 'Requires 30+ Days'}
                </Badge>
              </div>

              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {capabilities.deadStockDetection ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-zinc-200 font-medium">Coverage-Based Dead Stock Detection</span>
                </div>
                <Badge className={capabilities.deadStockDetection ? 'bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 text-[10px]'}>
                  {capabilities.deadStockDetection ? 'Active' : 'Awaiting Baseline'}
                </Badge>
              </div>

              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {capabilities.stockoutPrediction ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-zinc-200 font-medium">Stockout Runway &amp; Reorder Urgency</span>
                </div>
                <Badge className={capabilities.stockoutPrediction ? 'bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 text-[10px]'}>
                  {capabilities.stockoutPrediction ? 'Active' : 'Requires Stock Data'}
                </Badge>
              </div>

              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {capabilities.seasonalityAnalysis ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-zinc-200 font-medium">Seasonal Pattern &amp; Holiday Cycles</span>
                </div>
                <Badge className={capabilities.seasonalityAnalysis ? 'bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 text-[10px]'}>
                  {capabilities.seasonalityAnalysis ? 'Active' : 'Requires 90+ Days'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Section 3: Limitations / Constructive Guidance */}
          {limitations.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
              <span className="text-amber-300 font-bold flex items-center gap-1.5 text-xs">
                <Info className="w-3.5 h-3.5 text-amber-400" /> Current Intelligence Notes
              </span>
              <div className="space-y-1">
                {limitations.map((lim, idx) => (
                  <p key={idx} className="text-zinc-300 text-[11px] leading-relaxed">
                    {lim}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-4 cursor-pointer"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
