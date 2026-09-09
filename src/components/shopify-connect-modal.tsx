'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
  Store,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Key,
  Globe,
  Unlink,
  ExternalLink,
  ShieldCheck,
  Sliders,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ShopifyScheduleModal } from '@/components/shopify-schedule-modal';
import {
  formatShopifyScheduleSummary,
  getNextShopifySyncDisplay,
} from '@/lib/shopify-sync-helper';

export function ShopifyConnectModal() {
  const {
    showShopifyModal,
    setShowShopifyModal,
    businessProfile,
    updateBusinessProfile,
    bulkAddProducts,
    bulkAddTransactions,
    bulkAddReturns,
    disconnectShopify,
  } = useData();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const isConnected = Boolean(
    businessProfile?.shopifyConnected || businessProfile?.shopifyStatus === 'Connected'
  );

  const [activeTab, setActiveTab] = useState<'oauth' | 'token'>('oauth');
  const [storeUrl, setStoreUrl] = useState(businessProfile?.shopifyStoreUrl || '');
  const [accessToken, setAccessToken] = useState(businessProfile?.shopifyAccessToken || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isCheckingScopes, setIsCheckingScopes] = useState(false);
  const [scopeCheckResult, setScopeCheckResult] = useState<any>(null);
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [newTokenInput, setNewTokenInput] = useState('');

  const cleanShopDomain = (input: string): string => {
    let clean = input.trim().toLowerCase();
    const adminMatch = clean.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9\-]+)/);
    if (adminMatch && adminMatch[1]) {
      return `${adminMatch[1]}.myshopify.com`;
    }
    clean = clean.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean.includes('.myshopify.com')) {
      clean = `${clean}.myshopify.com`;
    }
    return clean;
  };

  // 1. Initiate One-Click OAuth Flow (Zero-trust server-resolved session)
  const handleOAuthConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Sign In Required',
        description: 'Please sign in to your AnalyzeUp account before connecting your Shopify store.',
      });
      return;
    }
    if (!storeUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'Store URL Required',
        description: 'Please enter your Shopify store name or URL (e.g. your-store.myshopify.com).',
      });
      return;
    }

    const shop = cleanShopDomain(storeUrl);
    setIsSubmitting(true);

    try {
      const idToken = await user?.getIdToken();
      const res = await fetch('/api/shopify/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ shop }),
      });

      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error || 'Failed to initiate Shopify authorization.');
      }

      window.location.href = data.authUrl;
    } catch (err: any) {
      setIsSubmitting(false);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: err.message || 'Could not reach Shopify authorization server.',
      });
    }
  };

  // 2. Direct Admin API Token Verification & Connection
  const handleTokenConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'Store URL Required',
        description: 'Please enter your Shopify store URL.',
      });
      return;
    }
    if (!accessToken.trim()) {
      toast({
        variant: 'destructive',
        title: 'Access Token Required',
        description: 'Please enter your Admin API Access Token (starts with shpat_).',
      });
      return;
    }

    const shop = cleanShopDomain(storeUrl);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/shopify/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          accessToken: accessToken.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Shopify verification failed. Please check credentials.');
      }

      const shopData = data.shop;
      const storeName = shopData.name || shop.replace('.myshopify.com', '');

      // Save connection in Firestore
      if (user && firestore) {
        const connectionRef = doc(firestore, 'users', user.uid, 'integrations', 'shopify');
        await setDoc(
          connectionRef,
          {
            userId: user.uid,
            provider: 'shopify',
            shopDomain: shop,
            storeName,
            storeEmail: shopData.email || '',
            currency: shopData.currency || 'USD',
            accessToken: accessToken.trim(),
            connectionStatus: 'Connected',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Store lookup index for instant real-time webhook routing
        const storeLookupRef = doc(firestore, 'shopify_stores', shop);
        await setDoc(storeLookupRef, {
          userId: user.uid,
          shopDomain: shop,
          storeName,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(console.warn);

        // Auto-register real-time webhooks with Shopify Admin API
        fetch('/api/shopify/webhooks/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, accessToken: accessToken.trim() }),
        }).catch(console.warn);
      }

      // Update business profile state
      await updateBusinessProfile({
        shopifyConnected: true,
        shopifyStoreUrl: shop,
        shopifyStoreName: storeName,
        shopifyStatus: 'Connected',
        shopifyAccessToken: accessToken.trim(),
      });

      toast({
        title: 'Shopify Connected! 🛍️',
        description: `Successfully verified and connected "${storeName}" (${shop}).`,
      });

      // Automatically trigger initial sync
      triggerSync(shop, accessToken.trim());
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: err?.message || 'Could not verify Shopify store credentials.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Trigger Manual Catalog & Orders Sync
  const triggerSync = async (shopOverride?: string, tokenOverride?: string) => {
    const shop = shopOverride || businessProfile?.shopifyStoreUrl;
    const token = tokenOverride || businessProfile?.shopifyAccessToken;

    if (!shop) {
      toast({
        variant: 'destructive',
        title: 'Missing Store URL',
        description: 'Store URL is missing. Please connect your store first.',
      });
      return;
    }

    setIsSyncing(true);
    toast({
      title: 'Syncing Shopify Data...',
      description: 'Fetching product catalog, live inventory levels, and customer orders.',
    });

    try {
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, ...(token ? { accessToken: token } : {}) }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync with Shopify.');
      }

      const { products = [], transactions = [], returns = [], stats } = data;

      // Ingest canonical products, transactions, and returns into DataContext
      if (products.length > 0) {
        await bulkAddProducts(products, true);
      }
      if (transactions.length > 0) {
        await bulkAddTransactions(transactions);
      }
      if (returns.length > 0) {
        await bulkAddReturns(returns);
      }

      await updateBusinessProfile({
        shopifyLastSyncedAt: new Date().toISOString(),
        shopifyStatus: 'Connected',
      });

      const returnMsg = (stats?.canonicalReturnsCount || returns.length) > 0
        ? `, and ${stats?.canonicalReturnsCount || returns.length} returns/refunds`
        : '';
      toast({
        title: 'Shopify Sync Complete! 🎉',
        description: `Synchronized ${stats?.canonicalProductsCount || products.length} products, ${stats?.canonicalTransactionsCount || transactions.length} orders${returnMsg} into your workspace.`,
      });
    } catch (err: any) {
      console.error('[Shopify Sync Error]:', err);
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: err?.message || 'Failed to pull data from Shopify API.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Disconnect Shopify Store & Purge Synced Data
  const handleDisconnect = async () => {
    if (
      !confirm(
        'Are you sure you want to disconnect this Shopify store? All products, orders, and synchronized data imported from Shopify will be immediately deleted from your workspace.'
      )
    ) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const shopToDisconnect = businessProfile?.shopifyStoreUrl || storeUrl;
      const result = await disconnectShopify({
        purgeData: true,
        shopOverride: shopToDisconnect,
      });

      setStoreUrl('');
      setAccessToken('');
      setShowShopifyModal(false);

      const itemsRemoved =
        result.deletedProducts > 0 || result.deletedTransactions > 0 || result.deletedReturns > 0
          ? ` Removed ${result.deletedProducts} products, ${result.deletedTransactions} orders, and ${result.deletedReturns} returns.`
          : '';

      toast({
        title: 'Shopify Disconnected & Purged 🗑️',
        description: `Store integration disconnected successfully.${itemsRemoved}`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Disconnect Error',
        description: err?.message || 'Failed to disconnect Shopify.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCheckScopes = async () => {
    const shop = businessProfile?.shopifyStoreUrl;
    const token = businessProfile?.shopifyAccessToken;
    if (!shop) {
      toast({ variant: 'destructive', title: 'Missing store URL', description: 'Please connect your store first.' });
      return;
    }

    setIsCheckingScopes(true);
    try {
      const res = await fetch('/api/shopify/scopes/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, ...(token ? { accessToken: token } : {}) }),
      });
      const data = await res.json();
      setScopeCheckResult(data);
      if (data.success && data.hasCoreScopes) {
        toast({
          title: 'Permissions Verified! ⚡',
          description: 'Catalog, inventory, and order syncing are fully active.',
        });
      } else if (data.success && !data.hasCoreScopes) {
        toast({
          variant: 'destructive',
          title: 'Action Needed: Reconnect Store',
          description: 'Core permissions (products, orders, inventory) are missing. Please reconnect your store.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Permission Check Notice',
          description: data.error || 'Could not verify scopes.',
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Inspection Failed', description: err.message });
    } finally {
      setIsCheckingScopes(false);
    }
  };

  const handleSaveUpdatedToken = async () => {
    if (!newTokenInput.trim()) {
      toast({ variant: 'destructive', title: 'Token Required', description: 'Please enter your Admin API token.' });
      return;
    }
    const token = newTokenInput.trim();
    setIsSubmitting(true);
    try {
      await updateBusinessProfile({ shopifyAccessToken: token });
      setAccessToken(token);
      setIsEditingToken(false);
      setNewTokenInput('');
      toast({ title: 'Token Updated 🔑', description: 'Updated access token saved. Verifying permissions...' });
      handleCheckScopes();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showShopifyModal && !showScheduleModal) return null;

  return (
    <>
      <Dialog open={showShopifyModal} onOpenChange={setShowShopifyModal}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto ios-glass rounded-3xl border border-border/50 p-6 shadow-2xl">
        <DialogHeader className="text-left pb-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Shopify Integration
                {isConnected && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 py-0 px-2">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sync catalog, live stock levels, sales orders & variants automatically from Shopify.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* --- VIEW A: STORE IS ALREADY CONNECTED --- */}
        {isConnected ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-muted-foreground block">Connected Store</span>
                  <h4 className="text-base font-bold text-foreground">
                    {businessProfile?.shopifyStoreName || 'Shopify Storefront'}
                  </h4>
                  <span className="text-xs font-mono text-emerald-400">
                    {businessProfile?.shopifyStoreUrl}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Store className="w-5 h-5" />
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync Active
                </span>
                <span>
                  {businessProfile?.shopifyLastSyncedAt
                    ? `Last synced: ${new Date(businessProfile.shopifyLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Ready to sync'}
                </span>
              </div>
            </div>

            {/* Live Token Permissions & Reinstall Card */}
            <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/40 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>API Scopes & Permissions</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCheckingScopes}
                  onClick={handleCheckScopes}
                  className="rounded-xl text-[11px] gap-1.5 h-7 px-2.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingScopes ? 'animate-spin' : ''}`} />
                  {isCheckingScopes ? 'Verifying...' : 'Verify Scopes'}
                </Button>
              </div>

              {scopeCheckResult ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-background/50 border border-border/30">
                    <span className="font-medium text-foreground">Product Price Sync (write_products):</span>
                    {scopeCheckResult.permissions?.hasWriteProducts ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 py-0 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Active & Ready
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] gap-1 py-0 font-semibold">
                        <AlertCircle className="w-3 h-3" /> Not Active on Token
                      </Badge>
                    )}
                  </div>

                  {!scopeCheckResult.permissions?.hasWriteProducts && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                      <p className="font-bold flex items-center gap-1 text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" /> Action Required in Shopify:
                      </p>
                      <p className="text-[10.5px] leading-relaxed text-amber-200/90">
                        You added <code>write_products</code>, but Shopify requires clicking <strong>"Reinstall app"</strong> (in Shopify Admin → Apps and sales channels → Develop apps → Click app → <strong>API credentials</strong> tab) to grant it to your token.
                      </p>
                    </div>
                  )}

                  {scopeCheckResult.scopes && scopeCheckResult.scopes.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block font-medium">Active Token Scopes:</span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {scopeCheckResult.scopes.map((s: string) => (
                          <span
                            key={s}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                              s === 'write_products'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                                : 'bg-secondary/60 text-muted-foreground border border-border/40'
                            }`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Catalog & variants, orders, returns, and inventory</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={handleCheckScopes}
                    className="text-emerald-400 hover:text-emerald-300 text-[11px] p-0 h-auto cursor-pointer"
                  >
                    Check Active Scopes →
                  </Button>
                </div>
              )}

              {/* Token update toggle */}
              <div className="pt-1.5 border-t border-border/30">
                {!isEditingToken ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingToken(true)}
                    className="text-[11px] text-muted-foreground hover:text-foreground p-0 h-6 gap-1 cursor-pointer"
                  >
                    <Key className="w-3 h-3 text-amber-400" />
                    <span>Need to update Admin API Token? Click here</span>
                  </Button>
                ) : (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="edit-token" className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                      <span>New Admin API Access Token</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingToken(false)}
                        className="h-5 text-[10px] p-0 text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit-token"
                        type="password"
                        placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                        value={newTokenInput}
                        onChange={(e) => setNewTokenInput(e.target.value)}
                        className="h-8 text-xs rounded-xl bg-background/50 font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSubmitting || !newTokenInput.trim()}
                        onClick={handleSaveUpdatedToken}
                        className="h-8 rounded-xl text-xs font-semibold px-3 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                      >
                        {isSubmitting ? 'Saving...' : 'Save & Verify'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Automation & Real-Time Schedule Card */}
            <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/40 text-xs flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Automation & Schedule
                </span>
                <span className="font-semibold text-emerald-400 truncate block">
                  {formatShopifyScheduleSummary(businessProfile)}
                </span>
                <span className="text-[10px] text-muted-foreground truncate block">
                  Next: {getNextShopifySyncDisplay(businessProfile)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleModal(true)}
                className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-8 shrink-0 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                Schedule
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={() => triggerSync()}
                disabled={isSyncing}
                className="flex-1 rounded-xl text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 h-10"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing Catalog & Orders...' : 'Sync Now'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={isSyncing || isDisconnecting}
                className="rounded-xl text-xs font-semibold gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 h-10 cursor-pointer"
              >
                {isDisconnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Deleting Data...
                  </>
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5" />
                    Disconnect & Delete Data
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* --- VIEW B: CONNECT NEW SHOPIFY STORE (DUAL TABS) --- */
          <div className="space-y-4 pt-1">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'oauth' | 'token')}>
              <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-secondary/40 p-1 border border-border/40">
                <TabsTrigger
                  value="oauth"
                  className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  <Globe className="w-3.5 h-3.5" />
                  One-Click OAuth
                </TabsTrigger>
                <TabsTrigger
                  value="token"
                  className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  <Key className="w-3.5 h-3.5" />
                  Admin API Token
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: ONE-CLICK OAUTH */}
              <TabsContent value="oauth" className="space-y-4 pt-3 mt-0">
                <form onSubmit={handleOAuthConnect} className="space-y-3.5">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="oauth-store-url" className="text-xs font-semibold text-foreground">
                      Shopify Store Domain
                    </Label>
                    <div className="relative">
                      <Input
                        id="oauth-store-url"
                        placeholder="your-store-handle or store.myshopify.com"
                        value={storeUrl}
                        onChange={(e) => setStoreUrl(e.target.value)}
                        className="pl-9 text-xs rounded-xl h-10 bg-secondary/30 border-border/50 focus:border-primary/50"
                        required
                      />
                      <Store className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Enter your store name, handle, or admin URL (e.g. <code>snkhed</code>, <code>14aj1c-0a</code>, or <code>admin.shopify.com/store/14aj1c-0a</code>).
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" /> Official Shopify Approval
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      You will be securely redirected to Shopify to review and approve these permissions.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 h-10"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Redirecting to Shopify...
                      </>
                    ) : (
                      <>
                        Connect via Shopify OAuth
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* TAB 2: CUSTOM APP ADMIN API TOKEN */}
              <TabsContent value="token" className="space-y-4 pt-3 mt-0">
                <form onSubmit={handleTokenConnect} className="space-y-3.5">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="token-store-url" className="text-xs font-semibold text-foreground">
                      Shopify Store Domain
                    </Label>
                    <div className="relative">
                      <Input
                        id="token-store-url"
                        placeholder="your-store-name.myshopify.com"
                        value={storeUrl}
                        onChange={(e) => setStoreUrl(e.target.value)}
                        className="pl-9 text-xs rounded-xl h-10 bg-secondary/30 border-border/50 focus:border-primary/50"
                        required
                      />
                      <Store className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="access-token" className="text-xs font-semibold text-foreground">
                      Admin API Access Token
                    </Label>
                    <div className="relative">
                      <Input
                        id="access-token"
                        type="password"
                        placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        className="pl-9 text-xs rounded-xl h-10 bg-secondary/30 border-border/50 focus:border-primary/50 font-mono"
                        required
                      />
                      <Key className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      From your store: <strong>Settings → Develop apps → API credentials</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40 text-[11px] space-y-1 text-left">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>Required Shopify App Scopes:</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">Admin API</Badge>
                    </div>
                    <p className="text-muted-foreground text-[10.5px] leading-relaxed">
                      • <strong>read_products</strong>, <span className="text-emerald-400 font-semibold">write_products</span> (price & catalog sync)<br />
                      • <strong>read_orders</strong>, <strong>write_orders</strong>, <strong>read_all_orders</strong> (sales transactions)<br />
                      • <span className="text-emerald-400 font-semibold">read_returns</span> (customer returns & refunds)<br />
                      • <strong>read_inventory</strong> (stock tracking)
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 h-10"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Verifying Credentials...
                      </>
                    ) : (
                      <>
                        Verify & Connect Store
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-border/30">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowShopifyModal(false)}
            className="w-full rounded-xl text-xs h-9 border border-border/40 hover:bg-secondary text-muted-foreground"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Submodal for Schedule & Automation */}
    {showScheduleModal && (
      <ShopifyScheduleModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
      />
    )}
  </>
  );
}
