"use client";

import { useData } from "@/context/data-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SubscriptionModal() {
  const {
    activePlan,
    isProcessingPayment,
    showSubscriptionModal,
    setShowSubscriptionModal,
    handleUpgrade,
  } = useData();

  if (!showSubscriptionModal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowSubscriptionModal(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-lg"
        />

        {/* Modal Content container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-5xl bg-card/80 border border-border shadow-2xl rounded-3xl overflow-hidden z-10 max-h-[90vh] flex flex-col backdrop-blur-md"
        >
          {/* Close button */}
          <button
            onClick={() => setShowSubscriptionModal(false)}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
            aria-label="Close subscription modal"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="p-6 md:p-10 overflow-y-auto">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-3 border-primary/30 text-primary px-3 py-1 font-semibold uppercase tracking-wider text-xs">
                Pricing Plans
              </Badge>
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                Billing & Subscriptions
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Manage your workspace subscription plan. Choose the perfect tier to grow your business.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mt-4">
              {/* Plan 1: Free Trial */}
              <div
                className={`flex flex-col justify-between p-6 rounded-2xl border ${
                  activePlan === "Free Trial"
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/5"
                    : "border-border bg-card/50"
                } transition-all duration-300 relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg">Free Trial</span>
                    {activePlan === "Free Trial" && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary border border-primary/20">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold mb-4">
                    ₹0{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Up to 50 products
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Inventory, Orders & Suppliers
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Core CSV import/export
                    </li>
                    <li className="flex items-center gap-2.5 text-muted-foreground/50">
                      <X className="h-4 w-4 shrink-0 text-muted-foreground/40" /> Today's AI Brief & Chat locked
                    </li>
                  </ul>
                </div>
                <Button variant="outline" disabled={activePlan === "Free Trial"} className="w-full mt-auto">
                  {activePlan === "Free Trial" ? "Current Plan" : "Downgrade"}
                </Button>
              </div>

              {/* Plan 2: Starter Plan */}
              <div
                className={`flex flex-col justify-between p-6 rounded-2xl border ${
                  activePlan === "Starter Plan"
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/5"
                    : "border-border bg-card/50"
                } transition-all duration-300 relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg">Starter Plan</span>
                    {activePlan === "Starter Plan" && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary border border-primary/20">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold mb-4">
                    ₹499{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Up to 500 products
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Today's AI Brief unlocked
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> AI Reorder Alerts unlocked
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Chat Widget & Copilot unlocked
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Dynamic CSV exports
                    </li>
                  </ul>
                </div>
                <Button
                  onClick={() => handleUpgrade("starter_monthly", 499, "Starter Plan")}
                  disabled={activePlan === "Starter Plan" || isProcessingPayment !== null}
                  className={`w-full mt-auto ${
                    activePlan === "Starter Plan"
                      ? ""
                      : "bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-all"
                  }`}
                >
                  {isProcessingPayment === "starter_monthly" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : activePlan === "Starter Plan" ? (
                    "Current Plan"
                  ) : (
                    "Upgrade to Starter"
                  )}
                </Button>
              </div>

              {/* Plan 3: Pro Plan */}
              <div
                className={`flex flex-col justify-between p-6 rounded-2xl border ${
                  activePlan === "Pro Plan"
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/5"
                    : "border-border bg-card/50"
                } transition-all duration-300 relative overflow-hidden`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg">Pro Plan</span>
                    {activePlan === "Pro Plan" && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary border border-primary/20">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold mb-4">
                    ₹999{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Unlimited products
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Everything in Starter
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Advanced AI Advisor & Strategy
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Business Health Score & Insights
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Premium PDF downloads
                    </li>
                  </ul>
                </div>
                <Button
                  onClick={() => handleUpgrade("pro_monthly", 999, "Pro Plan")}
                  disabled={activePlan === "Pro Plan" || isProcessingPayment !== null}
                  className={`w-full mt-auto ${
                    activePlan === "Pro Plan"
                      ? ""
                      : "bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-all"
                  }`}
                >
                  {isProcessingPayment === "pro_monthly" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : activePlan === "Pro Plan" ? (
                    "Current Plan"
                  ) : (
                    "Upgrade to Pro"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
