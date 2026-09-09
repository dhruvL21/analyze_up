'use client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { computeBusinessHealth } from '@/lib/command-center-engine';
import { LogOut, Settings, Menu, Sun, Moon, X, LayoutDashboard, Boxes, ShoppingCart, Truck, BarChart3, Sparkles, Activity, RefreshCw, Compass, TrendingUp, Bell, Crown, Layers, CreditCard } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Nav from './nav';
import Link from 'next/link';
import { AnalyzeUpIcon } from './analyze-up-icon';
import { useUser, useAuth } from '@/firebase';
import { signOut } from '@/firebase/auth/auth-service';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useData } from '@/context/data-context';
import { detectBusinessEvents, getStoredEventStatuses } from '@/lib/business-event-engine';
import { NotificationCenterDrawer } from './notification-center-drawer';

const mobileNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/inventory', label: 'Operations', icon: Boxes },
  { href: '/dashboard/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/dashboard/executive', label: 'Executive', icon: Crown },
  { href: '/dashboard/integrations', label: 'Connect', icon: Layers },
  { href: '/dashboard/insights', label: 'Insights & Health', icon: BarChart3 },
  { href: '/dashboard/ai-advisor', label: 'AI Advisor', icon: Sparkles },
  { href: '/dashboard/billing', label: 'Billing & Plan', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [healthTick, setHealthTick] = useState(0);

  const {
    products,
    transactions,
    suppliers,
    orders,
    returns,
    businessProfile,
    activePlan,
    isLimitExceeded,
    setShowSubscriptionModal,
  } = useData();

  useEffect(() => {
    const handleUpdate = () => setHealthTick(t => t + 1);
    window.addEventListener('analyzeup_audit_logged', handleUpdate);
    window.addEventListener('analyzeup_tasks_updated', handleUpdate);
    window.addEventListener('analyzeup_events_updated', handleUpdate);
    return () => {
      window.removeEventListener('analyzeup_audit_logged', handleUpdate);
      window.removeEventListener('analyzeup_tasks_updated', handleUpdate);
      window.removeEventListener('analyzeup_events_updated', handleUpdate);
    };
  }, []);

  const [headerMetrics, setHeaderMetrics] = useState({ activeAlertCount: 0, healthLogoColor: '#10b981' });

  // Event detection runs forecasting, supplier, and customer intelligence. Running
  // it synchronously in the fixed header made every snapshot update block clicks
  // and scrolling on large imports. Schedule it after the current render instead.
  useEffect(() => {
    let cancelled = false;
    const calculate = () => {
      if (cancelled) return;
      const businessEvents = detectBusinessEvents(products, transactions, suppliers, orders, returns, businessProfile);
      const statuses = getStoredEventStatuses();
      const activeAlertCount = businessEvents.filter((event) => (statuses[event.id] || event.status) !== 'RESOLVED').length;
      const healthLogoColor = computeBusinessHealth(products, transactions, suppliers, returns).color;
      if (!cancelled) setHeaderMetrics({ activeAlertCount, healthLogoColor });
    };

    const idleId = window.setTimeout(calculate, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(idleId);
    };
  }, [products, transactions, suppliers, orders, returns, businessProfile, healthTick]);

  const { activeAlertCount, healthLogoColor } = headerMetrics;

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      sessionStorage.removeItem("analyzeup_free_trial_session_prompted");
      router.push('/');
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between gap-2 px-4 lg:px-6 navbar">
      <div className="flex flex-shrink-0 items-center gap-2 font-semibold">
        <Link href="/dashboard" data-tour="header-logo" className="flex items-center gap-2 group">
          <AnalyzeUpIcon className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" healthColor={healthLogoColor} />
          <span className="text-xl font-semibold">AnalyzeUp</span>
        </Link>
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <Nav />
      </div>

      <div className="flex flex-shrink-0 items-center justify-end gap-1">
        {/* Proactive Notification Bell */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-tour="notification-bell"
                className="rounded-full relative"
                onClick={() => setNotifDrawerOpen(true)}
              >
                <Bell className="h-5 w-5" />
                {activeAlertCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
                    {activeAlertCount}
                  </span>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Business Alerts ({activeAlertCount})</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Account Avatar Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" data-tour="settings-btn" className="relative h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9 border border-border/50">
                <AvatarImage src={user?.photoURL || ''} alt="User avatar" />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 ios-glass">
            <div className="px-3 py-2 border-b border-border/30">
              <p className="font-bold text-xs text-foreground truncate">{user?.displayName || 'Business User'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email || 'user@business.com'}</p>
            </div>
            <DropdownMenuItem asChild className="cursor-pointer text-xs">
              <Link href="/dashboard/settings" className="flex items-center w-full">
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="cursor-pointer text-xs">
              {theme === 'light' ? (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark Mode
                </>
              ) : (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  Light Mode
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer text-xs">
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile Hamburger Menu Icon - Far Right */}
        <div className="md:hidden flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9 relative z-30"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <motion.div
              animate={{ rotate: isMenuOpen ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex items-center justify-center"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.div>
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 top-16 bg-black/40 backdrop-blur-sm z-30 md:hidden"
            />

            {/* Slide Down Menu Content */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shadow-2xl p-6 md:hidden flex flex-col gap-4 rounded-b-2xl"
            >
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-2.5"
              >
                {mobileNavItems.map((item) => {
                  const isActive = item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);

                  const isPremiumRoute =
                    item.href.startsWith("/dashboard/ai-advisor") ||
                    item.href.startsWith("/dashboard/insights") ||
                    item.href.startsWith("/dashboard/business-health");
                  const isLocked = isPremiumRoute && (activePlan !== "Pro Plan" || isLimitExceeded);

                  return (
                    <motion.div key={item.href} variants={itemVariants}>
                      <Link
                        href={item.href}
                        onClick={(e) => {
                          setIsMenuOpen(false);
                          if (isLocked) {
                            e.preventDefault();
                            setShowSubscriptionModal(true);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 relative border border-border/20 shadow-sm",
                          isActive
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "text-muted-foreground hover:text-foreground bg-secondary/20 hover:bg-secondary/40"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {notifDrawerOpen && <NotificationCenterDrawer open={notifDrawerOpen} onOpenChange={setNotifDrawerOpen} />}
    </header>
  );
}
