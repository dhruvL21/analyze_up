'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useData } from '@/context/data-context';
import { BusinessType, BusinessSize } from '@/lib/types';
import { INDUSTRY_CONFIGS } from '@/lib/industry-intelligence';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Building2,
  PackagePlus,
  FileSpreadsheet,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Zap,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const BUSINESS_TYPES: BusinessType[] = [
  'Retail',
  'Wholesale',
  'Manufacturing',
  'Restaurant',
  'Cafe',
  'Electronics',
  'Fashion',
  'Beauty',
  'Medical',
  'Hardware',
  'Automotive',
  'Sports',
  'Books',
  'Furniture',
  'Other',
];

const BUSINESS_SIZES: BusinessSize[] = [
  'Solo',
  '2-10 Employees',
  '11-50 Employees',
  '50+',
];

const CURRENCIES = [
  { code: 'INR (₹)', symbol: '₹' },
  { code: 'USD ($)', symbol: '$' },
  { code: 'EUR (€)', symbol: '€' },
  { code: 'GBP (£)', symbol: '£' },
  { code: 'AED (Dhs)', symbol: 'Dhs' },
  { code: 'CAD ($)', symbol: 'C$' },
  { code: 'AUD ($)', symbol: 'A$' },
];

export function SmartOnboardingWizard() {
  const {
    showOnboardingWizard,
    setShowOnboardingWizard,
    businessProfile,
    updateBusinessProfile,
    loadDemoBusiness,
    setShowShopifyModal,
    setShowWelcomeModal,
  } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [businessName, setBusinessName] = useState(businessProfile?.businessName || '');
  const [businessType, setBusinessType] = useState<BusinessType>(businessProfile?.businessType || 'Retail');
  const [industry] = useState(businessProfile?.industry || 'General Retail');
  const [businessSize, setBusinessSize] = useState<BusinessSize>(businessProfile?.businessSize || '2-10 Employees');
  const [currency, setCurrency] = useState(businessProfile?.currency || 'INR (₹)');
  const [timezone] = useState(businessProfile?.timezone || 'Asia/Kolkata');
  const [country, setCountry] = useState(businessProfile?.country || 'India');
  const [language] = useState(businessProfile?.language || 'English');
  const [logoUrl, setLogoUrl] = useState(businessProfile?.logoUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file (PNG, JPG, SVG, WebP).'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image must be under 5MB.'));
        return;
      }

      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read SVG file.'));
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 400;
          let { width, height } = img;
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const dataUrl = canvas.toDataURL('image/webp', 0.88);
            resolve(dataUrl);
          } catch {
            resolve(canvas.toDataURL('image/png'));
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelected = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const dataUrl = await processImageFile(file);
      setLogoUrl(dataUrl);
      await updateBusinessProfile({
        businessName: businessName || 'My Business',
        businessType,
        industry,
        businessSize,
        currency,
        timezone,
        country,
        language,
        logoUrl: dataUrl,
      }, true);
      toast({
        title: 'Logo Uploaded! 🎨',
        description: 'Your business logo is ready.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: err?.message || 'Could not process image file.',
      });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    await updateBusinessProfile({
      businessName: businessName || 'My Business',
      businessType,
      industry,
      businessSize,
      currency,
      timezone,
      country,
      language,
      logoUrl: '',
    }, true);
    toast({
      title: 'Logo Cleared',
      description: 'Business logo removed.',
    });
  };

  const handleAutoSave = async () => {
    try {
      await updateBusinessProfile({
        businessName: businessName || 'My Business',
        businessType,
        industry,
        businessSize,
        currency,
        timezone,
        country,
        language,
        logoUrl,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast({ variant: 'destructive', title: 'Business Name Required', description: 'Please enter your business name to continue.' });
      return;
    }
    handleAutoSave();
    setStep(2);
  };

  const handleSelectSetupMethod = async (method: 'manual' | 'csv' | 'shopify' | 'demo') => {
    setLoading(true);
    try {
      await updateBusinessProfile({
        businessName: businessName || 'My Business',
        businessType,
        industry,
        businessSize,
        currency,
        timezone,
        country,
        language,
        logoUrl,
        inventorySetupMethod: method,
        isOnboardingCompleted: true,
      });

      setShowOnboardingWizard(false);

      if (method === 'demo') {
        await loadDemoBusiness(businessType);
      } else if (method === 'shopify') {
        setShowShopifyModal(true);
      } else if (method === 'csv') {
        router.push('/dashboard/inventory?action=import');
        toast({ title: 'Setup Complete', description: 'Opening CSV / Excel import wizard.' });
      } else {
        setShowWelcomeModal(true);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Setup Error', description: 'Failed to complete business setup.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await updateBusinessProfile({
      businessName: businessName || 'My Business',
      businessType,
      isOnboardingCompleted: true,
    });
    setShowOnboardingWizard(false);
    toast({ title: 'Wizard Paused', description: 'You can update your business profile anytime in Settings.' });
  };

  if (!showOnboardingWizard) return null;

  return (
    <Dialog open={showOnboardingWizard} onOpenChange={setShowOnboardingWizard}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[85vh] overflow-y-auto ios-glass rounded-3xl border border-primary/20 p-5 sm:p-6 md:p-8 shadow-2xl">
        {/* Glow backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Progress Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3.5 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/15 text-primary border border-primary/25">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                {step === 1 ? 'Smart Business Setup' : 'Choose Inventory Setup Method'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {step === 1 ? 'Step 1 of 2 — Personalize your AI Business Copilot' : 'Step 2 of 2 — How would you like to populate your catalog?'}
              </DialogDescription>
            </div>
          </div>

          <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-xs px-3 py-1 font-bold">
            Step {step} / 2
          </Badge>
        </div>

        {step === 1 ? (
          <form onSubmit={handleNextStep1} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Business Name */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="biz-name" className="text-xs font-semibold">Business Name *</Label>
                <Input
                  id="biz-name"
                  placeholder="e.g. Apex Apparel & Accessories"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onBlur={handleAutoSave}
                  className="rounded-xl text-sm"
                  required
                />
              </div>

              {/* Business Type */}
              <div className="space-y-1.5">
                <Label htmlFor="biz-type" className="text-xs font-semibold">Business Type</Label>
                <Select
                  value={businessType}
                  onValueChange={(val: BusinessType) => {
                    setBusinessType(val);
                    handleAutoSave();
                  }}
                >
                  <SelectTrigger id="biz-type" className="rounded-xl text-sm">
                    <SelectValue placeholder="Select Business Type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {BUSINESS_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Business Size */}
              <div className="space-y-1.5">
                <Label htmlFor="biz-size" className="text-xs font-semibold">Team / Business Size</Label>
                <Select
                  value={businessSize}
                  onValueChange={(val: BusinessSize) => {
                    setBusinessSize(val);
                    handleAutoSave();
                  }}
                >
                  <SelectTrigger id="biz-size" className="rounded-xl text-sm">
                    <SelectValue placeholder="Select Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_SIZES.map((bs) => (
                      <SelectItem key={bs} value={bs}>
                        {bs}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Currency */}
              <div className="space-y-1.5">
                <Label htmlFor="biz-currency" className="text-xs font-semibold">Base Currency</Label>
                <Select
                  value={currency}
                  onValueChange={(val) => {
                    setCurrency(val);
                    handleAutoSave();
                  }}
                >
                  <SelectTrigger id="biz-currency" className="rounded-xl text-sm">
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Country */}
              <div className="space-y-1.5">
                <Label htmlFor="biz-country" className="text-xs font-semibold">Country</Label>
                <Input
                  id="biz-country"
                  placeholder="e.g. India, United States"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  onBlur={handleAutoSave}
                  className="rounded-xl text-sm"
                />
              </div>

              {/* Logo Upload & URL Option */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="biz-logo" className="text-xs font-semibold flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    Business Logo (Optional)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">PNG, JPG, SVG, WebP up to 5MB</span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                  className="hidden"
                />

                {logoUrl ? (
                  <div className="p-3 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-background border border-border/80 flex items-center justify-center shrink-0 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">Logo Attached</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                          {logoUrl.startsWith('data:') ? 'Custom uploaded image' : logoUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingLogo}
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl text-xs h-8 px-3 gap-1 border-border/60 hover:bg-secondary"
                      >
                        {isUploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        <span>Change</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLogo}
                        className="rounded-xl text-xs h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Click & Drag/Drop Upload Area */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileSelected(file);
                      }}
                      className={cn(
                        "group cursor-pointer rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center gap-2 transition-all bg-secondary/15 hover:bg-secondary/35",
                        isDragging ? "border-primary bg-primary/10 scale-[0.99]" : "border-border/60 hover:border-primary/50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                        {isUploadingLogo ? (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        ) : (
                          <UploadCloud className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Click to upload logo <span className="font-normal text-muted-foreground">or drag & drop</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Upload from your computer (auto-resized for performance)
                        </p>
                      </div>
                    </div>

                    {/* Or paste URL toggle / field */}
                    <div className="pt-0.5">
                      {!showUrlInput ? (
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(true)}
                          className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <LinkIcon className="w-3 h-3" />
                          Or paste an image URL instead
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div className="relative flex-1">
                            <Input
                              id="biz-logo"
                              placeholder="https://example.com/logo.png"
                              value={logoUrl}
                              onChange={(e) => setLogoUrl(e.target.value)}
                              onBlur={handleAutoSave}
                              className="rounded-xl text-xs h-8 pl-7"
                            />
                            <LinkIcon className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowUrlInput(false)}
                            className="text-[11px] h-8 px-2 text-muted-foreground"
                          >
                            Hide
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Industry AI Intelligence Info Box */}
            <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/15 text-primary shrink-0 border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-primary">Tailored AI Insights Active</p>
                <p className="text-muted-foreground leading-relaxed mt-0.5">{INDUSTRY_CONFIGS[businessType]?.aiPriority}</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-3">
              <Button type="button" variant="ghost" onClick={handleSkip} className="rounded-xl text-xs text-muted-foreground hover:text-foreground">
                Skip for now
              </Button>
              <Button type="submit" className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground shadow-md font-bold px-5 h-10">
                Next: Inventory Setup
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select how you want to initialize your products. You can always import or create more products anytime.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: Manual Entry */}
              <div
                onClick={() => handleSelectSetupMethod('manual')}
                className="p-4 rounded-2xl bg-secondary/40 border border-border/50 hover:border-primary/40 transition-all cursor-pointer space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <PackagePlus className="w-5 h-5 text-primary" />
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 font-semibold">Manual</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Create Single Product</h4>
                  <p className="text-xs text-muted-foreground mt-1">Add your products one-by-one with price, cost, and stock parameters.</p>
                </div>
              </div>

              {/* Option 2: CSV / Excel Import */}
              <div
                onClick={() => handleSelectSetupMethod('csv')}
                className="p-4 rounded-2xl bg-secondary/40 border border-border/50 hover:border-primary/40 transition-all cursor-pointer space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 font-semibold">Bulk</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Bulk CSV / Excel Import</h4>
                  <p className="text-xs text-muted-foreground mt-1">Upload your existing spreadsheet to automatically map catalog fields.</p>
                </div>
              </div>

              {/* Option 3: Shopify Sync */}
              <div
                onClick={() => handleSelectSetupMethod('shopify')}
                className="p-4 rounded-2xl bg-secondary/40 border border-border/50 hover:border-primary/40 transition-all cursor-pointer space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 font-semibold">Shopify</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Connect Shopify Store</h4>
                  <p className="text-xs text-muted-foreground mt-1">Sync products & inventory levels live from your e-commerce storefront.</p>
                </div>
              </div>

              {/* Option 4: Explore Demo Business */}
              <div
                onClick={() => handleSelectSetupMethod('demo')}
                className="p-4 rounded-2xl bg-secondary/40 border border-border/50 hover:border-primary/40 transition-all cursor-pointer space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <Zap className="w-5 h-5 text-primary" />
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 font-semibold">1-Click Demo</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Load Demo Business Data</h4>
                  <p className="text-xs text-muted-foreground mt-1">Pre-load 200+ products, suppliers & sales orders to test AI diagnostics.</p>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="rounded-xl text-xs gap-1.5 text-muted-foreground"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Business Setup
              </Button>
              <Button
                type="button"
                onClick={handleSkip}
                className="rounded-xl text-xs bg-secondary hover:bg-secondary/80 text-foreground font-semibold"
              >
                Skip & Open Dashboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
