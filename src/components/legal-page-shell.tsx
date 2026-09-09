'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnalyzeUpIcon } from '@/components/analyze-up-icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Footer } from '@/components/footer';
import {
  FileText,
  ShieldCheck,
  CreditCard,
  Printer,
  ArrowLeft,
  Mail,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';

interface TocItem {
  id: string;
  title: string;
}

interface LegalPageShellProps {
  title: string;
  subtitle: string;
  documentType: 'terms' | 'privacy' | 'subscription';
  lastUpdated: string;
  effectiveDate: string;
  toc: TocItem[];
  children: React.ReactNode;
}

export function LegalPageShell({
  title,
  subtitle,
  documentType,
  lastUpdated,
  effectiveDate,
  toc,
  children,
}: LegalPageShellProps) {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string>(toc[0]?.id || '');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      for (let i = toc.length - 1; i >= 0; i--) {
        const element = document.getElementById(toc[i].id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveId(toc[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [toc]);

  const handlePrint = () => {
    window.print();
  };

  const navLinks = [
    {
      href: '/terms',
      label: 'Terms of Service',
      icon: FileText,
      active: documentType === 'terms',
    },
    {
      href: '/privacy',
      label: 'Privacy Policy',
      icon: ShieldCheck,
      active: documentType === 'privacy',
    },
    {
      href: '/subscription-terms',
      label: 'Subscription Terms',
      icon: CreditCard,
      active: documentType === 'subscription',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl transition-all">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <AnalyzeUpIcon className="h-6 w-6 text-primary group-hover:scale-105 transition-transform" />
              <span className="font-bold text-lg tracking-tight text-foreground">
                AnalyzeUp
              </span>
              <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border/40">
                Legal
              </span>
            </Link>

            {/* Document Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1 bg-secondary/40 p-1 rounded-xl border border-border/30">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      link.active
                        ? 'bg-background text-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 text-xs border-border/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="text-xs font-semibold shadow-sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-t border-border/30 bg-secondary/20 overflow-x-auto scrollbar-none">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                  link.active
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'bg-background/70 text-muted-foreground hover:text-foreground border border-border/40'
                }`}
              >
                <Icon className="w-3 h-3" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Hero Header Section */}
      <section className="relative w-full border-b border-border/40 bg-gradient-to-b from-secondary/30 via-background to-background py-12 md:py-16 overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Home
              </Link>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-xs text-muted-foreground font-medium">Legal Center</span>
              <span className="text-muted-foreground/50">/</span>
              <Badge variant="outline" className="text-[11px] font-semibold tracking-wide uppercase bg-primary/10 border-primary/25 text-primary">
                Official Policy
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              {title}
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
              {subtitle}
            </p>

            {/* Document Metadata Strip */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2 text-xs text-muted-foreground border-t border-border/30">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Last Updated: <strong className="text-foreground font-semibold">{lastUpdated}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Effective Date: <strong className="text-foreground font-semibold">{effectiveDate}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Applies to all AnalyzeUp Workspaces & Shopify Stores</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content & Table of Contents */}
      <main className="flex-1 container mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Sticky Desktop Table of Contents Sidebar */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-6">
            <div className="p-5 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Table of Contents
                </h3>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {toc.length} sections
                </span>
              </div>
              <nav className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 text-xs scrollbar-thin">
                {toc.map((item, idx) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`group flex items-start gap-2.5 px-3 py-2 rounded-lg transition-all ${
                      activeId === item.id
                        ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="leading-snug">{item.title}</span>
                  </a>
                ))}
              </nav>
            </div>

            {/* Quick Contact & Assistance Box */}
            <div className="p-5 rounded-2xl border border-border/40 bg-secondary/20 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" /> Questions or Compliance Needs?
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Our legal and security officers are available to clarify clauses, process GDPR/CCPA requests, or provide enterprise custom agreements.
              </p>
              <a
                href="mailto:support@analyzeup.com"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                support@analyzeup.com <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </aside>

          {/* Main Legal Content Body */}
          <article className="lg:col-span-8 space-y-12 leading-relaxed text-sm md:text-base text-foreground">
            {children}

            {/* Bottom Support & Legal Confirmation Callout */}
            <div className="p-6 md:p-8 rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 to-secondary/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    AnalyzeUp Governance & Merchant Transparency
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    AnalyzeUp is committed to clear, honest, and enterprise-grade operational integrity.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                By maintaining an active AnalyzeUp workspace, connecting an authorized Shopify storefront, or provisioning API credentials, you acknowledge that you have read, understood, and agree to be bound by these provisions and our overarching terms.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href="/dashboard">
                  <Button size="sm" className="text-xs">
                    Return to Dashboard
                  </Button>
                </Link>
                <Link href="/subscription-terms">
                  <Button size="sm" variant="outline" className="text-xs">
                    View Subscription Plans
                  </Button>
                </Link>
                <a
                  href="mailto:support@analyzeup.com"
                  className="text-xs text-muted-foreground hover:text-foreground font-medium ml-auto flex items-center gap-1"
                >
                  Contact Legal Support <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </article>
        </div>
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
