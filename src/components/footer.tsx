'use client';

import React from 'react';
import Link from 'next/link';
import { AnalyzeUpIcon } from './analyze-up-icon';
import { Button } from './ui/button';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  BarChart3,
  Boxes,
  Truck,
  Crown,
  CreditCard,
  FileText,
  Lock,
  ExternalLink,
} from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-background border-t border-border/40 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Pre-Footer Call to Action Banner */}
      <div className="container px-4 md:px-6 mx-auto pt-16 pb-12">
        <div className="relative rounded-3xl border border-primary/25 bg-gradient-to-br from-card/90 via-secondary/20 to-card/90 p-8 md:p-12 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Next-Gen Retail Intelligence
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                Supercharge Your Business With <span className="text-primary">AnalyzeUp</span>
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base max-w-2xl leading-relaxed">
                Join forward-thinking e-commerce brands and retailers eliminating dead stock, automating reorders, and boosting gross margins with autonomous AI guidance.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 14-Day Free Trial
                </div>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No Credit Card Required
                </div>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Universal Data Import
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center lg:items-end">
              <Link href="/register" className="w-full sm:w-auto lg:w-full">
                <Button size="lg" className="w-full bg-primary text-primary-foreground font-bold hover:brightness-110 shadow-lg shadow-primary/20 gap-2 h-11">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto lg:w-full">
                <Button size="lg" variant="outline" className="w-full border-border/60 hover:bg-secondary/60 text-foreground font-semibold h-11">
                  Explore Live Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Footer Grid */}
      <div className="container px-4 md:px-6 mx-auto pt-8 pb-12 border-t border-border/30">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand & Platform Summary */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2 space-y-3">
            <Link href="/" className="flex items-center gap-2">
              <AnalyzeUpIcon className="h-7 w-7 text-primary" />
              <span className="font-extrabold text-xl tracking-tight text-foreground">AnalyzeUp</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              Autonomous inventory analytics, dead-stock prevention, demand forecasting, and executive decision intelligence copilot designed for growing commerce.
            </p>
          </div>

          {/* Column: Core Modules */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" /> Executive Dashboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard/inventory" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-primary" /> Stock & Operations
                </Link>
              </li>
              <li>
                <Link href="/dashboard/suppliers" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" /> Supplier Network
                </Link>
              </li>
              <li>
                <Link href="/dashboard/executive" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-primary" /> Strategic Intelligence
                </Link>
              </li>
              <li>
                <Link href="/dashboard/billing" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-primary" /> Pricing & Plans
                </Link>
              </li>
            </ul>
          </div>

          {/* Column: Data & Integrations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Integrations</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/dashboard/connect" className="hover:text-primary transition-colors">
                  Shopify Store Sync
                </Link>
              </li>
              <li>
                <Link href="/dashboard/connect" className="hover:text-primary transition-colors">
                  Google Drive Connection
                </Link>
              </li>
              <li>
                <Link href="/dashboard/connect" className="hover:text-primary transition-colors">
                  Zoho Inventory
                </Link>
              </li>
              <li>
                <Link href="/dashboard/connect" className="hover:text-primary transition-colors">
                  Tally ERP Connector
                </Link>
              </li>
              <li>
                <Link href="/dashboard/connect" className="hover:text-primary transition-colors">
                  AI CSV & Excel Parser
                </Link>
              </li>
            </ul>
          </div>

          {/* Column: Trust & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Security & Legal</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors flex items-center gap-1.5 text-left group"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" /> Terms of Service
                  <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors flex items-center gap-1.5 text-left group"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Privacy Policy
                  <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link
                  href="/subscription-terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors flex items-center gap-1.5 text-left group"
                >
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Subscription Terms
                  <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                </Link>
              </li>
              <li>
                <Link href="/dashboard/billing" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-primary" /> Multi-Tenant Isolation
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-primary transition-colors">
                  Create Workspace
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Copyright & Direct Legal Strip (Public Pages - No Login Required) */}
      <div className="border-t border-border/40 bg-secondary/15 py-6">
        <div className="container px-4 md:px-6 mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            &copy; {currentYear} AnalyzeUp Intelligence Platform. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-muted-foreground">
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
            >
              Terms of Service
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">&bull;</span>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
            >
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">&bull;</span>
            <Link
              href="/subscription-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
            >
              Subscription Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
