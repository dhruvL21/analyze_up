'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getClientDriveToken,
  formatScheduleSummary,
  getNextSyncTimeDisplay,
  isAutoSyncDue,
  formatTime12h,
  formatLastSyncTime,
  autoDetectMapping,
} from '@/lib/drive-helper';
import { ShopifyScheduleModal } from '@/components/shopify-schedule-modal';
import {
  formatShopifyScheduleSummary,
  getNextShopifySyncDisplay,
  formatShopifyLastSync,
} from '@/lib/shopify-sync-helper';
import { ImportDialog } from '@/components/import-dialog';
import { findMatchingImportProfile } from '@/lib/import-profile-store';
import { logBusinessAction } from '@/lib/audit-store';
import Papa from 'papaparse';
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Bell,
  Lock,
  ArrowRight,
  Zap,
  Cloud,
  Loader2,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  History as HistoryIcon,
  Trash2,
  Check,
  AlertTriangle,
  Folder,
  ArrowRightLeft,
  Mail,
  HardDrive,
  Users,
  Star,
  Clock,
  Pencil,
  Settings,
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  Table,
  Sliders,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface IntegrationItem {
  id: string;
  name: string;
  category: 'E-commerce' | 'Marketplace' | 'Accounting' | 'POS';
  description: string;
  status: 'Available' | 'Coming Soon';
  icon: string;
  color: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'E-commerce',
    description: 'Sync products, inventory levels, variants, images & sales orders automatically.',
    status: 'Available',
    icon: '🛍️',
    color: 'emerald',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'E-commerce',
    description: 'Connect WordPress WooCommerce store for bi-directional stock updates.',
    status: 'Coming Soon',
    icon: '🛒',
    color: 'purple',
  },
  {
    id: 'amazon',
    name: 'Amazon Seller Central',
    category: 'Marketplace',
    description: 'FBA & FBM inventory synchronization, return tracking, and revenue feeds.',
    status: 'Coming Soon',
    icon: '📦',
    color: 'amber',
  },
  {
    id: 'flipkart',
    name: 'Flipkart Seller Hub',
    category: 'Marketplace',
    description: 'Sync Flipkart listings, order dispatches, and warehouse stock allocations.',
    status: 'Coming Soon',
    icon: '⚡',
    color: 'blue',
  },
  {
    id: 'zoho',
    name: 'Zoho Inventory',
    category: 'Accounting',
    description: 'Auto-sync invoices, purchase orders, billings, and multi-location warehouses.',
    status: 'Coming Soon',
    icon: '💼',
    color: 'rose',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    category: 'Accounting',
    description: 'Automated COGS ledger updates, tax reports, and supplier invoice reconciliations.',
    status: 'Coming Soon',
    icon: '📊',
    color: 'green',
  },
  {
    id: 'tally',
    name: 'Tally Prime / ERP 9',
    category: 'Accounting',
    description: 'Direct voucher import/export for Indian GST & accounting compliance.',
    status: 'Coming Soon',
    icon: '🧾',
    color: 'amber',
  },
  {
    id: 'pos',
    name: 'Retail POS Systems',
    category: 'POS',
    description: 'Live barcode scanner terminal sync for offline retail stores & checkout desks.',
    status: 'Coming Soon',
    icon: '🖥️',
    color: 'indigo',
  },
];

