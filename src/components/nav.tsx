"use client";

import { usePathname, useSearchParams } from "next/navigation";
import React, { useState, useRef, useMemo, Suspense } from "react";
import {
  Boxes,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  BarChart3,
  Sparkles,
  Activity,
  RefreshCw,
  Layers,
  TrendingUp,
  Crown,
  PackageX,
  Coins,
  ClipboardList,
  FlaskConical,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronRight,
  Rocket,
  CreditCard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnalyzeUpIcon } from "./analyze-up-icon";
import { motion, AnimatePresence } from "framer-motion";
import { SheetClose } from "@/components/ui/sheet";
import { useData } from "@/context/data-context";
import { computeBusinessHealth } from "@/lib/command-center-engine";

export interface SubNavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: SubNavItem[];
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    href: "/dashboard/inventory",
    icon: Boxes,
    label: "Operations",
    children: [
      {
        href: "/dashboard/inventory",
        label: "Inventory Stock",
        description: "SKUs, stock levels, costs, prices & reorder thresholds",
        icon: Boxes,
      },
      {
        href: "/dashboard/orders",
        label: "Orders & Inbound POs",
        description: "Sales transactions, purchase orders & order ledger",
        icon: ShoppingCart,
      },
      {
        href: "/dashboard/returns",
        label: "Customer Returns",
        description: "Defect analytics, customer refunds & return diagnostics",
        icon: PackageX,
      },
    ],
  },
  {
    href: "/dashboard/suppliers",
    icon: Truck,
    label: "Suppliers",
    children: [
      {
        href: "/dashboard/suppliers?tab=suppliers",
        label: "Vendor Intelligence",
        description: "Supplier performance, delivery SLAs & lead times",
        icon: Truck,
      },
      {
        href: "/dashboard/suppliers?tab=savings",
        label: "Cost Savings Arbitrage",
        description: "Identify alternative suppliers & reduce procurement spend",
        icon: Coins,
      },
    ],
  },
  {
    href: "/dashboard/executive",
    icon: Crown,
    label: "Executive",
    children: [
      {
        href: "/dashboard/executive?tab=overview",
        label: "Executive Overview",
        description: "C-suite strategic brief, KPIs & period comparisons",
        icon: Crown,
      },
      {
        href: "/dashboard/executive?tab=forecasting",
        label: "Demand Forecasting",
        description: "Predictive sales velocity & 30-day stockout projections",
        icon: TrendingUp,
      },
      {
        href: "/dashboard/executive?tab=growth",
        label: "Growth & Retention",
        description: "Repeat purchasing rates, customer RFM & churn alerts",
        icon: Rocket,
      },
      {
        href: "/dashboard/executive?tab=simulation",
        label: "AI Strategy Lab",
        description: "Model price adjustments, bulk POs & risk-free scenarios",
        icon: FlaskConical,
      },
      {
        href: "/dashboard/executive?tab=team",
        label: "Team & Governance",
        description: "Manage workspace members, roles & permissions",
        icon: Users,
      },
    ],
  },
  {
    href: "/dashboard/integrations",
    icon: Layers,
    label: "Connect",
  },
  {
    href: "/dashboard/insights",
    icon: BarChart3,
    label: "Insights & Health",
    children: [
      {
        href: "/dashboard/insights?tab=insights",
        label: "Financial Insights",
        description: "Gross revenue, COGS, margins & profit breakdown",
        icon: BarChart3,
      },
      {
        href: "/dashboard/insights?tab=health",
        label: "Business Health Quotient",
        description: "Algorithmic 100-point quotient across 5 health pillars",
        icon: Activity,
      },
    ],
  },
  {
    href: "/dashboard/billing",
    icon: CreditCard,
    label: "Pricing",
  },
];

