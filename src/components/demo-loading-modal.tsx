'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '@/context/data-context';
import {
  Package,
  Truck,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Loader2,
  Zap,
  Database,
} from 'lucide-react';

const STEPS = [
  {
    id: 1,
    title: 'Products & Inventory Catalog',
    description: '200+ SKUs, categories, costs & stock thresholds',
    icon: Package,
  },
  {
    id: 2,
    title: 'Supplier & Vendor Network',
    description: '15+ trusted suppliers & lead-time curves',
    icon: Truck,
  },
  {
    id: 3,
    title: 'Sales & Omnichannel Orders',
    description: '500+ transaction histories & return patterns',
    icon: TrendingUp,
  },
  {
    id: 4,
    title: 'AI Copilot & Profit Calibration',
    description: 'Demand forecasting, dead-stock & margin models',
    icon: Sparkles,
  },
];

export function DemoLoadingModal() {
  const { isLoadingDemo, demoProgress } = useData();

  if (!isLoadingDemo) return null;

  const currentStage = demoProgress.stage || 1;
  const percent = Math.min(100, Math.max(0, demoProgress.percent || 0));
  const isComplete = percent >= 100;

  return (
    <AnimatePresence>
      <motion.div
        key="demo-loading-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md"
      >
        {/* Subtle ambient glow — uses primary color */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          transition={{ type: 'spring', duration: 0.45, bounce: 0.15 }}
          className="relative w-full max-w-lg rounded-3xl border border-border/60 bg-card/95 dark:bg-zinc-950/95 p-6 sm:p-7 shadow-2xl overflow-hidden"
        >
          {/* Top accent border line — primary color */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          {/* Header section with centerpiece icon */}
          <div className="flex flex-col items-center text-center space-y-3">
            {/* Animated center orb icon */}
            <div className="relative flex items-center justify-center">
              {/* Outer rotating dashed ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-2.5 rounded-3xl border-2 border-dashed border-primary/20"
              />

              {/* Pulsating glow aura */}
              <div
                className={`absolute inset-0 rounded-2xl blur-md transition-all duration-500 ${
                  isComplete ? 'bg-emerald-500/20' : 'bg-primary/10 animate-pulse'
                }`}
              />

              {/* Central avatar container */}
              <div
                className={`relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border transition-all duration-500 ${
                  isComplete
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-primary/10 border-primary/25 text-primary'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-8 h-8 scale-110 transition-transform animate-in zoom-in-75 duration-300" />
                ) : currentStage === 1 ? (
                  <Package className="w-8 h-8 animate-bounce [animation-duration:2s]" />
                ) : currentStage === 2 ? (
                  <Truck className="w-8 h-8 animate-pulse" />
                ) : currentStage === 3 ? (
                  <TrendingUp className="w-8 h-8 animate-pulse" />
                ) : (
                  <Sparkles className="w-8 h-8 animate-spin [animation-duration:4s]" />
                )}
              </div>
            </div>

            {/* Badge & Title */}
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 border border-primary/20 text-[11px] font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping inline-block" />
                {isComplete ? 'Ready to Explore' : 'Provisioning Demo Business'}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground pt-1">
                {isComplete ? 'Demo Business Ready!' : 'Uploading Demo Data...'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto min-h-[2.5rem] flex items-center justify-center">
                {demoProgress.stepName || 'Preparing enterprise retail demo environment...'}
              </p>
            </div>
          </div>

          {/* Progress Bar & Percentage display */}
          <div className="space-y-2 my-4">
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5 text-[11px]">
                <Database className="w-3.5 h-3.5 text-primary/70" />
                Populating Records
              </span>
              <span className="font-mono font-bold text-foreground text-sm">
                {percent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 rounded-full bg-secondary/80 border border-border/40 p-0.5 relative overflow-hidden">
              <motion.div
                className={`h-full rounded-full relative overflow-hidden transition-all ${
                  isComplete
                    ? 'bg-emerald-500'
                    : 'bg-primary'
                }`}
                initial={{ width: '0%' }}
                animate={{ width: `${percent}%` }}
                transition={{ type: 'spring', stiffness: 50, damping: 14 }}
              >
                {/* Shimmer beam */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
              </motion.div>
            </div>
          </div>

          {/* Real-time 4-Milestone Checklist */}
          <div className="space-y-2 py-1">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isDone = isComplete || currentStage > step.id;
              const isCurrent = currentStage === step.id && !isComplete;

              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 ${
                    isDone
                      ? 'bg-emerald-500/8 border-emerald-500/20 text-foreground'
                      : isCurrent
                      ? 'bg-primary/8 border-primary/25 text-foreground'
                      : 'bg-secondary/20 border-border/30 text-muted-foreground/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                          : isCurrent
                          ? 'bg-primary/15 text-primary border-primary/25'
                          : 'bg-secondary/40 text-muted-foreground/40 border-border/30'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isDone
                            ? 'text-foreground'
                            : isCurrent
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground truncate">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    {isDone ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 animate-in zoom-in-50 duration-200">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Done</span>
                      </div>
                    ) : isCurrent ? (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="hidden sm:inline">Uploading</span>
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-border/50 bg-secondary/30" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer isolation security note */}
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 truncate">
              <Zap className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span>Calibrating margins & cash cow metrics</span>
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">
              Isolated Workspace
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
