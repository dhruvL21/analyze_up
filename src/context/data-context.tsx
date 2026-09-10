'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Product, PurchaseOrder, Supplier, Transaction, Category, ProductReturn, CustomAttribute, BusinessProfile, BusinessType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, setDoc, onSnapshot, getDocs, getDoc, deleteField } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateDemoBusinessData } from '@/lib/demo-data';
import Papa from 'papaparse';
import { getClientDriveToken, isAutoSyncDue, autoDetectMapping, formatLastSyncTime } from '@/lib/drive-helper';
import { isShopifyAutoSyncDue } from '@/lib/shopify-sync-helper';
import { findMatchingImportProfile } from '@/lib/import-profile-store';
import { logBusinessAction } from '@/lib/audit-store';
import {
  type AnalyticsSummary,
  DEFAULT_ANALYTICS_SUMMARY,
  recalculateAndSaveAnalyticsSummary,
} from '@/lib/analytics-aggregator';
import { generateProductDocId, generateTransactionDocId } from '@/lib/import-job-service';
import { sanitizePlainData } from '@/lib/utils';

import {
  getBusinessBuddyCalibration,
  type BusinessBuddyCalibration,
} from '@/lib/business-buddy-engine';

interface DataContextProps {
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
  hasDemoData: boolean;
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
  updateReturnStatus: (returnId: string, refundStatus: string) => Promise<void>;
  bulkAddProducts: (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[], overwriteStock?: boolean, silent?: boolean) => Promise<any>;
  bulkUpdateProducts: (updates: (Partial<Product> & { id: string })[]) => Promise<void>;
  bulkDeleteProducts: (productIds: string[]) => Promise<void>;
  bulkAddTransactions: (transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>[], silent?: boolean) => Promise<any>;
  bulkAddReturns: (returnsData: (Omit<ProductReturn, 'createdAt' | 'updatedAt' | 'userId'> & { id?: string })[], silent?: boolean) => Promise<any>;
  vectorizeAndSyncAiChatbot: () => Promise<any>;
  clearAllData: () => Promise<void>;
  // Google Drive & Integration Helpers
  driveConnection: any;
  autoSyncGoogleDriveNow: (showToast?: boolean) => Promise<void>;
  subscribeGoogleDriveConnection: (onUpdate: (data: any) => void) => () => void;
  getGoogleDriveFiles: () => Promise<any[]>;
  getSyncHistory: () => Promise<any[]>;
  getMappingProfiles: () => Promise<any[]>;
  disconnectGoogleDrive: () => Promise<void>;
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
  handleUpgrade: (planId: string, amount: number, planName: string) => Promise<void>;
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

