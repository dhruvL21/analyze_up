'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, ChevronDown } from 'lucide-react';

interface PricingAssistanceCtaProps {
  onOpenFindMyPlan: () => void;
  onOpenAskAi: () => void;
  onCompareFeaturesClick?: () => void;
}

export function PricingAssistanceCta({
  onOpenFindMyPlan,
  onOpenAskAi,
  onCompareFeaturesClick,
}: PricingAssistanceCtaProps) {
  return (
    <div className="ios-glass rounded-2xl border border-border/60 bg-gradient-to-b from-zinc-900/60 via-zinc-950/80 to-zinc-950 p-6 sm:p-8 text-center space-y-4 my-6 shadow-xl relative overflow-hidden">
      {/* Subtle ambient back-glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 bg-primary/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Heading & Supporting Text */}
      <div className="space-y-1.5 max-w-xl mx-auto">
        <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
          Which plan is right for you?
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Tell us about your business or ask AnalyzeUp directly. We&apos;ll help you find the plan that fits your needs.
        </p>
      </div>

      {/* Two Primary Action Buttons: Inline on Desktop, Stacked on Mobile */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1 max-w-md mx-auto">
        <Button
          onClick={onOpenFindMyPlan}
          className="w-full sm:w-auto flex-1 h-11 sm:h-12 px-6 rounded-xl text-xs sm:text-sm font-bold gap-2 bg-card hover:bg-secondary text-foreground border border-border/80 hover:border-primary/60 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Find My Plan</span>
        </Button>

        <Button
          onClick={onOpenAskAi}
          className="w-full sm:w-auto flex-1 h-11 sm:h-12 px-6 rounded-xl text-xs sm:text-sm font-bold gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all font-black"
        >
          <Bot className="w-4 h-4 text-zinc-950" />
          <span>Ask AnalyzeUp AI</span>
        </Button>
      </div>

      {/* Compare all features indicator */}
      {onCompareFeaturesClick && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onCompareFeaturesClick}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group py-1 px-3 rounded-lg hover:bg-secondary/40"
          >
            <span>Compare all features</span>
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}