function NavContent({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { products, transactions, suppliers, returns, isLimitExceeded, activePlan, setShowSubscriptionModal } = useData();

  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [mobileExpandedLabel, setMobileExpandedLabel] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const healthSummary = useMemo(() => {
    return computeBusinessHealth(products, transactions, suppliers, returns);
  }, [products, transactions, suppliers, returns]);

  const healthLogoColor = useMemo(() => {
    return healthSummary.color;
  }, [healthSummary.color]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const isPremiumRoute =
      href.startsWith("/dashboard/insights") ||
      href.startsWith("/dashboard/business-health");

    const isLocked = isPremiumRoute && (activePlan !== "Pro Plan" || isLimitExceeded);

    if (isLocked) {
      e.preventDefault();
      setShowSubscriptionModal(true);
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.label === 'Dashboard') {
      return pathname === '/dashboard';
    }
    if (item.label === 'Operations') {
      return pathname.startsWith('/dashboard/inventory') || pathname.startsWith('/dashboard/orders') || pathname.startsWith('/dashboard/returns') || pathname.startsWith('/dashboard/forecasting');
    }
    if (item.label === 'Suppliers') {
      return pathname.startsWith('/dashboard/suppliers');
    }
    if (item.label === 'Executive') {
      return pathname.startsWith('/dashboard/executive');
    }
    if (item.label === 'Connect') {
      return pathname.startsWith('/dashboard/integrations');
    }
    if (item.label === 'Insights & Health') {
      return pathname.startsWith('/dashboard/insights') || pathname.startsWith('/dashboard/business-health');
    }
    if (item.label === 'Pricing') {
      return pathname.startsWith('/dashboard/billing');
    }
    return pathname === item.href;
  };

  const isChildItemActive = (parentItem: (typeof navItems)[number], childHref: string) => {
    if (!isItemActive(parentItem)) return false;
    const [childPath, childQuery] = childHref.split('?');
    if (pathname !== childPath) return false;
    if (!childQuery) {
      const currentTab = searchParams?.get('tab');
      return !currentTab || currentTab === 'overview' || currentTab === 'suppliers' || currentTab === 'insights';
    }
    const childParams = new URLSearchParams(childQuery);
    const expectedTab = childParams.get('tab');
    return searchParams?.get('tab') === expectedTab;
  };

  const handleMouseEnter = (label: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setHoveredLabel(label);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredLabel(null);
    }, 150);
  };

  if (isMobile) {
    return (
      <nav className="grid gap-2 text-lg font-medium">
        <SheetClose asChild>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-semibold mb-4"
          >
            <AnalyzeUpIcon className="h-6 w-6" healthColor={healthLogoColor} />
            <span>AnalyzeUp</span>
          </Link>
        </SheetClose>
        {navItems.map((item) => {
          const active = isItemActive(item);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = mobileExpandedLabel === item.label;

          return (
            <div key={item.href} className="space-y-1">
              <div className="flex items-center justify-between">
                <SheetClose asChild={!hasChildren}>
                  <Link
                    href={item.href}
                    data-tour={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-foreground/70 transition-all hover:text-primary flex-1",
                      active && "text-primary bg-primary/10 font-bold"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SheetClose>

                {hasChildren && (
                  <button
                    onClick={() => setMobileExpandedLabel(isExpanded ? null : item.label)}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                  </button>
                )}
              </div>

              {hasChildren && isExpanded && (
                <div className="pl-6 space-y-1 border-l-2 border-primary/20 ml-4 py-1">
                  {item.children!.map((child, cIdx) => {
                    const isChildActive = isChildItemActive(item, child.href);
                    return (
                      <SheetClose key={cIdx} asChild>
                        <Link
                          href={child.href}
                          onClick={(e) => handleNavClick(e, child.href)}
                          className={cn(
                            "flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors",
                            isChildActive && "text-primary font-bold bg-primary/10"
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5 text-primary/80" />
                          <span>{child.label}</span>
                        </Link>
                      </SheetClose>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  const getDropdownAlignmentClass = (label: string) => {
    if (label === 'Insights & Health') {
      return 'right-0';
    }
    if (label === 'Executive') {
      return 'right-0 xl:right-auto xl:left-1/2 xl:-translate-x-1/2 2xl:left-1/2 2xl:-translate-x-1/2';
    }
    if (label === 'Connect') {
      return 'right-0 xl:right-auto xl:left-1/2 xl:-translate-x-1/2';
    }
    if (label === 'Suppliers') {
      return 'left-0 xl:left-1/2 xl:-translate-x-1/2';
    }
    if (label === 'Operations') {
      return 'left-0';
    }
    return 'left-1/2 -translate-x-1/2';
  };

  return (
    <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 text-xs xl:text-sm font-semibold whitespace-nowrap max-w-full overflow-x-auto scrollbar-none py-1">
      {navItems.map((item) => {
        const active = isItemActive(item);
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isHovered = hoveredLabel === item.label;

        return (
          <div
            key={item.href}
            className="relative shrink-0"
            onMouseEnter={() => hasChildren && handleMouseEnter(item.label)}
            onMouseLeave={hasChildren ? handleMouseLeave : undefined}
          >
            <div className="flex items-center">
              <Link
                href={item.href}
                data-tour={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={(e) => handleNavClick(e, item.href)}
                className={cn(
                  "group flex items-center gap-1 transition-all duration-200 hover:text-foreground/90 px-2 xl:px-3.5 py-1.5 rounded-full cursor-pointer relative whitespace-nowrap shrink-0",
                  active ? "text-accent-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>
                  {item.label === 'Insights & Health' ? (
                    <>
                      Insights<span className="hidden xl:inline"> & Health</span>
                    </>
                  ) : (
                    item.label
                  )}
                </span>
                {active && (
                  <motion.span
                    layoutId="active-nav-link"
                    className="absolute inset-0 bg-black/20 dark:bg-white/10 backdrop-blur-sm rounded-full -z-10 border border-border/40 shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHoveredLabel(isHovered ? null : item.label);
                  }}
                  aria-label={`Toggle ${item.label} menu`}
                  className="p-1 -ml-1 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform duration-200 opacity-60 hover:opacity-100",
                      isHovered && "rotate-180 text-primary opacity-100"
                    )}
                  />
                </button>
              )}
            </div>

            {/* Hover Dropdown Menu */}
            {hasChildren && (
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className={cn(
                      "absolute top-full pt-2 z-50 pointer-events-auto",
                      getDropdownAlignmentClass(item.label)
                    )}
                  >
                    <div className="w-[calc(100vw-2rem)] sm:w-72 lg:w-80 max-w-[calc(100vw-2rem)] rounded-2xl ios-glass border border-border/50 shadow-2xl p-2 bg-background/95 backdrop-blur-xl space-y-1">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 border-b border-border/30 pb-1.5 mb-1">
                        <span>{item.label} Modules</span>
                      </div>

                      {item.children!.map((child, idx) => {
                        const isChildActive = isChildItemActive(item, child.href);
                        return (
                          <Link
                            key={idx}
                            href={child.href}
                            onClick={(e) => {
                              setHoveredLabel(null);
                              handleNavClick(e, child.href);
                            }}
                            className={cn(
                              "flex items-start gap-2.5 p-2 rounded-xl transition-all group hover:bg-secondary/70 cursor-pointer border border-transparent",
                              isChildActive && "bg-primary/10 border-primary/20"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-xl transition-all shrink-0 mt-0.5 shadow-sm",
                              isChildActive
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                : "bg-secondary/60 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105"
                            )}>
                              <child.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-xs font-bold text-foreground group-hover:text-primary transition-colors block truncate",
                                  isChildActive && "text-primary font-bold"
                                )}>
                                  {child.label}
                                </span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                              </div>
                              <p className="text-[10.5px] text-muted-foreground leading-snug line-clamp-1 mt-0.5 group-hover:text-muted-foreground/90">
                                {child.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function Nav({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <Suspense fallback={<nav className="h-9 w-64 bg-secondary/20 rounded-xl animate-pulse" />}>
      <NavContent isMobile={isMobile} />
    </Suspense>
  );
}