  const [activePlan, setActivePlan] = useState<string>(() => {
    if (typeof window === 'undefined') return "Free Trial";
    return localStorage.getItem("analyzeup_subscription_plan") || "Free Trial";
  });
  const [aiQueryCount, setAiQueryCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = localStorage.getItem('analyzeup_ai_queries_count');
      return saved ? Math.max(0, parseInt(saved, 10)) : 0;
    } catch {
      return 0;
    }
  });

  const incrementAiQueryCount = useCallback((amount = 1) => {
    setAiQueryCount(prev => {
      const next = prev + amount;
      try {
        localStorage.setItem('analyzeup_ai_queries_count', next.toString());
      } catch (e) {
        console.error('Error saving AI query count:', e);
      }
      return next;
    });
  }, []);

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
      getDoc(doc(firestore, 'users', user.uid, 'settings', 'business_profile'))
        .then((snap) => {
          if (snap.exists()) {
            const remote = snap.data() as BusinessProfile;
            setBusinessProfile((prev) => {
              const merged = { ...(prev || {}), ...remote } as BusinessProfile;
              businessProfileRef.current = merged;
              return merged;
            });
          }
        })
        .catch(console.warn);

      // Check integrations collection for Shopify connection
      getDoc(doc(firestore, 'users', user.uid, 'integrations', 'shopify'))
        .then((snap) => {
          if (snap.exists()) {
            const intData = snap.data();
            if (intData?.connectionStatus === 'Connected' || intData?.accessToken) {
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
            }
          }
        })
        .catch(console.warn);
    }
  }, [user, firestore]);

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
    toast({ title: 'Generating Demo Business...', description: 'Loading 200+ products, 15+ suppliers & 500+ transactions.' });

    const demo = generateDemoBusinessData();
    const uid = user.uid;

    try {
      // Chunk writing into batch commitments
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

      const txBatches = [];
      for (let i = 0; i < demo.transactions.length; i += 450) {
        const batch = writeBatch(firestore);
        const chunk = demo.transactions.slice(i, i + 450);
        chunk.forEach(t => {
          const ref = doc(firestore, 'users', uid, 'transactions', t.id);
          batch.set(ref, cleanObject({ ...t, userId: uid }));
        });
        txBatches.push(batch.commit());
      }
      await Promise.all(txBatches);

      const poBatch = writeBatch(firestore);
      demo.orders.forEach(o => {
        const ref = doc(firestore, 'users', uid, 'orders', o.id);
        poBatch.set(ref, cleanObject({ ...o, userId: uid }));
      });
      demo.returns.forEach(r => {
        const ref = doc(firestore, 'users', uid, 'returns', r.id);
        poBatch.set(ref, cleanObject({ ...r, userId: uid }));
      });
      await poBatch.commit();

      // Recalculate and persist Analytics Summary & AI Brief immediately for complete dashboard fidelity
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
      });

      setShowWelcomeModal(true);
    } catch (err) {
      console.error("Error populating demo data:", err);
      toast({ variant: 'destructive', title: 'Demo Business Error', description: 'Failed to populate full demo dataset.' });
    }
  }, [user, firestore, toast, businessProfile, updateBusinessProfile]);

  useEffect(() => {
    const stored = localStorage.getItem("analyzeup_subscription_plan");
    if (stored) {
      setActivePlan(stored);
    }
  }, []);

  const activePlanLimit = useMemo(() => {
    if (activePlan === "Starter Plan") return 25000;
    if (activePlan === "Growth Plan") return 50000;
    if (activePlan === "Pro Plan") return 250000;
    return 10000; // Free Baseline allows 10,000 records
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
              localStorage.setItem("analyzeup_subscription_plan", planName);
              setActivePlan(planName);
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
  }, [toast]);

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

    const newProduct: any = {
      ...productData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      averageDailySales: Math.floor(Math.random() * 10) + 1,
      leadTimeDays: Math.floor(Math.random() * 10) + 5,
    };
    batch.set(newProductRef, newProduct);

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

    const existingProductByIdMap = new Map<string, Product>();
    const existingProductByVariantMap = new Map<string, Product>();
    const existingProductByShopifyProdMap = new Map<string, Product>();
    const existingProductSkuMap = new Map<string, Product>();
    const existingProductNameMap = new Map<string, Product>();

    products.forEach(p => {
      if (p.id) existingProductByIdMap.set(p.id, p);
      if (p.shopifyVariantId) existingProductByVariantMap.set(String(p.shopifyVariantId), p);
      if (p.shopifyProductId) existingProductByShopifyProdMap.set(String(p.shopifyProductId), p);
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
      const docId = pAny.id ? String(pAny.id) : '';
      const shopifyVarId = pAny.shopifyVariantId ? String(pAny.shopifyVariantId) : '';
      const shopifyProdId = pAny.shopifyProductId ? String(pAny.shopifyProductId) : '';
      const skuUpper = (productData.sku || '').trim().toUpperCase();
      const nameLower = (productData.name || '').trim().toLowerCase();

      const existingProduct =
        (docId && existingProductByIdMap.get(docId)) ||
        (shopifyVarId && existingProductByVariantMap.get(shopifyVarId)) ||
        (skuUpper && existingProductSkuMap.get(skuUpper)) ||
        (shopifyProdId && existingProductByShopifyProdMap.get(shopifyProdId)) ||
        (nameLower && existingProductNameMap.get(nameLower)) ||
        null;

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

        operations.push({
          type: 'update',
          id: existingProduct.id,
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
        const targetId = pAny.id || undefined;
        operations.push({
          type: 'create',
          id: targetId,
          data: cleanObject({
            ...productData,
            ...(targetId ? { id: targetId } : {}),
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            averageDailySales: productData.averageDailySales || (Math.floor(Math.random() * 5) + 1),
            leadTimeDays: productData.leadTimeDays || (Math.floor(Math.random() * 7) + 5),
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

      chunk.forEach(op => {
        if (op.type === 'update') {
          const productRef = doc(productsRef, op.id);
          batch.update(productRef, op.data);
        } else {
          const newProductRef = op.id ? doc(productsRef, op.id) : doc(productsRef);
          batch.set(newProductRef, op.data);

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

    const CHUNK_SIZE = 450;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);

      chunk.forEach(update => {
        const productRef = doc(productsRef, update.id);
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

    const CHUNK_SIZE = 450;
    const deletePromises: Promise<void>[] = [];

    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);
      chunk.forEach(id => {
        const productRef = doc(firestore, 'users', user.uid, 'products', id);
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

    const existingMapByOrderNo = new Map<string, Transaction>();
    const existingMapByFingerprint = new Map<string, Transaction>();

    transactions.forEach(t => {
      if (t.orderNumber?.trim()) {
        existingMapByOrderNo.set(t.orderNumber.trim().toUpperCase(), t);
      }
      existingMapByFingerprint.set(getTxFingerprint(t), t);
    });

    let newCount = 0;
    let updateCount = 0;
    let skippedCount = 0;

    const operations: Array<
      | { type: 'create'; data: any }
      | { type: 'update'; id: string; data: any }
    > = [];

    transactionsData.forEach(t => {
      const orderNoUpper = t.orderNumber?.trim().toUpperCase();
      const fingerprint = getTxFingerprint(t);
      const existing = (orderNoUpper ? existingMapByOrderNo.get(orderNoUpper) : null) || existingMapByFingerprint.get(fingerprint);

      if (existing) {
        const isStatusChanged = t.status && t.status !== existing.status;
        const isPaymentChanged = t.paymentMethod && t.paymentMethod !== existing.paymentMethod;

        if (!isStatusChanged && !isPaymentChanged) {
          skippedCount++;
          return;
        }

        operations.push({
          type: 'update',
          id: existing.id,
          data: cleanObject({
            ...(isStatusChanged ? { status: t.status } : {}),
            ...(isPaymentChanged ? { paymentMethod: t.paymentMethod } : {}),
            updatedAt: serverTimestamp(),
          }),
        });
        updateCount++;
      } else {
        if (orderNoUpper) existingMapByOrderNo.set(orderNoUpper, t as any);
        existingMapByFingerprint.set(fingerprint, t as any);

        operations.push({
          type: 'create',
          data: cleanObject({
            ...t,
            orderNumber: t.orderNumber || `ORD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            source: (t as any).source || 'Sync',
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
        if (op.type === 'update') {
          const transDocRef = doc(transactionsRef, op.id);
          batch.update(transDocRef, op.data);
        } else {
          const newTransDocRef = doc(transactionsRef);
          batch.set(newTransDocRef, op.data);
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

        if (!isStatusChanged && !isActionChanged && !isAmountChanged) {
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
            updatedAt: serverTimestamp(),
          }),
          rawReturn: { ...existing, ...r },
        });
        updateCount++;
      } else {
        const returnId = r.id || `ret_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        if (r.id) existingMapById.set(r.id, { ...r, id: returnId } as any);
        existingMapByFingerprint.set(fingerprint, { ...r, id: returnId } as any);

        operations.push({
          type: 'create',
          id: returnId,
          data: cleanObject({
            ...r,
            id: returnId,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          rawReturn: { ...r, id: returnId },
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
        const returnDocRef = doc(returnsRef, op.id);
        if (op.type === 'update') {
          batch.update(returnDocRef, op.data);
        } else {
          batch.set(returnDocRef, op.data);

          // If restocked, update product stock in Firestore
          if (op.rawReturn.actionTaken === 'Restocked' && op.rawReturn.productId) {
            const product = products.find(p => p.id === op.rawReturn.productId || (op.rawReturn.sku && p.sku === op.rawReturn.sku));
            if (product) {
              const productRef = doc(firestore, 'users', user.uid, 'products', product.id);
              batch.update(productRef, {
                stock: product.stock + Math.abs(op.rawReturn.quantity || 1),
                updatedAt: serverTimestamp(),
              });
            }
          }

          // If refunded, record deterministic Sale adjustment transaction (negative sales!)
          if (op.rawReturn.refundStatus === 'Refunded' || op.rawReturn.refundStatus === 'Store Credit') {
            const product = products.find(p => p.id === op.rawReturn.productId || (op.rawReturn.sku && p.sku === op.rawReturn.sku));
            const refundTxId = `tx_refund_${op.id}`;
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
    if (!firestore || !user) return;
    const existingProduct = products.find(p => p.id === updatedProduct.id);
    const productRef = doc(firestore, 'users', user.uid, 'products', updatedProduct.id);
    const { id, ...updateData } = updatedProduct;
    const dataToUpdate = cleanObject({ ...updateData, updatedAt: serverTimestamp() });

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
    const shop = businessProfile?.shopifyStoreUrl;
    const token = businessProfile?.shopifyAccessToken;
    const isShopifyProduct = Boolean(
      updatedProduct.shopifyProductId ||
      updatedProduct.shopifyVariantId ||
      updatedProduct.source === 'shopify' ||
      updatedProduct.source === 'SHOPIFY' ||
      (typeof updatedProduct.sku === 'string' && updatedProduct.sku.startsWith('SHOPIFY-')) ||
      (typeof updatedProduct.supplier === 'string' && updatedProduct.supplier.toLowerCase().includes('shopify'))
    );
    const shouldSyncShopify = Boolean(
      (isPriceChanged || options?.forceShopifySync) &&
      (shop || isShopifyProduct || Boolean(businessProfile?.shopifyConnected))
    );

    // Automatically synchronize discounted price with Shopify store & backend database
    if (shouldSyncShopify) {
      const oldPrice =
        updatedProduct.compareAtPrice !== undefined
          ? updatedProduct.compareAtPrice
          : existingProduct && existingProduct.price !== updatedProduct.price
          ? existingProduct.price
          : existingProduct?.compareAtPrice || updatedProduct.price;
      const newPrice = updatedProduct.price;
      const compareAtPrice =
        updatedProduct.compareAtPrice !== undefined
          ? updatedProduct.compareAtPrice
          : oldPrice > newPrice
          ? oldPrice
          : undefined;

      try {
        const res = await fetch('/api/shopify/price/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop,
            accessToken: token,
            userId: user.uid,
            tenantId: user.uid,
            productId: updatedProduct.id,
            shopifyProductId: updatedProduct.shopifyProductId,
            shopifyVariantId: updatedProduct.shopifyVariantId,
            sku: updatedProduct.sku,
            productName: updatedProduct.name,
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
    const updatedProductsList = products.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p);
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
    if (!firestore || !user) return;
    const productRef = doc(firestore, 'users', user.uid, 'products', productId);
    await deleteDoc(productRef).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: productRef.path,
        operation: 'delete',
      }));
    });
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
    if (orderStatus === 'Fulfilled') {
      const productRef = doc(firestore, 'users', user.uid, 'products', orderData.productId);
      const product = products.find(p => p.id === orderData.productId);
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
    if (!firestore || !user) return;
    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
    await deleteDoc(orderRef).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: orderRef.path,
        operation: 'delete',
      }));
    });
    toast({ title: 'Order Deleted', description: 'The purchase order has been removed.' });
  }, [firestore, user, toast]);

  const receivePurchaseOrder = useCallback(async (orderId: string, customReceivedQty?: number) => {
    if (!firestore || !user || !ordersRef || !transactionsRef) return;
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    if (orderToUpdate.status === 'Fulfilled') {
      toast({ title: 'Already Received', description: 'This purchase order has already been received and added to inventory.' });
      return;
    }

    const receivedQty = customReceivedQty !== undefined ? customReceivedQty : orderToUpdate.quantity;
    const batch = writeBatch(firestore);
    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);

    batch.update(orderRef, {
      status: 'Fulfilled',
      actualDeliveryDate: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    const product = products.find(p => p.id === orderToUpdate.productId);
    if (product) {
      const productRef = doc(firestore, 'users', user.uid, 'products', product.id);
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
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            shop: shopifyStore,
            inventoryItemId: invItemId || product.id.replace('shopify_', ''),
            locationId: 'primary',
            delta: receivedQty,
            reason: 'received_purchase_order',
            purchaseOrderId: orderId,
            receivingEventId: `rcv_${orderId}_${Date.now()}`,
          }),
        }).catch((err) => {
          console.warn('[Shopify PO Inventory Sync Note]:', err);
        });
      }).catch(console.warn);
    }

    toast({
      title: '📦 Goods Received & Inventory Updated!',
      description: `Added +${receivedQty} units to "${product?.name || 'Product'}". Stock count and AI analytics updated.`,
    });
  }, [firestore, user, ordersRef, transactionsRef, orders, products, suppliers, businessProfile, toast]);

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    if (status === 'Fulfilled') {
      await receivePurchaseOrder(orderId);
      return;
    }

    if (!firestore || !user) return;
    const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
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
    if (!firestore || !user || !transactionsRef) return;

    const product = products.find(p => p.id === productId);
    if (!product || product.stock < quantity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Insufficient stock or product not found.' });
      return;
    }

    const batch = writeBatch(firestore);
    const productRef = doc(firestore, 'users', user.uid, 'products', productId);
    const transactionRef = doc(transactionsRef);

    batch.update(productRef, {
      stock: product.stock - quantity,
      updatedAt: serverTimestamp()
    });

    batch.set(transactionRef, {
      id: transactionRef.id,
      tenantId: user.uid,
      productId,
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
    if (returnData.actionTaken === 'Restocked') {
      const productRef = doc(firestore, 'users', user.uid, 'products', returnData.productId);
      const product = products.find(p => p.id === returnData.productId);
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
    if (!firestore || !user || !returnsRef || !transactionsRef) return;
    
    const returnRef = doc(firestore, 'users', user.uid, 'returns', returnId);
    const returnToUpdate = returns.find(r => r.id === returnId);
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

  const deleteReturn = useCallback(async (returnId: string) => {
    if (!firestore || !user) return;
    const returnRef = doc(firestore, 'users', user.uid, 'returns', returnId);
    await deleteDoc(returnRef).catch((_serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: returnRef.path,
            operation: 'delete',
        }));
    });
    toast({ title: 'Return Deleted', description: 'The return record has been removed.' });
  }, [firestore, user, toast]);

  const deleteSupplier = useCallback(async (supplierId: string) => {
    if (!firestore || !user) return;
    const supplierRef = doc(firestore, 'users', user.uid, 'suppliers', supplierId);
    await deleteDoc(supplierRef).catch((_serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: supplierRef.path,
        operation: 'delete',
      }));
    });
    toast({ title: 'Supplier Deleted', description: 'The supplier has been removed.' });
  }, [firestore, user, toast]);

  const clearAllData = useCallback(async () => {
    if (!firestore || !user) {
      throw new Error('Your workspace is not ready to reset. Please wait for Firebase to reconnect and try again.');
    }

    // 1. Wipe all local storage caches, history, demographics, insights, completed actions & snapshots instantly
    if (typeof window !== 'undefined') {
      try {
        const keysToKeep = new Set([
          'analyzeup_subscription_plan',
          'analyzeup_just_registered',
          'analyzeup_just_logged_in',
          'analyzeup_feature_tour_seen_global',
          user ? `analyzeup_profile_${user.uid}` : '',
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
            key.includes('opportunity')
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
        isOnboardingCompleted: false,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(firestore, 'users', uid, 'settings', 'business_profile'), profileReset, { merge: true });

      if (businessProfile) {
        const cleanedProfile: BusinessProfile = {
          ...businessProfile,
          inventorySetupMethod: profileReset.inventorySetupMethod,
          csvImportedAt: undefined,
          shopifyConnected: profileReset.shopifyConnected,
          shopifyStoreUrl: profileReset.shopifyStoreUrl,
          shopifyStoreName: profileReset.shopifyStoreName,
          shopifyStatus: profileReset.shopifyStatus,
          shopifyAccessToken: undefined,
          shopifyLastSyncedAt: undefined,
          isOnboardingCompleted: profileReset.isOnboardingCompleted,
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
    }

    toast({
      title: 'Workspace Reset Complete',
      description: 'All products, sales, Google Drive, Shopify links, and logs have been deleted.',
    });
  }, [firestore, user, businessProfile, toast]);

  const clearDemoBusiness = useCallback(async () => {
    await clearAllData();
    setHasDemoData(false);
    toast({ title: 'Demo Business Cleared', description: 'Demo data has been removed from your workspace.' });
  }, [clearAllData, toast]);

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

  const disconnectGoogleDrive = useCallback(async () => {
    if (!user || !firestore) return;
    try {
      const docRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
      await deleteDoc(docRef);
      setDriveConnection(null);
      toast({
        title: 'Google Drive Disconnected',
        description: 'Successfully revoked credentials from AnalyzeUp workspace.',
      });
    } catch (e) {
      console.error('Disconnection error:', e);
      const contextualError = new FirestorePermissionError({
        operation: 'delete',
        path: `users/${user.uid}/integrations/google-drive`,
      });
      errorEmitter.emit('permission-error', contextualError);
      toast({
        variant: 'destructive',
        title: 'Disconnection Failed',
        description: 'Failed to delete connection document.',
      });
    }
  }, [user, firestore, toast]);

  const recordSyncSuccess = useCallback(async (fileId: string, fileData: Record<string, any>, historyData: Record<string, any>) => {
    if (!user || !firestore) return;
    try {
      const fileRef = doc(firestore, 'users', user.uid, 'google_drive_files', fileId);
      await setDoc(fileRef, cleanObject(fileData), { merge: true });
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
      const profileRef = doc(firestore, 'users', user.uid, 'mapping_profiles', `profile-${fileId}`);
      await setDoc(profileRef, cleanObject(profileData), { merge: true });
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
                obj.stock ||
                obj.inventory_quantity ||
                rawRow['Stock'] ||
                rawRow['Current Stock'] ||
                '25';
              const stock = parseInt(String(rawStock).replace(/[^0-9]/g, ''), 10) || 25;

              const sku = (
                obj.sku ||
                rawRow['SKU'] ||
                rawRow['Item Code'] ||
                rawRow['Barcode'] ||
                `SKU-${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}-${idx + 1}`
              ).toUpperCase();

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
                  stock,
                  qty: Math.max(1, Math.min(stock, 4)),
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

              // 3. ALWAYS populate products into Catalog Intelligence & Inventory
              const productsToImport = validRows.map(r => ({
                name: r.parsed.name,
                sku: r.parsed.sku,
                description: r.parsed.description,
                categoryId: existingCatMap.get(r.parsed.category.toLowerCase()) || 'cat-general',
                category: r.parsed.category,
                supplier: r.parsed.supplier,
                supplierId: existingSupMap.get(r.parsed.supplier.toLowerCase()) || '',
                price: r.parsed.price,
                costPrice: r.parsed.costPrice,
                stock: r.parsed.stock,
                minStock: 5,
                maxStock: Math.max(100, r.parsed.stock * 2),
                unit: r.parsed.unit,
                status: 'Active' as const,
                averageDailySales: 1.5,
                leadTimeDays: 7,
              }));

              await bulkAddProducts(productsToImport, true);

              // 4. ALWAYS populate sales transactions to drive charts & revenue analytics
              // Skip rows belonging to products already in the database to prevent repeating historical transactions
              const existingSkuSet = new Set(products.map(p => (p.sku || '').trim().toUpperCase()).filter(Boolean));
              const existingNameSet = new Set(products.map(p => (p.name || '').trim().toLowerCase()).filter(Boolean));

              const transactionsToImport = validRows
                .filter(r => {
                  const sUpper = (r.parsed.sku || '').trim().toUpperCase();
                  const nLower = (r.parsed.name || '').trim().toLowerCase();
                  const isExisting = (sUpper && existingSkuSet.has(sUpper)) || (nLower && existingNameSet.has(nLower));
                  return !isExisting;
                })
                .map((r, idx) => {
                  return {
                    type: 'Sale' as const,
                    productId: `prod-${(r.parsed.sku || r.parsed.name).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
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
              await recordSyncSuccess(
                file.id,
                {
                  id: file.id,
                  name: file.name,
                  status: 'Synced',
                  rowCount: validRows.length,
                  lastSyncedAt: nowIso,
                  fileType: matchedProfile.fileType,
                },
                {
                  fileId: file.id,
                  fileName: file.name,
                  recordsCount: validRows.length,
                  syncedAt: nowIso,
                  status: 'Success',
                }
              );

              await saveMappingProfile(file.id, {
                id: `profile-${file.id}`,
                profileName: `Auto Map for ${file.name}`,
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
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          deletedShopifyProducts.forEach(dp => {
            const dpRef = doc(firestore, 'users', user.uid, 'products', dp.id);
            deleteBatch.delete(dpRef);
          });
          await deleteBatch.commit().catch(console.error);
          deletedProdsCount = deletedShopifyProducts.length;
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
          title: 'Shopify Sync Complete! 🎉',
          description: `Synchronized ${stats?.canonicalProductsCount || shopifyProds.length} products${delMsg}, ${stats?.canonicalTransactionsCount || shopifyTxs.length} orders${returnMsg}. Insights & predictions updated.`,
        });
      } else if (prodChanges > 0 || txChanges > 0 || returnChanges > 0) {
        const delDetail = deletedProdsCount > 0 ? `, ${deletedProdsCount} deleted removed` : '';
        toast({
          title: 'Shopify Auto-Synced ⚡',
          description: `Auto-sync pulled new updates from Shopify (${prodChanges} product changes${delDetail}, ${txChanges} new orders, ${returnChanges} returns/refunds). Insights refreshed.`,
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
          shopifyStatus: 'Disconnected',
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

    toast({
      title: 'Shopify Sync Settings Saved 🛍️',
      description: settings.shopifyRealtimeSyncEnabled
        ? 'Real-Time Sync is active. Instant updates enabled via webhooks & scheduled sync.'
        : settings.shopifyAutoSyncEnabled
        ? `Scheduled auto-sync is active (${settings.shopifySyncFrequency || 'daily'}).`
        : 'Auto-sync is paused. Manual sync is still available.',
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

    const isRealtime = businessProfile?.shopifyRealtimeSyncEnabled !== false;
    const isAutoSync = businessProfile?.shopifyAutoSyncEnabled !== false;
    if (!isRealtime && !isAutoSync) return;

    let lastTrigger = 0;
    const checkShopifyBackgroundSync = (force = false) => {
      if (isShopifySyncingRef.current) return;
      const now = Date.now();
      // Minimum 10s cooldown to prevent redundant overlapping calls
      if (now - lastTrigger < 10000) return;

      if (force || isShopifyAutoSyncDue(businessProfile)) {
        lastTrigger = now;
        console.log(`[Shopify Sync] ${force ? 'Instant tab focus/visibility' : 'Live heartbeat'} auto-sync triggered...`);
        autoSyncShopifyNow(false);
      }
    };

    // 1. Live interval: 15s when Real-Time sync is enabled, 60s for scheduled intervals
    const intervalMs = isRealtime ? 15000 : 60000;
    const intervalId = setInterval(() => checkShopifyBackgroundSync(false), intervalMs);

    // 2. Instant tab focus / visibility listener:
    // When merchant edits, adds, or deletes products in Shopify and returns to AnalyzeUp, fetch immediately!
    const onWindowActive = () => {
      if (document.visibilityState === 'visible' && isRealtime) {
        const lastSync = businessProfile.shopifyLastSyncedAt
          ? new Date(businessProfile.shopifyLastSyncedAt).getTime()
          : 0;
        if (Date.now() - lastSync >= 10000) {
          checkShopifyBackgroundSync(true);
        }
      }
    };

    window.addEventListener('focus', onWindowActive);
    document.addEventListener('visibilitychange', onWindowActive);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onWindowActive);
      document.removeEventListener('visibilitychange', onWindowActive);
    };
  }, [businessProfile, autoSyncShopifyNow]);

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

    // 1. If purgeData is requested, locate and delete all Shopify documents across collections
    if (purgeData) {
      try {
        const CHUNK_SIZE = 400;

        // A. Products
        const productsSnap = await getDocs(collection(firestore, 'users', uid, 'products')).catch(() => ({ docs: [] } as any));
        const shopifyProductDocs = productsSnap.docs.filter((d: any) => {
          const data = d.data();
          return (
            data.source === 'SHOPIFY' ||
            d.id.startsWith('shopify_') ||
            Boolean(data.shopifyProductId) ||
            Boolean(data.shopifyVariantId) ||
            (typeof data.sku === 'string' && data.sku.startsWith('SHOPIFY-')) ||
            (typeof data.supplier === 'string' && data.supplier.toLowerCase().includes('shopify'))
          );
        });

        const deletedProductIds = new Set(shopifyProductDocs.map((d: any) => d.id));
        deletedProductsCount = shopifyProductDocs.length;

        // B. Transactions
        const txSnap = await getDocs(collection(firestore, 'users', uid, 'transactions')).catch(() => ({ docs: [] } as any));
        const shopifyTxDocs = txSnap.docs.filter((d: any) => {
          const data = d.data();
          return (
            data.source === 'SHOPIFY' ||
            d.id.startsWith('tx_shopify_') ||
            d.id.startsWith('tx_refund_') ||
            data.paymentMethod === 'Shopify Payments' ||
            Boolean(data.shopifyOrderId) ||
            (data.productId && deletedProductIds.has(data.productId))
          );
        });
        deletedTransactionsCount = shopifyTxDocs.length;

        // C. Returns
        const retSnap = await getDocs(collection(firestore, 'users', uid, 'returns')).catch(() => ({ docs: [] } as any));
        const shopifyRetDocs = retSnap.docs.filter((d: any) => {
          const data = d.data();
          return (
            data.source === 'SHOPIFY' ||
            d.id.startsWith('ret_shopify_') ||
            d.id.startsWith('ret_') ||
            Boolean(data.shopifyReturnId) ||
            (data.productId && deletedProductIds.has(data.productId)) ||
            (typeof data.notes === 'string' && data.notes.toLowerCase().includes('shopify'))
          );
        });
        deletedReturnsCount = shopifyRetDocs.length;

        // D. Sales Orders & Orders
        const salesOrdersSnap = await getDocs(collection(firestore, 'users', uid, 'sales_orders')).catch(() => ({ docs: [] } as any));
        const ordersSnap = await getDocs(collection(firestore, 'users', uid, 'orders')).catch(() => ({ docs: [] } as any));
        const shopifyOrderDocs = [
          ...salesOrdersSnap.docs,
          ...ordersSnap.docs.filter((d: any) => {
            const data = d.data();
            return (
              data.source === 'SHOPIFY' ||
              d.id.startsWith('shopify_') ||
              d.id.startsWith('order_') ||
              Boolean(data.shopifyOrderId)
            );
          }),
        ];

        // E. Refunds & Inventory
        const refundsSnap = await getDocs(collection(firestore, 'users', uid, 'refunds')).catch(() => ({ docs: [] } as any));
        const inventorySnap = await getDocs(collection(firestore, 'users', uid, 'inventory')).catch(() => ({ docs: [] } as any));

        // Group all documents to delete
        const allDocsToDelete = [
          ...shopifyProductDocs,
          ...shopifyTxDocs,
          ...shopifyRetDocs,
          ...shopifyOrderDocs,
          ...refundsSnap.docs,
          ...inventorySnap.docs,
        ];

        // Execute batch deletions with chunking
        for (let i = 0; i < allDocsToDelete.length; i += CHUNK_SIZE) {
          const batch = writeBatch(firestore);
          allDocsToDelete.slice(i, i + CHUNK_SIZE).forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit().catch((err) => console.warn('[Shopify Disconnect] Batch deletion error:', err));
          await new Promise((r) => setTimeout(r, 10));
        }

        // F. Clean up orphaned categories if no remaining products use them
        const remainingProducts = products.filter((p) => !deletedProductIds.has(p.id));
        const remainingCategoryNames = new Set(remainingProducts.map((p) => (p.category || '').trim().toLowerCase()));
        const categoriesSnap = await getDocs(collection(firestore, 'users', uid, 'categories')).catch(() => ({ docs: [] } as any));
        const orphanedCategories = categoriesSnap.docs.filter((d: any) => {
          const catName = (d.data()?.name || '').trim().toLowerCase();
          return !remainingCategoryNames.has(catName);
        });
        if (orphanedCategories.length > 0 && remainingProducts.length === 0) {
          const catBatch = writeBatch(firestore);
          orphanedCategories.forEach((d: any) => catBatch.delete(d.ref));
          await catBatch.commit().catch(console.warn);
        }

        // G. Recalculate or zero out analytics summary
        if (remainingProducts.length === 0) {
          const summaryRef = doc(firestore, 'users', uid, 'analytics', 'summary');
          await setDoc(summaryRef, DEFAULT_ANALYTICS_SUMMARY).catch(console.warn);
          await deleteDoc(doc(firestore, 'users', uid, 'analytics', 'ai_brief')).catch(() => {});
        } else {
          const deletedTxIds = new Set(shopifyTxDocs.map((d: any) => d.id));
          const deletedRetIds = new Set(shopifyRetDocs.map((d: any) => d.id));
          const remainingTx = transactions.filter((t) => !deletedTxIds.has(t.id));
          const remainingRet = returns.filter((r) => !deletedRetIds.has(r.id));
          await recalculateAndSaveAnalyticsSummary(firestore, uid, {
            products: remainingProducts,
            transactions: remainingTx,
            suppliers,
            orders,
            returns: remainingRet,
          }).catch(console.warn);
        }
      } catch (purgeErr) {
        console.error('[Shopify Disconnect] Error purging Shopify data from Firestore:', purgeErr);
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

    // 4. Notify backend server
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
  }, [firestore, user, businessProfile, products, transactions, returns, suppliers, orders, updateBusinessProfile]);

  const businessBuddyCalibration = useMemo(() => {
    return getBusinessBuddyCalibration(businessProfile, products, transactions, returns);
  }, [businessProfile, products, transactions, returns]);

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

  const value = useMemo(() => ({
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
    hasDemoData,
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
    handleUpgrade,
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
    hasDemoData,
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
    handleUpgrade,
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
