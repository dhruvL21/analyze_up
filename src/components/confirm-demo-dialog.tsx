'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useData } from '@/context/data-context';
import { BusinessType } from '@/lib/types';
import {
  Sparkles,
  Package,
  Truck,
  TrendingUp,
  BrainCircuit,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface ConfirmDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
  businessType?: BusinessType;
}

export function ConfirmDemoDialog({
  open,
  onOpenChange,
  onConfirm,
  businessType,
}: ConfirmDemoDialogProps) {
  const { loadDemoBusiness, businessProfile, isLoadingDemo } = useData();

  const handleConfirm = async () => {
    onOpenChange(false);
    if (onConfirm) {
      onConfirm();
    } else {
      const targetType = businessType || businessProfile?.businessType || 'Retail';
      await loadDemoBusiness(targetType);
    }
  };

  const demoHighlights = [
    {
      icon: Package,
      iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      title: '200+ Products & SKUs',
      description:
        'Injects complete catalog items with inventory stock levels, category trees, cost of goods (COGS), selling prices, and reorder thresholds.',
    },
    {
      icon: Truck,
      iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      title: '15+ Verified Suppliers',
      description:
        'Configures active vendor profiles with contact channels, historical lead times, and product associations for automated restock modeling.',
    },
    {
      icon: TrendingUp,
      iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      title: '500+ Sales Orders & Transactions',
      description:
        'Synthesizes 90 days of realistic sales velocity, omnichannel orders, and return patterns to power revenue analytics and cash-flow reports.',
    },
    {
      icon: BrainCircuit,
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      title: 'AI Copilot & Profit Intelligence',
      description:
        'Calibrates dead-stock risk diagnostics, stockout warnings, demand forecasting models, and your real-time Executive Health Score.',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Load Demo Business Environment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Here is what will be populated in your workspace:
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Feature Highlights Grid */}
        <div className="space-y-3 my-2">
          {demoHighlights.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-secondary/35 border border-border/40 hover:bg-secondary/50 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${item.iconColor}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    {item.title}
                  </h4>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Safety & Non-destructive Notice */}
        <div className="rounded-xl p-3 bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11.5px] leading-relaxed">
            <strong className="text-foreground font-semibold">Safe & Fully Reversible:</strong> You can test all executive dashboards and AI tools. Connecting Shopify, Google Drive, or uploading your CSV file will seamlessly override or replace this demo data.
          </p>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoadingDemo}
            className="rounded-xl text-xs sm:text-sm font-semibold h-10 px-4 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoadingDemo}
            className="rounded-xl text-xs sm:text-sm gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold h-10 px-5 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-black" />
            <span>Okay, Load Demo</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
