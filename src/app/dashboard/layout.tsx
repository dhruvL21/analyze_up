
'use client';
import { Header } from '@/components/header';
import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import SubscriptionModal from '@/components/subscription-modal';
import { useData } from '@/context/data-context';
import { ChatWidget } from '@/components/chat-widget';

function DashboardLoading() {
    return (
        <div className="flex flex-col h-dvh">
         <div className="sticky top-0 z-20 flex h-16 w-full items-center justify-between gap-4 border-b bg-background/70 px-4 backdrop-blur-xl lg:px-6 animate-pulse">
            <div className="h-8 w-32 bg-secondary rounded-lg"></div>
            <div className="h-8 w-64 bg-secondary rounded-lg hidden md:block"></div>
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-secondary rounded-full"></div>
                <div className="h-8 w-8 bg-secondary rounded-full"></div>
                <div className="h-9 w-9 bg-secondary rounded-full"></div>
            </div>
         </div>
         <main className="flex-1 p-4 sm:p-6 md:p-8 bg-background overflow-auto">
         </main>
       </div>
    )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const { showSubscriptionModal, setShowSubscriptionModal, isLimitExceeded, activePlan } = useData();
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

  // Check if user has just registered to prompt them with plans
  useEffect(() => {
    if (loading || !user) return;
    const justRegistered = localStorage.getItem("analyzeup_just_registered");
    if (justRegistered === "true") {
      setShowSubscriptionModal(true);
      localStorage.removeItem("analyzeup_just_registered");
    }
  }, [setShowSubscriptionModal, loading, user]);

  // Show popup once per login session if user is on the Free Trial, or on explicit login redirect
  useEffect(() => {
    if (loading || !user) return;
    const savedPlan = localStorage.getItem("analyzeup_subscription_plan") || "Free Trial";

    const justLoggedIn = localStorage.getItem("analyzeup_just_logged_in");
    if (justLoggedIn === "true") {
      if (savedPlan === "Free Trial") {
        setShowSubscriptionModal(true);
      }
      localStorage.removeItem("analyzeup_just_logged_in");
      sessionStorage.setItem("analyzeup_free_trial_session_prompted", "true");
      return;
    }

    if (savedPlan === "Free Trial") {
      const sessionPrompted = sessionStorage.getItem("analyzeup_free_trial_session_prompted");
      if (!sessionPrompted) {
        setShowSubscriptionModal(true);
        sessionStorage.setItem("analyzeup_free_trial_session_prompted", "true");
      }
    }
  }, [setShowSubscriptionModal, loading, user]);

  // Auto-pop the subscription modal if limit is exceeded and visiting a feature page
  useEffect(() => {
    if (isLimitExceeded) {
      const isFeatureRoute =
        pathname.startsWith("/dashboard/inventory") ||
        pathname.startsWith("/dashboard/orders") ||
        pathname.startsWith("/dashboard/suppliers") ||
        pathname.startsWith("/dashboard/reports");

      if (isFeatureRoute) {
        setShowSubscriptionModal(true);
      }
    }
  }, [pathname, isLimitExceeded, setShowSubscriptionModal]);

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
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto relative">
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
      <SubscriptionModal />
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
    </div>
  );
}


    