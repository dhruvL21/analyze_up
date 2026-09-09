'use client';
import { Header } from '@/components/header';
import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { useData } from '@/context/data-context';
import { ActiveImportBanner } from '@/components/active-import-banner';

// These overlays are not needed to render the dashboard shell. Loading them only
// when opened keeps their AI, form, and animation code out of the critical path.
const ChatWidget = dynamic(() => import('@/components/chat-widget').then((module) => module.ChatWidget), { ssr: false });
const FeatureTour = dynamic(() => import('@/components/feature-tour').then((module) => module.FeatureTour), { ssr: false });
const SubscriptionModal = dynamic(() => import('@/components/subscription-modal'), { ssr: false });
const SmartOnboardingWizard = dynamic(() => import('@/components/smart-onboarding-wizard').then((module) => module.SmartOnboardingWizard), { ssr: false });
const SmartWelcomeModal = dynamic(() => import('@/components/smart-welcome-modal').then((module) => module.SmartWelcomeModal), { ssr: false });
const ShopifyConnectModal = dynamic(() => import('@/components/shopify-connect-modal').then((module) => module.ShopifyConnectModal), { ssr: false });

function DashboardLoading() {
  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      <div className="sticky top-0 z-20 flex h-16 w-full items-center justify-between gap-4 border-b bg-background/70 px-4 backdrop-blur-xl lg:px-6">
        <div className="h-8 w-32 bg-secondary/80 rounded-lg animate-pulse"></div>
        <div className="h-8 w-64 bg-secondary/80 rounded-lg hidden md:block animate-pulse"></div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-secondary/80 rounded-full animate-pulse"></div>
          <div className="h-8 w-8 bg-secondary/80 rounded-full animate-pulse"></div>
          <div className="h-9 w-9 bg-secondary/80 rounded-full animate-pulse"></div>
        </div>
      </div>
      <main className="flex-1 p-4 sm:p-6 md:p-8 bg-background overflow-auto" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const {
    showSubscriptionModal,
    setShowSubscriptionModal,
    isLimitExceeded,
    activePlan,
    isTourOpen,
    setIsTourOpen,
    businessProfile,
    setShowOnboardingWizard,
    showOnboardingWizard,
    showWelcomeModal,
    showShopifyModal,
  } = useData();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Prevent outer scrolling by locking body/html scroll
    document.documentElement.classList.add('overflow-hidden', 'h-full');
    document.body.classList.add('overflow-hidden', 'h-full');
    return () => {
      document.documentElement.classList.remove('overflow-hidden', 'h-full');
      document.body.classList.remove('overflow-hidden', 'h-full');
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Check if user needs smart onboarding setup
  useEffect(() => {
    if (loading || !user) return;
    const isCompleted = localStorage.getItem(`analyzeup_onboarding_completed_${user.uid}`) === 'true';
    const hasPrompted = sessionStorage.getItem(`analyzeup_onboarding_prompted_${user.uid}`) === 'true';
    if (!isCompleted && !hasPrompted && businessProfile && !businessProfile.isOnboardingCompleted) {
      setShowOnboardingWizard(true);
      sessionStorage.setItem(`analyzeup_onboarding_prompted_${user.uid}`, 'true');
    }
  }, [user, loading, businessProfile, setShowOnboardingWizard]);

  // Check if user has just registered to prompt them with plans
  useEffect(() => {
    if (loading || !user || isTourOpen) return;
    const justRegistered = localStorage.getItem("analyzeup_just_registered");
    if (justRegistered === "true") {
      setShowSubscriptionModal(true);
      localStorage.removeItem("analyzeup_just_registered");
    }
  }, [setShowSubscriptionModal, loading, user, isTourOpen]);

  // Show popup only on explicit first-time login redirect (not on regular page reload)
  useEffect(() => {
    if (loading || !user || isTourOpen) return;
    const savedPlan = localStorage.getItem("analyzeup_subscription_plan") || "Free Trial";

    const justLoggedIn = localStorage.getItem("analyzeup_just_logged_in");
    if (justLoggedIn === "true") {
      if (savedPlan === "Free Trial") {
        setShowSubscriptionModal(true);
      }
      localStorage.removeItem("analyzeup_just_logged_in");
      sessionStorage.setItem("analyzeup_free_trial_session_prompted", "true");
    }
  }, [setShowSubscriptionModal, loading, user, isTourOpen]);

  // Auto-trigger feature tour ONLY once when a brand-new user registers
  useEffect(() => {
    if (loading || !user) return;
    const tourCompletedKey = `analyzeup_feature_tour_completed_${user.uid}`;
    const tourSeenKey = `analyzeup_feature_tour_seen_${user.uid}`;
    const globalSeenKey = 'analyzeup_feature_tour_seen_global';

    const hasSeenTour =
      localStorage.getItem(tourCompletedKey) === 'true' ||
      localStorage.getItem(tourSeenKey) === 'true' ||
      localStorage.getItem(globalSeenKey) === 'true';

    if (hasSeenTour) return;

    const isNewUser = localStorage.getItem("analyzeup_just_registered") === "true";
    if (!isNewUser) {
      localStorage.setItem(tourSeenKey, 'true');
      localStorage.setItem(globalSeenKey, 'true');
      return;
    }

    localStorage.setItem(tourSeenKey, 'true');
    localStorage.setItem(globalSeenKey, 'true');
    const timer = setTimeout(() => {
      setShowSubscriptionModal(false);
      setIsTourOpen(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [user, loading, setIsTourOpen, setShowSubscriptionModal]);

  // Auto-pop the subscription modal if visiting a locked feature page based on plan or product limit
  useEffect(() => {
    if (isTourOpen) return;
    const isPremiumRoute =
      pathname.startsWith("/dashboard/ai-advisor") ||
      pathname.startsWith("/dashboard/insights") ||
      pathname.startsWith("/dashboard/business-health");

    const isLocked = isPremiumRoute && (activePlan !== "Pro Plan" || isLimitExceeded);

    if (isLocked) {
      setShowSubscriptionModal(true);
      if (!showSubscriptionModal) {
        router.push("/dashboard");
      }
    }
  }, [pathname, activePlan, isLimitExceeded, showSubscriptionModal, setShowSubscriptionModal, router, isTourOpen]);

  if (loading || !user) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <div 
        className={cn(
          "flex flex-col h-dvh overflow-hidden transition-all duration-300",
          showSubscriptionModal && "blur-sm pointer-events-none select-none"
        )}
      >
        <Header />
        <ActiveImportBanner />
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-28 sm:pb-32 overflow-y-auto relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-full h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ChatWidget />
      {isTourOpen && <FeatureTour />}
      {showSubscriptionModal && <SubscriptionModal />}
      {showOnboardingWizard && <SmartOnboardingWizard />}
      {showWelcomeModal && <SmartWelcomeModal />}
      <ShopifyConnectModal />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
    </div>
  );
}
