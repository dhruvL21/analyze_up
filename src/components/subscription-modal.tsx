"use client";

import React, { useState } from "react";
import { useData } from "@/context/data-context";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  RotateCcw,
  CreditCard,
  ArrowRight,
  Ticket,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ORDERED_PLANS, PLAN_CONFIGS, PlanType } from "@/lib/saas-engine";
import PlanFeatureComparisonTable from "@/components/plan-feature-comparison-table";
import { PricingPlanCard } from "@/components/pricing-plan-card";
import { FindMyPlanModal } from "@/components/find-my-plan-modal";
import { AskPricingAiModal } from "@/components/ask-pricing-ai-modal";

export default function SubscriptionModal() {
  const {
    activePlan,
    isProcessingPayment,
    showSubscriptionModal,
    setShowSubscriptionModal,
    handleUpgrade,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    updateActivePlan,
  } = useData();

  const [viewMode, setViewMode] = useState<"cards" | "comparison">("cards");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isFindMyPlanOpen, setIsFindMyPlanOpen] = useState<boolean>(false);
  const [isAskAiOpen, setIsAskAiOpen] = useState<boolean>(false);
  const [couponInput, setCouponInput] = useState<string>("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const resolvedPlanKey: PlanType = React.useMemo(() => {
    if (activePlan === "Scale" || activePlan === "SCALE" || activePlan === "Enterprise Pro" || activePlan === "Pro Plan" || activePlan === "PRO") return "PRO";
    if (activePlan === "Growth" || activePlan === "Growth Plan" || activePlan === "GROWTH") return "GROWTH";
    if (activePlan === "Founder" || activePlan === "FOUNDER" || activePlan === "Starter Plan" || activePlan === "STARTER") return "STARTER";
    return "FREE";
  }, [activePlan]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const targetCode = (codeToApply || couponInput).trim();
    if (!targetCode) {
      setCouponError("Please enter a promo code.");
      return;
    }
    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const res = await applyCoupon(targetCode);
      if (res.success) {
        setCouponInput("");
      } else {
        setCouponError(res.message);
      }
    } catch (e: any) {
      setCouponError(e.message || "Failed to apply coupon.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handlePlanUpgrade = async (key: PlanType) => {
    if (key === resolvedPlanKey && !appliedCoupon) return;
    const plan = PLAN_CONFIGS[key];

    // If coupon is active and selecting Scale, activate without payment
    if (appliedCoupon && (key === "PRO" || key === "SCALE")) {
      await updateActivePlan("Scale");
      setShowSubscriptionModal(false);
      return;
    }
    if (key === "FREE") {
      await updateActivePlan("Free");
      setShowSubscriptionModal(false);
      return;
    }

    const isAnnual = billingCycle === "annual";
    const amount = isAnnual ? plan.priceYearly : plan.priceMonthly;
    const planId = `${key.toLowerCase()}_${billingCycle}`;
    handleUpgrade(planId, amount, plan.name);
  };

  return (
    <>
      <AnimatePresence>
        {showSubscriptionModal && (
          <div
            key="subscription-modal-wrapper"
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          >
            {/* Deep Cinematic Backdrop */}
            <motion.div
              key="subscription-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSubscriptionModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl"
            />

            {/* Modal Container */}
            <motion.div
              key="subscription-modal-container"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-6xl bg-zinc-950/95 border border-border/80 shadow-[0_25px_70px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden z-10 max-h-[94vh] flex flex-col backdrop-blur-2xl"
            >
              {/* Top Glowing Ambient Accents */}
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-48 bg-primary/20 rounded-full blur-[100px] pointer-events-none -z-10" />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

              {/* Close Button */}
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border/40 transition-all duration-200 z-20 group"
                aria-label="Close subscription modal"
              >
                <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
              </button>

              <div className="p-4 sm:p-6 md:p-7 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 space-y-4">
                {/* Header Section */}
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-bold uppercase tracking-widest">
                    <Sparkles className="w-3 h-3" />
                    Pricing & Plans
                  </div>
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-foreground tracking-tight">
                    Choose Your Workspace Plan
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    Transparent pricing tailored to your business scale with zero hidden fees.
                  </p>

                  {/* Toggles Bar: [ Plans | Compare Features ] & [ Monthly | Yearly ] */}
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center p-1 rounded-2xl bg-secondary/50 border border-border/60 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setViewMode("cards")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          viewMode === "cards"
                            ? "bg-card text-foreground shadow-md border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Plans
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("comparison")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          viewMode === "comparison"
                            ? "bg-card text-foreground shadow-md border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Compare Features
                      </button>
                    </div>

                    {/* Monthly / Yearly Billing Toggle */}
                    <div className="flex items-center p-1 rounded-2xl bg-secondary/50 border border-border/60 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setBillingCycle("monthly")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          billingCycle === "monthly"
                            ? "bg-card text-foreground shadow-md border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle("annual")}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          billingCycle === "annual"
                            ? "bg-card text-foreground shadow-md border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span>Yearly</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                          Save ~2 months
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Promo Code Input Bar */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">
                          {appliedCoupon ? `Promo Code Applied: ${appliedCoupon}` : "Have a promo code?"}
                        </span>
                        {appliedCoupon ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 text-[9px] font-black uppercase">
                            100% Free
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase">
                            Scale Only
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {appliedCoupon
                          ? "Promo code active. Full access to Scale plan is unlocked."
                          : "Enter your promo code to unlock Scale 100% free."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                    {appliedCoupon ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await removeCoupon();
                        }}
                        className="h-8 text-xs rounded-xl border-border/60 hover:text-destructive hover:bg-destructive/10"
                      >
                        Remove Code
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => {
                            setCouponInput(e.target.value.toUpperCase());
                            setCouponError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
                          }}
                          placeholder="Enter promo code"
                          className="h-8 px-2.5 rounded-xl bg-background/80 border border-border/80 text-xs font-mono font-bold uppercase w-36 sm:w-44 focus:border-emerald-500 focus:outline-none"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleApplyCoupon()}
                          disabled={isApplyingCoupon || !couponInput.trim()}
                          className="h-8 px-3 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {isApplyingCoupon ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {couponError && (
                  <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {couponError}
                  </p>
                )}

                {/* View Mode 1: 4 Pricing Cards Grid */}
                {viewMode === "cards" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                      {ORDERED_PLANS.map((key) => {
                        const plan = PLAN_CONFIGS[key];
                        const isCurrent = key === resolvedPlanKey;
                        const isProcessing = Boolean(
                          isProcessingPayment &&
                          isProcessingPayment.toLowerCase().includes(key.toLowerCase())
                        );

                        return (
                          <PricingPlanCard
                            key={`pricing-card-${key}`}
                            planKey={key}
                            plan={plan}
                            isCurrent={isCurrent}
                            billingCycle={billingCycle}
                            appliedCoupon={appliedCoupon}
                            isProcessing={isProcessing}
                            onSelect={(k) => handlePlanUpgrade(k)}
                          />
                        );
                      })}
                    </div>

                    {/* Quick Assistance Actions */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsFindMyPlanOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors py-1.5 px-3.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/60 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Find My Plan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAskAiOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-950 transition-colors py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-extrabold shadow-sm"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Ask AnalyzeUp AI</span>
                      </button>
                    </div>

                    {/* Quick toggle link to comparison table */}
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setViewMode("comparison")}
                        className="text-xs font-bold text-primary hover:text-primary/80 hover:underline inline-flex items-center gap-1.5 transition-colors py-1 px-3 rounded-lg hover:bg-primary/5"
                      >
                        Compare all features & limits in detail <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode 2: Detailed Feature Comparison Matrix */
                  <div className="space-y-3">
                    <PlanFeatureComparisonTable
                      billingCycle={billingCycle}
                      currentPlanKey={resolvedPlanKey}
                      appliedCoupon={appliedCoupon}
                      onSelectUpgrade={handlePlanUpgrade}
                      isProcessingPayment={isProcessingPayment}
                    />
                  </div>
                )}

                {/* Trust & Guarantee Strip */}
                <div className="pt-3 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-[10px] text-muted-foreground">
                  <div className="flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>256-Bit Encryption</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Instant Activation</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <RotateCcw className="w-3 h-3 text-blue-400" />
                    <span>Cancel Anytime</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <CreditCard className="w-3 h-3 text-purple-400" />
                    <span>Razorpay Verified</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Plan Selection Assistance Modals */}
      <FindMyPlanModal
        isOpen={isFindMyPlanOpen}
        onClose={() => setIsFindMyPlanOpen(false)}
        onSelectPlan={(k) => handlePlanUpgrade(k)}
        onViewComparison={() => setViewMode("comparison")}
      />

      <AskPricingAiModal
        isOpen={isAskAiOpen}
        onClose={() => setIsAskAiOpen(false)}
        onSelectPlan={(k) => handlePlanUpgrade(k)}
        onViewComparison={() => setViewMode("comparison")}
      />
    </>
  );
}
