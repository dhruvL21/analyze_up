'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import { useRouter } from 'next/navigation';
import { Sparkles, FileSpreadsheet, ShoppingBag, PlusCircle, Zap, ArrowRight, Loader2 } from 'lucide-react';

export function EmptyStateIntelligence() {
  const { loadDemoBusiness, setShowShopifyModal, businessProfile, isLoadingDemo } = useData();
  const router = useRouter();

  return (
    <Card className="ios-glass rounded-3xl border border-border/50 p-6 md:p-8 shadow-2xl overflow-hidden relative text-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <CardContent className="p-0 space-y-6 max-w-2xl mx-auto">
        <div className="p-4 rounded-3xl bg-primary/15 text-primary border border-primary/25 w-16 h-16 mx-auto flex items-center justify-center shadow-lg">
          <Sparkles className="w-8 h-8 animate-pulse text-primary" />
        </div>

        <div className="space-y-2">
          <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs px-3 py-1 font-bold">
            AI Copilot Workspace Initialization
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to AnalyzeUp Command Center
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            AnalyzeUp needs business inventory & sales data to generate daily briefings, profit predictions, and health scores.
          </p>
        </div>

        {/* 2-Card Options with Harmonious Matched Styling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left items-stretch">
          {/* Option 1: Demo Business */}
          <div className="p-5 rounded-2xl bg-secondary/40 border border-border/50 hover:border-primary/40 transition-all flex flex-col justify-between gap-4 h-full shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/25">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] px-2.5 py-0.5 font-bold">
                  Instant 1-Click
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Explore Demo Business</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Load 200+ products, 15 suppliers & 500+ sales orders to test AI features instantly.
                </p>
              </div>
            </div>
            <Button
              onClick={() => loadDemoBusiness(businessProfile?.businessType || 'Fashion')}
              disabled={isLoadingDemo}
              className="w-full rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground hover:brightness-110 shadow-md font-semibold h-10 mt-auto"
            >
              {isLoadingDemo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading Demo Business...
                </>
              ) : (
                <>
                  Load Demo Business
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </div>

          {/* Option 2: Bulk Import Catalog */}
          <div className="p-5 rounded-2xl bg-secondary/40 border border-border/50 hover:border-primary/40 transition-all flex flex-col justify-between gap-4 h-full shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/25">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                </div>
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] px-2.5 py-0.5 font-bold">
                  CSV / Excel
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Bulk Import Catalog</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Download our official CSV template and import your existing Excel product lists.
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/dashboard/inventory?action=import')}
              className="w-full rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground hover:brightness-110 shadow-md font-semibold h-10 mt-auto"
            >
              Import CSV File
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
          <Button
            variant="ghost"
            onClick={() => setShowShopifyModal(true)}
            className="rounded-xl text-xs gap-1.5 text-primary hover:bg-primary/10 font-medium"
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Connect Shopify Store
          </Button>

          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/inventory?action=add')}
            className="rounded-xl text-xs gap-1.5 text-primary hover:bg-primary/10 font-medium"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Create Single Product
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
