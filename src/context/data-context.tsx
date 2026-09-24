'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Product, PurchaseOrder, Supplier, Transaction, Category, ProductReturn, CustomAttribute, BusinessProfile, BusinessType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, setDoc, onSnapshot, getDocs, getDoc, deleteField, increment } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateDemoBusinessData } from '@/lib/demo-data';
import Papa from 'papaparse';
import { getClientDriveToken, isAutoSyncDue, autoDetectMapping, formatLastSyncTime } from '@/lib/drive-helper';
import { isShopifyAutoSyncDue } from '@/lib/shopify-sync-helper';
import { findMatchingImportProfile, setActiveImportUserId } from '@/lib/import-profile-store';
import { logBusinessAction, setActiveAuditUserId } from '@/lib/audit-store';
import { setActiveSimulationUserId } from '@/lib/simulation-engine';
import { setActiveGrowthUserId } from '@/lib/customer-growth-engine';
import { setActiveEventUserId } from '@/lib/business-event-engine';
import { setActiveExecutiveUserId } from '@/lib/executive-intelligence-engine';
import {
  type AnalyticsSummary,
  DEFAULT_ANALYTICS_SUMMARY,
  recalculateAndSaveAnalyticsSummary,
} from '@/lib/analytics-aggregator';
import { generateProductDocId, generateTransactionDocId } from '@/lib/import-job-service';
import {
  resolveExistingProduct,
  generateOrderLineItemKey,
  normalizeOrderNumber,
  reconcileDuplicateProducts,
} from '@/lib/ingestion/order-deduplication-engine';
import { sanitizePlainData } from '@/lib/utils';
import {
  type MonthlyUsageRecord,
  getCurrentBillingMonth,
  createInitialMonthlyUsage,
  validateCouponCode,
} from '@/lib/saas-engine';

import {
  getBusinessBuddyCalibration,
  type BusinessBuddyCalibration,
} from '@/lib/business-buddy-engine';
import {
  evaluateDataReadiness,
  type DataReadiness,
  type IntelligenceCapabilities,
} from '@/lib/data-readiness-engine';
import { clearClientSessionCaches } from '@/firebase/auth/auth-service';

interface DataContextProps {
  dataReadiness: DataReadiness;
  capabilities: IntelligenceCapabilities;
  businessBuddyCalibration: BusinessBuddyCalibration;
  activateRecommendationsNow: () => Promise<void>;
  products: Product[];
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  transactions: Transaction[];
  categories: Category[];
  returns: ProductReturn[];
  customAttributes: CustomAttribute[];
  businessProfile: BusinessProfile | null;
  updateBusinessProfile: (profile: Partial<BusinessProfile>, silent?: boolean) => Promise<void>;
  loadDemoBusiness: (businessType?: BusinessType) => Promise<void>;
  clearDemoBusiness: () => Promise<void>;
  purgeDemoDataOnly: () => Promise<void>;
  hasDemoData: boolean;
  isLoadingDemo: boolean;
  isDeletingDemo: boolean;
  demoProgress: {
    stage: number;
    stepName: string;
    percent: number;
    details?: string;
  };
  showOnboardingWizard: boolean;
  setShowOnboardingWizard: (show: boolean) => void;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  showShopifyModal: boolean;
  setShowShopifyModal: (show: boolean) => void;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  addCustomAttribute: (attribute: Omit<CustomAttribute, 'id'>) => Promise<void>;
  updateProduct: (product: Product, options?: { silentToast?: boolean; forceShopifySync?: boolean }) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  receivePurchaseOrder: (orderId: string, customReceivedQty?: number) => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'userId'>) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => Promise<void>;
  recordSale: (productId: string, quantity: number) => Promise<void>;
  addReturn: (returnData: Omit<ProductReturn, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  deleteReturn: (returnId: string) => Promise<void>;
  updateReturn: (returnId: string, updates: Partial<ProductReturn>) => Promise<void>;
  updateReturnStatus: (returnId: string, refundStatus: string) => Promise<void>;
  bulkAddProducts: (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[], overwriteStock?: boolean, silent?: boolean) => Promise<any>;
  bulkUpdateProducts: (updates: (Partial<Product> & { id: string })[]) => Promise<void>;
  bulkDeleteProducts: (productIds: string[]) => Promise<void>;
  bulkAddTransactions: (transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>[], silent?: boolean) => Promise<any>;
  bulkAddReturns: (returnsData: (Omit<ProductReturn, 'createdAt' | 'updatedAt' | 'userId'> & { id?: string })[], silent?: boolean) => Promise<any>;
  vectorizeAndSyncAiChatbot: () => Promise<any>;
  clearAllData: (options?: { silent?: boolean }) => Promise<void>;
  // Google Drive & Integration Helpers
  driveConnection: any;
  autoSyncGoogleDriveNow: (showToast?: boolean) => Promise<void>;
  subscribeGoogleDriveConnection: (onUpdate: (data: any) => void) => () => void;
  getGoogleDriveFiles: () => Promise<any[]>;
  getSyncHistory: () => Promise<any[]>;
  getMappingProfiles: () => Promise<any[]>;
  disconnectGoogleDrive: (options?: { purgeData?: boolean }) => Promise<{
    success: boolean;
    deletedProducts: number;
    deletedTransactions: number;
    deletedReturns: number;
  }>;
  updateGoogleDriveSettings: (settings: Record<string, any>) => Promise<void>;
  recordSyncSuccess: (fileId: string, fileData: Record<string, any>, historyData: Record<string, any>) => Promise<void>;
  saveMappingProfile: (fileId: string, profileData: Record<string, any>) => Promise<void>;
  isLoading: boolean;
  activePlan: string;
  isProcessingPayment: string | null;
  showSubscriptionModal: boolean;
  setShowSubscriptionModal: (show: boolean) => void;
  isTourOpen: boolean;
  setIsTourOpen: (show: boolean) => void;
  isLimitExceeded: boolean;
  activePlanLimit: number;
  aiQueryCount: number;
  incrementAiQueryCount: (amount?: number) => void;
  reportCount: number;
  incrementReportCount: (amount?: number) => void;
  monthlyUsage: MonthlyUsageRecord;
  updateActivePlan: (newPlan: string) => Promise<void>;
  handleUpgrade: (planId: string, amount: number, planName: string) => Promise<void>;
  appliedCoupon: string | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string; plan?: string }>;
  removeCoupon: () => Promise<void>;
  analyticsSummary: AnalyticsSummary;
  refreshAnalytics: () => Promise<void>;
  // Shopify Real-Time & Auto-Sync
  isShopifySyncing: boolean;
  autoSyncShopifyNow: (showToast?: boolean, shopOverride?: string, tokenOverride?: string) => Promise<void>;
  updateShopifyScheduleSettings: (settings: {
    shopifyAutoSyncEnabled?: boolean;
    shopifyRealtimeSyncEnabled?: boolean;
    shopifySyncFrequency?: 'realtime' | '1_min' | '5_mins' | '15_mins' | '30_mins' | '1_hour' | '6_hours' | '12_hours' | 'daily' | 'weekly' | 'custom_datetime';
    shopifySyncTime?: string;
    shopifySyncDay?: string;
    shopifyScheduledDateTime?: string;
    shopifyWebhookHost?: string;
    shopifyWebhooksActive?: boolean;
  }) => Promise<void>;
  disconnectShopify: (options?: { purgeData?: boolean; shopOverride?: string }) => Promise<{
    success: boolean;
    deletedProducts: number;
    deletedTransactions: number;
    deletedReturns: number;
  }>;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

// Helper function to remove duplicates from an array of objects by a given key
const uniqueBy = <T extends Record<string, any>>(array: T[] | null, key: keyof T): T[] => {
  if (!array) return [];
  return Array.from(new Map(array.map(item => [item[key], item])).values());
}


// Helper function to remove undefined values from an object for Firestore compatibility
const cleanObject = (obj: any) => {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
};


