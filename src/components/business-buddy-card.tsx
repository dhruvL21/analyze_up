'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  TrendingUp,
  PackageX,
  RotateCcw,
  Globe2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  Info,
  Calendar,
} from 'lucide-react';
import { BusinessBuddyCalibration } from '@/lib/business-buddy-engine';

interface BusinessBuddyCardProps {
  calibration: BusinessBuddyCalibration;
}

export function BusinessBuddyCard({ calibration }: BusinessBuddyCardProps) {
  const [activeTab, setActiveTab] = useState<'sales' | 'unsold' | 'returns' | 'market'>('market');

  const {
    currentDayNumber,
    targetDays,
    intelligence,
    salesPatterns,
    unsoldPatterns,
    returnPatterns,
  } = calibration;

  const progressPercent = Math.min(100, Math.round((currentDayNumber / targetDays) * 100));

  return (
    <>
      <Card className="ios-glass rounded-3xl border-emerald-500/30 p-5 shadow-2xl space-y-5 relative overflow-hidden bg-gradient-to-br from-emerald-950/20 via-background to-indigo-950/20">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <CardHeader className="p-0 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 shadow-lg shadow-emerald-500/10">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  AI Business Buddy
                </CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold px-2.5 py-0.5">
                  ● Learning Phase: Day {currentDayNumber} of {targetDays}
                </Badge>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60">
                  {intelligence.detectedIndustry}
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                I am observing your daily sales rhythm, why items sell, and return patterns before triggering automated clearance discounts or restock orders.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 shrink-0">
            <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Learning Mode Active</span>
          </div>
        </CardHeader>

        <CardContent className="p-0 space-y-5">
          {/* Progress Banner */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-foreground flex items-center gap-1.5 font-semibold">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Store Baseline Calibration Progress
              </span>
              <span className="text-emerald-400 font-bold">{progressPercent}% Calibrated</span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-secondary" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Catalog Ingested</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Industry Profiled</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span>Tracking Daily Velocity</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Margin Guard Active</span>
              </div>
            </div>
          </div>

          {/* AI Buddy Persona Note */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-xs leading-relaxed text-emerald-200">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-white font-semibold">Business Buddy Advice: </strong>
              {intelligence.buddyAdvice}
            </p>
          </div>

          {/* Daily Pattern Learning Explorer Tabs */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full space-y-3">
            <TabsList className="grid grid-cols-4 bg-secondary/40 p-1 rounded-2xl border border-border/40 text-xs">
              <TabsTrigger value="market" className="rounded-xl gap-1.5 data-[state=active]:bg-card text-xs">
                <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Market Trends</span>
                <span className="sm:hidden">Market</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="rounded-xl gap-1.5 data-[state=active]:bg-card text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Sales Patterns</span>
                <span className="sm:hidden">Sales</span>
              </TabsTrigger>
              <TabsTrigger value="unsold" className="rounded-xl gap-1.5 data-[state=active]:bg-card text-xs">
                <PackageX className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Unsold Analysis</span>
                <span className="sm:hidden">Unsold</span>
              </TabsTrigger>
              <TabsTrigger value="returns" className="rounded-xl gap-1.5 data-[state=active]:bg-card text-xs">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Return Reasons</span>
                <span className="sm:hidden">Returns</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Market Trends via OpenAI */}
            <TabsContent value="market" className="m-0 space-y-3">
              <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-foreground">OpenAI Industry Trend Research</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-300">
                    {intelligence.detectedIndustry}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {intelligence.marketDemandTrend}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                    <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      Calibrated Holding Period
                    </span>
                    <p className="text-xs text-emerald-300 font-bold">
                      {intelligence.holdingPeriodDays} Days
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {intelligence.holdingPeriodExplanation}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-1">
                    <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Price Elasticity Guidance
                    </span>
                    <p className="text-xs text-indigo-300 font-bold">
                      Recommended: {intelligence.recommendedDiscountRange.min}%–{intelligence.recommendedDiscountRange.max}% Max
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {intelligence.priceElasticitySummary}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Sales Patterns */}
            <TabsContent value="sales" className="m-0 space-y-3">
              <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">How Products Are Sold (Velocity & Cadence)</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                    {salesPatterns.growthTrajectory}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {salesPatterns.summary}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Daily Velocity</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">~{salesPatterns.dailyVelocity} units/day</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Peak Day</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{salesPatterns.peakSalesDay}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Units Ingested</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{salesPatterns.totalUnitsSold} units</p>
                  </div>
                </div>

                {salesPatterns.topVelocityProducts.length > 0 && (
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <span className="text-[11px] font-semibold text-foreground">Top Performing Velocity SKUs:</span>
                    <div className="flex flex-wrap gap-2">
                      {salesPatterns.topVelocityProducts.map((p, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[11px] py-1 px-2">
                          {p.name} ({p.unitsSold} sold)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: Unsold Analysis */}
            <TabsContent value="unsold" className="m-0 space-y-3">
              <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageX className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-foreground">Why Products Are Not Sold (Dormancy Drivers)</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                    Holding Window: {unsoldPatterns.holdingThresholdDays} Days
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {unsoldPatterns.primaryReason}
                </p>

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200">
                  <strong>Why clearance is on hold: </strong>
                  Marking brand-new inventory as &quot;dead stock&quot; on Day 1 causes premature 20-30% margin loss. The AI Buddy protects your full price equity until {unsoldPatterns.holdingThresholdDays} days of true lack of demand are demonstrated.
                </div>

                {Object.keys(unsoldPatterns.sizingDistribution).length > 0 && (
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[11px] font-semibold text-foreground">Sizes &amp; Variants Currently Held:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(unsoldPatterns.sizingDistribution).map(([size, count]) => (
                        <Badge key={size} variant="outline" className="text-[10px] py-0.5 px-2 text-muted-foreground">
                          Size {size}: {count} in stock
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 4: Return Reasons Breakdown */}
            <TabsContent value="returns" className="m-0 space-y-3">
              <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-foreground">Why Products Are Returned (Customer Friction)</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-border text-foreground">
                    Rate: {returnPatterns.overallReturnRate}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {returnPatterns.summary}
                </p>

                <div className="space-y-2 pt-1">
                  {returnPatterns.topReasons.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-secondary/30">
                      <span className="text-foreground font-medium">{r.reason}</span>
                      <span className="text-amber-400 font-bold">{r.percentage}% ({r.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