export default function IntegrationsPage() {
  const {
    businessProfile,
    updateBusinessProfile,
    setShowShopifyModal,
    autoSyncShopifyNow,
    isShopifySyncing,
    updateShopifyScheduleSettings,
    products,
    transactions,
    categories,
    suppliers,
    addCategory,
    addSupplier,
    bulkAddProducts,
    bulkAddTransactions,
    vectorizeAndSyncAiChatbot,
    subscribeGoogleDriveConnection,
    getGoogleDriveFiles,
    getSyncHistory,
    getMappingProfiles,
    disconnectGoogleDrive,
    updateGoogleDriveSettings,
    recordSyncSuccess,
    saveMappingProfile,
  } = useData();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Shopify integration states
  const isShopifyConnected = Boolean(
    businessProfile?.shopifyConnected || businessProfile?.shopifyStatus === 'Connected'
  );
  const [showShopifyScheduleModal, setShowShopifyScheduleModal] = useState(false);

  // Real Google Drive integration states
  const [driveConnection, setDriveConnection] = useState<any>(null);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [isLoadingConnection, setIsLoadingConnection] = useState(true);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  
  // Auto-Sync Scheduling States
  const [showAutoSyncModal, setShowAutoSyncModal] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncFrequency, setAutoSyncFrequency] = useState<'1_hour' | '6_hours' | '12_hours' | 'daily' | 'weekly'>('daily');
  const [autoSyncTime, setAutoSyncTime] = useState('09:00');
  const [autoSyncDay, setAutoSyncDay] = useState('monday');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // UI Dialog/Modals States
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isFolderCreating, setIsFolderCreating] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'scanning' | 'syncing' | 'success'>('idle');
  const [syncProgress, setSyncProgress] = useState<{
    stage: string;
    percent: number;
    fileName?: string;
    recordsCount?: number;
  }>({
    stage: 'Connecting to Google Drive...',
    percent: 15,
  });
  const [isSyncingFileId, setIsSyncingFileId] = useState<string | null>(null);
  const [folderSearchTerm, setFolderSearchTerm] = useState('');
  const [folderSection, setFolderSection] = useState<'all' | 'mydrive' | 'shared' | 'starred' | 'recent'>('all');

  // Preset file for ImportDialog integration
  const [presetFile, setPresetFile] = useState<{ name: string; content: string; driveFileId?: string } | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  const handleDownload22ColumnTemplate = () => {
    const sample22ColumnCsv = `Invoice No,Order ID,Order Date,Customer ID,Customer Name,SKU,Item Name,Category,Supplier ID,Supplier Name,Qty Sold,Purchase Price,Retail Price,Discount,Tax,Current Stock,Reorder Level,Safety Stock,Lead Time Days,Payment Mode,Order Status,Warehouse
INV-1001,ORD-5001,2026-08-20,CUST-101,John Doe,SKU-ELEC-01,Wireless Noise-Cancelling Headphones,Electronics,SUP-101,Acoustic Tech Ltd,2,3200,4999,10,18,45,15,5,7,UPI,Completed,Main Warehouse
INV-1002,ORD-5002,2026-08-21,CUST-102,TechCorp Solutions,SKU-ELEC-02,Mechanical Gaming Keyboard,Electronics,SUP-101,Acoustic Tech Ltd,1,1800,2999,0,18,8,10,4,5,Credit Card,Completed,North Hub
INV-1003,ORD-5003,2026-08-22,CUST-103,Alice Smith,SKU-FASH-01,Classic Oxford Leather Shoes,Footwear,SUP-102,Prime Leather Crafts,1,1400,2499,5,12,30,8,3,10,Net Banking,Shipped,Main Warehouse
INV-1004,ORD-5004,2026-08-23,CUST-104,Rahul Sharma,SKU-HOME-01,Ceramic Pour-Over Coffee Maker,Home & Kitchen,SUP-103,Artisan Living,3,650,1199,0,5,18,12,5,4,UPI,Completed,South Depot
INV-1005,ORD-5005,2026-08-24,CUST-105,Global Retail Co,SKU-ELEC-03,Ultra-Fast USB-C 65W GaN Charger,Accessories,SUP-101,Acoustic Tech Ltd,5,750,1499,15,18,120,25,10,3,Card,Completed,Main Warehouse`;

    const blob = new Blob([sample22ColumnCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'analyzeup_universal_22_columns_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Template Downloaded',
      description: 'analyzeup_universal_22_columns_template.csv is ready in your downloads folder.',
    });
  };

  // Sync Stats derived from Firestore tracked files
  const [syncStats, setSyncStats] = useState({
    filesCount: 0,
    rowsCount: 0,
    duplicatesCount: 0,
    errorsCount: 0
  });

  // 1. Subscribe to real Google Drive connection state
  useEffect(() => {
    setIsLoadingConnection(true);
    const unsubscribe = subscribeGoogleDriveConnection((conn) => {
      setDriveConnection(conn);
      setIsLoadingConnection(false);
      if (conn) {
        setAutoSyncEnabled(conn.autoSyncEnabled !== false);
        setAutoSyncFrequency(conn.autoSyncFrequency || 'daily');
        setAutoSyncTime(conn.autoSyncTime || '09:00');
        setAutoSyncDay(conn.autoSyncDay || 'monday');
      }
    });

    return () => unsubscribe();
  }, [subscribeGoogleDriveConnection]);

  const loadStats = useCallback(async () => {
    try {
      const files = await getGoogleDriveFiles();
      let rows = 0;
      let filesCount = 0;
      let errors = 0;
      let duplicates = 0;

      files.forEach((d: any) => {
        filesCount++;
        if (d.status === 'Synced') {
          rows += d.validRows || 0;
        } else if (d.status === 'Needs Review') {
          errors += d.errorRows || 0;
        }
        duplicates += d.skippedDuplicates || 0;
      });

      setSyncStats({
        filesCount,
        rowsCount: rows,
        duplicatesCount: duplicates,
        errorsCount: errors
      });
    } catch (e) {
      console.error(e);
    }
  }, [getGoogleDriveFiles]);

  const loadSyncHistory = useCallback(async () => {
    try {
      const historyList = await getSyncHistory();
      setSyncHistory(historyList);
    } catch (e) {
      console.error(e);
    }
  }, [getSyncHistory]);

  // 5. Scan Folder for files
  const scanDriveFolder = useCallback(async (overrideFolderId?: string, overrideFolderName?: string) => {
    if (!user) return;
    setIsLoadingScan(true);
    setSyncState('scanning');
    try {
      const token = await getClientDriveToken(driveConnection, user, firestore);
      if (!token) return;

      const folderId = overrideFolderId || driveConnection?.selectedFolderId;
      const folderName = overrideFolderName || driveConnection?.selectedFolderName || '';

      const folderQuery = folderId
        ? `?folderId=${encodeURIComponent(folderId)}&folderName=${encodeURIComponent(folderName)}`
        : '';

      const res = await fetch(`/api/drive/scan${folderQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-uid': user.uid,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDriveFiles(data.files || []);
        loadStats();
      } else if (!data?.folderNotSelected) {
        toast({
          variant: 'destructive',
          title: 'Folder Scan Failed',
          description: data.error || 'Could not list files in the sync folder.',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingScan(false);
      setSyncState('idle');
    }
  }, [user, driveConnection, firestore, loadStats, toast]);


  const handleSaveAutoSyncSchedule = async () => {
    setIsSavingSchedule(true);
    try {
      await updateGoogleDriveSettings({
        autoSyncEnabled,
        autoSyncFrequency,
        autoSyncTime,
        autoSyncDay,
      });
      setShowAutoSyncModal(false);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // 1.1 Handle OAuth callback payload / status / error query params in URL
  useEffect(() => {
    if (typeof window === 'undefined' || !user || !firestore) return;
    const urlParams = new URLSearchParams(window.location.search);
    const oauthDataRaw = urlParams.get('oauth_data');
    const shopifyOauthRaw = urlParams.get('shopify_oauth');
    const shopifyConnected = urlParams.get('shopify_connected');
    const shopParam = urlParams.get('shop');
    const status = urlParams.get('status');
    const error = urlParams.get('error');

    const missingScopesParam = urlParams.get('missing_scopes');
    const isPartial = (status === 'partial' || urlParams.get('shopify_partial') === 'true') && shopifyConnected !== 'true';

    if (shopifyConnected === 'true') {
      let accessTokenFromOauth: string | undefined;
      let shopifyData: any = null;

      if (shopifyOauthRaw) {
        try {
          const decodedStr = atob(decodeURIComponent(shopifyOauthRaw));
          shopifyData = JSON.parse(decodedStr);
          accessTokenFromOauth = shopifyData.accessToken;
        } catch (e) {
          console.warn('[Shopify] Error decoding oauth payload:', e);
        }
      }

      const connectedShop = shopParam || shopifyData?.shopDomain || 'Shopify Store';
      const storeName = shopifyData?.storeName || connectedShop.replace('.myshopify.com', '');

      toast({
        title: 'Shopify Connected! 🛍️',
        description: `Successfully linked and authenticated "${connectedShop}". Live catalog and order sync initialized.`,
      });

      // 1. Immediately persist to client Firestore with user credentials (works in serverless/Vercel)
      if (accessTokenFromOauth && user && firestore) {
        const connectionRef = doc(firestore, 'users', user.uid, 'integrations', 'shopify');
        setDoc(
          connectionRef,
          {
            userId: user.uid,
            provider: 'shopify',
            shopDomain: connectedShop,
            storeName,
            accessToken: accessTokenFromOauth,
            scope: shopifyData?.scope || '',
            connectionStatus: 'Connected',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch(console.warn);

        // Store lookup index
        const storeLookupRef = doc(firestore, 'shopify_stores', connectedShop);
        setDoc(
          storeLookupRef,
          {
            userId: user.uid,
            shopDomain: connectedShop,
            storeName,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch(console.warn);
      }

      // 2. Synchronize businessProfile state immediately
      updateBusinessProfile({
        shopifyConnected: true,
        shopifyStatus: 'Connected',
        shopifyStoreUrl: connectedShop,
        shopifyStoreName: storeName,
        shopifyLastSyncedAt: new Date().toISOString(),
        ...(accessTokenFromOauth ? { shopifyAccessToken: accessTokenFromOauth } : {}),
      }, true);

      // 3. Ingest live catalog & orders directly with the token!
      autoSyncShopifyNow(true, connectedShop, accessTokenFromOauth).catch(console.warn);

      if (user) {
        user.getIdToken().then((idToken) => {
          fetch(`/api/shopify/status?shop=${encodeURIComponent(connectedShop)}&userId=${user.uid}`, {
            headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
          })
            .then((r) => r.json())
            .then((data) => {
              if (data?.connected) {
                updateBusinessProfile({
                  shopifyConnected: true,
                  shopifyStatus: 'Connected',
                  shopifyStoreUrl: data.shop,
                  shopifyStoreName: data.storeName,
                  shopifyLastSyncedAt: data.lastSyncAt,
                }, true);
              }
            })
            .catch(console.warn);
        });
      }

      window.history.replaceState({}, '', window.location.pathname);
    } else if (isPartial) {
      const connectedShop = shopParam || 'Shopify Store';
      const missingList = missingScopesParam ? missingScopesParam.split(',').join(', ') : 'read_products, read_orders, read_inventory';
      toast({
        variant: 'destructive',
        title: 'Reauthorization Required ⚠️',
        description: `Store "${connectedShop}" is missing permissions: ${missingList}. Please click Connect Shopify to grant these scopes.`,
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (shopifyOauthRaw) {
      try {
        const decodedStr = atob(decodeURIComponent(shopifyOauthRaw));
        const shopifyData = JSON.parse(decodedStr);

        const saveShopifyConnection = async () => {
          const connectionRef = doc(firestore, 'users', user.uid, 'integrations', 'shopify');
          await setDoc(
            connectionRef,
            {
              userId: user.uid,
              provider: 'shopify',
              shopDomain: shopifyData.shopDomain,
              storeName: shopifyData.storeName,
              storeEmail: shopifyData.storeEmail || '',
              currency: shopifyData.currency || 'USD',
              accessToken: shopifyData.accessToken,
              scope: shopifyData.scope || '',
              connectionStatus: 'Connected',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          // Save store lookup index for instant real-time webhook routing
          const storeLookupRef = doc(firestore, 'shopify_stores', shopifyData.shopDomain);
          await setDoc(storeLookupRef, {
            userId: user.uid,
            shopDomain: shopifyData.shopDomain,
            storeName: shopifyData.storeName,
            updatedAt: new Date().toISOString(),
          }, { merge: true }).catch(console.warn);

          // Register real-time webhooks with Shopify Admin API
          fetch('/api/shopify/webhooks/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop: shopifyData.shopDomain,
              accessToken: shopifyData.accessToken,
            }),
          }).catch(console.warn);

          await updateBusinessProfile({
            shopifyConnected: true,
            shopifyStoreUrl: shopifyData.shopDomain,
            shopifyStoreName: shopifyData.storeName,
            shopifyStatus: 'Connected',
            shopifyAccessToken: shopifyData.accessToken,
          });

          toast({
            title: 'Shopify Store Connected! 🛍️',
            description: `Successfully linked "${shopifyData.storeName}" (${shopifyData.shopDomain}). Auto-sync is ready.`,
          });
          window.history.replaceState({}, '', window.location.pathname);
        };

        saveShopifyConnection().catch((err) => {
          console.error('Failed to save Shopify connection:', err);
          toast({
            variant: 'destructive',
            title: 'Shopify Save Error',
            description: err?.message || 'Could not save connection details.',
          });
          window.history.replaceState({}, '', window.location.pathname);
        });
      } catch (err: any) {
        console.error('Failed to parse Shopify OAuth data:', err);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (oauthDataRaw) {
      try {
        const decodedStr = atob(decodeURIComponent(oauthDataRaw));
        const oauthData = JSON.parse(decodedStr);

        const saveConnection = async () => {
          const connectionRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
          const connectionSnap = await getDoc(connectionRef);
          const existingData = connectionSnap.exists() ? connectionSnap.data() : null;

          const finalRefreshToken = oauthData.refreshToken || (existingData ? existingData.refreshToken : '');

          await setDoc(
            connectionRef,
            {
              userId: user.uid,
              provider: 'google-drive',
              googleEmail: oauthData.googleEmail || '',
              googleAccountId: oauthData.googleAccountId || '',
              accessToken: oauthData.accessToken,
              refreshToken: finalRefreshToken,
              tokenExpiry: Date.now() + (oauthData.expiresIn || 3600) * 1000,
              connectionStatus: 'Connected',
              createdAt: existingData ? existingData.createdAt : new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          toast({
            title: 'Google Drive Connected! 🎉',
            description: 'Your account is linked. Select or create a folder to begin syncing.',
          });
          window.history.replaceState({}, '', window.location.pathname);
        };

        saveConnection().catch((err) => {
          console.error('Failed to save connection in client Firestore:', err);
          toast({
            variant: 'destructive',
            title: 'Connection Save Error',
            description: err?.message || 'Could not save connection details.',
          });
          window.history.replaceState({}, '', window.location.pathname);
        });
      } catch (err: any) {
        console.error('Failed to parse OAuth data:', err);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (status === 'success') {
      toast({
        title: 'Google Drive Connected! 🎉',
        description: 'Your account is linked. Select or create a folder to begin syncing.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      const decodedErr = decodeURIComponent(error);
      const isShopify = decodedErr.toLowerCase().includes('shopify') || decodedErr.toLowerCase().includes('oauth');
      toast({
        variant: 'destructive',
        title: isShopify ? 'Shopify Connection Error' : 'Google Drive Connection Failed',
        description: decodedErr,
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user, firestore, toast, updateBusinessProfile]);

  // 1.2 Fetch live Shopify connection status on mount (single check)
  const hasFetchedShopifyStatusRef = useRef(false);
  useEffect(() => {
    if (!user || hasFetchedShopifyStatusRef.current) return;
    hasFetchedShopifyStatusRef.current = true;

    const fetchShopifyStatus = async () => {
      try {
        const idToken = await user.getIdToken();
        const shopQuery = businessProfile?.shopifyStoreUrl ? `&shop=${encodeURIComponent(businessProfile.shopifyStoreUrl)}` : '';
        const res = await fetch(`/api/shopify/status?userId=${user.uid}${shopQuery}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        const data = await res.json();
        if (data?.connected) {
          updateBusinessProfile({
            shopifyConnected: true,
            shopifyStatus: 'Connected',
            shopifyStoreUrl: data.shop,
            shopifyStoreName: data.storeName,
            shopifyLastSyncedAt: data.lastSyncAt,
          }, true);
        } else if (data && data.connected === false && businessProfile?.shopifyConnected) {
          updateBusinessProfile({
            shopifyConnected: false,
            shopifyStatus: 'Disconnected',
          }, true);
        }
      } catch (err) {
        console.warn('Could not fetch Shopify connection status:', err);
      }
    };
    fetchShopifyStatus();
  }, [user?.uid]);

  // 2. Fetch scanned files list and stats on connection changes
  useEffect(() => {
    if (driveConnection && user) {
      scanDriveFolder();
      loadSyncHistory();
      loadStats();
    }
  }, [driveConnection, user, scanDriveFolder, loadSyncHistory, loadStats]);

  // 3. Authenticate with Google Drive (Redirect to Server OAuth API)
  const connectGoogleDrive = () => {
    if (!user) return;
    window.location.href = `/api/drive/auth?userId=${user.uid}&prompt=select_account%20consent`;
  };

  // 3.1 Switch or connect a different Google Account
  const switchGoogleAccount = () => {
    if (!user) return;
    window.location.href = `/api/drive/auth?userId=${user.uid}&prompt=select_account%20consent`;
  };

  // 4. Disconnect Google Drive connection
  const handleDisconnectGoogleDrive = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Drive? This will clear connection credentials.')) return;
    await disconnectGoogleDrive();
    setDriveConnection(null);
    setDriveFiles([]);
  };

  // 6. Fetch Available Folders for selection
  const fetchFolders = async () => {
    if (!user) return;
    setIsLoadingFolders(true);
    try {
      const token = await getClientDriveToken(driveConnection, user, firestore);
      if (!token) return;

      const res = await fetch('/api/drive/folders', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-uid': user.uid,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setDriveFolders(data.files || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // 7. Select Folder or Auto-create Sync folder
  const selectFolder = async (folderId?: string, folderName?: string) => {
    if (!user) return;
    if (!folderId) setIsFolderCreating(true);

    try {
      const token = await getClientDriveToken(driveConnection, user, firestore);
      if (!token) throw new Error('Could not obtain valid Google Drive token');

      const res = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-user-uid': user.uid,
        },
        body: JSON.stringify({ folderId, folderName }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (firestore) {
          const connectionRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
          await updateDoc(connectionRef, {
            selectedFolderId: data.folderId,
            selectedFolderName: data.folderName,
            updatedAt: new Date().toISOString(),
          });
        }
        setShowFolderModal(false);
        toast({
          title: folderId ? 'Folder Synced' : 'AnalyzeUp Sync Folder Created! 📁',
          description: `Ingestion scoped to directory "${data.folderName}".`,
        });
        scanDriveFolder(data.folderId, data.folderName);
      }
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Folder Selection Failed',
        description: e?.message || 'Could not configure folder.',
      });
    } finally {
      setIsFolderCreating(false);
    }
  };



  // 8. Client-side silent normalization & ingestion
  const runSilentIngestion = useCallback(async (
    fileId: string,
    fileName: string,
    csvContent: string,
    profile: any,
    triggerScanRefresh: boolean = true,
    showNotification: boolean = true
  ) => {
    if (!user) return;
    try {
      setSyncProgress({
        stage: `Parsing "${fileName}"...`,
        percent: 25,
        fileName,
      });

      const results = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
      const rawRows = results.data as Record<string, any>[];
      const headers = Object.keys(rawRows[0] || {});
      
      let fileType = profile?.fileType || 'INVENTORY_MASTER';
      let fieldMapping = profile?.mapping || profile?.fieldMapping;

      if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
        const detected = autoDetectMapping(headers);
        if (detected) {
          fileType = detected.fileType;
          fieldMapping = detected.mapping;
        } else {
          fieldMapping = {};
        }
      }

      const safeFieldMapping = fieldMapping || {};
      const existingSkus = new Set(products.map(p => p.sku?.toUpperCase()));
      const seenSkusInFile = new Set<string>();

      setSyncProgress({
        stage: `Normalizing ${rawRows.length.toLocaleString()} spreadsheet records...`,
        percent: 45,
        fileName,
        recordsCount: rawRows.length,
      });

      // Normalize Rows using the matched mapping profile
      const normalizedItems = rawRows.map((rawRow, idx) => {
        const obj: Record<string, any> = { isValid: true, errors: [], warnings: [] };

        Object.entries(safeFieldMapping).forEach(([csvHeader, targetKey]) => {
          const keyStr = targetKey as string;
          if (keyStr === 'skip') return;
          const val = rawRow[csvHeader];
          if (val !== undefined && val !== null) {
            obj[keyStr] = val.toString().trim();
          }
        });

        if (fileType === 'SALES_REPORT') {
          const name = obj.productName || obj.name || '';
          const price = parseFloat((obj.sellingPrice || obj.price || '0').replace(/[^0-9.]/g, '')) || 0;
          const costPrice = parseFloat((obj.costPrice || '0').replace(/[^0-9.]/g, '')) || 0;
          const qty = parseInt((obj.quantity || obj.stock || '1').replace(/[^0-9]/g, ''), 10) || 1;
          const orderNo = obj.orderNumber || obj.orderId || (obj.sku ? `ORD-${obj.sku}-${idx + 1}` : `INV-${1000 + idx}`);
          const customer = obj.customerName || 'Retail Customer';
          const city = obj.city || '';
          const status = obj.status || 'Completed';
          const remarks = obj.remarks || '';
          const paymentMode = obj.paymentMode || 'UPI';
          const date = obj.orderDate || new Date().toISOString().split('T')[0];

          if (!name) obj.errors.push('Missing product name');
          if (price <= 0) obj.errors.push('Invalid price');
          if (qty <= 0) obj.errors.push('Invalid quantity');

          obj.parsed = {
            name,
            price,
            costPrice,
            qty,
            orderNo,
            customer,
            city,
            status,
            remarks,
            paymentMode,
            date,
            sku: obj.sku || `SKU-${idx + 1}`,
            category: obj.category || 'General',
            supplier: obj.supplier || 'Google Drive Vendor',
            stock: obj.stock !== undefined ? parseInt((obj.stock || '25').replace(/[^0-9]/g, ''), 10) : undefined,
            minStock: obj.minStock !== undefined ? parseInt((obj.minStock || '5').replace(/[^0-9]/g, ''), 10) : 5,
            leadTimeDays: obj.leadTimeDays !== undefined ? parseInt((obj.leadTimeDays || '7').replace(/[^0-9]/g, ''), 10) : 7,
          };
        } else if (fileType === 'INVENTORY_MASTER' || fileType === 'WAREHOUSE_STOCK') {
          const name = obj.name || obj.productName || '';
          const price = parseFloat((obj.price || obj.sellingPrice || '0').replace(/[^0-9.]/g, '')) || 0;
          const costPrice = parseFloat((obj.costPrice || '0').replace(/[^0-9.]/g, '')) || 0;
          const stock = parseInt((obj.stock || obj.quantity || '0').replace(/[^0-9]/g, ''), 10) || 0;
          const sku = (obj.sku || `AUTOSKU-${idx + 1}`).toUpperCase();
          const category = obj.category || 'General';
          const supplier = obj.supplier || obj.supplierName || '';

          if (!name) obj.errors.push('Missing product name');
          if (price <= 0) obj.errors.push('Invalid price');
          if (stock < 0) obj.errors.push('Negative stock');

          if (existingSkus.has(sku)) obj.warnings.push(`SKU already exists`);
          if (seenSkusInFile.has(sku)) obj.errors.push(`Duplicate SKU inside file`);
          else seenSkusInFile.add(sku);

          obj.parsed = { name, price, costPrice, stock, sku, category, supplier, unit: obj.unit || 'Piece', description: obj.description || '' };
        } else {
          const name = obj.name || obj.productName || `Item #${idx + 1}`;
          const price = parseFloat((obj.price || '0').replace(/[^0-9.]/g, '')) || 0;
          const qty = parseInt((obj.quantity || '1').replace(/[^0-9]/g, ''), 10) || 1;
          obj.parsed = { name, price, qty, sku: obj.sku || `ITEM-${idx + 1}`, category: obj.category || 'General', supplier: obj.supplier || 'Vendor' };
        }

        obj.isValid = obj.errors.length === 0;
        return obj;
      });

      const validRows = normalizedItems.filter(r => r.isValid);
      if (validRows.length === 0) {
        throw new Error('No valid records found in spreadsheet.');
      }

      setSyncProgress({
        stage: `Registering categories & suppliers...`,
        percent: 60,
        fileName,
        recordsCount: validRows.length,
      });

      // Auto-create Categories
      const fileCategories = Array.from(new Set(validRows.map(r => r.parsed.category || 'General').filter(Boolean)));
      const existingCatMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      for (const catName of fileCategories) {
        if (!existingCatMap.has(catName.toLowerCase())) {
          await addCategory({ name: catName, description: 'Created during AI business import' }).catch(() => {});
        }
      }

      // Auto-create Suppliers
      const fileSuppliers = Array.from(new Set(validRows.map(r => r.parsed.supplier || 'Import Vendor').filter(Boolean)));
      const existingSupMap = new Map(suppliers.map(s => [s.name.toLowerCase(), s.id]));
      for (const supName of fileSuppliers) {
        if (!existingSupMap.has(supName.toLowerCase())) {
          await addSupplier({
            name: supName,
            contactName: 'Import Contact',
            email: `orders@${supName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
            phone: '+91 90000 00000',
            address: 'Imported via AI Engine',
          }).catch(() => {});
        }
      }

      // Group unique products by SKU / Name to avoid writing thousands of redundant duplicate product documents
      // 1. Identify which products already exist in Firestore
      const existingProductSkuMap = new Map(products.map(p => [(p.sku || '').trim().toUpperCase(), p]));
      const existingProductNameMap = new Map(products.map(p => [(p.name || '').trim().toLowerCase(), p]));

      // Group unique products by SKU / Name to avoid writing redundant duplicate product documents
      const uniqueProductsMap = new Map<string, any>();
      validRows.forEach(r => {
        const skuKey = (r.parsed.sku || r.parsed.name || '').trim().toUpperCase();
        if (!uniqueProductsMap.has(skuKey)) {
          uniqueProductsMap.set(skuKey, {
            name: r.parsed.name,
            sku: r.parsed.sku || `SKU-${r.parsed.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}`,
            description: r.parsed.description || `Imported ${r.parsed.name}`,
            categoryId: existingCatMap.get((r.parsed.category || '').toLowerCase()) || 'cat-general',
            category: r.parsed.category || 'General',
            supplier: r.parsed.supplier || 'Google Drive Vendor',
            supplierId: existingSupMap.get((r.parsed.supplier || '').toLowerCase()) || '',
            price: r.parsed.price || 499,
            costPrice: r.parsed.costPrice && r.parsed.costPrice > 0 ? r.parsed.costPrice : Math.round((r.parsed.price || 499) * 0.6),
            stock: r.parsed.stock !== undefined && r.parsed.stock > 0 ? r.parsed.stock : 25,
            minStock: r.parsed.minStock !== undefined ? r.parsed.minStock : 5,
            maxStock: Math.max(100, (r.parsed.stock || 25) * 2),
            unit: r.parsed.unit || 'Piece',
            status: 'Active' as const,
            averageDailySales: 1.5,
            leadTimeDays: r.parsed.leadTimeDays || 7,
          });
        }
      });
      const productsToImport = Array.from(uniqueProductsMap.values());

      // Filter truly new products that do not exist yet in Firestore
      const trulyNewProducts = productsToImport.filter(p => {
        const sUpper = (p.sku || '').trim().toUpperCase();
        const nLower = (p.name || '').trim().toLowerCase();
        return !(sUpper && existingProductSkuMap.has(sUpper)) && !(nLower && existingProductNameMap.has(nLower));
      });
      const skippedExistingProductCount = productsToImport.length - trulyNewProducts.length;

      setSyncProgress({
        stage: `Saving catalog: ${trulyNewProducts.length} new items (${skippedExistingProductCount} already present skipped)...`,
        percent: 75,
        fileName,
        recordsCount: trulyNewProducts.length || productsToImport.length,
      });

      await bulkAddProducts(productsToImport, true); // overwriteStock = true

      if (fileType === 'SALES_REPORT' || validRows.some(r => r.parsed.orderNo)) {
        // Build set of existing order numbers and composite fingerprints
        const existingOrderNos = new Set(transactions.map(t => (t.orderNumber || '').trim().toUpperCase()).filter(Boolean));
        const existingTxFingerprints = new Set(transactions.map(t => {
          const prod = (t.productName || t.productId || '').trim().toLowerCase();
          const date = typeof t.transactionDate === 'string' ? t.transactionDate.trim() : '';
          const qty = Number(t.quantity || 1);
          const rev = Number(t.totalRevenue || t.price || 0);
          const cust = (t.customerName || '').trim().toLowerCase();
          return `${prod}|${date}|${qty}|${rev}|${cust}`;
        }));

        const seenOrderNosInBatch = new Set<string>();
        const seenFpInBatch = new Set<string>();
        const transactionsToImport: any[] = [];

        validRows.forEach((r, idx) => {
          const skuUpper = (r.parsed.sku || '').trim().toUpperCase();
          const nameLower = (r.parsed.name || '').trim().toLowerCase();
          const isExistingProduct = (skuUpper && existingProductSkuMap.has(skuUpper)) || (nameLower && existingProductNameMap.has(nameLower));

          // If product was already added from earlier file, do NOT duplicate historical transactions!
          if (isExistingProduct) {
            return;
          }

          const orderNo = r.parsed.orderNo || `INV-${(r.parsed.sku || r.parsed.name || 'ITEM').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}-${idx + 1}`;
          const orderNoUpper = orderNo.trim().toUpperCase();

          if (existingOrderNos.has(orderNoUpper) || seenOrderNosInBatch.has(orderNoUpper)) {
            return;
          }

          const fp = `${(r.parsed.name || '').trim().toLowerCase()}|${(r.parsed.date || '').trim()}|${Number(r.parsed.qty || 1)}|${(r.parsed.price || 499) * (r.parsed.qty || 1)}|${(r.parsed.customer || '').trim().toLowerCase()}`;
          if (existingTxFingerprints.has(fp) || seenFpInBatch.has(fp)) {
            return;
          }

          seenOrderNosInBatch.add(orderNoUpper);
          seenFpInBatch.add(fp);

          transactionsToImport.push({
            type: 'Sale' as const,
            productId: `prod-${(r.parsed.sku || r.parsed.name).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            productName: r.parsed.name,
            sku: r.parsed.sku,
            quantity: r.parsed.qty || 1,
            price: r.parsed.price || 499,
            totalRevenue: (r.parsed.price || 499) * (r.parsed.qty || 1),
            costPerUnit: r.parsed.costPrice && r.parsed.costPrice > 0 ? r.parsed.costPrice : Math.round((r.parsed.price || 499) * 0.6),
            totalCost: (r.parsed.costPrice && r.parsed.costPrice > 0 ? r.parsed.costPrice : Math.round((r.parsed.price || 499) * 0.6)) * (r.parsed.qty || 1),
            customerName: r.parsed.customer || 'Retail Customer',
            customerCity: r.parsed.city || '',
            transactionDate: r.parsed.date || new Date().toISOString().split('T')[0],
            status: r.parsed.status || 'Completed',
            paymentMethod: r.parsed.paymentMode || 'UPI',
            notes: r.parsed.remarks || 'Synced from Google Drive',
            orderNumber: orderNo,
          });
        });

        if (transactionsToImport.length > 0) {
          await bulkAddTransactions(transactionsToImport);
        }
      }

      setSyncProgress({
        stage: 'Vectorizing business data for AI Copilot...',
        percent: 92,
        fileName,
        recordsCount: trulyNewProducts.length || validRows.length,
      });

      // Incrementally vectorize workspace data into RAG knowledge store for AI Copilot
      await vectorizeAndSyncAiChatbot().catch(console.warn);

      setSyncProgress({
        stage: 'Updating business intelligence and health score...',
        percent: 97,
        fileName,
        recordsCount: trulyNewProducts.length || validRows.length,
      });

      const effectiveNewCount = trulyNewProducts.length;

      // Track Google Drive file and sync history via DataContext
      await recordSyncSuccess(
        fileId,
        {
          id: fileId,
          fileName,
          status: 'Synced',
          lastProcessedAt: new Date().toISOString(),
          validRows: effectiveNewCount || validRows.length,
          size: csvContent.length,
          modifiedTime: new Date().toISOString(),
        },
        {
          syncedAt: new Date().toISOString(),
          filesCount: 1,
          rowsCount: effectiveNewCount || validRows.length,
          status: 'Completed',
          files: [fileName],
        }
      );

      logBusinessAction({
        title: 'Google Drive Data Synced',
        productName: fileName,
        actionType: 'audit',
        changeDetails: `Synced ${effectiveNewCount} new records from Google Drive. ${skippedExistingProductCount > 0 ? `${skippedExistingProductCount} previously imported products and their transactions skipped to avoid duplicates.` : ''}`,
        impactValue: `+${effectiveNewCount} New Records`,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
        window.dispatchEvent(new CustomEvent('analyzeup_tasks_updated'));
        window.dispatchEvent(new CustomEvent('analyzeup_drive_synced', { detail: { fileName, rowsCount: effectiveNewCount || validRows.length } }));
        localStorage.removeItem('analyzeup_completed_tasks');
      }

      setSyncProgress({
        stage: 'Sync Complete! 🎉',
        percent: 100,
        fileName,
        recordsCount: validRows.length,
      });

      if (showNotification) {
        toast({
          title: 'Google Drive Synced Successfully ✨',
          description: `Processed "${fileName}". Firestore updated with new/changed records, and AI Copilot updated.`,
        });
      }

      if (triggerScanRefresh) {
        scanDriveFolder();
      }
    } catch (err: any) {
      console.error('runSilentIngestion error:', err);
      if (showNotification) {
        toast({
          variant: 'destructive',
          title: 'Sync Ingestion Notice',
          description: err?.message || 'Failed to normalize data.',
        });
      }
    }
  }, [user, products, transactions, categories, suppliers, addCategory, addSupplier, bulkAddProducts, bulkAddTransactions, vectorizeAndSyncAiChatbot, recordSyncSuccess, toast, scanDriveFolder]);

  // 9. Silent Sync or Manual Mapping Ingestion Flow
  const syncFile = useCallback(async (file: any, isBackground = false) => {
    if (!user) return;
    setIsSyncingFileId(file.id);
    setSyncState('syncing');
    setSyncProgress({
      stage: `Connecting to Google Drive for "${file.name}"...`,
      percent: 15,
      fileName: file.name,
    });

    // Safety watchdog timer: automatically close modal after 30 seconds if any edge case stalls
    const watchdogTimer = setTimeout(() => {
      setSyncState('idle');
      setIsSyncingFileId(null);
    }, 30000);

    try {
      const token = await getClientDriveToken(driveConnection, user, firestore);
      if (!token) throw new Error('Could not obtain valid Google Drive token');

      setSyncProgress({
        stage: `Downloading "${file.name}" from Google Drive...`,
        percent: 30,
        fileName: file.name,
      });

      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-user-uid': user.uid,
        },
        body: JSON.stringify({ fileId: file.id, fileName: file.name }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to download file content.');
      }

      setSyncProgress({
        stage: `Processing spreadsheet content...`,
        percent: 45,
        fileName: file.name,
      });

      // Parse CSV rows
      const results = Papa.parse(data.csvContent, { header: true, skipEmptyLines: true });
      const rawRows = results.data as Record<string, any>[];
      if (rawRows.length === 0) {
        throw new Error('Spreadsheet has no data rows.');
      }

      const headers = Object.keys(rawRows[0] || {});
      
      // Load saved mapping profiles from DataContext or storage
      const profiles = await getMappingProfiles();
      const currentSignature = headers.slice().sort().join('|').toLowerCase();
      let matchedProfile = profiles.find((p: any) => p.headersSignature === currentSignature);

      if (!matchedProfile) {
        matchedProfile = findMatchingImportProfile(headers) as any;
      }

      if (!matchedProfile) {
        matchedProfile = autoDetectMapping(headers) as any;
      }

      if (matchedProfile) {
        setSyncProgress({
          stage: `Auto-mapping ${rawRows.length} records...`,
          percent: 55,
          fileName: file.name,
          recordsCount: rawRows.length,
        });

        // Auto Sync: Run direct ingestion silently on the client side
        await runSilentIngestion(file.id, file.name, data.csvContent, matchedProfile, !isBackground, !isBackground);
        
        // Save profile in DataContext for future automatic syncs
        await saveMappingProfile(file.id, {
          id: `profile-${file.id}`,
          profileName: `Auto Map for ${file.name}`,
          fileType: matchedProfile.fileType,
          mapping: matchedProfile.mapping,
          headersSignature: currentSignature,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        if (!isBackground) {
          // Needs Review / Custom Mapping: Open the mapping wizard modal with preset file content
          setPresetFile({
            name: file.name,
            content: data.csvContent,
            driveFileId: file.id
          });
          setIsImportDialogOpen(true);
        } else {
          // In background auto-sync, mark file as Needs Review
          await recordSyncSuccess(
            file.id,
            {
              id: file.id,
              fileName: file.name,
              status: 'Needs Review',
              lastProcessedAt: new Date().toISOString(),
              size: data.csvContent.length,
              modifiedTime: new Date().toISOString(),
            },
            {
              syncedAt: new Date().toISOString(),
              filesCount: 1,
              rowsCount: 0,
              status: 'Completed',
              files: [file.name],
            }
          );
        }
      }
    } catch (err: any) {
      console.error('syncFile error:', err);
      if (!isBackground) {
        toast({
          variant: 'destructive',
          title: 'Sync Action Failed',
          description: err?.message || 'Verification failed.',
        });
      }
    } finally {
      clearTimeout(watchdogTimer);
      setIsSyncingFileId(null);
      setSyncState('idle');
    }
  }, [user, driveConnection, firestore, getMappingProfiles, runSilentIngestion, saveMappingProfile, recordSyncSuccess, toast]);

  // 9.5 Complete Folder Sync with Automatic Silent Ingestion
  const syncFolderWithAutoIngest = useCallback(async (overrideFolderId?: string, overrideFolderName?: string) => {
    if (!user) return;
    setIsLoadingScan(true);
    setSyncState('scanning');

    try {
      const token = await getClientDriveToken(driveConnection, user, firestore);
      if (!token) return;

      const folderId = overrideFolderId || driveConnection?.selectedFolderId;
      const folderName = overrideFolderName || driveConnection?.selectedFolderName || '';

      const folderQuery = folderId
        ? `?folderId=${encodeURIComponent(folderId)}&folderName=${encodeURIComponent(folderName)}`
        : '';

      const res = await fetch(`/api/drive/scan${folderQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-uid': user.uid,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (!data?.folderNotSelected) {
          toast({
            variant: 'destructive',
            title: 'Folder Scan Failed',
            description: data?.error || 'Could not list files in the sync folder.',
          });
        }
        return;
      }

      const files = data.files || [];
      setDriveFiles(files);

      // Identify un-synced / new / modified files (exclude 'Synced', 'Deleted', 'Tombstoned')
      const pendingFiles = files.filter((f: any) => f.status !== 'Synced' && f.status !== 'Deleted' && f.status !== 'Tombstoned');

      let ingestedCount = 0;
      if (pendingFiles.length > 0) {
        setSyncState('syncing');
        for (const file of pendingFiles) {
          try {
            await syncFile(file, true);
            ingestedCount++;
          } catch (e) {
            console.error(`Auto-sync failed for file ${file.name}:`, e);
          }
        }
      }

      // Record lastSyncAt timestamp in Firestore so the connection doc updates
      const nowIso = new Date().toISOString();
      if (firestore && user) {
        const connRef = doc(firestore, 'users', user.uid, 'integrations', 'google-drive');
        await updateDoc(connRef, {
          lastSyncAt: nowIso,
          lastSyncStatus: 'Success',
          updatedAt: nowIso,
        }).catch(async () => {
          await setDoc(connRef, { lastSyncAt: nowIso, lastSyncStatus: 'Success', updatedAt: nowIso }, { merge: true });
        });
      }

      setDriveConnection((prev: any) => prev ? { ...prev, lastSyncAt: nowIso, lastSyncStatus: 'Success' } : prev);
      await loadStats();
      await loadSyncHistory();

      // Refresh final list
      const resAfter = await fetch(`/api/drive/scan${folderQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-uid': user.uid,
        },
      });
      const dataAfter = await resAfter.json();
      if (resAfter.ok && dataAfter.success) {
        setDriveFiles(dataAfter.files || []);
      }

      toast({
        title: 'Google Drive Synchronized 🚀',
        description: ingestedCount > 0
          ? `Automatically ingested ${ingestedCount} spreadsheet${ingestedCount > 1 ? 's' : ''}. Last sync updated.`
          : `Folder checked. All spreadsheets are up to date (${formatLastSyncTime(nowIso)}).`,
      });
    } catch (e: any) {
      console.error('Folder sync error:', e);
      toast({
        variant: 'destructive',
        title: 'Sync Error',
        description: e?.message || 'Could not complete folder synchronization.',
      });
    } finally {
      setIsLoadingScan(false);
      setSyncState('idle');
    }
  }, [user, driveConnection, firestore, syncFile, loadStats, loadSyncHistory, toast]);

  // 9.6 Listen to global auto-sync completions from DataContext
  useEffect(() => {
    const handleSyncComplete = () => {
      scanDriveFolder();
      loadStats();
      loadSyncHistory();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('analyzeup_drive_sync_complete', handleSyncComplete);
      return () => window.removeEventListener('analyzeup_drive_sync_complete', handleSyncComplete);
    }
  }, [scanDriveFolder, loadStats, loadSyncHistory]);

  // 9.7 Local recurring background auto-sync scheduler (checks every 30 seconds)
  useEffect(() => {
    if (!driveConnection || !driveConnection.selectedFolderId || !user) return;
    if (driveConnection.autoSyncEnabled !== true || driveConnection.isConnected === false || driveConnection.connectionStatus !== 'Connected') return;

    const intervalId = setInterval(() => {
      if (isAutoSyncDue(driveConnection) && !isLoadingScan && !isSyncingFileId) {
        console.log('[AutoSync] Scheduled Google Drive sync triggered for:', driveConnection.selectedFolderName);
        syncFolderWithAutoIngest(driveConnection.selectedFolderId, driveConnection.selectedFolderName);
      }
    }, 30 * 1000);

    return () => clearInterval(intervalId);
  }, [driveConnection, user, isLoadingScan, isSyncingFileId, syncFolderWithAutoIngest]);

  // 10. Open Mapping Dialog callback to register the mapping profile in Firestore
  const handleImportComplete = async (summary: any) => {
    if (!user || !presetFile) return;

    try {
      const fileId = presetFile.driveFileId || `custom-${Date.now()}`;
      
      // Save Mapping Profile via DataContext so that subsequent syncs run automatically
      const currentSignature = rawHeadersSignature(presetFile.content);
      await saveMappingProfile(fileId, {
        id: `profile-${fileId}`,
        profileName: `Auto Map for ${presetFile.name}`,
        fileType: summary.fileType,
        headersSignature: currentSignature,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Track Drive file and sync history via DataContext
      await recordSyncSuccess(
        fileId,
        {
          id: fileId,
          fileName: presetFile.name,
          status: 'Synced',
          lastProcessedAt: new Date().toISOString(),
          validRows: summary.importedCount,
          size: presetFile.content.length,
          modifiedTime: new Date().toISOString(),
        },
        {
          syncedAt: new Date().toISOString(),
          filesCount: 1,
          rowsCount: summary.importedCount,
          status: 'Completed',
          files: [presetFile.name],
        }
      );

      setPresetFile(null);
      scanDriveFolder();
    } catch (e) {
      console.error('Failed to register mapping profile:', e);
    }
  };

  const rawHeadersSignature = (csvContent: string): string => {
    const results = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    const headers = Object.keys(results.data[0] || {});
    return headers.slice().sort().join('|').toLowerCase();
  };

  const filteredIntegrations = INTEGRATIONS.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleNotifyMe = (name: string) => {
    toast({
      title: 'Notification Request Saved',
      description: `We will notify you as soon as the ${name} integration is live!`,
    });
  };

  // Google Drive folder categorization and search filtering
  const myDriveFolders = driveFolders.filter(f => !f.shared || f.owners?.[0]?.me);
  const sharedFolders = driveFolders.filter(f => f.shared || (f.owners && f.owners.length > 0 && !f.owners[0]?.me));
  const starredFolders = driveFolders.filter(f => Boolean(f.starred));

  const filteredDriveFolders = driveFolders
    .filter(folder => {
      if (folderSection === 'mydrive' && (folder.shared && !folder.owners?.[0]?.me)) return false;
      if (folderSection === 'shared' && (!folder.shared && (!folder.owners || folder.owners[0]?.me))) return false;
      if (folderSection === 'starred' && !folder.starred) return false;

      if (!folderSearchTerm) return true;
      const term = folderSearchTerm.toLowerCase();
      const nameMatch = (folder.name || '').toLowerCase().includes(term);
      const ownerMatch = (folder.owners?.[0]?.displayName || folder.owners?.[0]?.emailAddress || '').toLowerCase().includes(term);
      return nameMatch || ownerMatch;
    })
    .sort((a, b) => {
      if (folderSection === 'recent') {
        return new Date(b.modifiedTime || 0).getTime() - new Date(a.modifiedTime || 0).getTime();
      }
      return (a.name || '').localeCompare(b.name || '');
    });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
            Connect & Channels
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Connect your storefronts, market channels, accounting software & POS systems to power AI predictions.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/40">
        <div className="relative w-full sm:w-72">
          <Input
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs rounded-xl"
          />
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['All', 'E-commerce', 'Marketplace', 'Accounting', 'POS'].map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="rounded-xl text-xs px-3 h-8 shrink-0"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Section 1: Available Channels & CSV Upload */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-emerald-500" />
          Available Channels & CSV Upload
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. CSV Database Import Card */}
          <Card className="ios-glass border-amber-500/30 hover:border-amber-500/60 transition-all rounded-3xl overflow-hidden relative group flex flex-col h-full shadow-lg">
              <CardHeader className="pb-3 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-2xl p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                      📄
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold truncate">
                          CSV Database
                        </CardTitle>
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] py-0 px-2 font-semibold shrink-0">
                          22 Columns
                        </Badge>
                      </div>
                      <CardDescription className="text-xs truncate mt-0.5">
                        Universal Database Upload
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload your unified 22-column CSV database containing product catalog, unit costs, retail prices, suppliers, warehouse stock, and sales logs in one go.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Standard Schema</span>
                      <span className="font-semibold text-foreground text-xs block">22 Canonical Fields</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">AI Data Mapper</span>
                      <span className="font-semibold text-emerald-400 text-xs block">Auto-Match Active</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownload22ColumnTemplate}
                      className="w-full text-xs h-9 rounded-xl gap-2 bg-secondary/40 hover:bg-secondary border-border/60 text-foreground font-semibold transition-all shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Sample CSV</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSchemaModal(true)}
                      className="w-full text-xs h-9 rounded-xl gap-2 bg-secondary/40 hover:bg-secondary border-border/60 text-foreground font-semibold transition-all shadow-sm"
                    >
                      <Table className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Inspect 22 Fields</span>
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => setIsImportDialogOpen(true)}
                  className="w-full rounded-2xl text-xs font-bold gap-2 bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 h-10 mt-auto"
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload CSV / Open Wizard
                  <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                </Button>
              </CardContent>
            </Card>

            {/* 2. Shopify Store Card */}
            <Card className="ios-glass border-emerald-500/30 hover:border-emerald-500/60 transition-all rounded-3xl overflow-hidden relative group flex flex-col h-full shadow-lg">
              <CardHeader className="pb-3 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-2xl p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                      🛍️
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold truncate">
                          Shopify
                        </CardTitle>
                        {isShopifyConnected ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 py-0 px-2 shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-2 shrink-0">
                            Available
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs truncate mt-0.5">
                        E-commerce Platform Sync
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sync catalog, live stock levels, sales orders & variants automatically from your connected Shopify storefront.
                  </p>

                  {isShopifyConnected ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2.5">
                      <div className="flex items-center justify-between text-emerald-400 font-semibold">
                        <span className="truncate">Store: {businessProfile?.shopifyStoreName}</span>
                        <span className="font-mono text-[11px] text-muted-foreground truncate">{businessProfile?.shopifyStoreUrl}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground pt-1 border-t border-emerald-500/15">
                        <button
                          type="button"
                          onClick={() => setShowShopifyScheduleModal(true)}
                          className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors group text-left cursor-pointer"
                        >
                          <span className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            (businessProfile?.shopifyRealtimeSyncEnabled !== false) ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/60"
                          )} />
                          <span className="truncate">{formatShopifyScheduleSummary(businessProfile)}</span>
                          <Pencil className="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0" />
                        </button>
                        <span>
                          {formatShopifyLastSync(businessProfile?.shopifyLastSyncedAt)}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between pt-0.5">
                        <span>Next: {getNextShopifySyncDisplay(businessProfile)}</span>
                        <button
                          type="button"
                          onClick={() => setShowShopifyScheduleModal(true)}
                          className="text-emerald-400 hover:underline font-sans cursor-pointer font-medium"
                        >
                          Set Schedule →
                        </button>
                      </div>

                      {businessProfile?.shopifyRealtimeSyncEnabled === false && (
                        <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Real-Time Sync is paused</span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={async () => {
                              await updateShopifyScheduleSettings({
                                shopifyRealtimeSyncEnabled: true,
                                shopifyAutoSyncEnabled: true,
                              });
                            }}
                            className="h-6 px-2.5 text-[10px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                          >
                            ⚡ Enable Real-Time
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-1">
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Sync Scope</span>
                        <span className="font-semibold text-foreground text-xs block">Catalog & Orders</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-1">
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Frequency</span>
                        <span className="font-semibold text-emerald-400 text-xs block">Real-time Webhooks</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-auto pt-2">
                  {isShopifyConnected && (
                    <>
                      <Button
                        onClick={() => autoSyncShopifyNow(true, businessProfile?.shopifyStoreUrl)}
                        disabled={isShopifySyncing}
                        className="flex-1 rounded-2xl text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 h-10 cursor-pointer"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isShopifySyncing && "animate-spin")} />
                        {isShopifySyncing ? 'Syncing...' : 'Sync Now'}
                      </Button>
                      <Button
                        onClick={() => setShowShopifyScheduleModal(true)}
                        variant="outline"
                        title="Configure Auto-Sync Schedule & Real-Time Sync"
                        className="rounded-2xl text-xs font-bold gap-1.5 h-10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-3 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Schedule</span>
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={() => setShowShopifyModal(true)}
                    variant={isShopifyConnected ? 'outline' : 'default'}
                    className={cn(
                      "rounded-2xl text-xs font-bold gap-2 h-10 cursor-pointer",
                      isShopifyConnected
                        ? "border-border/60 hover:bg-secondary px-3"
                        : "w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                    )}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {isShopifyConnected ? 'Settings' : 'Connect Shopify Store'}
                    {!isShopifyConnected && <ArrowRight className="w-3.5 h-3.5 ml-auto" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 2: Google Drive Auto-Sync (Single Unified Card) */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-blue-500" />
            Google Drive Cloud Auto-Sync
          </h3>

          <Card className="ios-glass border-blue-500/30 hover:border-blue-500/60 transition-all rounded-3xl overflow-hidden relative group shadow-lg">
            <CardHeader className="pb-4 border-b border-border/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="text-2xl p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                    📁
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base font-bold truncate">
                        Google Drive
                      </CardTitle>
                      {isLoadingConnection ? (
                        <Badge variant="outline" className="text-zinc-500 text-[10px] gap-1 py-0 px-2 shrink-0">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading
                        </Badge>
                      ) : driveConnection ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] gap-1 py-0 px-2 shrink-0 font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px] py-0 px-2 shrink-0">
                          Available
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs truncate mt-0.5">
                      Background Cloud Folder & Spreadsheet Synchronization
                    </CardDescription>
                  </div>
                </div>

                {driveConnection && (
                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-3 py-1.5 text-xs shrink-0 self-start sm:self-auto">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                      {driveConnection.googleEmail ? driveConnection.googleEmail.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <span className="text-xs font-semibold text-foreground max-w-[200px] truncate" title={driveConnection.googleEmail}>
                      {driveConnection.googleEmail || 'Google Drive'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={switchGoogleAccount}
                      className="h-6 px-2 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/15 rounded-lg shrink-0 gap-1 font-medium"
                      title="Switch Google Account"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Switch
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {isLoadingConnection ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : !driveConnection ? (
                // State 1: Disconnected
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
                  <div className="space-y-1 max-w-xl">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Connect your Google Drive business folder to automatically sync and ingest sales spreadsheets, orders, and product catalog files in the background.
                    </p>
                  </div>
                  <Button
                    onClick={connectGoogleDrive}
                    className="rounded-2xl text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 h-10 px-6 shrink-0 w-full sm:w-auto"
                  >
                    <Cloud className="w-4 h-4" />
                    Connect Google Drive
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </Button>
                </div>
              ) : !driveConnection.selectedFolderId ? (
                // State 2: Connected but folder not selected
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-2.5 flex-1">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-500">Folder Required</p>
                      <p className="text-muted-foreground text-[11px]">Select a Google Drive folder to scan and sync spreadsheets.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <Button
                      variant="default"
                      onClick={() => {
                        setShowFolderModal(true);
                        fetchFolders();
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold gap-1.5 h-9 px-5 flex-1 sm:flex-initial"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Select Sync Folder
                    </Button>
                    <Button
                      onClick={handleDisconnectGoogleDrive}
                      variant="ghost"
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs h-9 px-3 shrink-0"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                // State 3: Connected & Active Folder Selected
                <div className="space-y-6">
                  {/* Top Stats Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/40 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Sync Folder</span>
                      <p className="font-semibold text-blue-400 text-xs truncate">
                        "{driveConnection.selectedFolderName || 'AnalyzeUp'}"
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/40 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Schedule</span>
                      <button
                        type="button"
                        onClick={() => setShowAutoSyncModal(true)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors group text-left"
                      >
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          (driveConnection.autoSyncEnabled !== false) ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                        )} />
                        <span className="truncate">{formatScheduleSummary(driveConnection)}</span>
                        <Pencil className="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0" />
                      </button>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/40 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Last Synced</span>
                      <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{formatLastSyncTime(driveConnection.lastSyncAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Next check banner */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-border/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px]">Next check: {getNextSyncTimeDisplay(driveConnection)}</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        onClick={() => syncFolderWithAutoIngest()}
                        disabled={isLoadingScan || syncState === 'syncing'}
                        className="rounded-xl text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 h-9 px-5 flex-1 sm:flex-initial cursor-pointer"
                      >
                        {isLoadingScan || syncState === 'syncing' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing Folder...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" /> Sync Folder Now
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowFolderModal(true);
                          fetchFolders();
                        }}
                        className="rounded-xl text-xs font-medium h-9 px-3.5 border-border/60 hover:bg-secondary/60 shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5 mr-1 text-blue-400" />
                        Change Folder
                      </Button>

                      <Button
                        size="sm"
                        onClick={handleDisconnectGoogleDrive}
                        variant="ghost"
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs h-9 px-3 shrink-0"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>

                  {/* Folder Files List Table (Integrated Inside the Same Single Card) */}
                  <div className="pt-4 border-t border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Detected Folder Files
                        </h4>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {driveFiles.length} {driveFiles.length === 1 ? 'file' : 'files'}
                        </Badge>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncFolderWithAutoIngest()}
                        disabled={isLoadingScan || syncState === 'syncing'}
                        className="rounded-xl text-xs gap-2 h-8 px-3.5 font-semibold bg-secondary/50 hover:bg-secondary border-border/60 text-foreground transition-all shadow-sm cursor-pointer"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5 text-blue-400 shrink-0", (isLoadingScan || syncState === 'syncing') && "animate-spin")} />
                        <span>Scan & Sync All</span>
                      </Button>
                    </div>

                    {isLoadingScan && driveFiles.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <p className="text-xs text-muted-foreground">Scanning folder contents...</p>
                      </div>
                    ) : driveFiles.length === 0 ? (
                      <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-2xl">
                        <AlertCircle className="w-6 h-6 text-zinc-500 mx-auto" />
                        <h5 className="text-xs font-semibold text-zinc-300">No spreadsheets found</h5>
                        <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                          Place CSV or Excel files inside your <code className="bg-secondary px-1 py-0.5 rounded font-mono text-blue-400">{driveConnection.selectedFolderName}</code> folder, then click Scan & Sync All.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-border/30 bg-secondary/15">
                        <table className="w-full text-xs text-left text-zinc-300">
                          <thead>
                            <tr className="border-b border-border/30 text-muted-foreground bg-secondary/30">
                              <th className="py-2.5 px-3 font-bold">File Name</th>
                              <th className="py-2.5 px-3 font-bold">Size</th>
                              <th className="py-2.5 px-3 font-bold">Last Modified</th>
                              <th className="py-2.5 px-3 font-bold">Synced Status</th>
                              <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driveFiles.map((file) => {
                              const isSyncing = isSyncingFileId === file.id;
                              const dateStr = new Date(file.modifiedTime).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              });

                              return (
                                <tr key={file.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                                  <td className="py-2.5 px-3 font-semibold text-zinc-200">{file.name}</td>
                                  <td className="py-2.5 px-3 text-zinc-400">
                                    {file.sizeBytes ? `${(file.sizeBytes / 1024).toFixed(1)} KB` : '0 KB'}
                                  </td>
                                  <td className="py-2.5 px-3 text-zinc-400">{dateStr}</td>
                                  <td className="py-2.5 px-3">
                                    {file.status === 'Synced' ? (
                                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] gap-1 px-2 py-0">
                                        <Check className="w-3 h-3" /> Synced
                                      </Badge>
                                    ) : file.status === 'Modified' ? (
                                      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] gap-1 px-2 py-0">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Modified
                                      </Badge>
                                    ) : file.status === 'Needs Review' ? (
                                      <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] gap-1 px-2 py-0">
                                        <AlertCircle className="w-3 h-3" /> Review Required
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px] px-2 py-0">
                                        New File
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {file.status === 'Synced' ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => syncFile(file)}
                                        disabled={isSyncing}
                                        className="h-7 text-[10px] font-semibold text-zinc-400 hover:text-white"
                                      >
                                        {isSyncing ? 'Processing...' : 'Re-Sync'}
                                      </Button>
                                    ) : file.status === 'Needs Review' ? (
                                      <Button
                                        size="sm"
                                        onClick={() => syncFile(file)}
                                        disabled={isSyncing}
                                        className="h-7 text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg px-2.5"
                                      >
                                        Review & Map
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => syncFile(file)}
                                        disabled={isSyncing}
                                        className="h-7 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-2.5"
                                      >
                                        {isSyncing ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin mr-1" /> Syncing...
                                          </>
                                        ) : (
                                          'Sync Now'
                                        )}
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      {/* Coming Soon Section */}
      <div className="space-y-3 pt-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-muted-foreground" />
          Coming Soon & Planned Expansion
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations
            .filter((item) => item.status === 'Coming Soon')
            .map((item) => (
              <Card key={item.id} className="bg-secondary/30 border-border/40 rounded-2xl opacity-90 hover:opacity-100 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="text-2xl p-2 rounded-xl bg-secondary border border-border/40">
                        {item.icon}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">{item.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground mt-0.5">
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      Coming Soon
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground min-h-[36px]">{item.description}</p>
                  <Button
                    variant="outline"
                    onClick={() => handleNotifyMe(item.name)}
                    className="w-full rounded-xl text-xs gap-1.5 border-border/60 hover:bg-secondary"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    Notify Me When Available
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* Dialog 1: Folder Selector Modal */}
      <Dialog open={showFolderModal} onOpenChange={setShowFolderModal}>
        <DialogContent className="sm:max-w-lg bg-zinc-950/95 border border-blue-500/20 rounded-3xl ios-glass text-white shadow-2xl p-6 max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-2 border-b border-zinc-800/60">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-zinc-100">
              <Folder className="w-5 h-5 text-blue-400" />
              Configure Sync Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Select or search the Google Drive folder containing your business spreadsheets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3 text-xs flex-1 overflow-hidden flex flex-col">
            {/* Auto Create Button */}
            <Button
              onClick={() => selectFolder()}
              disabled={isFolderCreating}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold gap-2 py-3.5 shrink-0 shadow-md"
            >
              {isFolderCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating folder...
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4" /> Create "AnalyzeUp_Data_Sync" Recommended Folder
                </>
              )}
            </Button>

            {/* Divider with label */}
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px bg-zinc-800/80 flex-1" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Or Browse Existing Folders
              </span>
              <div className="h-px bg-zinc-800/80 flex-1" />
            </div>

            {/* Search Input Box */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Search folders by name or owner..."
                value={folderSearchTerm}
                onChange={(e) => setFolderSearchTerm(e.target.value)}
                className="pl-9 pr-8 text-xs bg-zinc-900/90 border-zinc-800 rounded-xl h-9 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-blue-500"
              />
              {folderSearchTerm && (
                <button
                  onClick={() => setFolderSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Google Drive Location Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
              <Button
                variant={folderSection === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFolderSection('all')}
                className={`h-7 px-2.5 text-[11px] rounded-lg gap-1.5 font-medium shrink-0 ${
                  folderSection === 'all'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <span>All</span>
                <span className="text-[10px] opacity-75">({driveFolders.length})</span>
              </Button>
              <Button
                variant={folderSection === 'mydrive' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFolderSection('mydrive')}
                className={`h-7 px-2.5 text-[11px] rounded-lg gap-1.5 font-medium shrink-0 ${
                  folderSection === 'mydrive'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <HardDrive className="w-3 h-3" />
                <span>My Drive</span>
                <span className="text-[10px] opacity-75">({myDriveFolders.length})</span>
              </Button>
              <Button
                variant={folderSection === 'shared' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFolderSection('shared')}
                className={`h-7 px-2.5 text-[11px] rounded-lg gap-1.5 font-medium shrink-0 ${
                  folderSection === 'shared'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Shared with me</span>
                <span className="text-[10px] opacity-75">({sharedFolders.length})</span>
              </Button>
              <Button
                variant={folderSection === 'starred' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFolderSection('starred')}
                className={`h-7 px-2.5 text-[11px] rounded-lg gap-1.5 font-medium shrink-0 ${
                  folderSection === 'starred'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Starred</span>
                <span className="text-[10px] opacity-75">({starredFolders.length})</span>
              </Button>
              <Button
                variant={folderSection === 'recent' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFolderSection('recent')}
                className={`h-7 px-2.5 text-[11px] rounded-lg gap-1.5 font-medium shrink-0 ${
                  folderSection === 'recent'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Recent</span>
              </Button>
            </div>

            {/* Folder List with distinctions */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[160px] max-h-[300px]">
              {isLoadingFolders ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs text-zinc-400">Loading your Drive folders...</p>
                </div>
              ) : filteredDriveFolders.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-zinc-800 rounded-2xl">
                  <Folder className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-400">
                    {folderSearchTerm ? `No folders match "${folderSearchTerm}"` : 'No folders found in this section.'}
                  </p>
                  {folderSearchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFolderSearchTerm('')}
                      className="text-blue-400 text-xs h-7"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                filteredDriveFolders.map(folder => {
                  const isSelected = driveConnection?.selectedFolderId === folder.id;
                  const isShared = Boolean(folder.shared) || (folder.owners && folder.owners.length > 0 && !folder.owners[0]?.me);
                  const ownerName = folder.owners?.[0]?.displayName || folder.owners?.[0]?.emailAddress || 'Shared User';
                  const dateStr = folder.modifiedTime
                    ? new Date(folder.modifiedTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null;

                  return (
                    <div
                      key={folder.id}
                      onClick={() => selectFolder(folder.id, folder.name)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                        isSelected
                          ? 'bg-blue-500/15 border-blue-500/60 ring-1 ring-blue-500/40'
                          : 'bg-zinc-900/80 border-zinc-800/80 hover:border-blue-500/40 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isShared
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {isShared ? <Users className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-100 truncate text-xs group-hover:text-blue-300 transition-colors">
                              {folder.name}
                            </span>
                            {folder.starred && (
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                            )}
                            {isSelected && (
                              <Badge className="bg-blue-500 text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                isShared ? 'text-purple-400' : 'text-zinc-400'
                              }`}
                            >
                              {isShared ? <Users className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />}
                              {isShared ? `Shared by ${ownerName}` : 'My Drive'}
                            </span>
                            {dateStr && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-500">{dateStr}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 group-hover:text-blue-400 group-hover:bg-blue-500/20 flex items-center justify-center transition-all">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Sync History Log Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="sm:max-w-lg bg-zinc-950/95 border border-blue-500/20 rounded-3xl ios-glass text-white shadow-2xl p-6 max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="pb-3 border-b border-zinc-800/60 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-blue-400" />
              Sync History Log
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Audit log of files ingested from Google Drive sync folder.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
            {syncHistory.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-12">No synchronization records logged yet.</p>
            ) : (
              syncHistory.map(log => (
                <div key={log.id} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-200">
                      {new Date(log.syncedAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0">
                      Completed
                    </Badge>
                  </div>
                  <div className="text-[11px] text-zinc-400 space-y-1">
                    <p>
                      Files Ingested: <span className="text-zinc-300 font-semibold">{(log.files || []).join(', ')}</span>
                    </p>
                    <p>
                      Impact: <span className="text-emerald-400 font-bold">+{log.rowsCount} records</span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 3: Silent Sync loading screen */}
      <Dialog open={syncState === 'syncing'} onOpenChange={(open) => { if (!open) setSyncState('idle'); }}>
        <DialogContent className="max-w-md bg-zinc-950/95 border border-blue-500/30 rounded-3xl ios-glass text-white shadow-2xl p-7 flex flex-col items-center justify-center space-y-4">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
            <div className="absolute inset-0 rounded-2xl bg-blue-500/10 animate-ping opacity-30 pointer-events-none" />
          </div>
          <DialogHeader className="items-center text-center space-y-1.5 w-full">
            <div className="flex items-center justify-center gap-2">
              <DialogTitle className="text-base font-extrabold text-zinc-100">
                Syncing File Data
              </DialogTitle>
              {syncProgress.recordsCount ? (
                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2 py-0.5 font-bold">
                  {syncProgress.recordsCount.toLocaleString()} Rows
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="text-xs text-zinc-400 text-center w-full max-w-sm mx-auto leading-relaxed font-medium break-words [overflow-wrap:anywhere]">
              {syncProgress.stage || 'Processing spreadsheet records and updating business intelligence...'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
              <span className="truncate max-w-[220px] text-zinc-300">{syncProgress.fileName || 'Google Drive File'}</span>
              <span className="text-emerald-400 font-bold font-mono">{syncProgress.percent}%</span>
            </div>
            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(8, syncProgress.percent)}%` }}
              />
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSyncState('idle')}
            className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/60 rounded-xl h-8 px-4 mt-1 border border-zinc-800/60"
          >
            Run in Background
          </Button>
        </DialogContent>
      </Dialog>

      {/* Dialog 4: Auto-Sync Schedule Configuration Modal */}
      <Dialog open={showAutoSyncModal} onOpenChange={setShowAutoSyncModal}>
        <DialogContent className="sm:max-w-md bg-zinc-950/95 border border-blue-500/20 rounded-3xl ios-glass text-white shadow-2xl p-6 max-h-[88vh] flex flex-col overflow-hidden">
          <DialogHeader className="pb-3 border-b border-zinc-800/60 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Auto-Sync Schedule
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Configure when AnalyzeUp should automatically scan and sync files from your connected Google Drive folder.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            {/* Active Toggle Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-inner">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync-toggle" className="text-xs font-bold text-zinc-100 cursor-pointer">
                  Enable Automatic Sync
                </Label>
                <p className="text-[11px] text-zinc-400">
                  Automatically import new spreadsheets on a recurring schedule
                </p>
              </div>
              <Switch
                id="auto-sync-toggle"
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
              />
            </div>

            {autoSyncEnabled && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                {/* Frequency Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-300">Sync Frequency</Label>
                  <Select
                    value={autoSyncFrequency}
                    onValueChange={(val: any) => setAutoSyncFrequency(val)}
                  >
                    <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 rounded-xl text-xs text-white">
                      <SelectValue placeholder="Select Frequency" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl">
                      <SelectItem value="1_hour">Every 1 Hour</SelectItem>
                      <SelectItem value="6_hours">Every 6 Hours</SelectItem>
                      <SelectItem value="12_hours">Every 12 Hours</SelectItem>
                      <SelectItem value="daily">Daily (Once per day)</SelectItem>
                      <SelectItem value="weekly">Weekly (Once per week)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Day of Week Selector (Weekly only) */}
                {autoSyncFrequency === 'weekly' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300">Sync Day of Week</Label>
                    <Select value={autoSyncDay} onValueChange={setAutoSyncDay}>
                      <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 rounded-xl text-xs text-white capitalize">
                        <SelectValue placeholder="Select Day" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-white rounded-xl">
                        <SelectItem value="monday">Every Monday</SelectItem>
                        <SelectItem value="tuesday">Every Tuesday</SelectItem>
                        <SelectItem value="wednesday">Every Wednesday</SelectItem>
                        <SelectItem value="thursday">Every Thursday</SelectItem>
                        <SelectItem value="friday">Every Friday</SelectItem>
                        <SelectItem value="saturday">Every Saturday</SelectItem>
                        <SelectItem value="sunday">Every Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Time of Day Picker (Daily & Weekly) */}
                {(autoSyncFrequency === 'daily' || autoSyncFrequency === 'weekly') && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-zinc-300">Sync Time (Local)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { label: '9:00 AM', value: '09:00' },
                        { label: '12:00 PM', value: '12:00' },
                        { label: '6:00 PM', value: '18:00' },
                        { label: '11:59 PM', value: '23:59' },
                      ].map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setAutoSyncTime(preset.value)}
                          className={cn(
                            "py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer",
                            autoSyncTime === preset.value
                              ? "bg-blue-600 border-blue-500 text-white font-bold shadow-sm"
                              : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-zinc-400">Or custom time:</span>
                      <Input
                        type="time"
                        value={autoSyncTime}
                        onChange={(e) => setAutoSyncTime(e.target.value)}
                        className="h-8 w-32 bg-zinc-900 border-zinc-800 text-xs rounded-xl text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Live Preview Pill */}
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs flex items-center gap-2 text-blue-300">
                  <Zap className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    Schedule: <strong className="text-white">{formatScheduleSummary({ autoSyncEnabled, autoSyncFrequency, autoSyncTime, autoSyncDay })}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3.5 mt-2 border-t border-zinc-800/80 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAutoSyncModal(false)}
              className="rounded-xl text-xs h-9 px-4 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAutoSyncSchedule}
              disabled={isSavingSchedule}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold px-4 h-9 gap-1.5 shadow-md shadow-blue-600/20 transition-all"
            >
              {isSavingSchedule ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Save Schedule'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 22-Column Universal Database Schema Modal */}
      <Dialog open={showSchemaModal} onOpenChange={setShowSchemaModal}>
        <DialogContent className="max-w-2xl ios-glass rounded-3xl p-6 border-border/40 max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">22-Column Universal Database Schema</DialogTitle>
                <DialogDescription className="text-xs">
                  Standardized database columns supported for complete financial, inventory, forecasting, and supplier intelligence.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
                <span className="font-bold text-foreground text-xs block text-amber-400">1. Orders & Transactions</span>
                <ul className="space-y-1 text-muted-foreground text-[11px]">
                  <li>• <strong className="text-foreground">Invoice No:</strong> Unique billing invoice reference</li>
                  <li>• <strong className="text-foreground">Order ID:</strong> Transaction order tracking ID</li>
                  <li>• <strong className="text-foreground">Order Date:</strong> Transaction timestamp (YYYY-MM-DD)</li>
                  <li>• <strong className="text-foreground">Payment Mode:</strong> UPI, Card, Cash, NetBanking</li>
                  <li>• <strong className="text-foreground">Order Status:</strong> Completed, Pending, Shipped</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
                <span className="font-bold text-foreground text-xs block text-blue-400">2. Customer Identification</span>
                <ul className="space-y-1 text-muted-foreground text-[11px]">
                  <li>• <strong className="text-foreground">Customer ID:</strong> Unique customer identifier</li>
                  <li>• <strong className="text-foreground">Customer Name:</strong> Buyer entity or full name</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
                <span className="font-bold text-foreground text-xs block text-purple-400">3. Product Catalog</span>
                <ul className="space-y-1 text-muted-foreground text-[11px]">
                  <li>• <strong className="text-foreground">SKU:</strong> Stock Keeping Unit (Unique ID)</li>
                  <li>• <strong className="text-foreground">Item Name:</strong> Product title & specs</li>
                  <li>• <strong className="text-foreground">Category:</strong> Classification category</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
                <span className="font-bold text-foreground text-xs block text-emerald-400">4. Supplier & Logistics</span>
                <ul className="space-y-1 text-muted-foreground text-[11px]">
                  <li>• <strong className="text-foreground">Supplier ID:</strong> Unique vendor code</li>
                  <li>• <strong className="text-foreground">Supplier Name:</strong> Primary supplier or vendor</li>
                  <li>• <strong className="text-foreground">Lead Time Days:</strong> Delivery transit timeframe in days</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
                <span className="font-bold text-foreground text-xs block text-rose-400">5. Sales & Financials</span>
                <ul className="space-y-1 text-muted-foreground text-[11px]">
                  <li>• <strong className="text-foreground">Qty Sold:</strong> Quantity sold in transaction</li>
                  <li>• <strong className="text-foreground">Purchase Price:</strong> Unit purchase cost (COGS)</li>
                  <li>• <strong className="text-foreground">Retail Price:</strong> Unit selling / MRP price</li>
                  <li>• <strong className="text-foreground">Discount:</strong> Applied promotional discount</li>
                  <li>• <strong className="text-foreground">Tax:</strong> GST / VAT / Tax applied</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
                <span className="font-bold text-foreground text-xs block text-teal-400">6. Warehouse & Inventory</span>
                <ul className="space-y-1 text-muted-foreground text-[11px]">
                  <li>• <strong className="text-foreground">Current Stock:</strong> Available on-hand quantity</li>
                  <li>• <strong className="text-foreground">Reorder Level:</strong> Threshold triggering reorder</li>
                  <li>• <strong className="text-foreground">Safety Stock:</strong> Minimum buffer stock level</li>
                  <li>• <strong className="text-foreground">Warehouse:</strong> Location or storage facility</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t border-border/40 pt-3">
            <Button variant="outline" size="sm" onClick={handleDownload22ColumnTemplate} className="rounded-xl text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" /> Download Template CSV
            </Button>
            <Button size="sm" onClick={() => { setShowSchemaModal(false); setIsImportDialogOpen(true); }} className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground">
              <UploadCloud className="w-3.5 h-3.5" /> Open Import Wizard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Integrated ImportDialog for mapping config */}
      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        presetFile={presetFile}
        onImportComplete={handleImportComplete}
      />

      {/* Shopify Schedule & Real-Time Sync Automation Modal */}
      <ShopifyScheduleModal
        open={showShopifyScheduleModal}
        onOpenChange={setShowShopifyScheduleModal}
      />
    </div>
  );
}
