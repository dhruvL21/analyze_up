"use client";

import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  BarChart3,
  Sparkles,
  Activity,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnalyzeUpIcon } from "./analyze-up-icon";
import { motion } from "framer-motion";
import { SheetClose } from "@/components/ui/sheet";
import { useData } from "@/context/data-context";

const navItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    href: "/dashboard/inventory",
    icon: Boxes,
    label: "Inventory",
  },
  {
    href: "/dashboard/orders",
    icon: ShoppingCart,
    label: "Order",
  },
  {
    href: "/dashboard/suppliers",
    icon: Truck,
    label: "Suppliers",
  },
  {
    href: "/dashboard/ai-advisor",
    icon: Sparkles,
    label: "AI Advisor",
  },
  {
    href: "/dashboard/insights",
    icon: BarChart3,
    label: "Insights",
  },
  {
    href: "/dashboard/business-health",
    icon: Activity,
    label: "Business Health",
  },
];

export default function Nav({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { isLimitExceeded, activePlan, setShowSubscriptionModal } = useData();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const isPremiumRoute =
      href.startsWith("/dashboard/ai-advisor") ||
      href.startsWith("/dashboard/insights") ||
      href.startsWith("/dashboard/business-health");

    const isLocked = isPremiumRoute && (activePlan !== "Pro Plan" || isLimitExceeded);

    if (isLocked) {
      e.preventDefault();
      setShowSubscriptionModal(true);
    }
  };

  if (isMobile) {
    return (
        <nav className="grid gap-2 text-lg font-medium">
            <SheetClose asChild>
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-xl font-semibold mb-4"
                >
                    <AnalyzeUpIcon className="h-6 w-6 text-primary" />
                    <span>AnalyzeUp</span>
                </Link>
            </SheetClose>
            {navItems.map((item) => (
                <SheetClose key={item.href} asChild>
                    <Link
                        href={item.href}
                        onClick={(e) => handleNavClick(e, item.href)}
                        className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-foreground/70 transition-all hover:text-primary",
                            pathname === item.href && "text-primary bg-primary/10"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </Link>
                </SheetClose>
            ))}
        </nav>
    );
  }

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
      {navItems.map((item) => (
        <Link 
            key={item.href}
            href={item.href}
            onClick={(e) => handleNavClick(e, item.href)}
            className={cn("transition-all duration-200 hover:text-foreground/80 px-4 py-2 rounded-full cursor-pointer relative hover:scale-105",
                pathname === item.href ? "text-accent-foreground" : "text-muted-foreground"
            )}
        >
          {item.label}
          {pathname === item.href && (
            <motion.span
              layoutId="active-nav-link"
              className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-full -z-10 border border-white/10 shadow-md"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
        </Link>
      ))}
    </nav>
  );
}
