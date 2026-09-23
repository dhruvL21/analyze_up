'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Building2,
  Package,
  ShoppingCart,
  Store,
  Users,
  Target,
  TrendingUp,
  AlertCircle,
  Mail,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  PlanQuestionnaireAnswers,
  PlanRecommendationResult,
  recommendPlan,
  PLAN_CONFIGS,
  PlanType,
} from '@/lib/saas-engine';

interface FindMyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planKey: PlanType) => void;
  onViewComparison?: () => void;
}

const TOTAL_STEPS = 7;

export function FindMyPlanModal({
  isOpen,
  onClose,
  onSelectPlan,
  onViewComparison,
}: FindMyPlanModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [answers, setAnswers] = useState<PlanQuestionnaireAnswers>({
    businessType: 'D2C / E-commerce',
    productCountRange: '100–500',
    monthlyOrdersRange: '100–1,000',
    salesChannels: ['Shopify'],
    teamSizeRange: 'Just me',
    primaryNeeds: ['Inventory management', 'Sales & profit analytics'],
    growthExpectation: 'Growing steadily',
  });

  const [recommendation, setRecommendation] = useState<PlanRecommendationResult | null>(null);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Calculate final deterministic recommendation
      const result = recommendPlan(answers);
      setRecommendation(result);
      setCurrentStep(TOTAL_STEPS + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setRecommendation(null);
  };

  const toggleArrayItem = (field: 'salesChannels' | 'primaryNeeds', item: string) => {
    setAnswers((prev) => {
      const current = prev[field] || [];
      if (item === 'Everything' && field === 'primaryNeeds') {
        return { ...prev, [field]: ['Everything'] };
      }
      let updated: string[];
      if (current.includes('Everything')) {
        updated = [item];
      } else if (current.includes(item)) {
        updated = current.filter((x) => x !== item);
      } else {
        updated = [...current, item];
      }
      return { ...prev, [field]: updated.length > 0 ? updated : [item] };
    });
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return Boolean(answers.businessType);
      case 2:
        return Boolean(answers.productCountRange);
      case 3:
        return Boolean(answers.monthlyOrdersRange);
      case 4:
        return answers.salesChannels.length > 0;
      case 5:
        return Boolean(answers.teamSizeRange);
      case 6:
        return answers.primaryNeeds.length > 0;
      case 7:
        return Boolean(answers.growthExpectation);
      default:
        return true;
    }
  };

  const progressPercent = Math.min(100, Math.round((currentStep / TOTAL_STEPS) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Cinematic Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-2xl bg-zinc-950/95 border border-border/80 shadow-[0_25px_70px_rgba(0,0,0,0.85)] rounded-3xl overflow-hidden z-10 max-h-[92vh] flex flex-col backdrop-blur-2xl"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-primary/20 rounded-full blur-[80px] pointer-events-none -z-10" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-border/40 flex items-center justify-between relative">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Plan Matcher
            </div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
              Find the right AnalyzeUp plan
            </h2>
            <p className="text-xs text-muted-foreground">
              Answer a few quick questions about your business.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Meter (Steps 1-7) */}
        {currentStep <= TOTAL_STEPS && (
          <div className="px-6 pt-3 pb-1 flex items-center justify-between gap-4">
            <span className="text-[11px] font-bold text-muted-foreground font-mono">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <div className="w-36 sm:w-48">
              <Progress value={progressPercent} className="h-1.5 bg-secondary/80" />
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 flex-1">
          <AnimatePresence mode="wait">
            {/* STEP 1: BUSINESS TYPE */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1">
                    <Building2 className="w-3.5 h-3.5" /> Step 1
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    What type of business do you run?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select your primary operating model.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {[
                    'D2C / E-commerce',
                    'Retail',
                    'Fashion / Apparel',
                    'Wholesale',
                    'Electronics',
                    'Beauty / Cosmetics',
                    'Other',
                  ].map((type) => {
                    const isSelected = answers.businessType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, businessType: type }))}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{type}</span>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 2: PRODUCTS */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1">
                    <Package className="w-3.5 h-3.5" /> Step 2
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    How many products or SKUs do you manage?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Include all active variants across sizes, colors, and bundles.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    { label: 'Under 100', desc: 'Pre-revenue or testing with a few core SKUs' },
                    { label: '100–500', desc: 'Growing boutique catalog or single brand line' },
                    { label: '500–2,000', desc: 'Established catalog with multi-category inventory' },
                    { label: '2,000–10,000', desc: 'Mid-sized e-commerce brand or retail catalog' },
                    { label: '10,000+', desc: 'Large multi-category or omnichannel catalog' },
                  ].map((item) => {
                    const isSelected = answers.productCountRange === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, productCountRange: item.label }))
                        }
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 3: MONTHLY ORDERS */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1">
                    <ShoppingCart className="w-3.5 h-3.5" /> Step 3
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Approximately how many orders or transactions do you process each month?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your average monthly transaction volume across all sales channels.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    { label: 'Under 100', desc: 'Validating product market fit or pre-scale' },
                    { label: '100–1,000', desc: 'Steady live transactions, solo or small store' },
                    { label: '1,000–5,000', desc: 'High daily volume, active daily reorders' },
                    { label: '5,000–20,000', desc: 'Rapidly growing D2C brand or multiple retail points' },
                    { label: '20,000+', desc: 'High-scale velocity with complex supply chain' },
                  ].map((item) => {
                    const isSelected = answers.monthlyOrdersRange === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, monthlyOrdersRange: item.label }))
                        }
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 4: SALES CHANNELS */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1">
                    <Store className="w-3.5 h-3.5" /> Step 4
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Where do you sell?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select all platforms and channels where your products are sold.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    { label: 'Shopify', desc: 'Direct automated real-time store synchronization' },
                    { label: 'Other e-commerce platforms', desc: 'Amazon, WooCommerce, Magento, etc. via CSV' },
                    { label: 'Physical stores', desc: 'Brick-and-mortar retail outlets or point of sale' },
                    { label: 'Wholesale', desc: 'B2B bulk orders and commercial distribution' },
                    { label: 'Multiple channels', desc: 'Omnichannel presence across online and offline' },
                  ].map((item) => {
                    const isSelected = answers.salesChannels.includes(item.label);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => toggleArrayItem('salesChannels', item.label)}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 5: TEAM */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5" /> Step 5
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    How many people need access to AnalyzeUp?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Team members who need workspace dashboards, alerts, or report exports.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    { label: 'Just me', desc: 'Solo founder / operator running the store' },
                    { label: '2–3', desc: 'Co-founder or inventory/marketing manager' },
                    { label: '4–10', desc: 'Growing operations, finance, and warehouse team' },
                    { label: '11–25', desc: 'Larger departmental staff across multiple functions' },
                    { label: '25+', desc: 'Large enterprise organization with extensive staff' },
                  ].map((item) => {
                    const isSelected = answers.teamSizeRange === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, teamSizeRange: item.label }))}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 6: WHAT THEY NEED */}
            {currentStep === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1">
                    <Target className="w-3.5 h-3.5" /> Step 6
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    What do you mainly want AnalyzeUp to help with?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select all key business goals (multiple selections allowed).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {[
                    'Inventory management',
                    'Sales & profit analytics',
                    'AI insights',
                    'Shopify management',
                    'Multiple stores',
                    'Business reporting',
                    'Everything',
                  ].map((need) => {
                    const isSelected = answers.primaryNeeds.includes(need);
                    return (
                      <button
                        key={need}
                        type="button"
                        onClick={() => toggleArrayItem('primaryNeeds', need)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between text-xs font-semibold ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{need}</span>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 7: GROWTH */}
            {currentStep === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Step 7
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    How do you expect your business to grow over the next 12 months?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Helps ensure your plan has comfortable capacity without overpaying.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    { label: 'Just getting started', desc: 'Validating demand, cautious growth' },
                    { label: 'Growing steadily', desc: 'Predictable incremental sales increases' },
                    { label: 'Growing quickly', desc: 'Scaling marketing spend and adding products' },
                    { label: 'Already scaling', desc: 'Rapid market expansion with high transaction velocity' },
                  ].map((item) => {
                    const isSelected = answers.growthExpectation === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, growthExpectation: item.label }))
                        }
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 8: RECOMMENDATION RESULT */}
            {currentStep > TOTAL_STEPS && recommendation && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5"
              >
                {/* Result Top Hero */}
                <div
                  className={`p-5 rounded-2xl border ${
                    recommendation.isBeyondStandardPlans
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : recommendation.recommendedPlanKey === 'GROWTH'
                      ? 'bg-gradient-to-b from-amber-500/15 via-zinc-900/90 to-zinc-950 border-amber-500/60 shadow-xl shadow-amber-500/10'
                      : 'bg-gradient-to-b from-primary/15 via-zinc-900/90 to-zinc-950 border-primary/50 shadow-xl shadow-primary/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                        Your recommended plan
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2 mt-0.5">
                        {recommendation.planName.toUpperCase()}
                        {recommendation.recommendedPlanKey === 'GROWTH' && (
                          <Badge className="bg-amber-500 text-zinc-950 text-[10px] font-black uppercase px-2 py-0.5">
                            <Zap className="w-3 h-3 fill-current mr-1" />
                            Best Match
                          </Badge>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {recommendation.isBeyondStandardPlans
                          ? 'Your requirements go beyond our standard plans.'
                          : 'Based on the information you provided, this plan currently fits your business requirements without overpaying.'}
                      </p>
                    </div>

                    {!recommendation.isBeyondStandardPlans && (
                      <div className="sm:text-right shrink-0">
                        <div className="text-2xl font-black text-foreground font-mono">
                          {recommendation.recommendedPlanKey === 'FREE'
                            ? '₹0'
                            : `₹${PLAN_CONFIGS[recommendation.recommendedPlanKey as PlanType]?.priceMonthly.toLocaleString('en-IN')}`}
                          <span className="text-xs text-muted-foreground font-normal">/month</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {PLAN_CONFIGS[recommendation.recommendedPlanKey as PlanType]?.priceSubtext}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transparent Business Comparison */}
                <div className="p-4 rounded-xl border border-border/60 bg-secondary/20 space-y-2.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                    Your Business Requirements:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-border/40">
                      <span className="text-muted-foreground text-[10px] block">Products</span>
                      <span className="font-bold text-foreground">{recommendation.userSummary.productEstimate}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-border/40">
                      <span className="text-muted-foreground text-[10px] block">Monthly Orders</span>
                      <span className="font-bold text-foreground">{recommendation.userSummary.orderEstimate}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-border/40">
                      <span className="text-muted-foreground text-[10px] block">Shopify Stores</span>
                      <span className="font-bold text-foreground">
                        {recommendation.userSummary.shopifyStoresEstimate === 0 ? 'None / CSV' : `${recommendation.userSummary.shopifyStoresEstimate} Store`}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-border/40">
                      <span className="text-muted-foreground text-[10px] block">Team Access</span>
                      <span className="font-bold text-foreground">{recommendation.userSummary.teamSizeEstimate}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground pt-1">
                    <strong className="text-foreground">Primary Needs:</strong>{' '}
                    {recommendation.userSummary.primaryNeeds.join(' • ')}
                  </div>
                </div>

                {/* Plan Capacity & Fit Visualization */}
                <div className="p-4 rounded-xl border border-border/60 bg-secondary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                      Capacity & Utilization Fit
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Your requirements → Plan capacity → Plan fit
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {recommendation.metrics.map((m) => (
                      <div key={m.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">{m.label}</span>
                          <span className="font-mono text-[11px] font-bold text-foreground">
                            {m.requiredDisplay} <span className="text-muted-foreground/60 font-normal">/ {m.capacityDisplay}</span>
                          </span>
                        </div>
                        <Progress
                          value={m.percentage}
                          className={`h-1.5 ${
                            !m.isWithinLimit ? 'bg-destructive/20 [&>div]:bg-destructive' : 'bg-zinc-800'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Why this plan? Checklist */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Why this plan?
                  </h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {recommendation.whyThisPlan.map((reason, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="text-zinc-200">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  {recommendation.isBeyondStandardPlans ? (
                    <a
                      href="mailto:support@analyzeup.com?subject=AnalyzeUp%20Enterprise%20Inquiry"
                      className="w-full sm:flex-1"
                    >
                      <Button className="w-full h-10 text-xs font-bold gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-black shadow-lg shadow-amber-500/25">
                        <Mail className="w-3.5 h-3.5" /> Talk to AnalyzeUp
                      </Button>
                    </a>
                  ) : (
                    <Button
                      onClick={() => {
                        onSelectPlan(recommendation.recommendedPlanKey as PlanType);
                        onClose();
                      }}
                      className={`w-full sm:flex-1 h-10 text-xs font-bold gap-1.5 ${
                        recommendation.recommendedPlanKey === 'GROWTH'
                          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-zinc-950 font-black shadow-lg shadow-amber-500/25'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold'
                      }`}
                    >
                      <span>Choose {recommendation.planName} Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="w-full sm:w-auto h-10 text-xs font-medium border-border/80 gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" /> Retake Questionnaire
                  </Button>

                  {onViewComparison && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onClose();
                        onViewComparison();
                      }}
                      className="w-full sm:w-auto h-10 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Compare All Features
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer Controls (Steps 1-7) */}
        {currentStep <= TOTAL_STEPS && (
          <div className="p-4 sm:p-5 border-t border-border/40 bg-zinc-900/30 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="text-xs h-9 rounded-xl border-border/60"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>

            <Button
              size="sm"
              onClick={handleNext}
              disabled={!isStepValid()}
              className="text-xs h-9 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {currentStep === TOTAL_STEPS ? (
                <>
                  See My Plan <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              ) : (
                <>
                  Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
