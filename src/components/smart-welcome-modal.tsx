'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import { getIndustryConfig } from '@/lib/industry-intelligence';
import { Sparkles, Package, Truck, IndianRupee, AlertTriangle, ArrowRight, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SmartWelcomeModal() {
  const { showWelcomeModal, setShowWelcomeModal, businessProfile, products, suppliers, categories } = useData();
  const router = useRouter();

  if (!showWelcomeModal) return null;

  const industry = getIndustryConfig(businessProfile?.businessType);
  const totalInventoryValue = products.reduce((acc, p) => acc + ((p.price || 0) * (p.stock || 0)), 0);
  const lowStockCount = products.filter(p => p.stock <= (p.minStock || 5)).length;

  const formattedVal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: businessProfile?.currency?.includes('USD') ? 'USD' : 'INR',
    maximumFractionDigits: 0,
  }).format(totalInventoryValue);

  return (
    <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg max-h-[88vh] flex flex-col ios-glass rounded-3xl border border-primary/20 p-5 sm:p-6 shadow-2xl overflow-hidden gap-0">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        {/* Header - Fixed & Pinned */}
        <DialogHeader className="text-left space-y-1.5 shrink-0 pr-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15 text-primary border border-primary/25 shrink-0">
              <Sparkles className="w-4 h-4 animate-pulse text-primary" />
            </div>
            <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 rounded-full font-semibold">
              AI Business Copilot Ready
            </Badge>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight pt-0.5">
            Welcome to AnalyzeUp!
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Your business profile for <span className="font-semibold text-foreground">{businessProfile?.businessName || 'Your Business'}</span> has been initialized.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body - Takes available space */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5 py-2 pr-1 [scrollbar-width:thin]">
          {/* Business Type Badge & Focus */}
          <div className="p-3 rounded-2xl bg-secondary/50 border border-border/40 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Business Type & Industry</span>
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate block">{industry.label}</span>
            </div>
            <Badge className="bg-primary/20 text-primary hover:bg-primary/25 border-primary/30 text-[11px] px-2.5 py-0.5 shrink-0 font-semibold">
              {businessProfile?.businessSize || 'Solo / SMB'}
            </Badge>
          </div>

          {/* Business Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-2xl bg-secondary/30 border border-border/30 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                Products Catalog
              </div>
              <p className="text-lg font-bold font-mono">{products.length}</p>
            </div>

            <div className="p-3 rounded-2xl bg-secondary/30 border border-border/30 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
                Active Suppliers
              </div>
              <p className="text-lg font-bold font-mono">{suppliers.length}</p>
            </div>

            <div className="p-3 rounded-2xl bg-secondary/30 border border-border/30 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <IndianRupee className="w-3.5 h-3.5 text-primary shrink-0" />
                Inventory Valuation
              </div>
              <p className="text-base sm:text-lg font-bold text-primary font-mono truncate">{formattedVal}</p>
            </div>

            <div className="p-3 rounded-2xl bg-secondary/30 border border-border/30 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                Low Stock Alerts
              </div>
              <p className="text-base sm:text-lg font-bold text-destructive font-mono">{lowStockCount} Items</p>
            </div>
          </div>

          {/* AI Active Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border border-primary/20 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shrink-0 shadow-md">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-0.5 min-w-0">
              <p className="font-semibold text-foreground text-xs">The AI Copilot is now analyzing your business.</p>
              <p className="text-muted-foreground text-[11px] leading-snug line-clamp-2">{industry.aiPriority}</p>
            </div>
          </div>
        </div>

        {/* Pinned Action Buttons Footer - Always visible, never cut off */}
        <div className="shrink-0 pt-3 border-t border-border/40 flex flex-col sm:flex-row gap-2 mt-auto">
          <Button
            variant="outline"
            onClick={() => setShowWelcomeModal(false)}
            className="rounded-xl text-xs flex-1 h-9 sm:h-10 border-border/60 hover:bg-secondary font-semibold"
          >
            Explore Dashboard
          </Button>
          <Button
            onClick={() => {
              setShowWelcomeModal(false);
              window.dispatchEvent(new CustomEvent('analyzeup_open_copilot', { detail: { query: 'What should I focus on today?' } }));
            }}
            className="rounded-xl text-xs flex-1 h-9 sm:h-10 gap-1.5 bg-primary text-primary-foreground font-bold shadow-lg hover:brightness-110"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Launch AI Copilot
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