export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const productsRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'products') : null, [user, firestore]);
  const ordersRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'orders') : null, [user, firestore]);
  const suppliersRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'suppliers') : null, [user, firestore]);
  const transactionsRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'transactions') : null, [user, firestore]);
  const categoriesRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'categories') : null, [user, firestore]);
  const returnsRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'returns') : null, [user, firestore]);
  const customAttributesRef = useMemo(() => user && firestore ? collection(firestore, 'users', user.uid, 'custom_attributes') : null, [user, firestore]);
  const summaryRef = useMemo(() => user && firestore ? doc(firestore, 'users', user.uid, 'analytics', 'summary') : null, [user, firestore]);

  const { data: productsData, loading: productsLoading } = useCollection<Product>(productsRef);
  const { data: ordersData, loading: ordersLoading } = useCollection<PurchaseOrder>(ordersRef);
  const { data: suppliersData, loading: suppliersLoading } = useCollection<Supplier>(suppliersRef);
  const { data: transactionsData, loading: transactionsLoading } = useCollection<Transaction>(transactionsRef);
  const { data: categoriesData, loading: categoriesLoading } = useCollection<Category>(categoriesRef);
  const { data: returnsData, loading: returnsLoading } = useCollection<ProductReturn>(returnsRef);
  const { data: customAttributesData } = useCollection<CustomAttribute>(customAttributesRef);
  const { data: summaryData } = useDoc<AnalyticsSummary>(summaryRef);

  const products = useMemo(() => uniqueBy(productsData, 'id'), [productsData]);
  const orders = useMemo(() => uniqueBy(ordersData, 'id'), [ordersData]);
  const suppliers = useMemo(() => uniqueBy(suppliersData, 'name'), [suppliersData]);
  const transactions = useMemo(() => uniqueBy(transactionsData, 'id'), [transactionsData]);
  const categories = useMemo(() => uniqueBy(categoriesData, 'name'), [categoriesData]);
  const returns = useMemo(() => uniqueBy(returnsData, 'id'), [returnsData]);
  const customAttributes = useMemo(() => uniqueBy(customAttributesData, 'value'), [customAttributesData]);
  const analyticsSummary = useMemo(() => summaryData || DEFAULT_ANALYTICS_SUMMARY, [summaryData]);

  const refreshAnalytics = useCallback(async () => {
    if (!firestore || !user) return;
    try {
      await recalculateAndSaveAnalyticsSummary(firestore, user.uid, {
        products,
        transactions,
        suppliers,
        orders,
        returns,
      });
    } catch (err) {
      console.error('Failed to refresh analytics summary:', err);
    }
  }, [firestore, user, products, transactions, suppliers, orders, returns]);

  const [activePlan, setActivePlanState] = useState<string>("Free");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [aiQueryCount, setAiQueryCount] = useState<number>(0);
  const [reportCount, setReportCount] = useState<number>(0);

  // Sync user-scoped account settings & purge legacy cross-account localStorage leaks
  useEffect(() => {
    if (!user) {
      setActivePlanState("Free");
      setAppliedCoupon(null);
      setAiQueryCount(0);
      setReportCount(0);
      setActiveAuditUserId(null);
      setActiveSimulationUserId(null);
      setActiveGrowthUserId(null);
      setActiveEventUserId(null);
      setActiveExecutiveUserId(null);
      setActiveImportUserId(null);
      return;
    }

    setActiveAuditUserId(user.uid);
    setActiveSimulationUserId(user.uid);
    setActiveGrowthUserId(user.uid);
    setActiveEventUserId(user.uid);
    setActiveExecutiveUserId(user.uid);
    setActiveImportUserId(user.uid);

    try {
      // Purge legacy unscoped keys to guarantee strict multi-tenant isolation
      clearClientSessionCaches();
    } catch {}

    const userCoupon = localStorage.getItem(`analyzeup_applied_coupon_${user.uid}`);
    const userPlan = localStorage.getItem(`analyzeup_subscription_plan_${user.uid}`);
    const userAi = localStorage.getItem(`analyzeup_ai_queries_count_${user.uid}`);
    const userRep = localStorage.getItem(`analyzeup_reports_count_${user.uid}`);

    setAppliedCoupon(userCoupon || null);
    setActivePlanState(userCoupon ? (userPlan || "Scale") : (userPlan || "Free"));
    setAiQueryCount(userAi ? Math.max(0, parseInt(userAi, 10)) : 0);
    setReportCount(userRep ? Math.max(0, parseInt(userRep, 10)) : 0);
  }, [user?.uid]);

  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsageRecord>(() => createInitialMonthlyUsage());

  // Real-time synchronization of account-level subscription and monthly usage limits from Firestore
  useEffect(() => {
    if (!user || !firestore) return;

    const usageDocRef = doc(firestore, 'users', user.uid, 'subscription', 'usage');
    const currentMonth = getCurrentBillingMonth();

    const unsubscribe = onSnapshot(usageDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const storedMonth = data.billingMonth;

        // Reset ONLY when a new calendar month starts (e.g., September -> October)
        if (storedMonth && storedMonth !== currentMonth) {
          console.log(`[UsageQuota] Monthly rollover detected (${storedMonth} -> ${currentMonth}). Resetting monthly quota for account ${user.uid}.`);
          const resetData: MonthlyUsageRecord = {
            billingMonth: currentMonth,
            aiQueriesCount: 0,
            reportsCount: 0,
            lastResetDate: new Date().toISOString(),
            plan: data.plan || activePlan,
            planKey: data.planKey || 'PRO',
          };
          setAiQueryCount(0);
          setReportCount(0);
          setMonthlyUsage(resetData);
          try {
            if (user) {
              localStorage.setItem(`analyzeup_ai_queries_count_${user.uid}`, '0');
              localStorage.setItem(`analyzeup_reports_count_${user.uid}`, '0');
              localStorage.setItem(`analyzeup_usage_${user.uid}`, JSON.stringify(resetData));
            }
          } catch (e) {}

          await setDoc(usageDocRef, {
            ...resetData,
            updatedAt: serverTimestamp(),
          }, { merge: true }).catch(console.warn);
        } else {
          // SAME MONTH: Preserve exact cumulative usage for this account across all logins
          const aiCount = typeof data.aiQueriesCount === 'number' ? data.aiQueriesCount : 0;
          const repCount = typeof data.reportsCount === 'number' ? data.reportsCount : 0;
          setAiQueryCount(aiCount);
          setReportCount(repCount);
          setMonthlyUsage({
            billingMonth: data.billingMonth || currentMonth,
            aiQueriesCount: aiCount,
            reportsCount: repCount,
            lastResetDate: data.lastResetDate || new Date().toISOString(),
            plan: data.plan,
            planKey: data.planKey,
          });

          const activeCoupon = data.appliedCoupon || (user ? localStorage.getItem(`analyzeup_applied_coupon_${user.uid}`) : null);
          if (data.plan) {
            // Revert any legacy dev artifact names to clean new plan names
            const planToSet =
              data.plan === 'Pro Plan' && !activeCoupon
                ? 'Free'
                : data.plan === 'Free Trial'
                ? 'Free'
                : data.plan === 'Starter Plan'
                ? 'Founder'
                : data.plan === 'Enterprise Pro'
                ? 'Scale'
                : data.plan;
            setActivePlanState(planToSet);
            if (user) {
              try {
                localStorage.setItem(`analyzeup_subscription_plan_${user.uid}`, planToSet);
              } catch (e) {}
            }
          }

          if (data.appliedCoupon) {
            setAppliedCoupon(data.appliedCoupon);
            if (user) {
              try {
                localStorage.setItem(`analyzeup_applied_coupon_${user.uid}`, data.appliedCoupon);
              } catch (e) {}
            }
          }

          if (user) {
            try {
              localStorage.setItem(`analyzeup_ai_queries_count_${user.uid}`, aiCount.toString());
              localStorage.setItem(`analyzeup_reports_count_${user.uid}`, repCount.toString());
              localStorage.setItem(`analyzeup_usage_${user.uid}`, JSON.stringify(data));
            } catch (e) {}
          }
        }
      } else {
        // Document does not exist yet: New user account starts completely fresh with isolated zeroed usage
        const initialPlan = 'Free';
        const initialAi = 0;
        const initialRep = 0;

        const seedUsage = {
          plan: initialPlan,
          planKey: 'FREE',
          billingMonth: currentMonth,
          aiQueriesCount: initialAi,
          reportsCount: initialRep,
          lastResetDate: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        };

        setMonthlyUsage({
          billingMonth: currentMonth,
          aiQueriesCount: initialAi,
          reportsCount: initialRep,
          lastResetDate: seedUsage.lastResetDate,
          plan: initialPlan,
          planKey: 'FREE',
        });

        setActivePlanState('Free');
        setAppliedCoupon(null);
        setAiQueryCount(0);
        setReportCount(0);

        await setDoc(usageDocRef, seedUsage, { merge: true }).catch(console.warn);
      }
    }, (error) => {
      console.warn('[UsageQuota] Listener error:', error);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  const incrementAiQueryCount = useCallback(async (amount = 1) => {
    const currentMonth = getCurrentBillingMonth();
    setAiQueryCount(prev => {
      const next = prev + amount;
      if (user) {
        try {
          localStorage.setItem(`analyzeup_ai_queries_count_${user.uid}`, next.toString());
        } catch (e) {}
      }
      return next;
    });

    if (user && firestore) {
      try {
        const usageDocRef = doc(firestore, 'users', user.uid, 'subscription', 'usage');
        await setDoc(usageDocRef, {
          aiQueriesCount: increment(amount),
          billingMonth: currentMonth,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to increment AI queries in Firestore:', err);
      }
    }
  }, [user, firestore]);

  const incrementReportCount = useCallback(async (amount = 1) => {
    const currentMonth = getCurrentBillingMonth();
    setReportCount(prev => {
      const next = prev + amount;
      if (user) {
        try {
          localStorage.setItem(`analyzeup_reports_count_${user.uid}`, next.toString());
        } catch (e) {}
      }
      return next;
    });

    if (user && firestore) {
      try {
        const usageDocRef = doc(firestore, 'users', user.uid, 'subscription', 'usage');
        await setDoc(usageDocRef, {
          reportsCount: increment(amount),
          billingMonth: currentMonth,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to increment report count in Firestore:', err);
      }
    }
  }, [user, firestore]);

  const updateActivePlan = useCallback(async (newPlan: string) => {
    setActivePlanState(newPlan);
    if (user) {
      try {
        localStorage.setItem(`analyzeup_subscription_plan_${user.uid}`, newPlan);
      } catch (e) {}
    }

    if (user && firestore) {
      try {
        const usageDocRef = doc(firestore, 'users', user.uid, 'subscription', 'usage');
        await setDoc(usageDocRef, {
          plan: newPlan,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Update root user profile document too
        await setDoc(doc(firestore, 'users', user.uid), {
          activePlan: newPlan,
          subscriptionPlan: newPlan,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update active plan in Firestore:', err);
      }
    }
  }, [user, firestore]);

  const applyCoupon = useCallback(async (code: string) => {
    const validation = validateCouponCode(code);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    setAppliedCoupon(validation.code);
    if (user) {
      try {
        localStorage.setItem(`analyzeup_applied_coupon_${user.uid}`, validation.code);
        localStorage.setItem(`analyzeup_coupon_discount_${user.uid}`, validation.discountPercent.toString());
      } catch (e) {}
    }

    // Automatically upgrade workspace to Enterprise Pro for free
    await updateActivePlan(validation.planName);

    if (user && firestore) {
      try {
        const usageDocRef = doc(firestore, 'users', user.uid, 'subscription', 'usage');
        await setDoc(usageDocRef, {
          plan: validation.planName,
          planKey: validation.planKey,
          appliedCoupon: validation.code,
          isCouponActive: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        await setDoc(doc(firestore, 'users', user.uid), {
          activePlan: validation.planName,
          subscriptionPlan: validation.planName,
          appliedCoupon: validation.code,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to sync coupon to Firestore:', err);
      }
    }

    return {
      success: true,
      message: validation.message,
      plan: validation.planName,
    };
  }, [updateActivePlan, user, firestore]);

  const removeCoupon = useCallback(async () => {
    setAppliedCoupon(null);
    if (user) {
      try {
        localStorage.removeItem(`analyzeup_applied_coupon_${user.uid}`);
        localStorage.removeItem(`analyzeup_coupon_discount_${user.uid}`);
      } catch (e) {}
    }

    await updateActivePlan('Free');

    if (user && firestore) {
      try {
        const usageDocRef = doc(firestore, 'users', user.uid, 'subscription', 'usage');
        await setDoc(usageDocRef, {
          plan: 'Free',
          planKey: 'FREE',
          appliedCoupon: null,
          isCouponActive: false,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        await setDoc(doc(firestore, 'users', user.uid), {
          activePlan: 'Free',
          subscriptionPlan: 'Free',
          appliedCoupon: null,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to clear coupon from Firestore:', err);
      }
    }
  }, [updateActivePlan, user, firestore]);

  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const businessProfileRef = useRef<BusinessProfile | null>(businessProfile);
  businessProfileRef.current = businessProfile;

  const [showOnboardingWizard, setShowOnboardingWizard] = useState<boolean>(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);
  const [showShopifyModal, setShowShopifyModal] = useState<boolean>(false);
  const [hasDemoData, setHasDemoData] = useState<boolean>(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState<boolean>(false);
  const [isDeletingDemo, setIsDeletingDemo] = useState<boolean>(false);
  const [demoProgress, setDemoProgress] = useState<{
    stage: number;
    stepName: string;
    percent: number;
    details?: string;
  }>({
    stage: 0,
    stepName: '',
    percent: 0,
    details: '',
  });

  // Load business profile from localStorage & Cloud Firestore
  useEffect(() => {
    if (!user) return;
    const localProfile = localStorage.getItem(`analyzeup_profile_${user.uid}`);
    if (localProfile) {
      try {
        const parsed = JSON.parse(localProfile);
        setBusinessProfile(parsed);
        businessProfileRef.current = parsed;
        if (parsed.inventorySetupMethod === 'demo') {
          setHasDemoData(true);
        }
      } catch (e) {
        console.error("Error parsing business profile:", e);
      }
    }

    // Sync from Cloud Firestore for persistent state across devices & deployments
    if (firestore) {
      // Ensure root user document exists in Firestore (resolves phantom document warnings)
      setDoc(
        doc(firestore, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          role: 'merchant',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(console.warn);

      // Live real-time listener for business profile
      const unsubProfile = onSnapshot(
        doc(firestore, 'users', user.uid, 'settings', 'business_profile'),
        (snap) => {
          if (snap.exists()) {
            const remote = snap.data() as BusinessProfile;
            setBusinessProfile((prev) => {
              const merged = { ...(prev || {}), ...remote } as BusinessProfile;
              businessProfileRef.current = merged;
              return merged;
            });
          }
        },
        (err) => console.warn('[BusinessProfile listener notice]:', err)
      );

      // Live real-time listener for Shopify integration status & credentials
      const unsubIntegration = onSnapshot(
        doc(firestore, 'users', user.uid, 'integrations', 'shopify'),
        (snap) => {
          if (snap.exists()) {
            const intData = snap.data();
            if (intData?.connectionStatus === 'Connected' && Boolean(intData?.accessToken)) {
              setBusinessProfile((prev) => {
                const merged: BusinessProfile = {
                  ...(prev || {}),
                  businessName: prev?.businessName || 'My Business',
                  businessType: prev?.businessType || 'Retail',
                  industry: prev?.industry || 'General Retail Store',
                  businessSize: prev?.businessSize || '2-10 Employees',
                  currency: prev?.currency || 'INR (₹)',
                  timezone: prev?.timezone || 'Asia/Kolkata (GMT+5:30)',
                  country: prev?.country || 'India',
                  shopifyConnected: true,
                  shopifyStatus: 'Connected',
                  shopifyStoreUrl: intData.shopDomain || prev?.shopifyStoreUrl,
                  shopifyStoreName: intData.storeName || prev?.shopifyStoreName,
                  shopifyAccessToken: intData.accessToken || prev?.shopifyAccessToken,
                };
                businessProfileRef.current = merged;
                return merged;
              });
            } else if (intData?.connectionStatus === 'Disconnected' || intData?.connectionStatus === 'Uninstalled' || !intData?.accessToken) {
              setBusinessProfile((prev) => {
                if (!prev) return prev;
                const merged: BusinessProfile = {
                  ...prev,
                  shopifyConnected: false,
                  shopifyStatus: 'Disconnected',
                  shopifyStoreUrl: '',
                  shopifyStoreName: '',
                  shopifyAccessToken: '',
                  shopifyAutoSyncEnabled: false,
                  shopifyRealtimeSyncEnabled: false,
                };
                businessProfileRef.current = merged;
                return merged;
              });
            }
          }
        },
        (err) => console.warn('[Shopify integration listener notice]:', err)
      );

      return () => {
        unsubProfile();
        unsubIntegration();
      };
    }
  }, [user, firestore]);

  // Automatically reconcile and purge duplicate products in Firestore (e.g. from phantom CSV imports)
  useEffect(() => {
    if (!firestore || !user || !products || products.length === 0) return;
    const timer = setTimeout(() => {
      reconcileDuplicateProducts(products, firestore, user.uid).catch(console.warn);
    }, 2000);
    return () => clearTimeout(timer);
  }, [firestore, user, products]);

  // Automatically reconcile and purge orphaned Shopify sales cycles / products when store is disconnected
  useEffect(() => {
    if (!firestore || !user || !businessProfile) return;
    const isShopifyDisconnected =
      businessProfile.shopifyConnected === false ||
      businessProfile.shopifyStatus === 'Disconnected' ||
      businessProfile.shopifyStatus === 'Uninstalled' ||
      !businessProfile.shopifyStoreUrl ||
      !businessProfile.shopifyAccessToken;

    if (!isShopifyDisconnected) return;

    const timer = setTimeout(async () => {
      try {
        const uid = user.uid;
        const txSnap = await getDocs(collection(firestore, 'users', uid, 'transactions')).catch(() => ({ docs: [] } as any));
        const sumRef = doc(firestore, 'users', uid, 'analytics', 'summary');
        const productsSnap = await getDocs(collection(firestore, 'users', uid, 'products')).catch(() => ({ docs: [] } as any));

        const shopifyProductDocs = productsSnap.docs.filter((d: any) => {
          const data = d.data() || {};
          return (
            data.source?.toUpperCase() === 'SHOPIFY' ||
            d.id.startsWith('shopify_') ||
            d.id.includes('shopify') ||
            (typeof data.id === 'string' && (data.id.startsWith('shopify_') || data.id.includes('shopify'))) ||
            Boolean(data.shopifyProductId) ||
            Boolean(data.shopifyVariantId) ||
            (typeof data.sku === 'string' && data.sku.toUpperCase().startsWith('SHOPIFY-')) ||
            (typeof data.supplier === 'string' && data.supplier.toLowerCase().includes('shopify'))
          );
        });

        const deletedProductDocIds = new Set<string>(shopifyProductDocs.map((d: any) => d.id));
        const deletedProductDataIds = new Set<string>(shopifyProductDocs.map((d: any) => d.data()?.id).filter(Boolean));
        const deletedProductSkus = new Set<string>(shopifyProductDocs.map((d: any) => d.data()?.sku?.toUpperCase()).filter(Boolean));
        const deletedProductNames = new Set<string>(shopifyProductDocs.map((d: any) => d.data()?.name?.toLowerCase()).filter(Boolean));
        const deletedShopifyIds = new Set<string>(shopifyProductDocs.map((d: any) => String(d.data()?.shopifyProductId || '')).filter(Boolean));

        const shopifyTxDocs = txSnap.docs.filter((d: any) => {
          const data = d.data() || {};
          const skuUpper = typeof data.sku === 'string' ? data.sku.toUpperCase() : '';
          const nameLower = typeof data.productName === 'string' ? data.productName.toLowerCase() : '';
          const isSourceShopify = data.source?.toUpperCase() === 'SHOPIFY';
          const isDocShopify = d.id.startsWith('tx_shopify_') || d.id.includes('shopify') || d.id.startsWith('tx_refund_');
          const isDataShopify = typeof data.id === 'string' && (data.id.startsWith('tx_shopify_') || data.id.includes('shopify'));
          const isPaymentShopify = typeof data.paymentMethod === 'string' && data.paymentMethod.toLowerCase().includes('shopify');
          const hasShopifyOrderId = Boolean(data.shopifyOrderId || data.shopifyTransactionId);
          const matchesProdId =
            (data.productId && (deletedProductDocIds.has(data.productId) || deletedProductDataIds.has(data.productId) || deletedShopifyIds.has(String(data.productId)))) ||
            (data.product_id && (deletedProductDocIds.has(data.product_id) || deletedProductDataIds.has(data.product_id) || deletedShopifyIds.has(String(data.product_id))));
          const matchesSku = skuUpper && deletedProductSkus.has(skuUpper);
          const matchesName = nameLower && deletedProductNames.has(nameLower);

          return (
            isSourceShopify ||
            isDocShopify ||
            isDataShopify ||
            isPaymentShopify ||
            hasShopifyOrderId ||
            matchesProdId ||
            matchesSku ||
            matchesName
          );
        });

        const remainingTxDocs = txSnap.docs.filter((d: any) => !shopifyTxDocs.some((sd: any) => sd.id === d.id));
        const remainingProdDocs = productsSnap.docs.filter((d: any) => !shopifyProductDocs.some((sp: any) => sp.id === d.id));

        if (shopifyTxDocs.length > 0 || shopifyProductDocs.length > 0) {
          const CHUNK_SIZE = 400;
          const toDelete = [...shopifyTxDocs, ...shopifyProductDocs];
          for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
            const batch = writeBatch(firestore);
            toDelete.slice(i, i + CHUNK_SIZE).forEach((docSnap: any) => batch.delete(docSnap.ref));
            await batch.commit().catch(console.warn);
          }

          const retSnap = await getDocs(collection(firestore, 'users', uid, 'returns')).catch(() => ({ docs: [] } as any));
          const shopifyRetDocs = retSnap.docs.filter((d: any) => {
            const data = d.data() || {};
            return (
              data.source?.toUpperCase() === 'SHOPIFY' ||
              d.id.startsWith('ret_shopify_') ||
              d.id.includes('shopify') ||
              deletedProductDocIds.has(data.productId)
            );
          });
          if (shopifyRetDocs.length > 0) {
            const retBatch = writeBatch(firestore);
            shopifyRetDocs.forEach((d: any) => retBatch.delete(d.ref));
            await retBatch.commit().catch(console.warn);
          }

          if (remainingTxDocs.length === 0 || remainingProdDocs.length === 0) {
            await setDoc(sumRef, DEFAULT_ANALYTICS_SUMMARY).catch(console.warn);
            await deleteDoc(doc(firestore, 'users', uid, 'analytics', 'ai_brief')).catch(() => {});
          } else {
            const remProds = remainingProdDocs.map((d: any) => ({ id: d.id, ...d.data() }));
            const remTxs = remainingTxDocs.map((d: any) => ({ id: d.id, ...d.data() }));
            await recalculateAndSaveAnalyticsSummary(firestore, uid, {
              products: remProds,
              transactions: remTxs,
              suppliers,
              orders,
              returns,
            }).catch(console.warn);
          }
        } else if (txSnap.docs.length === 0 || remainingTxDocs.length === 0) {
          const sumSnap = await getDoc(sumRef).catch(() => null);
          if (sumSnap && sumSnap.exists()) {
            const sumData = sumSnap.data();
            if (sumData?.totalTransactions > 0 || sumData?.totalRevenue > 0) {
              await setDoc(sumRef, DEFAULT_ANALYTICS_SUMMARY).catch(console.warn);
              await deleteDoc(doc(firestore, 'users', uid, 'analytics', 'ai_brief')).catch(() => {});
            }
          }
        }
      } catch (reconcileErr) {
        console.warn('[DataContext] Disconnected Shopify auto-cleanup notice:', reconcileErr);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [firestore, user, businessProfile?.shopifyConnected, businessProfile?.shopifyStatus, suppliers, orders, returns]);

  const updateBusinessProfile = useCallback(async (updates: Partial<BusinessProfile>, silent: boolean = false) => {
    if (!user) return;
    const current = businessProfileRef.current;
    const updatedProfile: BusinessProfile = {
      businessName: 'My Business',
      businessType: 'Retail',
      industry: 'General Retail Store',
      businessSize: '2-10 Employees',
      currency: 'INR (₹)',
      timezone: 'Asia/Kolkata (GMT+5:30)',
      country: 'India',
      language: 'English',
      isOnboardingCompleted: true,
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setBusinessProfile(updatedProfile);
    businessProfileRef.current = updatedProfile;
    localStorage.setItem(`analyzeup_profile_${user.uid}`, JSON.stringify(updatedProfile));

    if (firestore) {
      const profileRef = doc(firestore, 'users', user.uid, 'settings', 'business_profile');
      await setDoc(profileRef, cleanObject(updatedProfile), { merge: true }).catch(console.error);
    }
    if (!silent) {
      toast({ title: 'Business Profile Updated', description: 'Your business preferences have been saved.' });
    }
  }, [user, firestore, toast]);

  const loadDemoBusiness = useCallback(async (customType?: BusinessType) => {
    if (!user || !firestore) return;
    setIsLoadingDemo(true);
    setDemoProgress({
      stage: 1,
      stepName: 'Initializing Business Engine...',
      percent: 12,
      details: 'Generating tailored catalog, suppliers & historical sales velocity...',
    });

    const demo = generateDemoBusinessData();
    const uid = user.uid;

    try {
      // Step 1: Products
      setDemoProgress({
        stage: 1,
        stepName: 'Populating 200+ Products & SKUs...',
        percent: 25,
        details: `Injecting ${demo.products.length} products with stock levels, categories & pricing models.`,
      });
      const pBatches = [];
      for (let i = 0; i < demo.products.length; i += 450) {
        const batch = writeBatch(firestore);
        const chunk = demo.products.slice(i, i + 450);
        chunk.forEach(p => {
          const ref = doc(firestore, 'users', uid, 'products', p.id);
          batch.set(ref, cleanObject({ ...p, userId: uid }));
        });
        pBatches.push(batch.commit());
      }
      await Promise.all(pBatches);

      // Step 2: Suppliers & Categories
      setDemoProgress({
        stage: 2,
        stepName: 'Connecting 15+ Verified Suppliers...',
        percent: 50,
        details: `Configuring ${demo.suppliers.length} suppliers and ${demo.categories.length} category classification trees.`,
      });
      const supBatch = writeBatch(firestore);
      demo.suppliers.forEach(s => {
        const ref = doc(firestore, 'users', uid, 'suppliers', s.id);
        supBatch.set(ref, cleanObject({ ...s, userId: uid }));
      });
      await supBatch.commit();

      const catBatch = writeBatch(firestore);
      demo.categories.forEach(c => {
        const ref = doc(firestore, 'users', uid, 'categories', c.id);
        catBatch.set(ref, cleanObject({ ...c, userId: uid }));
      });
      await catBatch.commit();

      // Step 3: Transactions & Orders
      setDemoProgress({
        stage: 3,
        stepName: 'Synthesizing 500+ Transactions & Orders...',
        percent: 75,
        details: `Processing ${demo.transactions.length} sales events, purchase orders & return trajectories.`,
      });
      const txBatches = [];
      for (let i = 0; i < demo.transactions.length; i += 450) {
        const batch = writeBatch(firestore);
        const chunk = demo.transactions.slice(i, i + 450);
        chunk.forEach(t => {
          const tId = (t.id && String(t.id).trim()) || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const ref = doc(firestore, 'users', uid, 'transactions', tId);
          batch.set(ref, cleanObject({ ...t, userId: uid, id: tId }));
        });
        txBatches.push(batch.commit());
      }
      await Promise.all(txBatches);

      const poBatch = writeBatch(firestore);
      demo.orders.forEach(o => {
        const oId = (o.id && String(o.id).trim()) || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const ref = doc(firestore, 'users', uid, 'orders', oId);
        poBatch.set(ref, cleanObject({ ...o, userId: uid, id: oId }));
      });
      demo.returns.forEach(r => {
        const rId = (r.id && String(r.id).trim()) || `ret-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const ref = doc(firestore, 'users', uid, 'returns', rId);
        poBatch.set(ref, cleanObject({ ...r, userId: uid, id: rId }));
      });
      await poBatch.commit();

      // Step 4: AI Copilot Calibration & Analytics
      setDemoProgress({
        stage: 4,
        stepName: 'Calibrating AI Copilot & Profit Models...',
        percent: 92,
        details: 'Calculating stock health, dead-stock risks, and executive intelligence metrics.',
      });
      await recalculateAndSaveAnalyticsSummary(firestore, uid, {
        products: demo.products,
        transactions: demo.transactions,
        suppliers: demo.suppliers,
        orders: demo.orders,
        returns: demo.returns,
      }).catch(console.error);

      setHasDemoData(true);

      const targetType = customType || businessProfile?.businessType || 'Fashion';
      await updateBusinessProfile({
        businessType: targetType,
        isOnboardingCompleted: true,
        inventorySetupMethod: 'demo',
      }, true);

      // Final Completion Flash
      setDemoProgress({
        stage: 4,
        stepName: 'Demo Business Loaded Successfully! 🚀',
        percent: 100,
        details: 'Ready to explore your complete business intelligence command center.',
      });

      // Brief cinematic delay to show 100% completion with glowing green checks
      await new Promise((res) => setTimeout(res, 600));

      setIsLoadingDemo(false);
      setShowWelcomeModal(true);
    } catch (err) {
      console.error("Error populating demo data:", err);
      setIsLoadingDemo(false);
      toast({ variant: 'destructive', title: 'Demo Business Error', description: 'Failed to populate full demo dataset.' });
    }
  }, [user, firestore, toast, businessProfile, updateBusinessProfile]);

  useEffect(() => {
    const storedCoupon = localStorage.getItem("analyzeup_applied_coupon");
    const stored = localStorage.getItem("analyzeup_subscription_plan");
    if (storedCoupon) {
      setActivePlanState(stored || "Enterprise Pro");
      return;
    }
    if (stored === "Pro Plan") {
      try {
        localStorage.setItem("analyzeup_subscription_plan", "Free Trial");
      } catch (e) {}
      setActivePlanState("Free Trial");
      return;
    }
    setActivePlanState(stored || "Free Trial");
  }, []);

  const activePlanLimit = useMemo(() => {
    const p = (activePlan || '').toUpperCase();
    if (p.includes('SCALE') || p.includes('ENTERPRISE') || p.includes('PRO')) return 500000;
    if (p.includes('GROWTH')) return 100000;
    if (p.includes('FOUNDER') || p.includes('STARTER')) return 50000;
    return 25000; // Free baseline allows 25,000 records
  }, [activePlan]);

  const isLimitExceeded = useMemo(() => {
    return products.length >= activePlanLimit;
  }, [products.length, activePlanLimit]);

  const handleUpgrade = useCallback(async (planId: string, amount: number, planName: string) => {
    setIsProcessingPayment(planId);
    try {
      // 1. Create order on backend
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, amount, planName }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Order creation failed");
      }

      const { order, keyId } = data;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: keyId || "rzp_test_T40kl4zsYBSbQl",
        amount: order.amount,
        currency: order.currency,
        name: "AnalyzeUp",
        description: `Upgrade to ${planName}`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            // 3. Verify payment signature on backend
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              await updateActivePlan(planName);
              setShowSubscriptionModal(false);
              toast({
                title: "Payment Successful!",
                description: `You have successfully upgraded to ${planName}.`,
              });
            } else {
              toast({
                title: "Verification Failed",
                description: "Payment verification failed. Please contact support.",
                variant: "destructive",
              });
            }
          } catch (err: any) {
            console.error("Verification error:", err);
            toast({
              title: "Verification Error",
              description: "An error occurred while verifying the payment.",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: "Workspace Owner",
          email: "owner@example.com",
        },
        theme: {
          color: "#9a3412",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        toast({
          title: "Payment Failed",
          description: response.error.description || "The transaction was unsuccessful.",
          variant: "destructive",
        });
      });
      rzp.open();
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast({
        title: "Checkout Error",
        description: error.message || "Could not launch Razorpay checkout modal.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(null);
    }
  }, [toast, updateActivePlan]);

  const isLoading = !user || productsLoading || transactionsLoading;

  const addCategory = useCallback(async (categoryData: Omit<Category, 'id' | 'userId'>) => {
    if (!firestore || !user || !categoriesRef) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add category.' });
      throw new Error("Not authenticated");
    }
    const newCategory = {
      ...categoryData,
      userId: user.uid,
    };
    addDoc(categoriesRef, newCategory).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: categoriesRef.path,
        operation: 'create',
        requestResourceData: newCategory,
      }));
    });
  }, [firestore, user, categoriesRef, toast]);


  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    if (isLimitExceeded) {
      setShowSubscriptionModal(true);
      toast({
        variant: 'destructive',
        title: 'Limit Exceeded',
        description: `You have reached the product limit (${activePlanLimit}) for your plan. Please upgrade to add more products.`,
      });
      return;
    }
    if (!firestore || !user || !productsRef || !transactionsRef) return;

    const batch = writeBatch(firestore);
    const newProductRef = doc(productsRef);

    const src = String(productData.source || '').toUpperCase();
    const impSrc = String((productData as any).importSource || '').toLowerCase();
    let sourceSubcol = 'csv_products';
    let canonicalSource = 'CSV';
    let canonicalImportSource = 'csv';
    if (src === 'SHOPIFY' || impSrc === 'shopify' || (productData as any).shopifyProductId) {
      sourceSubcol = 'shopify_products';
      canonicalSource = 'SHOPIFY';
      canonicalImportSource = 'shopify';
    } else if (src === 'GOOGLE_DRIVE' || impSrc === 'drive' || (productData as any).driveFileId) {
      sourceSubcol = 'drive_products';
      canonicalSource = 'GOOGLE_DRIVE';
      canonicalImportSource = 'drive';
    }

    const newProduct: any = {
      ...productData,
      source: canonicalSource,
      importSource: canonicalImportSource,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      averageDailySales: Math.floor(Math.random() * 10) + 1,
      leadTimeDays: Math.floor(Math.random() * 10) + 5,
    };
    batch.set(newProductRef, newProduct);
    batch.set(doc(firestore, 'users', user.uid, sourceSubcol, newProductRef.id), newProduct);

    // Touch user document
    batch.set(doc(firestore, 'users', user.uid), { uid: user.uid, updatedAt: serverTimestamp() }, { merge: true });

    if (newProduct.stock > 0) {
      const transRef = doc(transactionsRef);
      batch.set(transRef, {
        userId: user.uid,
        productId: newProductRef.id,
        locationId: 'MAIN-WAREHOUSE',
        type: 'Purchase',
        quantity: newProduct.stock,
        transactionDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit().catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productsRef.path,
        operation: 'create',
        requestResourceData: newProduct,
      }));
    });
    toast({ title: 'Product Added', description: `${productData.name} has been added.` });
  }, [firestore, user, productsRef, transactionsRef, toast, isLimitExceeded, activePlanLimit]);

  const addTransaction = useCallback(async (transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>) => {
    if (!firestore || !user || !transactionsRef) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add transaction.' });
      throw new Error("Not authenticated");
    }

    const newTransaction = cleanObject({
      ...transactionData,
      tenantId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await addDoc(transactionsRef, newTransaction);
    } catch (serverError: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: transactionsRef.path,
        operation: 'create',
        requestResourceData: newTransaction,
      }));
    }
  }, [firestore, user, transactionsRef, toast]);

  const bulkAddProducts = useCallback(async (
    productsData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[],
    overwriteStock = false,
    silent = false
  ) => {
    if (!firestore || !user || !productsRef || !transactionsRef) return { newCount: 0, updateCount: 0, skippedCount: 0 };

    // Automatically purge demo loaded data when real non-demo products are imported via CSV or Shopify
    if (hasDemoData && productsData.length > 0 && productsData.some(p => !(p as any).isDemo && (p as any).source !== 'DEMO')) {
      await purgeDemoDataOnly();
    }

    const existingProductByIdMap = new Map<string, Product>();
    const existingProductByVariantMap = new Map<string, Product>();
    const existingProductByShopifyProdMap = new Map<string, Product>();
    const existingProductSkuMap = new Map<string, Product>();
    const existingProductNameMap = new Map<string, Product>();

    products.forEach(p => {
      const validId = p.id && String(p.id).trim();
      if (validId) existingProductByIdMap.set(validId, p);
      if (p.shopifyVariantId) existingProductByVariantMap.set(String(p.shopifyVariantId), p);
      if (p.shopifyProductId && !p.shopifyVariantId) existingProductByShopifyProdMap.set(String(p.shopifyProductId), p);
      if (p.sku) existingProductSkuMap.set(p.sku.trim().toUpperCase(), p);
      if (p.name) existingProductNameMap.set(p.name.trim().toLowerCase(), p);
    });

    let newCount = 0;
    let updateCount = 0;
    let skippedCount = 0;

    const operations: Array<
      | { type: 'create'; id?: string; data: any }
      | { type: 'update'; id: string; data: any }
    > = [];

    productsData.forEach(productData => {
      const pAny = productData as any;
      const docId = pAny.id ? String(pAny.id).trim() : '';
      const shopifyVarId = pAny.shopifyVariantId ? String(pAny.shopifyVariantId).trim() : '';
      const shopifyProdId = pAny.shopifyProductId ? String(pAny.shopifyProductId).trim() : '';
      const skuUpper = (productData.sku || '').trim().toUpperCase();
      const nameLower = (productData.name || '').trim().toLowerCase();

      let candidate =
        (docId && existingProductByIdMap.get(docId)) ||
        (shopifyVarId && existingProductByVariantMap.get(shopifyVarId)) ||
        (skuUpper && existingProductSkuMap.get(skuUpper)) ||
        null;

      if (!candidate && !shopifyVarId) {
        candidate =
          (shopifyProdId && existingProductByShopifyProdMap.get(shopifyProdId)) ||
          (nameLower && existingProductNameMap.get(nameLower)) ||
          null;
      }

      if (candidate && shopifyVarId && candidate.shopifyVariantId && candidate.shopifyVariantId !== shopifyVarId) {
        if (candidate.id !== docId) {
          candidate = null;
        }
      }

      const existingProduct = candidate;

      if (existingProduct) {
        const nameChanged = Boolean(productData.name && productData.name !== existingProduct.name);
        const skuChanged = Boolean(productData.sku && productData.sku !== existingProduct.sku);
        const incomingPrice = productData.price !== undefined && !isNaN(Number(productData.price)) ? Number(productData.price) : existingProduct.price;
        const incomingCost = productData.costPrice !== undefined && !isNaN(Number(productData.costPrice)) ? Number(productData.costPrice) : existingProduct.costPrice;
        const incomingStock = productData.stock !== undefined && !isNaN(Number(productData.stock)) ? Number(productData.stock) : undefined;

        const finalStock = overwriteStock
          ? (incomingStock !== undefined ? incomingStock : existingProduct.stock)
          : (existingProduct.stock || 0) + (incomingStock || 0);

        const priceChanged = incomingPrice !== existingProduct.price;
        const costChanged = incomingCost !== existingProduct.costPrice;
        const stockChanged = incomingStock !== undefined && finalStock !== existingProduct.stock;
        const supplierChanged = Boolean(productData.supplier && productData.supplier !== existingProduct.supplier);
        const categoryChanged = Boolean(productData.category && productData.category !== existingProduct.category);
        const compareAtChanged = pAny.compareAtPrice !== undefined && pAny.compareAtPrice !== existingProduct.compareAtPrice;
        const shopifyProdIdChanged = Boolean(pAny.shopifyProductId && pAny.shopifyProductId !== existingProduct.shopifyProductId);
        const shopifyVarIdChanged = Boolean(pAny.shopifyVariantId && pAny.shopifyVariantId !== existingProduct.shopifyVariantId);

        const hasUpdate = nameChanged || skuChanged || priceChanged || costChanged || stockChanged || supplierChanged || categoryChanged || compareAtChanged || shopifyProdIdChanged || shopifyVarIdChanged;

        if (!hasUpdate) {
          skippedCount++;
          return;
        }

        const validExistingId = (existingProduct.id && String(existingProduct.id).trim()) || '';
        const targetId = validExistingId || (pAny.id && String(pAny.id).trim()) || generateProductDocId(productData.sku, productData.name);

        const updatedProduct: Product = {
          ...existingProduct,
          id: targetId,
          ...(nameChanged ? { name: productData.name } : {}),
          ...(skuChanged ? { sku: productData.sku } : {}),
          ...(priceChanged ? { price: incomingPrice } : {}),
          ...(costChanged ? { costPrice: incomingCost } : {}),
          ...(stockChanged ? { stock: finalStock } : {}),
        };
        existingProductByIdMap.set(targetId, updatedProduct);
        if (updatedProduct.sku) existingProductSkuMap.set(updatedProduct.sku.trim().toUpperCase(), updatedProduct);
        if (updatedProduct.name) existingProductNameMap.set(updatedProduct.name.trim().toLowerCase(), updatedProduct);

        operations.push({
          type: 'update',
          id: targetId,
          data: cleanObject({
            ...(nameChanged ? { name: productData.name } : {}),
            ...(skuChanged ? { sku: productData.sku } : {}),
            ...(priceChanged ? { price: incomingPrice } : {}),
            ...(costChanged ? { costPrice: incomingCost } : {}),
            ...(stockChanged ? { stock: finalStock } : {}),
            ...(supplierChanged ? { supplier: productData.supplier, supplierId: productData.supplierId || existingProduct.supplierId } : {}),
            ...(categoryChanged ? { category: productData.category, categoryId: productData.categoryId || existingProduct.categoryId } : {}),
            ...(compareAtChanged ? { compareAtPrice: pAny.compareAtPrice } : {}),
            ...(shopifyProdIdChanged ? { shopifyProductId: pAny.shopifyProductId } : {}),
            ...(shopifyVarIdChanged ? { shopifyVariantId: pAny.shopifyVariantId } : {}),
            ...(pAny.source ? { source: pAny.source } : {}),
            updatedAt: serverTimestamp(),
          }),
        });
        updateCount++;
      } else {
        const rawTargetId = pAny.id ? String(pAny.id).trim() : '';
        const targetId = rawTargetId || generateProductDocId(productData.sku, productData.name);
        const newProductRecord: any = {
          ...productData,
          id: targetId,
          userId: user.uid,
          stock: productData.stock !== undefined && !isNaN(Number(productData.stock)) ? Number(productData.stock) : 0,
          minStock: productData.minStock !== undefined ? Number(productData.minStock) : 0,
          averageDailySales: productData.averageDailySales ?? 0,
          leadTimeDays: productData.leadTimeDays ?? 0,
        };

        existingProductByIdMap.set(targetId, newProductRecord);
        if (skuUpper) existingProductSkuMap.set(skuUpper, newProductRecord);
        if (nameLower) existingProductNameMap.set(nameLower, newProductRecord);
        if (shopifyVarId) existingProductByVariantMap.set(shopifyVarId, newProductRecord);
        if (shopifyProdId && !shopifyVarId) existingProductByShopifyProdMap.set(shopifyProdId, newProductRecord);

        operations.push({
          type: 'create',
          id: targetId,
          data: cleanObject({
            ...newProductRecord,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        });
        newCount++;
      }
    });

    if (operations.length === 0) {
      if (skippedCount > 0 && !silent) {
        toast({
          title: 'Catalog Up to Date ✨',
          description: `All ${skippedCount} products are already present in your database. No duplicate records imported.`,
        });
      }
      return { newCount: 0, updateCount: 0, skippedCount };
    }

    const CHUNK_SIZE = 200;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);

      // Touch parent user document in the batch
      const userDocRef = doc(firestore, 'users', user.uid);
      batch.set(userDocRef, {
        uid: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      chunk.forEach(op => {
        const validId = (op.id && String(op.id).trim()) || '';
        const rawTargetId = validId || (op.type === 'create' ? doc(productsRef).id : '');

        // Categorize into destination subcollection
        const src = String(op.data?.source || '').toUpperCase();
        const impSrc = String(op.data?.importSource || '').toLowerCase();
        let sourceSubcol = 'csv_products';
        let canonicalSource = 'CSV';
        let canonicalImportSource = 'csv';

        if (src === 'SHOPIFY' || impSrc === 'shopify' || rawTargetId.startsWith('shopify_') || op.data?.shopifyProductId) {
          sourceSubcol = 'shopify_products';
          canonicalSource = 'SHOPIFY';
          canonicalImportSource = 'shopify';
        } else if (src === 'GOOGLE_DRIVE' || impSrc === 'drive' || rawTargetId.startsWith('drive_') || op.data?.driveFileId) {
          sourceSubcol = 'drive_products';
          canonicalSource = 'GOOGLE_DRIVE';
          canonicalImportSource = 'drive';
        }

        const enrichedData = {
          ...op.data,
          source: canonicalSource,
          importSource: canonicalImportSource,
        };

        if (op.type === 'update') {
          if (validId) {
            const productRef = doc(productsRef, validId);
            batch.set(productRef, enrichedData, { merge: true });
            const sourceRef = doc(firestore, 'users', user.uid, sourceSubcol, validId);
            batch.set(sourceRef, enrichedData, { merge: true });
          } else {
            const newProductRef = doc(productsRef);
            batch.set(newProductRef, enrichedData, { merge: true });
            const sourceRef = doc(firestore, 'users', user.uid, sourceSubcol, newProductRef.id);
            batch.set(sourceRef, enrichedData, { merge: true });
          }
        } else {
          const newProductRef = validId ? doc(productsRef, validId) : doc(productsRef);
          batch.set(newProductRef, enrichedData, { merge: true });
          const sourceRef = doc(firestore, 'users', user.uid, sourceSubcol, newProductRef.id);
          batch.set(sourceRef, enrichedData, { merge: true });

          if (op.data.stock > 0) {
            const transRef = doc(transactionsRef);
            batch.set(transRef, cleanObject({
              userId: user.uid,
              productId: newProductRef.id,
              locationId: 'MAIN-WAREHOUSE',
              type: 'Purchase',
              quantity: op.data.stock,
              transactionDate: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }));
          }
        }
      });

      await batch.commit().catch((_serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: productsRef.path,
          operation: 'create',
          requestResourceData: 'Bulk Product Add',
        }));
      });
      await new Promise(r => setTimeout(r, 10));
    }

    if (!businessProfile?.firstImportedAt) {
      updateBusinessProfile({ firstImportedAt: new Date().toISOString() }, true).catch(console.warn);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
      window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
      window.dispatchEvent(new CustomEvent('analyzeup_drive_synced', { detail: { newCount, updateCount, skippedCount } }));
    }

    if (!silent) {
      toast({
        title: 'Catalog Data Synced ✨',
        description: `${newCount} new products added, ${updateCount} updated (${skippedCount} already present skipped).`,
      });
    }
    return { newCount, updateCount, skippedCount };
  }, [firestore, user, productsRef, transactionsRef, products, toast, businessProfile, updateBusinessProfile]);

  const bulkUpdateProducts = useCallback(async (updates: (Partial<Product> & { id: string })[]) => {
    if (!firestore || !user || !productsRef) return;

    const validUpdates = updates.filter(u => u && u.id && String(u.id).trim().length > 0);
    if (validUpdates.length === 0) return;

    const CHUNK_SIZE = 450;
    for (let i = 0; i < validUpdates.length; i += CHUNK_SIZE) {
      const chunk = validUpdates.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);

      chunk.forEach(update => {
        const validId = String(update.id).trim();
        const productRef = doc(productsRef, validId);
        batch.set(productRef, cleanObject({
          ...update,
          updatedAt: serverTimestamp(),
        }), { merge: true });
      });

      await batch.commit().catch((_serverError) => {
        console.error("Bulk update failed:", _serverError);
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
      window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
    }
  }, [firestore, user, productsRef]);

  const bulkDeleteProducts = useCallback(async (productIds: string[]) => {
    if (!firestore || !user || productIds.length === 0) return;

    const validIds = productIds.filter(id => id && String(id).trim().length > 0);
    if (validIds.length === 0) return;

    const CHUNK_SIZE = 450;
    const deletePromises: Promise<void>[] = [];

    for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
      const chunk = validIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);
      chunk.forEach(id => {
        const validId = String(id).trim();
        const productRef = doc(firestore, 'users', user.uid, 'products', validId);
        batch.delete(productRef);
      });
      deletePromises.push(
        batch.commit().catch(err => {
          console.error('Bulk delete failed:', err);
        })
      );
    }
    await Promise.all(deletePromises);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
      window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
    }

    toast({
      title: 'Products Deleted',
      description: `Removed ${productIds.length} products from your catalog.`,
    });
  }, [firestore, user, toast]);

  const bulkAddTransactions = useCallback(async (
    transactionsData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>[],
    silent = false
  ) => {
    if (!firestore || !user || !transactionsRef) return { newCount: 0, updateCount: 0, skippedCount: 0 };

    const getTxFingerprint = (t: any) => {
      const prod = (t.productName || t.productId || '').trim().toLowerCase();
      const date = (t.transactionDate || '').trim();
      const qty = Number(t.quantity || 1);
      const rev = Number(t.totalRevenue || t.price || 0);
      const cust = (t.customerName || '').trim().toLowerCase();
      return `${prod}|${date}|${qty}|${rev}|${cust}`;
    };

    const existingMapByLineItemKey = new Map<string, Transaction>();
    const existingMapByOrderNo = new Map<string, Transaction[]>();
    const existingMapByFingerprint = new Map<string, Transaction>();

    transactions.forEach(t => {
      const normOrder = normalizeOrderNumber(t.orderNumber);
      const lineKey = generateOrderLineItemKey(
        t.orderNumber,
        (t as any).sku,
        t.productName,
        typeof t.transactionDate === 'string' ? t.transactionDate : undefined,
        t.quantity
      );
      if (lineKey) existingMapByLineItemKey.set(lineKey, t);

      if (normOrder) {
        const list = existingMapByOrderNo.get(normOrder) || [];
        list.push(t);
        existingMapByOrderNo.set(normOrder, list);
      }
      existingMapByFingerprint.set(getTxFingerprint(t), t);
    });

    let newCount = 0;
    let updateCount = 0;
    let skippedCount = 0;

    const operations: Array<
      | { type: 'create'; id?: string; data: any }
      | { type: 'update'; id: string; data: any }
    > = [];

    transactionsData.forEach(t => {
      const normOrder = normalizeOrderNumber(t.orderNumber);
      const lineKey = generateOrderLineItemKey(
        t.orderNumber,
        (t as any).sku,
        t.productName,
        typeof t.transactionDate === 'string' ? t.transactionDate : undefined,
        t.quantity
      );
      const fingerprint = getTxFingerprint(t);

      let existing: Transaction | null = null;
      if (lineKey && existingMapByLineItemKey.has(lineKey)) {
        existing = existingMapByLineItemKey.get(lineKey)!;
      } else if (normOrder && existingMapByOrderNo.has(normOrder)) {
        const matchingOrders = existingMapByOrderNo.get(normOrder)!;
        const incomingSku = ((t as any).sku || '').trim().toUpperCase();
        const incomingProd = (t.productName || '').trim().toLowerCase();
        const found = matchingOrders.find(o => {
          const oSku = ((o as any).sku || '').trim().toUpperCase();
          const oProd = (o.productName || '').trim().toLowerCase();
          if (incomingSku && oSku && incomingSku === oSku) return true;
          if (incomingProd && oProd && incomingProd === oProd) return true;
          return false;
        });
        if (found) existing = found;
      } else if (fingerprint && existingMapByFingerprint.has(fingerprint)) {
        existing = existingMapByFingerprint.get(fingerprint)!;
      }

      if (existing) {
        const isStatusChanged = t.status && t.status !== existing.status;
        const isPaymentChanged = t.paymentMethod && t.paymentMethod !== existing.paymentMethod;
        const isFinancialChanged = (t as any).financialStatus && (t as any).financialStatus !== (existing as any).financialStatus;
        const isPaymentReceivedChanged = (t as any).paymentReceived !== undefined && (t as any).paymentReceived !== (existing as any).paymentReceived;
        const isFulfillmentChanged = (t as any).fulfillmentStatus && (t as any).fulfillmentStatus !== (existing as any).fulfillmentStatus;

        if (!isStatusChanged && !isPaymentChanged && !isFinancialChanged && !isPaymentReceivedChanged && !isFulfillmentChanged) {
          skippedCount++;
          return;
        }

        const validExistingId = (existing.id && String(existing.id).trim()) || '';
        const targetId = validExistingId || (t as any).id || (t.orderNumber ? generateTransactionDocId(t.orderNumber, (t as any).sku, typeof t.transactionDate === 'string' ? t.transactionDate : undefined, updateCount) : `tx_${Date.now().toString(36)}_${updateCount}_${Math.random().toString(36).slice(2, 6)}`);

        operations.push({
          type: 'update',
          id: targetId,
          data: cleanObject({
            ...(isStatusChanged ? { status: t.status } : {}),
            ...(isPaymentChanged ? { paymentMethod: t.paymentMethod } : {}),
            ...(isFinancialChanged ? { financialStatus: (t as any).financialStatus } : {}),
            ...(isPaymentReceivedChanged ? { paymentReceived: (t as any).paymentReceived } : {}),
            ...(isFulfillmentChanged ? { fulfillmentStatus: (t as any).fulfillmentStatus } : {}),
            ...((t as any).isRevenueRecognized !== undefined ? { isRevenueRecognized: (t as any).isRevenueRecognized } : {}),
            updatedAt: serverTimestamp(),
          }),
        });
        updateCount++;
      } else {
        if (lineKey) existingMapByLineItemKey.set(lineKey, t as any);
        if (normOrder) {
          const list = existingMapByOrderNo.get(normOrder) || [];
          list.push(t as any);
          existingMapByOrderNo.set(normOrder, list);
        }
        existingMapByFingerprint.set(fingerprint, t as any);

        const incomingSource = (t as any).source || (String((t as any).id || '').startsWith('tx_shopify_') ? 'SHOPIFY' : 'Sync');
        const rawTargetId = ((t as any).id && String((t as any).id).trim()) || ((t as any).transactionId && String((t as any).transactionId).trim()) || '';
        const targetDocId = rawTargetId || (t.orderNumber ? generateTransactionDocId(t.orderNumber, (t as any).sku, typeof t.transactionDate === 'string' ? t.transactionDate : undefined, newCount) : `tx_${Date.now().toString(36)}_${newCount}_${Math.random().toString(36).slice(2, 6)}`);

        operations.push({
          type: 'create',
          id: targetDocId,
          data: cleanObject({
            ...t,
            id: targetDocId,
            orderNumber: t.orderNumber || `ORD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            source: incomingSource,
            tenantId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        });
        newCount++;
      }
    });

    if (operations.length === 0) {
      if (skippedCount > 0 && !silent) {
        toast({
          title: 'Transactions Up to Date ✨',
          description: `All ${skippedCount} transactions are already present in your database. No duplicates added.`,
        });
      }
      return { newCount: 0, updateCount: 0, skippedCount };
    }

    const CHUNK_SIZE = 400;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);

      chunk.forEach(op => {
        const validId = (op.id && String(op.id).trim()) || '';
        if (op.type === 'update') {
          if (validId) {
            const transDocRef = doc(transactionsRef, validId);
            batch.set(transDocRef, op.data, { merge: true });
          } else {
            const newTransDocRef = doc(transactionsRef);
            batch.set(newTransDocRef, {
              ...op.data,
              id: newTransDocRef.id,
            });
          }
        } else {
          const newTransDocRef = validId ? doc(transactionsRef, validId) : doc(transactionsRef);
          batch.set(newTransDocRef, {
            ...op.data,
            id: newTransDocRef.id,
          });
        }
      });

      await batch.commit().catch((_serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: transactionsRef.path,
          operation: 'create',
          requestResourceData: 'Bulk Transaction Add',
        }));
      });
      await new Promise(r => setTimeout(r, 10));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
      window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
      window.dispatchEvent(new CustomEvent('analyzeup_drive_synced', { detail: { newCount, updateCount, skippedCount } }));
    }

    if (!silent) {
      toast({
        title: 'Sales Transactions Synced ✨',
        description: `${newCount} new transaction(s) added, ${updateCount} updated (${skippedCount} already present skipped).`,
      });
    }
    return { newCount, updateCount, skippedCount };
  }, [firestore, user, transactionsRef, transactions, toast]);

  const bulkAddReturns = useCallback(async (
    returnsData: (Omit<ProductReturn, 'createdAt' | 'updatedAt' | 'userId'> & { id?: string })[],
    silent = false
  ) => {
    if (!firestore || !user || !returnsRef || !transactionsRef) return { newCount: 0, updateCount: 0, skippedCount: 0 };

    const existingMapById = new Map<string, ProductReturn>();
    const existingMapByFingerprint = new Map<string, ProductReturn>();

    const getReturnFingerprint = (r: any) => {
      const ord = (r.orderNumber || '').trim().toUpperCase();
      const prod = (r.productId || r.productName || '').trim().toLowerCase();
      const qty = Number(r.quantity || 1);
      const amt = Number(r.refundAmount || 0);
      const d = (r.returnDate || '').trim();
      return `${ord}|${prod}|${qty}|${amt}|${d}`;
    };

    returns.forEach(r => {
      if (r.id) existingMapById.set(r.id, r);
      existingMapByFingerprint.set(getReturnFingerprint(r), r);
    });

    let newCount = 0;
    let updateCount = 0;
    let skippedCount = 0;

    const operations: Array<
      | { type: 'create'; id: string; data: any; rawReturn: any }
      | { type: 'update'; id: string; data: any; rawReturn: any }
    > = [];

    returnsData.forEach(r => {
      const fingerprint = getReturnFingerprint(r);
      const existing = (r.id ? existingMapById.get(r.id) : null) || existingMapByFingerprint.get(fingerprint);

      if (existing) {
        const isStatusChanged = r.refundStatus && r.refundStatus !== existing.refundStatus;
        const isActionChanged = r.actionTaken && r.actionTaken !== existing.actionTaken;
        const isAmountChanged = r.refundAmount !== undefined && r.refundAmount !== existing.refundAmount;
        const isReasonChanged = r.reason && r.reason !== existing.reason && (existing.reason === 'Other' || !existing.reason);
        const isProductResolved = r.productId && existing.productId?.startsWith('shopify_order_') && !r.productId.startsWith('shopify_order_');

        if (!isStatusChanged && !isActionChanged && !isAmountChanged && !isReasonChanged && !isProductResolved) {
          skippedCount++;
          return;
        }

        operations.push({
          type: 'update',
          id: existing.id,
          data: cleanObject({
            ...(isStatusChanged ? { refundStatus: r.refundStatus } : {}),
            ...(isActionChanged ? { actionTaken: r.actionTaken } : {}),
            ...(isAmountChanged ? { refundAmount: r.refundAmount } : {}),
            ...(isReasonChanged ? { reason: r.reason } : {}),
            ...(isProductResolved ? { productId: r.productId, productName: r.productName, sku: r.sku } : {}),
            updatedAt: serverTimestamp(),
          }),
          rawReturn: { ...existing, ...r },
        });
        updateCount++;
      } else {
        const returnId = r.id || `ret_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

        // Match against existing catalog products if productId is raw or missing
        const matchedProduct = products.find(p =>
          p.id === r.productId ||
          (r.sku && p.sku && p.sku.toLowerCase() === r.sku.toLowerCase()) ||
          (p.shopifyProductId && r.productId && r.productId.includes(p.shopifyProductId)) ||
          (p.name && r.productName && p.name.trim().toLowerCase() === r.productName.trim().toLowerCase())
        );

        const finalProductId = matchedProduct?.id || r.productId;
        const finalProductName = matchedProduct?.name || r.productName;
        const finalSku = matchedProduct?.sku || r.sku;

        if (r.id) existingMapById.set(r.id, { ...r, id: returnId, productId: finalProductId, productName: finalProductName, sku: finalSku } as any);
        existingMapByFingerprint.set(fingerprint, { ...r, id: returnId, productId: finalProductId, productName: finalProductName, sku: finalSku } as any);

        operations.push({
          type: 'create',
          id: returnId,
          data: cleanObject({
            ...r,
            productId: finalProductId,
            productName: finalProductName,
            sku: finalSku,
            id: returnId,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          rawReturn: { ...r, productId: finalProductId, productName: finalProductName, sku: finalSku, id: returnId },
        });
        newCount++;
      }
    });

    if (operations.length === 0) {
      if (skippedCount > 0 && !silent) {
        toast({
          title: 'Returns Up to Date ✨',
          description: `All ${skippedCount} returns/refunds are already recorded. No duplicates created.`,
        });
      }
      return { newCount: 0, updateCount: 0, skippedCount };
    }

    const CHUNK_SIZE = 250;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);

      chunk.forEach(op => {
        const validId = (op.id && String(op.id).trim()) || `ret_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const returnDocRef = doc(returnsRef, validId);
        if (op.type === 'update') {
          batch.set(returnDocRef, op.data, { merge: true });
        } else {
          batch.set(returnDocRef, op.data);

          // If restocked, update product stock in Firestore
          if (op.rawReturn.actionTaken === 'Restocked' && op.rawReturn.productId) {
            const product = products.find(p => p.id === op.rawReturn.productId || (op.rawReturn.sku && p.sku === op.rawReturn.sku));
            if (product && product.id && String(product.id).trim()) {
              const productRef = doc(firestore, 'users', user.uid, 'products', String(product.id).trim());
              batch.update(productRef, {
                stock: product.stock + Math.abs(op.rawReturn.quantity || 1),
                updatedAt: serverTimestamp(),
              });
            }
          }

          // If refunded, record deterministic Sale adjustment transaction (negative sales!)
          if (op.rawReturn.refundStatus === 'Refunded' || op.rawReturn.refundStatus === 'Store Credit') {
            const product = products.find(p => p.id === op.rawReturn.productId || (op.rawReturn.sku && p.sku === op.rawReturn.sku));
            const refundTxId = `tx_refund_${validId}`;
            const transRef = doc(transactionsRef, refundTxId);
            batch.set(transRef, cleanObject({
              id: refundTxId,
              tenantId: user.uid,
              userId: user.uid,
              productId: product?.id || op.rawReturn.productId || 'REFUNDED-ITEM',
              productName: op.rawReturn.productName || product?.name || 'Returned Item',
              sku: product?.sku || op.rawReturn.sku || 'N/A',
              category: product?.category || product?.categoryId || 'Returns',
              locationId: 'MAIN-WAREHOUSE',
              type: 'Sale',
              quantity: -Math.abs(op.rawReturn.quantity || 1),
              price: product?.price || (op.rawReturn.quantity > 0 ? op.rawReturn.refundAmount / op.rawReturn.quantity : op.rawReturn.refundAmount),
              unitPrice: product?.price || (op.rawReturn.quantity > 0 ? op.rawReturn.refundAmount / op.rawReturn.quantity : op.rawReturn.refundAmount),
              totalRevenue: -Math.abs(op.rawReturn.refundAmount || 0),
              costPrice: product?.costPrice || (product?.price ? Math.round(product.price * 0.6) : 0),
              costPerUnit: product?.costPrice || 0,
              totalCost: product?.costPrice ? -(product.costPrice * Math.abs(op.rawReturn.quantity || 1)) : 0,
              customerName: op.rawReturn.customerName || 'Online Customer',
              orderNumber: op.rawReturn.orderNumber || `RET-${op.id}`,
              transactionDate: op.rawReturn.returnDate || new Date().toISOString().split('T')[0],
              source: op.rawReturn.source || 'SHOPIFY',
              status: 'Completed',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }), { merge: true });
          }
        }
      });

      await batch.commit().catch((_serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: returnsRef.path,
          operation: 'create',
          requestResourceData: 'Bulk Return Add',
        }));
      });
      await new Promise(r => setTimeout(r, 10));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
      window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
      window.dispatchEvent(new CustomEvent('analyzeup_returns_synced', { detail: { newCount, updateCount, skippedCount } }));
    }

    if (!silent) {
      toast({
        title: 'Returns & Refunds Synced ✨',
        description: `${newCount} new return(s) logged, ${updateCount} updated (${skippedCount} already present skipped).`,
      });
    }
    return { newCount, updateCount, skippedCount };
  }, [firestore, user, returnsRef, transactionsRef, returns, products, toast]);

  const vectorizeAndSyncAiChatbot = useCallback(async () => {
    try {
      const { vectorizeWorkspaceData } = await import('@/ai/flows/chat');
      const stats = await vectorizeWorkspaceData(
        sanitizePlainData(products),
        sanitizePlainData(transactions),
        sanitizePlainData(suppliers),
        sanitizePlainData(orders),
        sanitizePlainData(returns),
        sanitizePlainData(businessProfile)
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analyzeup_vectors_updated', { detail: stats }));
      }
      return stats;
    } catch (err) {
      console.warn('[DataContext] Vectorization after sync notice:', err);
      return { success: false, totalVectors: 0, status: 'FAILED' };
    }
  }, [products, transactions, suppliers, orders, returns, businessProfile]);

  const updateProduct = useCallback(async (updatedProduct: Product, options?: { silentToast?: boolean; forceShopifySync?: boolean }) => {
    if (!firestore || !user || !updatedProduct?.id || !String(updatedProduct.id).trim()) return;
    const cleanId = String(updatedProduct.id).trim();
    const existingProduct = products.find(p => p.id === cleanId);
    const productRef = doc(firestore, 'users', user.uid, 'products', cleanId);

    const newPrice = updatedProduct.price;
    const compareAtPrice =
      updatedProduct.compareAtPrice !== undefined
        ? updatedProduct.compareAtPrice
        : (existingProduct?.compareAtPrice && existingProduct.compareAtPrice > newPrice)
        ? existingProduct.compareAtPrice
        : (existingProduct && existingProduct.price > newPrice)
        ? existingProduct.price
        : undefined;

    const oldPrice =
      compareAtPrice !== undefined
        ? compareAtPrice
        : existingProduct?.price !== undefined
        ? existingProduct.price
        : newPrice;

    const { id, ...updateData } = updatedProduct;
    const dataToUpdate: any = cleanObject({
      ...updateData,
      price: newPrice,
      ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
      ...(compareAtPrice && compareAtPrice > newPrice ? { discountPercent: Math.round(((compareAtPrice - newPrice) / compareAtPrice) * 100) } : {}),
      updatedAt: serverTimestamp(),
    });

    try {
      await setDoc(productRef, dataToUpdate, { merge: true });
    } catch (_serverError) {
      console.error('[DataContext] Error writing product to Firestore database:', _serverError);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productRef.path,
        operation: 'update',
        requestResourceData: dataToUpdate,
      }));
      throw _serverError;
    }

    const isPriceChanged = Boolean(existingProduct && existingProduct.price !== updatedProduct.price);
    const isCompareAtChanged = Boolean(compareAtPrice && compareAtPrice !== existingProduct?.compareAtPrice);
    let shop = businessProfile?.shopifyStoreUrl;
    let token = businessProfile?.shopifyAccessToken;
    if ((!shop || !token) && firestore && user?.uid) {
      try {
        const intSnap = await getDoc(doc(firestore, 'users', user.uid, 'integrations', 'shopify'));
        if (intSnap.exists()) {
          const intData = intSnap.data();
          if (intData?.shopDomain && !shop) shop = intData.shopDomain;
          if (intData?.accessToken && !token) token = intData.accessToken;
        }
      } catch (err) {
        console.warn('[DataContext] Integration lookup fallback notice:', err);
      }
    }

    const isShopifyProduct = Boolean(
      updatedProduct.shopifyProductId ||
      existingProduct?.shopifyProductId ||
      updatedProduct.shopifyVariantId ||
      existingProduct?.shopifyVariantId ||
      updatedProduct.source === 'shopify' ||
      updatedProduct.source === 'SHOPIFY' ||
      (typeof updatedProduct.sku === 'string' && updatedProduct.sku.startsWith('SHOPIFY-')) ||
      (typeof updatedProduct.supplier === 'string' && updatedProduct.supplier.toLowerCase().includes('shopify'))
    );
    const shouldSyncShopify = Boolean(
      (isPriceChanged || isCompareAtChanged || options?.forceShopifySync) &&
      (shop || isShopifyProduct || Boolean(businessProfile?.shopifyConnected))
    );

    // Automatically synchronize discounted price with Shopify store & backend database
    if (shouldSyncShopify) {
      try {
        const res = await fetch('/api/shopify/price/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop,
            accessToken: token,
            userId: user.uid,
            tenantId: user.uid,
            productId: cleanId,
            shopifyProductId: updatedProduct.shopifyProductId || existingProduct?.shopifyProductId,
            shopifyVariantId: updatedProduct.shopifyVariantId || existingProduct?.shopifyVariantId,
            sku: updatedProduct.sku || existingProduct?.sku,
            productName: updatedProduct.name || existingProduct?.name,
            newPrice,
            oldPrice,
            compareAtPrice,
            updateAllVariants: false,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const discountPct = oldPrice > newPrice ? Math.round(((oldPrice - newPrice) / oldPrice) * 100) : 0;
          const discountTag = discountPct > 0 ? ` (-${discountPct}% Off)` : '';
          const countMsg = data.shopifyResult?.updatedVariantsCount && data.shopifyResult.updatedVariantsCount > 1
            ? ` across all ${data.shopifyResult.updatedVariantsCount} variants`
            : '';
          if (!options?.silentToast) {
            toast({
              title: 'Database & Shopify Synchronized ⚡',
              description: `"${updatedProduct.name}" price updated to ₹${newPrice.toLocaleString('en-IN')}${discountTag}${countMsg} in database and live store.`,
            });
          }
        } else if (data.reinstallRequired || data.scopeMissing === 'write_products') {
          toast({
            variant: 'destructive',
            title: 'Database Updated (Shopify Scope Required)',
            description: 'Price saved to database! To push live to Shopify, please enable write_products in your Shopify app permissions.',
          });
        } else if (!data.skipped) {
          console.warn('[Shopify Price Sync Notice]:', data.error);
        }
      } catch (err) {
        console.warn('[Shopify Price Sync Network Error]:', err);
      }
    }

    // Persist and recalculate analytics summary in Firestore
    const updatedProductsList = products.map(p => p.id === cleanId ? { ...p, ...updatedProduct, id: cleanId } : p);
    recalculateAndSaveAnalyticsSummary(firestore, user.uid, {
      products: updatedProductsList,
      transactions,
      suppliers,
      orders,
      returns,
    }).catch(console.warn);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
      window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
    }

    if (!options?.silentToast && !shouldSyncShopify) {
      toast({ title: 'Product Updated in Database', description: `${updatedProduct.name} has been updated.` });
    }
  }, [firestore, user, products, transactions, suppliers, orders, returns, businessProfile, toast]);

  const deleteProduct = useCallback(async (productId: string) => {
    if (!firestore || !user || !productId || !String(productId).trim()) return;
    const cleanId = String(productId).trim();
    const productRef = doc(firestore, 'users', user.uid, 'products', cleanId);
    await deleteDoc(productRef).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productRef.path,
        operation: 'delete',
      }));
    });
    // Also clean up from source-specific subcollections if present
    await deleteDoc(doc(firestore, 'users', user.uid, 'shopify_products', cleanId)).catch(() => {});
    await deleteDoc(doc(firestore, 'users', user.uid, 'drive_products', cleanId)).catch(() => {});
    await deleteDoc(doc(firestore, 'users', user.uid, 'csv_products', cleanId)).catch(() => {});
    toast({ title: 'Product Deleted', description: 'The product has been removed.' });
  }, [firestore, user, toast]);

  const addOrder = useCallback(async (orderData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    if (!firestore || !user || !ordersRef || !transactionsRef) return;

    const batch = writeBatch(firestore);
    const orderStatus = orderData.status || 'Pending';

    const newOrderRef = doc(ordersRef);
    const newOrder = cleanObject({
      ...orderData,
      status: orderStatus,
      id: newOrderRef.id,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(newOrderRef, newOrder);

    // Only if explicitly created as Fulfilled (e.g. historical import), handle stock replenishment immediately
    if (orderStatus === 'Fulfilled' && orderData.productId && String(orderData.productId).trim()) {
      const cleanProdId = String(orderData.productId).trim();
      const productRef = doc(firestore, 'users', user.uid, 'products', cleanProdId);
      const product = products.find(p => p.id === cleanProdId);
      if (product) {
        batch.update(productRef, {
          stock: product.stock + orderData.quantity,
          updatedAt: serverTimestamp()
        });

        const transactionRef = doc(transactionsRef);
        const costPrice = product.costPrice || product.price * 0.6;
        batch.set(transactionRef, cleanObject({
          id: transactionRef.id,
          tenantId: user.uid,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          category: product.categoryId,
          locationId: 'MAIN-WAREHOUSE',
          type: 'Purchase',
          quantity: orderData.quantity,
          price: costPrice,
          totalCost: Math.round(costPrice * orderData.quantity),
          supplier: suppliers.find(s => s.id === orderData.supplierId)?.name || 'Supplier',
          transactionDate: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
      }
    }

    await batch.commit().catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'batch-write',
        operation: 'create',
        requestResourceData: { order: newOrder },
      }));
    });
    const supplierName = suppliers.find(s => s.id === newOrder.supplierId)?.name || 'the supplier';
    toast({
      title: orderStatus === 'Pending' ? '📦 Purchase Order Created (In Transit)' : 'Order Created',
      description: `Purchase order for ${orderData.quantity} units from ${supplierName} recorded. Stock will update once marked received.`,
    });
  }, [firestore, user, ordersRef, suppliers, toast, products, transactionsRef]);

  const deleteOrder = useCallback(async (orderId: string) => {
    if (!firestore || !user || !orderId || !String(orderId).trim()) return;
    const cleanId = String(orderId).trim();
    const orderRef = doc(firestore, 'users', user.uid, 'orders', cleanId);
    await deleteDoc(orderRef).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: orderRef.path,
        operation: 'delete',
      }));
    });
    toast({ title: 'Order Deleted', description: 'The purchase order has been removed.' });
  }, [firestore, user, toast]);

  const receivePurchaseOrder = useCallback(async (orderId: string, customReceivedQty?: number) => {
    if (!firestore || !user || !ordersRef || !transactionsRef || !orderId || !String(orderId).trim()) return;
    const cleanOrderId = String(orderId).trim();
    const orderToUpdate = orders.find(o => o.id === cleanOrderId);
    if (!orderToUpdate) return;

    if (orderToUpdate.status === 'Fulfilled') {
      toast({ title: 'Already Received', description: 'This purchase order has already been received and added to inventory.' });
      return;
    }

    const receivedQty = customReceivedQty !== undefined ? customReceivedQty : orderToUpdate.quantity;
    const batch = writeBatch(firestore);
    const orderRef = doc(firestore, 'users', user.uid, 'orders', cleanOrderId);

    batch.update(orderRef, {
      status: 'Fulfilled',
      actualDeliveryDate: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    const product = products.find(p => p.id === orderToUpdate.productId);
    if (product && product.id && String(product.id).trim()) {
      const productRef = doc(firestore, 'users', user.uid, 'products', String(product.id).trim());
      const newStock = (product.stock || 0) + receivedQty;
      batch.update(productRef, {
        stock: newStock,
        updatedAt: serverTimestamp(),
      });

      const costPrice = orderToUpdate.unitCost || product.costPrice || product.price * 0.6;
      const totalCost = Math.round(costPrice * receivedQty);
      const supplierName = suppliers.find(s => s.id === orderToUpdate.supplierId)?.name || 'Supplier';

      const transactionRef = doc(transactionsRef);
      batch.set(transactionRef, cleanObject({
        id: transactionRef.id,
        tenantId: user.uid,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.categoryId,
        locationId: 'MAIN-WAREHOUSE',
        type: 'Purchase',
        quantity: receivedQty,
        price: costPrice,
        totalCost: totalCost,
        supplier: supplierName,
        transactionDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      logBusinessAction({
        title: 'Purchase Order Received & Stock Replenished',
        productName: product.name,
        actionType: 'reorder',
        changeDetails: `Received shipment of ${receivedQty} units from "${supplierName}". Inventory updated from ${product.stock} to ${newStock} units.`,
        impactValue: `+${receivedQty} Units`,
        previousValue: `Stock: ${product.stock}`,
        newValue: `Stock: ${newStock}`,
      });
    }

    await batch.commit().catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'batch-write',
        operation: 'update',
      }));
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
      window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
    }

    // Sync PO receiving to Shopify Admin API if store is connected and product is linked to Shopify
    const shopifyStore = businessProfile?.shopifyStoreUrl;
    const invItemId = (product as any)?.shopifyInventoryItemId || (product as any)?.inventoryItemId;
    if (product && shopifyStore && (invItemId || product.id?.startsWith('shopify_'))) {
      user.getIdToken().then((token) => {
        fetch('/api/shopify/inventory/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: shopifyStore,
            accessToken: token,
            userId: user.uid,
            tenantId: user.uid,
            inventoryItemId: invItemId,
            availableDelta: receivedQty,
            productName: product.name,
          }),
        }).catch((err) => console.warn('[Shopify PO Receiving Sync Error]:', err));
      });
    }

    toast({
      title: '📦 Goods Received & Inventory Updated!',
      description: `Added +${receivedQty} units to "${product?.name || 'Product'}". Stock count and AI analytics updated.`,
    });
  }, [firestore, user, ordersRef, transactionsRef, orders, products, suppliers, businessProfile, toast]);

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    if (!orderId || !String(orderId).trim()) return;
    const cleanId = String(orderId).trim();
    if (status === 'Fulfilled') {
      await receivePurchaseOrder(cleanId);
      return;
    }

    if (!firestore || !user) return;
    const orderRef = doc(firestore, 'users', user.uid, 'orders', cleanId);
    await updateDoc(orderRef, { status, updatedAt: serverTimestamp() }).catch(console.error);
    toast({ title: 'Order Status Updated', description: `Order status set to ${status}.` });
  }, [firestore, user, receivePurchaseOrder, toast]);

  const addCustomAttribute = useCallback(async (attributeData: Omit<CustomAttribute, 'id'>) => {
    if (!firestore || !user || !customAttributesRef) return;
    if (customAttributes.some(attr => attr.value === attributeData.value)) return;

    const newAttr = {
      ...attributeData,
      createdAt: serverTimestamp()
    };
    await addDoc(customAttributesRef, newAttr).catch(err => {
      console.error("Failed to add custom attribute:", err);
    });
  }, [firestore, user, customAttributes, customAttributesRef]);

  const addSupplier = useCallback(async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    if (!firestore || !user || !suppliersRef) return;
    if (suppliers.find((s) => s.name.toLowerCase() === supplierData.name.toLowerCase())) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'A supplier with this name already exists.',
      });
      return;
    }
    const newSupplier = {
      ...supplierData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    addDoc(suppliersRef, newSupplier).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: suppliersRef.path,
        operation: 'create',
        requestResourceData: newSupplier,
      }));
    });
    toast({ title: 'Supplier Added', description: `${supplierData.name} has been added.` });
  }, [firestore, user, suppliers, suppliersRef, toast]);

  const recordSale = useCallback(async (productId: string, quantity: number) => {
    if (!firestore || !user || !transactionsRef || !productId || !String(productId).trim()) return;
    const cleanProdId = String(productId).trim();
    const product = products.find(p => p.id === cleanProdId);
    if (!product || product.stock < quantity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Insufficient stock or product not found.' });
      return;
    }

    const batch = writeBatch(firestore);
    const productRef = doc(firestore, 'users', user.uid, 'products', cleanProdId);
    const transactionRef = doc(transactionsRef);

    batch.update(productRef, {
      stock: product.stock - quantity,
      updatedAt: serverTimestamp()
    });

    batch.set(transactionRef, {
      id: transactionRef.id,
      tenantId: user.uid,
      productId: cleanProdId,
      locationId: 'MAIN-WAREHOUSE',
      type: 'Sale',
      quantity,
      price: product.price, // Record current price for historical accuracy
      transactionDate: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit().catch(err => {
      console.error('Sale recording failed:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to record sale.' });
    });

    toast({ title: 'Sale Recorded', description: `Sold ${quantity} units of ${product.name}.` });
  }, [firestore, user, transactionsRef, products, toast]);

  const addReturn = useCallback(async (returnData: Omit<ProductReturn, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    if (!firestore || !user || !returnsRef || !transactionsRef) return;

    const batch = writeBatch(firestore);
    const newReturnRef = doc(returnsRef);

    const newReturn = cleanObject({
      ...returnData,
      id: newReturnRef.id,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(newReturnRef, newReturn);

    // If restocked, update product stock
    if (returnData.actionTaken === 'Restocked' && returnData.productId && String(returnData.productId).trim()) {
      const cleanProdId = String(returnData.productId).trim();
      const productRef = doc(firestore, 'users', user.uid, 'products', cleanProdId);
      const product = products.find(p => p.id === cleanProdId);
      if (product) {
        batch.update(productRef, {
          stock: product.stock + returnData.quantity,
          updatedAt: serverTimestamp()
        });
      }
    }

    // If refunded or store credit, record a Sale adjustment transaction (negative sales!)
    if (returnData.refundStatus === 'Refunded' || returnData.refundStatus === 'Store Credit') {
      const product = products.find(p => p.id === returnData.productId);
      const transRef = doc(transactionsRef);
      batch.set(transRef, cleanObject({
        id: transRef.id,
        tenantId: user.uid,
        productId: returnData.productId,
        productName: returnData.productName,
        sku: product?.sku || 'N/A',
        category: product?.categoryId || 'N/A',
        locationId: 'MAIN-WAREHOUSE',
        type: 'Sale',
        quantity: -returnData.quantity, // Negative quantity
        price: product?.price || 0,
        totalRevenue: -returnData.refundAmount, // Negative revenue
        transactionDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    }

    await batch.commit().catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: returnsRef.path,
        operation: 'create',
        requestResourceData: newReturn,
      }));
    });

    toast({ title: 'Return Logged', description: `Return for ${returnData.customerName} has been recorded.` });
  }, [firestore, user, returnsRef, transactionsRef, products, toast]);

  const updateReturnStatus = useCallback(async (returnId: string, refundStatus: string) => {
    if (!firestore || !user || !returnsRef || !transactionsRef || !returnId || !String(returnId).trim()) return;
    const cleanReturnId = String(returnId).trim();
    const returnRef = doc(firestore, 'users', user.uid, 'returns', cleanReturnId);
    const returnToUpdate = returns.find(r => r.id === cleanReturnId);
    if (!returnToUpdate) return;

    const batch = writeBatch(firestore);
    batch.update(returnRef, { refundStatus, updatedAt: serverTimestamp() });

    // If changing from non-refunded to refunded/store credit, write the negative transaction
    const wasRefundedBefore = returnToUpdate.refundStatus === 'Refunded' || returnToUpdate.refundStatus === 'Store Credit';
    const isRefundedNow = refundStatus === 'Refunded' || refundStatus === 'Store Credit';

    if (!wasRefundedBefore && isRefundedNow) {
      const product = products.find(p => p.id === returnToUpdate.productId);
      const transRef = doc(transactionsRef);
      batch.set(transRef, cleanObject({
        id: transRef.id,
        tenantId: user.uid,
        productId: returnToUpdate.productId,
        productName: returnToUpdate.productName,
        sku: product?.sku || 'N/A',
        category: product?.categoryId || 'N/A',
        locationId: 'MAIN-WAREHOUSE',
        type: 'Sale',
        quantity: -returnToUpdate.quantity,
        price: product?.price || 0,
        totalRevenue: -returnToUpdate.refundAmount,
        transactionDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    }

    await batch.commit().catch((_serverError) => {
      console.error("Failed to update return status:", _serverError);
    });

    toast({ title: 'Return Status Updated', description: `Return status updated to ${refundStatus}.` });
  }, [firestore, user, returns, products, transactionsRef, returnsRef, toast]);

  const updateReturn = useCallback(async (returnId: string, updates: Partial<ProductReturn>) => {
    if (!firestore || !user || !returnsRef || !returnId || !String(returnId).trim()) return;
    const cleanReturnId = String(returnId).trim();
    const returnRef = doc(firestore, 'users', user.uid, 'returns', cleanReturnId);
    await updateDoc(returnRef, cleanObject({
      ...updates,
      updatedAt: serverTimestamp(),
    })).catch((_serverError) => {
      console.error("Failed to update return:", _serverError);
    });
    toast({ title: 'Return Updated', description: 'Return details updated successfully.' });
  }, [firestore, user, returnsRef, toast]);

  const deleteReturn = useCallback(async (returnId: string) => {
    if (!firestore || !user || !returnId || !String(returnId).trim()) return;
    const cleanReturnId = String(returnId).trim();
    const returnRef = doc(firestore, 'users', user.uid, 'returns', cleanReturnId);
    await deleteDoc(returnRef).catch((_serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: returnRef.path,
            operation: 'delete',
        }));
    });
    toast({ title: 'Return Deleted', description: 'The return record has been removed.' });
  }, [firestore, user, toast]);

  const deleteSupplier = useCallback(async (supplierId: string) => {
    if (!firestore || !user || !supplierId || !String(supplierId).trim()) return;
    const cleanSupplierId = String(supplierId).trim();
    const supplierRef = doc(firestore, 'users', user.uid, 'suppliers', cleanSupplierId);
    await deleteDoc(supplierRef).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: supplierRef.path,
        operation: 'delete',
      }));
    });
    toast({ title: 'Supplier Deleted', description: 'The supplier has been removed.' });
  }, [firestore, user, toast]);

  const clearAllData = useCallback(async (options?: { silent?: boolean }) => {
    if (!firestore || !user) {
      throw new Error('Your workspace is not ready to reset. Please wait for Firebase to reconnect and try again.');
    }

    // 1. Wipe all local storage caches, history, demographics, insights, completed actions & snapshots instantly
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
        const keysToKeep = new Set([
          'analyzeup_subscription_plan',
          'analyzeup_ai_queries_count',
          'analyzeup_reports_count',
          user ? `analyzeup_usage_${user.uid}` : '',
          'analyzeup_workspace_members_v1',
          'analyzeup_just_registered',
          'analyzeup_just_logged_in',
          'analyzeup_feature_tour_seen_global',
          user ? `analyzeup_feature_tour_seen_${user.uid}` : '',
          user ? `analyzeup_feature_tour_completed_${user.uid}` : '',
        ]);

        const allKeys = Object.keys(localStorage);
        allKeys.forEach((key) => {
          if (keysToKeep.has(key) || key.includes('feature_tour')) return;
          if (
            key.startsWith('analyzeup_') ||
            key.includes('audit') ||
            key.includes('simulation') ||
            key.includes('snapshot') ||
            key.includes('event') ||
            key.includes('task') ||
            key.includes('recommend') ||
            key.includes('opportunity') ||
            key.includes('shopify') ||
            key.includes('drive') ||
            key.includes('profile')
          ) {
            localStorage.removeItem(key);
          }
        });

        // Dispatch window events to notify all active UI components immediately
        window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
        window.dispatchEvent(new CustomEvent('analyzeup_simulations_updated'));
        window.dispatchEvent(new CustomEvent('analyzeup_snapshots_updated'));
        window.dispatchEvent(new CustomEvent('analyzeup_events_updated'));
        window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
      } catch (e) {
        console.error('Error clearing localStorage caches:', e);
      }
    }

    // 2. Delete the persisted workspace before changing the UI. Previously this
    //    routine swallowed write errors and retained Drive metadata/connection,
    //    which allowed a refresh (or auto-sync) to bring data back.
    {
      const uid = user.uid;

      try {
        console.log(`[ClearAllData] Starting full workspace purge for user: ${uid}`);
        const colNames = [
          'products',
          'orders',
          'suppliers',
          'transactions',
          'categories',
          'returns',
          'custom_attributes',
          'importJobs',
          'import_jobs',
          'google_drive_files',
          'sync_history',
          'mapping_profiles',
          'drive_sync_history',
          'drive_files',
          'drive_mappings',
          'audit_logs',
          'forecasts',
          'insights',
          'simulations',
          'events',
          'tasks',
        ];

        // Fetch independent collections at the same time. The previous sequential
        // loop waited for every empty collection too, making Reset appear frozen.
        const snapshots = await Promise.all(
          colNames.map(async (colName) => ({
            colName,
            snapshot: await getDocs(collection(firestore, 'users', uid, colName)),
          }))
        );

        const deletionBatches: ReturnType<typeof writeBatch>[] = [];
        let totalDeleted = 0;
        const CHUNK_SIZE = 400;
        snapshots.forEach(({ colName, snapshot }) => {
          for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
            const batch = writeBatch(firestore);
            snapshot.docs.slice(i, i + CHUNK_SIZE).forEach((document) => batch.delete(document.ref));
            deletionBatches.push(batch);
          }
          totalDeleted += snapshot.docs.length;
          if (!snapshot.empty) console.log(`[ClearAllData] Queued ${snapshot.docs.length} docs from ${colName}`);
        });

        // Commit deletion batches in controlled sequential order with micro-yields to prevent WebSocket choking
        for (const batch of deletionBatches) {
          await batch.commit().catch((err) => console.warn('[ClearAllData] Batch deletion error:', err));
          await new Promise((r) => setTimeout(r, 10));
        }

        // A reset is a disconnect: remove Drive as well as every other supported integration.
        const integrations = ['google-drive', 'google_drive', 'shopify', 'zoho', 'tally', 'woocommerce'];
        const integrationsBatch = writeBatch(firestore);
        integrations.forEach((name) => integrationsBatch.delete(doc(firestore, 'users', uid, 'integrations', name)));
        await integrationsBatch.commit().catch((err) => console.warn('[ClearAllData] Integrations batch error'));

        // Delete global shopify store lookup index
        const shop = businessProfile?.shopifyStoreUrl;
        if (shop && String(shop).trim()) {
          const storeLookupRef = doc(firestore, 'shopify_stores', String(shop).trim());
          await deleteDoc(storeLookupRef).catch(console.warn);
        }

        // Notify server disconnect route to scrub any backend cached sessions or tokens
        fetch('/api/shopify/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: uid,
            shop: shop || '',
            purgeData: true,
          }),
        }).catch(err => console.warn('[ClearAllData] Disconnect endpoint notice:', err));

        // Remove generated AI output; retain only an empty analytics summary.
        await deleteDoc(doc(firestore, 'users', uid, 'analytics', 'ai_brief')).catch(() => {});

        // Clear isolated vector knowledge store for this workspace
        try {
          const { globalVectorStore } = await import('@/ai/rag/vector-store');
          await globalVectorStore.deleteByBusinessId(uid);
        } catch (vErr) {
          console.warn('[ClearAllData] Vector store purge notice:', vErr);
        }

        // Reset analytics summary to zeroed defaults
        await setDoc(doc(firestore, 'users', uid, 'analytics', 'summary'), DEFAULT_ANALYTICS_SUMMARY);
        console.log(`[ClearAllData] Workspace purge complete. Deleted ${totalDeleted} documents.`);
      } catch (err) {
        console.error('Error wiping Firestore workspace collections:', err);
        throw new Error('Workspace reset could not finish. No success message was shown; please try again.');
      }

      // Keep business preferences, but remove all setup/import and integration state.
      const profileReset = {
        inventorySetupMethod: 'manual',
        csvImportedAt: deleteField(),
        shopifyConnected: false,
        shopifyStoreUrl: '',
        shopifyStoreName: '',
        shopifyStatus: 'Disconnected',
        shopifyAccessToken: '',
        shopifyLastSyncedAt: '',
        shopifyAutoSyncEnabled: false,
        shopifyRealtimeSyncEnabled: false,
        isOnboardingCompleted: false,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(firestore, 'users', uid, 'settings', 'business_profile'), profileReset, { merge: true });

      if (businessProfile) {
        const cleanedProfile: BusinessProfile = {
          ...businessProfile,
          inventorySetupMethod: profileReset.inventorySetupMethod,
          csvImportedAt: undefined,
          shopifyConnected: false,
          shopifyStoreUrl: '',
          shopifyStoreName: '',
          shopifyStatus: 'Disconnected',
          shopifyAccessToken: undefined,
          shopifyLastSyncedAt: undefined,
          shopifyAutoSyncEnabled: false,
          shopifyRealtimeSyncEnabled: false,
          isOnboardingCompleted: false,
          updatedAt: profileReset.updatedAt,
        };
        setBusinessProfile(cleanedProfile);
        localStorage.setItem(`analyzeup_profile_${uid}`, JSON.stringify(cleanedProfile));
      }
    }

    setHasDemoData(false);
    setDriveConnection(null);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('analyzeup_drive_synced', { detail: { count: 0, reset: true } }));
      window.dispatchEvent(new CustomEvent('analyzeup_integrations_reset'));
      window.dispatchEvent(new CustomEvent('analyzeup_workspace_reset'));
    }

    if (!options?.silent) {
      toast({
        title: 'Workspace Reset Complete',
        description: 'All products, sales, Google Drive, Shopify links, and logs have been deleted.',
      });
    }
  }, [firestore, user, businessProfile, toast]);

  const clearDemoBusiness = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    const uid = user.uid;
    setIsDeletingDemo(true);

    try {
      console.log('[DataContext] Deleting all demo data only...');
      const cols = ['products', 'transactions', 'suppliers', 'categories', 'orders', 'returns'];
      const deletionBatches: ReturnType<typeof writeBatch>[] = [];
      let currentBatch = writeBatch(firestore);
      let countInBatch = 0;
      let totalPurged = 0;

      for (const colName of cols) {
        const snap = await getDocs(collection(firestore, 'users', uid, colName));
        for (const docSnap of snap.docs) {
          const data = docSnap.data() || {};

          // Reciprocal Immunity: Strictly protect real business data
          const isProtectedReal =
            data.source?.toUpperCase() === 'SHOPIFY' ||
            data.source?.toUpperCase() === 'GOOGLE_DRIVE' ||
            data.source?.toUpperCase() === 'CSV' ||
            data.source?.toUpperCase() === 'IMPORT' ||
            data.source?.toUpperCase() === 'MANUAL' ||
            Boolean(data.shopifyProductId) ||
            Boolean(data.shopifyVariantId) ||
            Boolean(data.driveFileId) ||
            Boolean(data.fileId) ||
            docSnap.id.startsWith('shopify_') ||
            docSnap.id.startsWith('tx_shopify_') ||
            docSnap.id.startsWith('gdrive_') ||
            docSnap.id.startsWith('drive_');

          if (isProtectedReal) {
            continue;
          }

          const isDemo =
            data.isDemo === true ||
            data.source === 'DEMO' ||
            data.source === 'demo' ||
            docSnap.id.startsWith('prod-') ||
            docSnap.id.startsWith('demo_') ||
            docSnap.id.startsWith('sup-') ||
            docSnap.id.startsWith('cat-') ||
            docSnap.id.startsWith('tx-') ||
            docSnap.id.startsWith('ord-') ||
            docSnap.id.startsWith('po-') ||
            docSnap.id.startsWith('ret-');

          if (isDemo) {
            currentBatch.delete(docSnap.ref);
            countInBatch++;
            totalPurged++;
            if (countInBatch >= 400) {
              deletionBatches.push(currentBatch);
              currentBatch = writeBatch(firestore);
              countInBatch = 0;
            }
          }
        }
      }

      if (countInBatch > 0) {
        deletionBatches.push(currentBatch);
      }

      for (const b of deletionBatches) {
        await b.commit();
      }

      setHasDemoData(false);

      if (businessProfile?.inventorySetupMethod === 'demo') {
        const profileUpdate = {
          inventorySetupMethod: 'manual',
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(firestore, 'users', uid, 'settings', 'business_profile'), profileUpdate, { merge: true }).catch(() => {});
        setBusinessProfile(prev => prev ? { ...prev, inventorySetupMethod: 'manual' } : null);
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(`analyzeup_profile_${uid}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.inventorySetupMethod = 'manual';
              localStorage.setItem(`analyzeup_profile_${uid}`, JSON.stringify(parsed));
            }
          } catch {}
        }
      }

      const remainingProducts = products.filter(p => !p?.isDemo && p?.source !== 'DEMO' && p?.source !== 'demo' && !String(p?.id || '').startsWith('prod-') && !String(p?.id || '').startsWith('demo_'));
      const remainingTransactions = transactions.filter(t => !t?.isDemo && t?.source !== 'DEMO' && t?.source !== 'demo' && !String(t?.id || '').startsWith('tx-') && !String(t?.id || '').startsWith('demo_'));
      const remainingSuppliers = suppliers.filter(s => !s?.isDemo && s?.source !== 'DEMO' && s?.source !== 'demo' && !String(s?.id || '').startsWith('sup-') && !String(s?.id || '').startsWith('demo_'));
      const remainingOrders = orders.filter(o => !o?.isDemo && o?.source !== 'DEMO' && o?.source !== 'demo' && !String(o?.id || '').startsWith('ord-') && !String(o?.id || '').startsWith('po-') && !String(o?.id || '').startsWith('demo_'));
      const remainingReturns = returns.filter(r => !r?.isDemo && r?.source !== 'DEMO' && r?.source !== 'demo' && !String(r?.id || '').startsWith('ret-') && !String(r?.id || '').startsWith('demo_'));

      const sumRef = doc(firestore, 'users', uid, 'analytics', 'summary');
      if (remainingProducts.length > 0 || remainingTransactions.length > 0) {
        await recalculateAndSaveAnalyticsSummary(firestore, uid, {
          products: remainingProducts,
          transactions: remainingTransactions,
          suppliers: remainingSuppliers,
          orders: remainingOrders,
          returns: remainingReturns,
        }).catch(console.error);
      } else {
        await setDoc(sumRef, DEFAULT_ANALYTICS_SUMMARY, { merge: true }).catch(console.error);
      }

      toast({
        title: 'Demo Data Deleted',
        description: `Successfully removed ${totalPurged > 0 ? totalPurged + ' ' : ''}sample demo records. Your real business data remains untouched.`,
      });
    } catch (err) {
      console.error('[DataContext] Error deleting demo data:', err);
      toast({
        variant: 'destructive',
        title: 'Error Deleting Demo Data',
        description: 'Failed to delete demo records. Please try again.',
      });
    } finally {
      setIsDeletingDemo(false);
    }
  }, [firestore, user, businessProfile, products, transactions, suppliers, orders, returns, toast]);

  const purgeDemoDataOnly = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    const uid = user.uid;

    try {
      console.log('[DataContext] Automatically purging demo loaded data to make way for real business data...');
      const cols = ['products', 'transactions', 'suppliers', 'categories', 'orders', 'returns'];
      const deletionBatches: ReturnType<typeof writeBatch>[] = [];
      let currentBatch = writeBatch(firestore);
      let countInBatch = 0;
      let totalPurged = 0;

      for (const colName of cols) {
        const snap = await getDocs(collection(firestore, 'users', uid, colName));
        for (const docSnap of snap.docs) {
          const data = docSnap.data() || {};
          const isDemo =
            data.isDemo === true ||
            data.source === 'DEMO' ||
            docSnap.id.startsWith('prod-') ||
            docSnap.id.startsWith('sup-') ||
            docSnap.id.startsWith('cat-fashion-') ||
            docSnap.id.startsWith('cat-electronics-') ||
            docSnap.id.startsWith('cat-beauty-') ||
            docSnap.id.startsWith('cat-home-') ||
            docSnap.id.startsWith('cat-sports-') ||
            docSnap.id.startsWith('cat-food-') ||
            docSnap.id.startsWith('tx-') ||
            docSnap.id.startsWith('po-') ||
            docSnap.id.startsWith('ret-');

          if (isDemo) {
            currentBatch.delete(docSnap.ref);
            countInBatch++;
            totalPurged++;
            if (countInBatch >= 400) {
              deletionBatches.push(currentBatch);
              currentBatch = writeBatch(firestore);
              countInBatch = 0;
            }
          }
        }
      }

      if (countInBatch > 0) {
        deletionBatches.push(currentBatch);
      }

      for (const b of deletionBatches) {
        await b.commit();
      }

      setHasDemoData(false);

      if (businessProfile?.inventorySetupMethod === 'demo') {
        const profileUpdate = {
          inventorySetupMethod: 'manual',
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(firestore, 'users', uid, 'settings', 'business_profile'), profileUpdate, { merge: true }).catch(() => {});
        setBusinessProfile(prev => prev ? { ...prev, inventorySetupMethod: 'manual' } : null);
      }

      if (totalPurged > 0) {
        console.log(`[DataContext] Automatically purged ${totalPurged} demo records.`);
        toast({
          title: 'Demo Data Replaced',
          description: 'Sample demo business records were automatically deleted to initialize your real business data.',
        });
      }
    } catch (err) {
      console.warn('[DataContext] Error auto-purging demo data:', err);
    }
  }, [firestore, user, businessProfile, toast]);

  const [driveConnection, setDriveConnection] = useState<any>(null);

  // Subscribe to Google Drive connection doc in Firestore
  useEffect(() => {
    if (!user || !firestore) {
      setDriveConnection(null);
      return;
    }
    const docRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists() && snap.data().connectionStatus === 'Connected') {
        setDriveConnection(snap.data());
      } else {
        setDriveConnection(null);
      }
    }, (error) => {
      console.error('Error subscribing to Google Drive connection:', error);
    });

    return unsubscribe;
  }, [user, firestore]);

  const subscribeGoogleDriveConnection = useCallback((onUpdate: (data: any) => void) => {
    if (!user || !firestore) {
      onUpdate(null);
      return () => {};
    }
    const docRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists() && snap.data().connectionStatus === 'Connected') {
        onUpdate(snap.data());
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error('Error subscribing to Google Drive connection:', error);
      const contextualError = new FirestorePermissionError({
        operation: 'get',
        path: `users/${user.uid}/integrations/google-drive`,
      });
      errorEmitter.emit('permission-error', contextualError);
      onUpdate(null);
    });

    return unsubscribe;
  }, [user, firestore]);

  const getGoogleDriveFiles = useCallback(async (): Promise<any[]> => {
    if (!user || !firestore) return [];
    try {
      const filesSnap = await getDocs(collection(firestore, 'users', user.uid, 'google_drive_files'));
      return filesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('Error loading Google Drive files:', e);
      return [];
    }
  }, [user, firestore]);

  const getSyncHistory = useCallback(async (): Promise<any[]> => {
    if (!user || !firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, 'users', user.uid, 'sync_history'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime());
    } catch (e) {
      console.error('Error loading sync history:', e);
      return [];
    }
  }, [user, firestore]);

  const getMappingProfiles = useCallback(async (): Promise<any[]> => {
    if (!user || !firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, 'users', user.uid, 'mapping_profiles'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('Error loading mapping profiles:', e);
      return [];
    }
  }, [user, firestore]);

  const disconnectGoogleDrive = useCallback(async (options?: { purgeData?: boolean }) => {
    if (!user || !firestore) return { success: false, deletedProducts: 0, deletedTransactions: 0, deletedReturns: 0 };
    const uid = user.uid;
    const purgeData = options?.purgeData !== false; // defaults to true

    let deletedProductsCount = 0;
    let deletedTransactionsCount = 0;
    let deletedReturnsCount = 0;

    try {
      if (purgeData) {
        // 1. Identify and delete Drive products only
        const productsSnap = await getDocs(collection(firestore, 'users', uid, 'products')).catch(() => ({ docs: [] } as any));
        const driveProductDocs = productsSnap.docs.filter((d: any) => {
          const data = d.data() || {};

          // STRICT IMMUNITY GUARD: Never delete Shopify, CSV, or Manual products
          const isProtectedShopifyOrCsv =
            data.source?.toUpperCase() === 'SHOPIFY' ||
            data.source?.toUpperCase() === 'CSV' ||
            data.source?.toUpperCase() === 'MANUAL' ||
            data.importSource?.toLowerCase() === 'shopify' ||
            data.importSource?.toLowerCase() === 'csv' ||
            data.importSource?.toLowerCase() === 'manual' ||
            Boolean(data.shopifyProductId) ||
            Boolean(data.shopifyVariantId) ||
            d.id.startsWith('shopify_') ||
            d.id.startsWith('csv_');

          if (isProtectedShopifyOrCsv) return false;

          const src = String(data.source || '').toUpperCase();
          const impSrc = String(data.importSource || '').toLowerCase();
          return (
            src === 'GOOGLE_DRIVE' ||
            src === 'DRIVE' ||
            impSrc === 'drive' ||
            d.id.startsWith('drive_') ||
            (typeof data.id === 'string' && data.id.startsWith('drive_')) ||
            Boolean(data.driveFileId) ||
            Boolean(data.fileId && impSrc === 'drive') ||
            (typeof data.supplier === 'string' && data.supplier.toLowerCase().includes('google drive'))
          );
        });

        deletedProductsCount = driveProductDocs.length;
        const deletedProductDocIds = new Set<string>(driveProductDocs.map((d: any) => d.id));
        const deletedProductDataIds = new Set<string>(driveProductDocs.map((d: any) => d.data()?.id).filter(Boolean));

        // 2. Identify and delete Drive transactions only
        const txSnap = await getDocs(collection(firestore, 'users', uid, 'transactions')).catch(() => ({ docs: [] } as any));
        const driveTxDocs = txSnap.docs.filter((d: any) => {
          const data = d.data() || {};

          // STRICT IMMUNITY GUARD: Never delete Shopify, CSV, or Manual transactions
          const isProtectedShopifyOrCsv =
            data.source?.toUpperCase() === 'SHOPIFY' ||
            data.source?.toUpperCase() === 'CSV' ||
            data.source?.toUpperCase() === 'MANUAL' ||
            data.importSource?.toLowerCase() === 'shopify' ||
            data.importSource?.toLowerCase() === 'csv' ||
            data.importSource?.toLowerCase() === 'manual' ||
            Boolean(data.shopifyOrderId) ||
            Boolean(data.shopifyTransactionId) ||
            d.id.startsWith('tx_shopify_') ||
            d.id.startsWith('shopify_') ||
            d.id.startsWith('tx_csv_') ||
            d.id.startsWith('csv_');

          if (isProtectedShopifyOrCsv) return false;

          const src = String(data.source || '').toUpperCase();
          const impSrc = String(data.importSource || '').toLowerCase();
          return (
            src === 'GOOGLE_DRIVE' ||
            src === 'DRIVE' ||
            impSrc === 'drive' ||
            d.id.startsWith('tx_drive_') ||
            (typeof data.id === 'string' && data.id.startsWith('tx_drive_')) ||
            Boolean(data.driveFileId) ||
            (data.productId && (deletedProductDocIds.has(data.productId) || deletedProductDataIds.has(data.productId))) ||
            (data.product_id && (deletedProductDocIds.has(data.product_id) || deletedProductDataIds.has(data.product_id)))
          );
        });
        deletedTransactionsCount = driveTxDocs.length;

        // 3. Identify and delete Drive returns only
        const retSnap = await getDocs(collection(firestore, 'users', uid, 'returns')).catch(() => ({ docs: [] } as any));
        const driveRetDocs = retSnap.docs.filter((d: any) => {
          const data = d.data() || {};

          // STRICT IMMUNITY GUARD: Never delete Shopify, CSV, or Manual returns
          const isProtectedShopifyOrCsv =
            data.source?.toUpperCase() === 'SHOPIFY' ||
            data.source?.toUpperCase() === 'CSV' ||
            data.source?.toUpperCase() === 'MANUAL' ||
            data.importSource?.toLowerCase() === 'shopify' ||
            data.importSource?.toLowerCase() === 'csv' ||
            Boolean(data.shopifyReturnId) ||
            d.id.startsWith('ret_shopify_') ||
            d.id.startsWith('ret_csv_');

          if (isProtectedShopifyOrCsv) return false;

          const src = String(data.source || '').toUpperCase();
          const impSrc = String(data.importSource || '').toLowerCase();
          return (
            src === 'GOOGLE_DRIVE' ||
            src === 'DRIVE' ||
            impSrc === 'drive' ||
            d.id.startsWith('ret_drive_') ||
            Boolean(data.driveFileId) ||
            deletedProductDocIds.has(data.productId)
          );
        });
        deletedReturnsCount = driveRetDocs.length;

        // 4. Clean Drive-specific subcollections: drive_products, google_drive_files, drive_sync_history, drive_files, drive_mappings
        const driveCols = ['drive_products', 'google_drive_files', 'sync_history', 'drive_sync_history', 'drive_files', 'drive_mappings'];
        const driveSubsnaps = await Promise.all(
          driveCols.map((col) => getDocs(collection(firestore, 'users', uid, col)).catch(() => ({ docs: [] } as any)))
        );

        const allDocsToDelete = [
          ...driveProductDocs,
          ...driveTxDocs,
          ...driveRetDocs,
          ...driveSubsnaps.flatMap((s: any) => s.docs),
        ];

        const CHUNK_SIZE = 400;
        for (let i = 0; i < allDocsToDelete.length; i += CHUNK_SIZE) {
          const batch = writeBatch(firestore);
          allDocsToDelete.slice(i, i + CHUNK_SIZE).forEach((docSnap: any) => batch.delete(docSnap.ref));
          await batch.commit().catch(console.warn);
        }

        // 5. Recalculate remaining analytics summary (preserving Shopify & CSV data)
        const remainingTxDocs = txSnap.docs.filter((d: any) => !driveTxDocs.some((dd: any) => dd.id === d.id));
        const remainingProdDocs = productsSnap.docs.filter((d: any) => !driveProductDocs.some((dp: any) => dp.id === d.id));
        const sumRef = doc(firestore, 'users', uid, 'analytics', 'summary');

        if (remainingTxDocs.length === 0 || remainingProdDocs.length === 0) {
          await setDoc(sumRef, DEFAULT_ANALYTICS_SUMMARY).catch(console.warn);
          await deleteDoc(doc(firestore, 'users', uid, 'analytics', 'ai_brief')).catch(() => {});
        } else {
          const remProds = remainingProdDocs.map((d: any) => ({ id: d.id, ...d.data() }));
          const remTxs = remainingTxDocs.map((d: any) => ({ id: d.id, ...d.data() }));
          await recalculateAndSaveAnalyticsSummary(firestore, uid, {
            products: remProds,
            transactions: remTxs,
            suppliers,
            orders,
            returns,
          }).catch(console.warn);
        }
      }

      // 6. Delete Google Drive connection document
      const docRef = doc(firestore, 'users', uid, 'integrations', 'google-drive');
      await deleteDoc(docRef).catch(() => {});
      const docRefUnderscore = doc(firestore, 'users', uid, 'integrations', 'google_drive');
      await deleteDoc(docRefUnderscore).catch(() => {});
      setDriveConnection(null);

      // 7. Clean up ONLY Google Drive localStorage keys
      if (typeof window !== 'undefined') {
        const driveKeys = Object.keys(localStorage).filter(
          (k) => k.startsWith('analyzeup_drive_') || k.includes('drive_sync') || k.includes('drive_mapping')
        );
        driveKeys.forEach((k) => localStorage.removeItem(k));

        window.dispatchEvent(new CustomEvent('analyzeup_drive_synced', { detail: { count: 0, reset: true } }));
        window.dispatchEvent(new CustomEvent('analyzeup_integrations_reset'));
      }

      const itemsRemoved =
        deletedProductsCount > 0 || deletedTransactionsCount > 0 || deletedReturnsCount > 0
          ? ` Removed ${deletedProductsCount} products, ${deletedTransactionsCount} transactions, and ${deletedReturnsCount} returns.`
          : '';

      toast({
        title: 'Google Drive Disconnected & Purged 🗑️',
        description: `Successfully revoked credentials and removed Drive imported data.${itemsRemoved}`,
      });

      return {
        success: true,
        deletedProducts: deletedProductsCount,
        deletedTransactions: deletedTransactionsCount,
        deletedReturns: deletedReturnsCount,
      };
    } catch (e: any) {
      console.error('Google Drive disconnection error:', e);
      const contextualError = new FirestorePermissionError({
        operation: 'delete',
        path: `users/${user.uid}/integrations/google-drive`,
      });
      errorEmitter.emit('permission-error', contextualError);
      toast({
        variant: 'destructive',
        title: 'Disconnection Failed',
        description: e?.message || 'Failed to delete connection document.',
      });
      return { success: false, deletedProducts: 0, deletedTransactions: 0, deletedReturns: 0 };
    }
  }, [user, firestore, suppliers, orders, returns, toast]);

  const recordSyncSuccess = useCallback(async (fileId: string, fileData: Record<string, any>, historyData: Record<string, any>) => {
    if (!user || !firestore) return;
    try {
      const safeFileId = (fileId && String(fileId).trim()) || (fileData?.id && String(fileData.id).trim()) || `file_${Date.now()}`;
      const fileRef = doc(firestore, 'users', user.uid, 'google_drive_files', safeFileId);
      await setDoc(fileRef, cleanObject({ ...fileData, id: safeFileId }), { merge: true });
      await addDoc(collection(firestore, 'users', user.uid, 'sync_history'), cleanObject(historyData));
      const connRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
      await updateDoc(connRef, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'Success',
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error recording sync success:', e);
      const contextualError = new FirestorePermissionError({
        operation: 'write',
        path: `users/${user.uid}/google_drive_files`,
      });
      errorEmitter.emit('permission-error', contextualError);
    }
  }, [user, firestore]);

  const updateGoogleDriveSettings = useCallback(async (settings: Record<string, any>) => {
    if (!user || !firestore) return;
    try {
      const connRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
      await setDoc(connRef, {
        ...cleanObject(settings),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast({
        title: 'Auto-Sync Schedule Updated ✨',
        description: settings.autoSyncEnabled === false ? 'Auto-sync is now paused.' : 'Google Drive will auto-sync on your schedule.',
      });
    } catch (e) {
      console.error('Error updating Google Drive settings:', e);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save auto-sync schedule.',
      });
    }
  }, [user, firestore, toast]);

  const saveMappingProfile = useCallback(async (fileId: string, profileData: Record<string, any>) => {
    if (!user || !firestore) return;
    try {
      const safeFileId = (fileId && String(fileId).trim()) || (profileData?.id && String(profileData.id).trim()) || `profile_${Date.now()}`;
      const profileRef = doc(firestore, 'users', user.uid, 'mapping_profiles', `profile-${safeFileId}`);
      await setDoc(profileRef, cleanObject({ ...profileData, id: `profile-${safeFileId}` }), { merge: true });
    } catch (e) {
      console.error('Error saving mapping profile:', e);
    }
  }, [user, firestore]);

  // In-flight guard to prevent duplicate concurrent background sync cycles
  const isSyncingRef = useRef(false);

  // Unified background auto-sync runner for entire workspace
  const autoSyncGoogleDriveNow = useCallback(async (showToast: boolean = true) => {
    if (!user || !firestore || !driveConnection || !driveConnection.selectedFolderId || driveConnection.connectionStatus !== 'Connected' || driveConnection.isConnected === false) return;
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const token = await getClientDriveToken(driveConnection, user, firestore);
      if (!token) {
        isSyncingRef.current = false;
        return;
      }

      const folderId = driveConnection.selectedFolderId;
      const folderName = driveConnection.selectedFolderName || '';

      const folderQuery = `?folderId=${encodeURIComponent(folderId)}&folderName=${encodeURIComponent(folderName)}`;

      const res = await fetch(`/api/drive/scan${folderQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-uid': user.uid,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        isSyncingRef.current = false;
        return;
      }

      const files = data.files || [];
      // Match any file that is pending (exclude 'Synced', 'Deleted', and 'Tombstoned')
      const pendingFiles = files.filter((f: any) => f.status !== 'Synced' && f.status !== 'Deleted' && f.status !== 'Tombstoned');

      let ingestedCount = 0;
      const profiles = await getMappingProfiles();

      for (const file of pendingFiles) {
        try {
          const syncRes = await fetch('/api/drive/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'x-user-uid': user.uid,
            },
            body: JSON.stringify({ fileId: file.id, fileName: file.name }),
          });

          const syncData = await syncRes.json();
          if (!syncRes.ok || !syncData.success || !syncData.csvContent) continue;

          const parsed = Papa.parse(syncData.csvContent, { header: true, skipEmptyLines: true });
          const rawRows = parsed.data as Record<string, any>[];
          if (rawRows.length === 0) continue;

          const headers = Object.keys(rawRows[0] || {});
          const currentSignature = headers.slice().sort().join('|').toLowerCase();

          let matchedProfile = profiles.find((p: any) => p.headersSignature === currentSignature);
          if (!matchedProfile) {
            matchedProfile = findMatchingImportProfile(headers) as any;
          }
          if (!matchedProfile) {
            matchedProfile = autoDetectMapping(headers) as any;
          }

          let fieldMapping = matchedProfile?.mapping || matchedProfile?.fieldMapping;
          if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
            const detected = autoDetectMapping(headers);
            if (detected) {
              matchedProfile = detected;
              fieldMapping = detected.mapping;
            }
          }

          if (matchedProfile && fieldMapping && Object.keys(fieldMapping).length > 0) {
            const safeFieldMapping = fieldMapping || {};
            const isSalesReport = matchedProfile.fileType === 'SALES_REPORT';

            const normalizedItems = rawRows.map((rawRow: any, idx: number) => {
              const obj: any = {};
              Object.entries(safeFieldMapping).forEach(([sourceCol, targetKey]) => {
                if (targetKey && targetKey !== 'skip') {
                  obj[targetKey as string] = rawRow[sourceCol];
                }
              });

              const name = (
                obj.name ||
                obj.productName ||
                obj.product_name ||
                rawRow['Product Name'] ||
                rawRow['Item Name'] ||
                rawRow['Product'] ||
                `Product ${idx + 1}`
              ).trim();

              const rawPrice =
                obj.price ||
                obj.sellingPrice ||
                rawRow['Selling Price'] ||
                rawRow['Price'] ||
                '0';
              const price = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

              const rawCostPrice =
                obj.costPrice ||
                obj.cost ||
                rawRow['Cost Price'] ||
                rawRow['Cost'] ||
                (price * 0.6).toFixed(2);
              const costPrice = parseFloat(String(rawCostPrice).replace(/[^0-9.]/g, '')) || Math.round(price * 0.6);

              const rawStock =
                obj.stock !== undefined && obj.stock !== ''
                  ? obj.stock
                  : (obj.inventory_quantity !== undefined && obj.inventory_quantity !== ''
                      ? obj.inventory_quantity
                      : (rawRow['Stock'] !== undefined && rawRow['Stock'] !== ''
                          ? rawRow['Stock']
                          : (rawRow['Current Stock'] !== undefined && rawRow['Current Stock'] !== '' ? rawRow['Current Stock'] : undefined)));
              const hasExplicitStock = rawStock !== undefined && !isNaN(parseInt(String(rawStock).replace(/[^0-9]/g, ''), 10));
              const explicitStockValue = hasExplicitStock ? parseInt(String(rawStock).replace(/[^0-9]/g, ''), 10) : undefined;

              const sku = (
                obj.sku ||
                rawRow['SKU'] ||
                rawRow['Item Code'] ||
                rawRow['Barcode'] ||
                `SKU-${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}-${idx + 1}`
              ).toUpperCase();

              const existingProd = resolveExistingProduct(products, sku, name);
              const finalStock = explicitStockValue !== undefined
                ? explicitStockValue
                : (existingProd ? existingProd.stock : 0);

              const category = obj.category || rawRow['Category'] || rawRow['Department'] || 'General';
              const supplier = obj.supplier || obj.supplierName || rawRow['Supplier'] || rawRow['Vendor'] || 'Google Drive Vendor';

              const orderNo = obj.orderNumber || obj.orderId || rawRow['Order ID'] || rawRow['Invoice No'] || `INV-${1000 + idx}`;
              const customer = obj.customerName || obj.customer || rawRow['Customer Name'] || rawRow['Customer'] || 'Retail Customer';
              const city = obj.city || rawRow['City'] || rawRow['Location'] || '';
              const date = obj.orderDate || rawRow['Date'] || rawRow['Order Date'] || new Date().toISOString().split('T')[0];

              return {
                ...obj,
                parsed: {
                  name,
                  price,
                  costPrice,
                  stock: finalStock,
                  hasExplicitStock,
                  qty: Math.max(1, Math.min(finalStock > 0 ? finalStock : 1, 4)),
                  sku,
                  category,
                  supplier,
                  orderNo,
                  customer,
                  city,
                  date,
                  unit: obj.unit || rawRow['Unit'] || 'Piece',
                  description: obj.description || rawRow['Description'] || `Imported ${name}`,
                }
              };
            });

            const validRows = normalizedItems.filter(r => r.parsed && r.parsed.name);
            if (validRows.length > 0) {
              // 1. Auto-create Categories
              const fileCats = Array.from(new Set(validRows.map(r => r.parsed.category).filter(Boolean)));
              const existingCatMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
              const missingCats = fileCats.filter(c => !existingCatMap.has(c.toLowerCase()));
              if (missingCats.length > 0) {
                await Promise.all(missingCats.map(c => addCategory({ name: c, description: 'Created from Google Drive Sync' })));
              }

              // 2. Auto-create Suppliers
              const fileSups = Array.from(new Set(validRows.map(r => r.parsed.supplier).filter(Boolean)));
              const existingSupMap = new Map(suppliers.map(s => [s.name.toLowerCase(), s.id]));
              const missingSups = fileSups.filter(s => !existingSupMap.has(s.toLowerCase()));
              if (missingSups.length > 0) {
                await Promise.all(
                  missingSups.map(s =>
                    addSupplier({
                      name: s,
                      contactName: 'Drive Contact',
                      email: `contact@${s.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
                      phone: '+91 90000 00000',
                      address: 'Google Drive Synchronized Vendor',
                    })
                  )
                );
              }

              // 3. Populate products into Catalog Intelligence & Inventory without fabricated stock
              const productsToImport = validRows.map(r => {
                const { prodDocId, existingProduct: matchedProduct } = resolveExistingProduct(products, r.parsed.sku, r.parsed.name);
                const stockVal = r.parsed.hasExplicitStock && r.parsed.stock !== undefined
                  ? r.parsed.stock
                  : (matchedProduct ? matchedProduct.stock : 0);
                const resolvedId = (matchedProduct?.id && String(matchedProduct.id).trim()) || prodDocId || generateProductDocId(r.parsed.sku, r.parsed.name);

                return {
                  id: resolvedId,
                  name: r.parsed.name,
                  sku: r.parsed.sku,
                  description: r.parsed.description,
                  categoryId: existingCatMap.get(r.parsed.category.toLowerCase()) || 'cat-general',
                  category: r.parsed.category,
                  supplier: r.parsed.supplier,
                  supplierId: existingSupMap.get(r.parsed.supplier.toLowerCase()) || '',
                  price: r.parsed.price,
                  costPrice: r.parsed.costPrice,
                  stock: stockVal,
                  minStock: 0,
                  maxStock: stockVal > 0 ? stockVal * 2 : 0,
                  unit: r.parsed.unit,
                  status: 'Active' as const,
                  source: 'GOOGLE_DRIVE',
                  importSource: 'drive',
                  averageDailySales: 0,
                  leadTimeDays: 0,
                };
              });

              await bulkAddProducts(productsToImport, true);

              // 4. Populate sales transactions linked directly to authoritative products
              const transactionsToImport = validRows.map((r, idx) => {
                const { prodDocId, existingProduct: matchedProduct } = resolveExistingProduct(products, r.parsed.sku, r.parsed.name);
                const safeProdId = (matchedProduct?.id && String(matchedProduct.id).trim()) || prodDocId || generateProductDocId(r.parsed.sku, r.parsed.name);
                const safeTxId = generateTransactionDocId(r.parsed.orderNo, r.parsed.sku, r.parsed.date, idx + 1);

                return {
                  id: safeTxId,
                  type: 'Sale' as const,
                  productId: safeProdId,
                  productName: r.parsed.name,
                  sku: r.parsed.sku,
                  quantity: r.parsed.qty || 1,
                  price: r.parsed.price,
                  sellingPrice: r.parsed.price,
                  costPrice: r.parsed.costPrice,
                  totalRevenue: (r.parsed.price || 0) * (r.parsed.qty || 1),
                  totalCost: (r.parsed.costPrice || 0) * (r.parsed.qty || 1),
                  orderNumber: r.parsed.orderNo,
                  customerName: r.parsed.customer,
                  supplier: r.parsed.supplier,
                  transactionDate: r.parsed.date || new Date().toISOString().split('T')[0],
                  paymentMethod: 'UPI',
                  status: 'Completed' as const,
                };
              });

              if (transactionsToImport.length > 0) {
                await bulkAddTransactions(transactionsToImport);
              }

              const nowIso = new Date().toISOString();
              const safeFileId = (file.id && String(file.id).trim()) || (file.name && String(file.name).trim()) || `file_${Date.now()}`;
              const safeFileName = file.name || 'Untitled Spreadsheet';
              await recordSyncSuccess(
                safeFileId,
                {
                  id: safeFileId,
                  name: safeFileName,
                  status: 'Synced',
                  rowCount: validRows.length,
                  lastSyncedAt: nowIso,
                  fileType: matchedProfile.fileType,
                },
                {
                  fileId: safeFileId,
                  fileName: safeFileName,
                  recordsCount: validRows.length,
                  syncedAt: nowIso,
                  status: 'Success',
                }
              );

              await saveMappingProfile(safeFileId, {
                id: `profile-${safeFileId}`,
                profileName: `Auto Map for ${safeFileName}`,
                fileType: matchedProfile.fileType,
                mapping: safeFieldMapping,
                headersSignature: currentSignature,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

              ingestedCount++;
            }
          }
        } catch (fileErr) {
          console.error(`Auto-sync error on file ${file.name}:`, fileErr);
        }
      }

      // Update lastSyncAt on the integration doc in Firestore
      const nowIso = new Date().toISOString();
      const connRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
      await updateDoc(connRef, {
        lastSyncAt: nowIso,
        lastSyncStatus: 'Success',
        updatedAt: nowIso,
      });

      // Vectorize latest business data so AI Copilot immediately has new/updated context
      await vectorizeAndSyncAiChatbot().catch(console.warn);

      // Emit global custom event for open views to refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analyzeup_drive_sync_complete', { detail: { nowIso, ingestedCount } }));
      }

      if (showToast || ingestedCount > 0) {
        toast({
          title: 'Google Drive Synchronized 🚀',
          description: ingestedCount > 0
            ? `Automatically ingested ${ingestedCount} spreadsheet(s) from Drive & updated AI Copilot.`
            : `Folder checked. All spreadsheets are up to date (${formatLastSyncTime(nowIso)}).`,
        });
      }
    } catch (err) {
      console.error('Error during autoSyncGoogleDriveNow:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, firestore, driveConnection, getMappingProfiles, bulkAddProducts, bulkAddTransactions, recordSyncSuccess, saveMappingProfile, vectorizeAndSyncAiChatbot, toast]);

  // Global background auto-sync runner (runs on scheduled interval ONLY if autoSync is explicitly enabled)
  useEffect(() => {
    if (
      !user ||
      !firestore ||
      !driveConnection ||
      !driveConnection.selectedFolderId ||
      driveConnection.connectionStatus !== 'Connected' ||
      driveConnection.isConnected === false ||
      driveConnection.autoSyncEnabled !== true
    ) {
      return;
    }

    const checkAutoSync = () => {
      if (isAutoSyncDue(driveConnection) && !isSyncingRef.current) {
        console.log('[Global AutoSync] Schedule is due. Triggering automatic background ingestion for:', driveConnection.selectedFolderName);
        autoSyncGoogleDriveNow(false);
      }
    };

    const intervalId = setInterval(checkAutoSync, 120 * 1000);
    return () => clearInterval(intervalId);
  }, [user, firestore, driveConnection, autoSyncGoogleDriveNow]);

  // Shopify Auto-Sync & Real-Time Sync State & Execution
  const isShopifySyncingRef = useRef(false);
  const [isShopifySyncing, setIsShopifySyncing] = useState(false);

  const autoSyncShopifyNow = useCallback(async (showToast: boolean = true, shopOverride?: string, tokenOverride?: string) => {
    let shop = shopOverride || businessProfile?.shopifyStoreUrl || businessProfileRef.current?.shopifyStoreUrl;
    let token = tokenOverride || businessProfile?.shopifyAccessToken || businessProfileRef.current?.shopifyAccessToken;

    // Check client Firestore fallback under users/{uid}/integrations/shopify if token is missing
    if (!token && user && firestore) {
      try {
        const intSnap = await getDoc(doc(firestore, 'users', user.uid, 'integrations', 'shopify'));
        if (intSnap.exists()) {
          const intData = intSnap.data();
          if (intData?.accessToken) {
            token = intData.accessToken;
            if (!shop && intData.shopDomain) {
              shop = intData.shopDomain;
            }
          }
        }
      } catch (err) {
        console.warn('[Shopify] Error reading client integration token:', err);
      }
    }

    // Check localStorage fallback if state ref is empty
    if (!shop && user) {
      try {
        const localRaw = localStorage.getItem(`analyzeup_profile_${user.uid}`);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (parsed?.shopifyStoreUrl) {
            shop = parsed.shopifyStoreUrl;
            token = token || parsed.shopifyAccessToken;
          }
        }
      } catch (err) {
        console.warn('[Shopify] Error reading local profile:', err);
      }
    }

    // Auto-resolve shop from server status if still not found
    if (!shop && user) {
      try {
        const idToken = await user.getIdToken().catch(() => null);
        const statusRes = await fetch('/api/shopify/status', {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.connected && statusData.store?.shopDomain) {
          shop = statusData.store.shopDomain;
          token = token || statusData.store.accessToken;
          await updateBusinessProfile({
            shopifyConnected: true,
            shopifyStoreUrl: statusData.store.shopDomain,
            shopifyStoreName: statusData.store.storeName,
            shopifyStatus: 'Connected',
            shopifyAccessToken: statusData.store.accessToken || token,
          }, true);
        }
      } catch (err) {
        console.warn('[Shopify] Auto-resolve status failed:', err);
      }
    }

    if (!shop) {
      if (showToast) {
        toast({
          variant: 'destructive',
          title: 'Shopify Not Connected',
          description: 'Store domain missing. Please connect your store first.',
        });
      }
      return;
    }

    if (isShopifySyncingRef.current) return;
    isShopifySyncingRef.current = true;
    if (showToast) {
      setIsShopifySyncing(true);
    }

    if (showToast) {
      toast({
        title: 'Syncing Shopify Store...',
        description: 'Fetching products, inventory levels, and customer orders.',
      });
    }

    try {
      const idToken = user ? await user.getIdToken().catch(() => null) : null;
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ shop, ...(token ? { accessToken: token } : {}) }),
        signal: AbortSignal.timeout(25000),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync with Shopify.');
      }

      const { products: shopifyProds = [], transactions: shopifyTxs = [], returns: shopifyReturns = [], stats } = data;

      let prodChanges = 0;
      let txChanges = 0;
      let returnChanges = 0;
      let deletedProdsCount = 0;

      if (shopifyProds.length > 0) {
        const pRes = await bulkAddProducts(shopifyProds, true, !showToast);
        if (pRes) {
          prodChanges = (pRes.newCount || 0) + (pRes.updateCount || 0);
        }
      }

      // Reconcile deleted Shopify products:
      // If a product previously imported from Shopify is no longer present in Shopify's active catalog, delete it.
      if (firestore && user) {
        const activeShopifyDocIds = new Set<string>();
        const activeShopifyProdIds = new Set<string>();
        const activeShopifyVariantIds = new Set<string>();

        shopifyProds.forEach((p: any) => {
          if (p.id) activeShopifyDocIds.add(p.id);
          if (p.shopifyProductId) activeShopifyProdIds.add(String(p.shopifyProductId));
          if (p.shopifyVariantId) activeShopifyVariantIds.add(String(p.shopifyVariantId));
        });

        const deletedShopifyProducts = products.filter(p => {
          const isFromShopify =
            p.source === 'SHOPIFY' ||
            p.source === 'shopify' ||
            p.id.startsWith('shopify_') ||
            Boolean(p.shopifyProductId) ||
            Boolean(p.shopifyVariantId);

          if (!isFromShopify) return false;

          const isStillActive =
            activeShopifyDocIds.has(p.id) ||
            (p.shopifyVariantId
              ? activeShopifyVariantIds.has(String(p.shopifyVariantId))
              : Boolean(p.shopifyProductId && activeShopifyProdIds.has(String(p.shopifyProductId))));

          return !isStillActive;
        });

        if (deletedShopifyProducts.length > 0) {
          const deleteBatch = writeBatch(firestore);
          let validDeletes = 0;
          deletedShopifyProducts.forEach(dp => {
            const dpId = dp?.id && String(dp.id).trim();
            if (dpId) {
              const dpRef = doc(firestore, 'users', user.uid, 'products', dpId);
              deleteBatch.delete(dpRef);
              const dpShopifyRef = doc(firestore, 'users', user.uid, 'shopify_products', dpId);
              deleteBatch.delete(dpShopifyRef);
              validDeletes++;
            }
          });
          if (validDeletes > 0) {
            await deleteBatch.commit().catch(console.error);
          }
          deletedProdsCount = validDeletes;
          prodChanges += deletedProdsCount;

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
            window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
          }
        }
      }

      if (shopifyTxs.length > 0) {
        const tRes = await bulkAddTransactions(shopifyTxs, !showToast);
        if (tRes) {
          txChanges = (tRes.newCount || 0) + (tRes.updateCount || 0);
        }
      }
      if (shopifyReturns.length > 0) {
        const rRes = await bulkAddReturns(shopifyReturns, !showToast);
        if (rRes) {
          returnChanges = (rRes.newCount || 0) + (rRes.updateCount || 0);
        }
      }

      // Populate AI Copilot knowledge in background without blocking UI completion
      vectorizeAndSyncAiChatbot().catch(console.warn);

      const nowIso = new Date().toISOString();
      await updateBusinessProfile({
        shopifyLastSyncedAt: nowIso,
        shopifyStatus: 'Connected',
        ...(data.newAccessToken ? { shopifyAccessToken: data.newAccessToken } : {}),
        ...(!businessProfile?.firstImportedAt ? { firstImportedAt: nowIso } : {}),
      }, true);

      if (showToast) {
        const returnMsg = (stats?.canonicalReturnsCount || shopifyReturns.length) > 0
          ? `, and ${stats?.canonicalReturnsCount || shopifyReturns.length} returns/refunds`
          : '';
        const delMsg = deletedProdsCount > 0 ? ` (${deletedProdsCount} deleted removed)` : '';
        toast({
          title: 'Shopify Sync Complete',
          description: `Synchronized ${stats?.canonicalProductsCount || shopifyProds.length} products${delMsg}, ${stats?.canonicalTransactionsCount || shopifyTxs.length} orders${returnMsg}. Insights & predictions updated.`,
        });
      }
    } catch (err: any) {
      const isAuthError =
        err?.message?.includes('401') ||
        err?.message?.includes('authentication failed') ||
        err?.message?.includes('Invalid or revoked access token');

      if (isAuthError) {
        console.warn('[Shopify AutoSync] Store authentication requires attention:', err?.message);
        updateBusinessProfile({
          shopifyConnected: false,
          shopifyStatus: 'Disconnected',
          shopifyAccessToken: '',
          shopifyAutoSyncEnabled: false,
          shopifyRealtimeSyncEnabled: false,
        }, true).catch(() => {});
      } else if (showToast) {
        console.error('[Shopify Sync Error]:', err);
      } else {
        console.warn('[Shopify Background AutoSync Warning]:', err?.message || err);
      }

      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      if (showToast) {
        toast({
          variant: 'destructive',
          title: isAuthError ? 'Shopify Authentication Failed' : 'Shopify Sync Failed',
          description: isTimeout
            ? 'Shopify sync request timed out (25s). Please check your internet connection and try again.'
            : (err?.message || 'Could not fetch data from Shopify.'),
        });
      }
    } finally {
      isShopifySyncingRef.current = false;
      setIsShopifySyncing(false);
    }
  }, [businessProfile, products, firestore, user, bulkAddProducts, bulkAddTransactions, bulkAddReturns, vectorizeAndSyncAiChatbot, updateBusinessProfile, toast]);

  const updateShopifyScheduleSettings = useCallback(async (settings: {
    shopifyAutoSyncEnabled?: boolean;
    shopifyRealtimeSyncEnabled?: boolean;
    shopifySyncFrequency?: 'realtime' | '1_min' | '5_mins' | '15_mins' | '30_mins' | '1_hour' | '6_hours' | '12_hours' | 'daily' | 'weekly' | 'custom_datetime';
    shopifySyncTime?: string;
    shopifySyncDay?: string;
    shopifyScheduledDateTime?: string;
    shopifyWebhookHost?: string;
    shopifyWebhooksActive?: boolean;
  }) => {
    const cleanedSettings = cleanObject({
      ...settings,
      shopifyScheduledDateTime: settings.shopifyScheduledDateTime ?? '',
      shopifyStatus: 'Connected',
      updatedAt: new Date().toISOString(),
    });

    await updateBusinessProfile(cleanedSettings, true);

    if (user && firestore) {
      const connRef = doc(firestore, 'users', user.uid, 'integrations', 'shopify');
      await setDoc(connRef, cleanedSettings, { merge: true }).catch(console.warn);
    }

    const hasRealtime = Boolean(settings.shopifyRealtimeSyncEnabled);
    const hasScheduled = Boolean(settings.shopifyAutoSyncEnabled);

    let desc = 'Auto-sync is paused. Manual sync is still available.';
    if (hasRealtime && hasScheduled) {
      desc = `Real-time sync is active and scheduled auto-sync is enabled (${settings.shopifySyncFrequency || 'daily'}).`;
    } else if (hasRealtime) {
      desc = 'Real-time sync is active. Instant updates enabled via webhooks.';
    } else if (hasScheduled) {
      desc = `Scheduled auto-sync is active (${settings.shopifySyncFrequency || 'daily'}).`;
    }

    toast({
      title: 'Shopify Sync Settings Saved',
      description: desc,
    });
  }, [user, firestore, updateBusinessProfile, toast]);

  // Global background runner for Shopify (Real-time live sync & scheduled interval auto-sync)
  useEffect(() => {
    if (
      !businessProfile?.shopifyConnected ||
      !businessProfile?.shopifyStoreUrl
    ) {
      return;
    }

    // 1. Initial seed sync: If connected store has never synced once, run one-time initial seed
    if (!businessProfile.shopifyLastSyncedAt && !isShopifySyncingRef.current) {
      autoSyncShopifyNow(false);
    }

    const isRealtimeActive = Boolean(businessProfile?.shopifyRealtimeSyncEnabled);
    const isScheduledActive = Boolean(businessProfile?.shopifyAutoSyncEnabled);

    // If both real-time and scheduled sync are disabled, do not run any background sync
    if (!isRealtimeActive && !isScheduledActive) {
      return;
    }

    let lastTrigger = 0;
    const checkShopifyBackgroundSync = () => {
      if (isShopifySyncingRef.current) return;
      const now = Date.now();
      if (now - lastTrigger < 10000) return;

      if (isShopifyAutoSyncDue(businessProfile)) {
        lastTrigger = now;
        autoSyncShopifyNow(false);
      }
    };

    // Check automatically on interval (checks isShopifyAutoSyncDue)
    const intervalId = setInterval(checkShopifyBackgroundSync, 15000);

    // Tab focus listener: ONLY syncs if Real-Time Sync is active (never when only scheduled or off!)
    const handleFocus = () => {
      if (!isRealtimeActive) return; // STRICT GUARD: Do not sync on window focus if real-time sync is off!
      if (isShopifySyncingRef.current) return;
      const now = Date.now();
      if (now - lastTrigger < 15000) return;

      const lastSync = businessProfile?.shopifyLastSyncedAt
        ? new Date(businessProfile.shopifyLastSyncedAt).getTime()
        : 0;
      if (now - lastSync >= 15000) {
        lastTrigger = now;
        autoSyncShopifyNow(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    businessProfile?.shopifyConnected,
    businessProfile?.shopifyStoreUrl,
    businessProfile?.shopifyRealtimeSyncEnabled,
    businessProfile?.shopifyAutoSyncEnabled,
    businessProfile?.shopifySyncFrequency,
    businessProfile?.shopifyLastSyncedAt,
    autoSyncShopifyNow,
  ]);

  const disconnectShopify = useCallback(async (options?: { purgeData?: boolean; shopOverride?: string }) => {
    if (!firestore || !user) {
      throw new Error('Workspace is not initialized. Please wait for Firebase to connect.');
    }

    const purgeData = options?.purgeData !== false; // defaults to true
    const uid = user.uid;
    const shop = options?.shopOverride || businessProfile?.shopifyStoreUrl || '';

    let deletedProductsCount = 0;
    let deletedTransactionsCount = 0;
    let deletedReturnsCount = 0;

    // 1. If purgeData is requested, selectively purge ONLY Shopify records and preserve Google Drive & CSV
    if (purgeData) {
      try {
        // 1a. Identify and delete Shopify products only
        const productsSnap = await getDocs(collection(firestore, 'users', uid, 'products')).catch(() => ({ docs: [] } as any));
        const shopifyProductDocs = productsSnap.docs.filter((d: any) => {
          const data = d.data() || {};

          // STRICT IMMUNITY GUARD: Never delete Google Drive, CSV, or Manual products
          const isProtectedDriveOrCsv =
            data.source?.toUpperCase() === 'GOOGLE_DRIVE' ||
            data.source?.toUpperCase() === 'CSV' ||
            data.source?.toUpperCase() === 'MANUAL' ||
            data.importSource?.toLowerCase() === 'drive' ||
            data.importSource?.toLowerCase() === 'csv' ||
            data.importSource?.toLowerCase() === 'manual' ||
            Boolean(data.driveFileId) ||
            Boolean(data.driveProductId) ||
            d.id.startsWith('drive_') ||
            d.id.startsWith('csv_');

          if (isProtectedDriveOrCsv) return false;

          return (
            data.source?.toUpperCase() === 'SHOPIFY' ||
            data.importSource?.toLowerCase() === 'shopify' ||
            d.id.startsWith('shopify_') ||
            (typeof data.id === 'string' && data.id.startsWith('shopify_')) ||
            Boolean(data.shopifyProductId) ||
            Boolean(data.shopifyVariantId) ||
            (typeof data.sku === 'string' && data.sku.toUpperCase().startsWith('SHOPIFY-')) ||
            (typeof data.supplier === 'string' && data.supplier.toLowerCase().includes('shopify'))
          );
        });

        deletedProductsCount = shopifyProductDocs.length;
        const deletedProductDocIds = new Set<string>(shopifyProductDocs.map((d: any) => d.id));
        const deletedProductDataIds = new Set<string>(shopifyProductDocs.map((d: any) => d.data()?.id).filter(Boolean));
        const deletedShopifyIds = new Set<string>(shopifyProductDocs.map((d: any) => String(d.data()?.shopifyProductId || '')).filter(Boolean));

        // 1b. Identify and delete Shopify transactions only
        const txSnap = await getDocs(collection(firestore, 'users', uid, 'transactions')).catch(() => ({ docs: [] } as any));
        const shopifyTxDocs = txSnap.docs.filter((d: any) => {
          const data = d.data() || {};

          // STRICT IMMUNITY GUARD: Never delete Google Drive, CSV, or Manual transactions
          const isProtectedDriveOrCsv =
            data.source?.toUpperCase() === 'GOOGLE_DRIVE' ||
            data.source?.toUpperCase() === 'CSV' ||
            data.source?.toUpperCase() === 'MANUAL' ||
            data.importSource?.toLowerCase() === 'drive' ||
            data.importSource?.toLowerCase() === 'csv' ||
            data.importSource?.toLowerCase() === 'manual' ||
            Boolean(data.driveFileId) ||
            (typeof data.notes === 'string' && data.notes.toLowerCase().includes('google drive')) ||
            d.id.startsWith('tx_drive_') ||
            d.id.startsWith('drive_') ||
            d.id.startsWith('tx_csv_') ||
            d.id.startsWith('csv_');

          if (isProtectedDriveOrCsv) return false;

          const isSourceShopify = data.source?.toUpperCase() === 'SHOPIFY' || data.importSource?.toLowerCase() === 'shopify';
          const isDocShopify = d.id.startsWith('tx_shopify_') || (d.id.startsWith('tx_refund_') && Boolean(data.shopifyRefundId || data.shopifyOrderId));
          const isDataShopify = typeof data.id === 'string' && data.id.startsWith('tx_shopify_');
          const isPaymentShopify = typeof data.paymentMethod === 'string' && data.paymentMethod.toLowerCase().includes('shopify');
          const hasShopifyOrderId = Boolean(data.shopifyOrderId || data.shopifyTransactionId);
          const matchesProdId =
            (data.productId && (deletedProductDocIds.has(data.productId) || deletedProductDataIds.has(data.productId) || deletedShopifyIds.has(String(data.productId)))) ||
            (data.product_id && (deletedProductDocIds.has(data.product_id) || deletedProductDataIds.has(data.product_id) || deletedShopifyIds.has(String(data.product_id))));

          return (
            isSourceShopify ||
            isDocShopify ||
            isDataShopify ||
            isPaymentShopify ||
            hasShopifyOrderId ||
            matchesProdId
          );
        });
        deletedTransactionsCount = shopifyTxDocs.length;

        // 1c. Identify and delete Shopify returns only
        const retSnap = await getDocs(collection(firestore, 'users', uid, 'returns')).catch(() => ({ docs: [] } as any));
        const shopifyRetDocs = retSnap.docs.filter((d: any) => {
          const data = d.data() || {};

          // STRICT IMMUNITY GUARD: Never delete Google Drive, CSV, or Manual returns
          const isProtectedDriveOrCsv =
            data.source?.toUpperCase() === 'GOOGLE_DRIVE' ||
            data.source?.toUpperCase() === 'CSV' ||
            data.source?.toUpperCase() === 'MANUAL' ||
            data.importSource?.toLowerCase() === 'drive' ||
            data.importSource?.toLowerCase() === 'csv' ||
            Boolean(data.driveFileId) ||
            d.id.startsWith('ret_drive_') ||
            d.id.startsWith('ret_csv_');

          if (isProtectedDriveOrCsv) return false;

          return (
            data.source?.toUpperCase() === 'SHOPIFY' ||
            data.importSource?.toLowerCase() === 'shopify' ||
            d.id.startsWith('ret_shopify_') ||
            Boolean(data.shopifyReturnId) ||
            deletedProductDocIds.has(data.productId) ||
            (typeof data.notes === 'string' && data.notes.toLowerCase().includes('shopify'))
          );
        });
        deletedReturnsCount = shopifyRetDocs.length;

        // 1d. Clean dedicated Shopify subcollections ONLY (sales_orders, shopify_products)
        // DO NOT wipe generic inventory or refunds collections
        const shopifyExtraCols = ['sales_orders', 'shopify_products'];
        const extraSnaps = await Promise.all(
          shopifyExtraCols.map(col => getDocs(collection(firestore, 'users', uid, col)).catch(() => ({ docs: [] } as any)))
        );

        // Also clean only shopify-tagged docs from inventory subcollection if any
        const invSnap = await getDocs(collection(firestore, 'users', uid, 'inventory')).catch(() => ({ docs: [] } as any));
        const shopifyInvDocs = invSnap.docs.filter((d: any) => {
          const data = d.data() || {};
          return data.source?.toUpperCase() === 'SHOPIFY' || data.importSource?.toLowerCase() === 'shopify' || d.id.startsWith('shopify_') || Boolean(data.shopifyProductId);
        });

        const allShopifyDocsToDelete = [
          ...shopifyProductDocs,
          ...shopifyTxDocs,
          ...shopifyRetDocs,
          ...shopifyInvDocs,
          ...extraSnaps.flatMap((s: any) => s.docs),
        ];

        const CHUNK_SIZE = 400;
        for (let i = 0; i < allShopifyDocsToDelete.length; i += CHUNK_SIZE) {
          const batch = writeBatch(firestore);
          allShopifyDocsToDelete.slice(i, i + CHUNK_SIZE).forEach((docSnap: any) => batch.delete(docSnap.ref));
          await batch.commit().catch(console.warn);
        }

        // 1e. Recalculate remaining analytics summary (retaining Google Drive + CSV data)
        const remainingTxDocs = txSnap.docs.filter((d: any) => !shopifyTxDocs.some((sd: any) => sd.id === d.id));
        const remainingProdDocs = productsSnap.docs.filter((d: any) => !shopifyProductDocs.some((sp: any) => sp.id === d.id));
        const sumRef = doc(firestore, 'users', uid, 'analytics', 'summary');

        if (remainingTxDocs.length === 0 || remainingProdDocs.length === 0) {
          await setDoc(sumRef, DEFAULT_ANALYTICS_SUMMARY).catch(console.warn);
          await deleteDoc(doc(firestore, 'users', uid, 'analytics', 'ai_brief')).catch(() => {});
        } else {
          const remProds = remainingProdDocs.map((d: any) => ({ id: d.id, ...d.data() }));
          const remTxs = remainingTxDocs.map((d: any) => ({ id: d.id, ...d.data() }));
          await recalculateAndSaveAnalyticsSummary(firestore, uid, {
            products: remProds,
            transactions: remTxs,
            suppliers,
            orders,
            returns,
          }).catch(console.warn);
        }
      } catch (err) {
        console.error('[Shopify Disconnect] Selective data purge error:', err);
      }
    }

    // 2. Remove client integration document & store lookup index
    try {
      const connectionRef = doc(firestore, 'users', uid, 'integrations', 'shopify');
      await deleteDoc(connectionRef).catch(console.warn);

      if (shop) {
        const storeLookupRef = doc(firestore, 'shopify_stores', shop);
        await deleteDoc(storeLookupRef).catch(console.warn);
      }
    } catch (e) {
      console.warn('[Shopify Disconnect] Integration doc deletion error:', e);
    }

    // 3. Reset businessProfile in React state, localStorage, and Firestore
    await updateBusinessProfile(
      {
        shopifyConnected: false,
        shopifyStoreUrl: '',
        shopifyStoreName: '',
        shopifyStatus: 'Disconnected',
        shopifyAccessToken: '',
        shopifyLastSyncedAt: '',
        shopifyAutoSyncEnabled: false,
        shopifyRealtimeSyncEnabled: false,
        shopifySyncFrequency: 'daily',
        shopifyWebhooksActive: false,
      },
      true
    );

    if (firestore && user) {
      const profileRef = doc(firestore, 'users', uid, 'settings', 'business_profile');
      await setDoc(profileRef, {
        shopifyConnected: false,
        shopifyStoreUrl: '',
        shopifyStoreName: '',
        shopifyStatus: 'Disconnected',
        shopifyAccessToken: deleteField(),
        shopifyLastSyncedAt: deleteField(),
        shopifyAutoSyncEnabled: false,
        shopifyRealtimeSyncEnabled: false,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(console.error);
    }

    // 4. Notify backend server to scrub server cache and sync jobs
    const idToken = user ? await user.getIdToken().catch(() => null) : null;
    await fetch('/api/shopify/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        shop,
        userId: uid,
        purgeData,
      }),
    }).catch(console.warn);

    // 5. Clean up localStorage cache
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove = Object.keys(localStorage).filter(
          (k) => k.startsWith('analyzeup_shopify_') || k.includes('shopify_sync') || k.includes('shopify_store')
        );
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        const localProf = localStorage.getItem(`analyzeup_profile_${uid}`);
        if (localProf) {
          const parsed = JSON.parse(localProf);
          parsed.shopifyConnected = false;
          parsed.shopifyStatus = 'Disconnected';
          parsed.shopifyStoreUrl = '';
          parsed.shopifyStoreName = '';
          delete parsed.shopifyAccessToken;
          delete parsed.shopifyLastSyncedAt;
          localStorage.setItem(`analyzeup_profile_${uid}`, JSON.stringify(parsed));
        }
      } catch (e) {
        console.warn('[Shopify Disconnect] LocalStorage cleanup error:', e);
      }
    }

    return {
      success: true,
      deletedProducts: deletedProductsCount,
      deletedTransactions: deletedTransactionsCount,
      deletedReturns: deletedReturnsCount,
    };
  }, [firestore, user, businessProfile, suppliers, orders, returns, updateBusinessProfile]);

  const businessBuddyCalibration = useMemo(() => {
    return getBusinessBuddyCalibration(businessProfile, products, transactions, returns);
  }, [businessProfile, products, transactions, returns]);

  // Data Readiness & Centralized Feature Capabilities Engine (Section 1-8 & 22-23)
  const previousReadiness = useMemo<DataReadiness | null>(() => {
    if (typeof window !== 'undefined' && user?.uid) {
      try {
        const stored = localStorage.getItem(`analyzeup_data_readiness_snapshot_${user.uid}`);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  }, [user?.uid]);

  const dataReadiness = useMemo(() => {
    // If the account has no catalog products and no transactions, strictly evaluate genuine empty zero-state
    if ((!products || products.length === 0) && (!transactions || transactions.length === 0)) {
      return evaluateDataReadiness([], [], { profile: businessProfile });
    }

    const computed = evaluateDataReadiness(products, transactions, {
      profile: businessProfile,
      previousReadiness,
    });

    // Persist established high-water mark per-user so temporary sync drops never downgrade maturity (Section 23)
    if (typeof window !== 'undefined' && user?.uid && computed.score >= 25 && !computed.isResiliencePreserved && products.length > 0) {
      try {
        localStorage.setItem(`analyzeup_data_readiness_snapshot_${user.uid}`, JSON.stringify(computed));
      } catch {
        // ignore
      }
    }
    return computed;
  }, [products, transactions, businessProfile, previousReadiness, user?.uid]);

  const capabilities = useMemo(() => dataReadiness.capabilities, [dataReadiness]);

  const activateRecommendationsNow = useCallback(async () => {
    try {
      await updateBusinessProfile({
        buddyCalibrationOverridden: true,
        calibrationStatus: 'CALIBRATED',
      });
      toast({
        title: 'Recommendations Activated! 🚀',
        description: 'Your AI Business Buddy has unlocked full automated restock, promotions, and clearance tasks.',
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
        window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
      }
    } catch (err: any) {
      toast({
        title: 'Action failed',
        description: err?.message || 'Failed to activate recommendations.',
        variant: 'destructive',
      });
    }
  }, [updateBusinessProfile, toast]);

  // Automatic reconciliation of duplicate products sharing identical SKU in Firestore
  // Purges phantom duplicate product documents (e.g. from legacy CSV imports with fake 25 stock) while preserving authoritative Shopify/catalog products
  const hasRunReconciliationRef = useRef(false);
  useEffect(() => {
    if (!firestore || !user?.uid || products.length === 0 || hasRunReconciliationRef.current) return;

    const skuCountMap = new Map<string, number>();
    products.forEach(p => {
      const s = (p.sku || '').trim().toUpperCase();
      if (s) skuCountMap.set(s, (skuCountMap.get(s) || 0) + 1);
    });

    const hasDuplicates = Array.from(skuCountMap.values()).some(count => count > 1);
    if (hasDuplicates) {
      hasRunReconciliationRef.current = true;
      reconcileDuplicateProducts(products, firestore, user.uid).then(result => {
        if (result.purgedCount > 0) {
          console.log(`[AutoReconcile] Purged ${result.purgedCount} duplicate product documents from Firestore.`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
          }
        }
      }).catch(err => {
        console.warn('[AutoReconcile] Product reconciliation error:', err);
      });
    }
  }, [firestore, user?.uid, products]);

  const value = useMemo(() => ({
    dataReadiness,
    capabilities,
    businessBuddyCalibration,
    activateRecommendationsNow,
    products,
    orders,
    suppliers,
    transactions,
    categories,
    returns,
    customAttributes,
    businessProfile,
    updateBusinessProfile,
    loadDemoBusiness,
    clearDemoBusiness,
    purgeDemoDataOnly,
    hasDemoData,
    isLoadingDemo,
    isDeletingDemo,
    demoProgress,
    showOnboardingWizard,
    setShowOnboardingWizard,
    showWelcomeModal,
    setShowWelcomeModal,
    showShopifyModal,
    setShowShopifyModal,
    addCustomAttribute,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    deleteOrder,
    updateOrderStatus,
    receivePurchaseOrder,
    addSupplier,
    deleteSupplier,
    addCategory,
    addTransaction,
    recordSale,
    addReturn,
    deleteReturn,
    updateReturn,
    updateReturnStatus,
    bulkAddProducts,
    bulkUpdateProducts,
    bulkDeleteProducts,
    bulkAddTransactions,
    bulkAddReturns,
    vectorizeAndSyncAiChatbot,
    clearAllData,
    driveConnection,
    autoSyncGoogleDriveNow,
    subscribeGoogleDriveConnection,
    getGoogleDriveFiles,
    getSyncHistory,
    getMappingProfiles,
    disconnectGoogleDrive,
    updateGoogleDriveSettings,
    recordSyncSuccess,
    saveMappingProfile,
    isLoading,
    activePlan,
    isProcessingPayment,
    showSubscriptionModal,
    setShowSubscriptionModal,
    isTourOpen,
    setIsTourOpen,
    isLimitExceeded,
    activePlanLimit,
    aiQueryCount,
    incrementAiQueryCount,
    reportCount,
    incrementReportCount,
    monthlyUsage,
    updateActivePlan,
    handleUpgrade,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    analyticsSummary,
    refreshAnalytics,
    isShopifySyncing,
    autoSyncShopifyNow,
    updateShopifyScheduleSettings,
    disconnectShopify,
  }), [
    businessBuddyCalibration,
    activateRecommendationsNow,
    products,
    orders,
    suppliers,
    transactions,
    categories,
    returns,
    customAttributes,
    businessProfile,
    updateBusinessProfile,
    loadDemoBusiness,
    clearDemoBusiness,
    purgeDemoDataOnly,
    hasDemoData,
    isLoadingDemo,
    isDeletingDemo,
    demoProgress,
    showOnboardingWizard,
    setShowOnboardingWizard,
    showWelcomeModal,
    setShowWelcomeModal,
    showShopifyModal,
    setShowShopifyModal,
    addCustomAttribute,
    isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    deleteOrder,
    updateOrderStatus,
    receivePurchaseOrder,
    addSupplier,
    deleteSupplier,
    addCategory,
    addTransaction,
    recordSale,
    addReturn,
    deleteReturn,
    updateReturn,
    updateReturnStatus,
    bulkAddProducts,
    bulkUpdateProducts,
    bulkDeleteProducts,
    bulkAddTransactions,
    bulkAddReturns,
    vectorizeAndSyncAiChatbot,
    clearAllData,
    driveConnection,
    autoSyncGoogleDriveNow,
    subscribeGoogleDriveConnection,
    getGoogleDriveFiles,
    getSyncHistory,
    getMappingProfiles,
    disconnectGoogleDrive,
    updateGoogleDriveSettings,
    recordSyncSuccess,
    saveMappingProfile,
    activePlan,
    isProcessingPayment,
    showSubscriptionModal,
    setShowSubscriptionModal,
    isTourOpen,
    setIsTourOpen,
    isLimitExceeded,
    activePlanLimit,
    aiQueryCount,
    incrementAiQueryCount,
    reportCount,
    incrementReportCount,
    monthlyUsage,
    updateActivePlan,
    handleUpgrade,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    analyticsSummary,
    refreshAnalytics,
    isShopifySyncing,
    autoSyncShopifyNow,
    updateShopifyScheduleSettings,
    disconnectShopify,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
