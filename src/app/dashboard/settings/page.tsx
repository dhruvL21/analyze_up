"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/context/data-context";
import { BusinessType, BusinessSize } from "@/lib/types";
import { INDUSTRY_CONFIGS } from "@/lib/industry-intelligence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, Loader2, X, Sparkles, Building2, Zap, Trash2, RefreshCw, LogOut, Sun, Moon, KeyRound, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle, Download, UploadCloud, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { useUser, useAuth } from "@/firebase";
import { signOut, updateUserPassword } from "@/firebase/auth/auth-service";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      sessionStorage.removeItem("analyzeup_free_trial_session_prompted");
      router.push('/');
    }
  };
  const {
    clearAllData,
    activePlan,
    isProcessingPayment,
    handleUpgrade,
    businessProfile,
    updateBusinessProfile,
    loadDemoBusiness,
    hasDemoData,
    isLoadingDemo,
    setShowOnboardingWizard,
    products,
    transactions,
    suppliers,
    returns,
  } = useData();

  const [bizName, setBizName] = useState(businessProfile?.businessName || "My Business");
  const [bizType, setBizType] = useState<BusinessType>(businessProfile?.businessType || "Retail");
  const [bizSize, setBizSize] = useState<BusinessSize>(businessProfile?.businessSize || "2-10 Employees");
  const [currency, setCurrency] = useState(businessProfile?.currency || "INR (₹)");
  const [country, setCountry] = useState(businessProfile?.country || "India");
  const [logoUrl, setLogoUrl] = useState(businessProfile?.logoUrl || "");
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
        logoUrl: dataUrl,
      }, true);
      toast({
        title: 'Logo Uploaded! 🎨',
        description: 'Your business logo has been saved.',
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
      logoUrl: '',
    }, true);
    toast({
      title: 'Logo Cleared',
      description: 'Business logo removed.',
    });
  };

  useEffect(() => {
    if (businessProfile) {
      if (businessProfile.businessName) setBizName(businessProfile.businessName);
      if (businessProfile.businessType) setBizType(businessProfile.businessType);
      if (businessProfile.businessSize) setBizSize(businessProfile.businessSize);
      if (businessProfile.currency) setCurrency(businessProfile.currency);
      if (businessProfile.country) setCountry(businessProfile.country);
      if (businessProfile.logoUrl !== undefined) setLogoUrl(businessProfile.logoUrl);
    }
  }, [businessProfile]);

  const handleSaveBusinessProfile = async () => {
    await updateBusinessProfile({
      businessName: bizName,
      businessType: bizType,
      businessSize: bizSize,
      currency: currency,
      country: country,
      logoUrl: logoUrl,
      industry: INDUSTRY_CONFIGS[bizType]?.label || "General Business",
    });
  };

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in to update your password." });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast({ variant: "destructive", title: "Invalid Password", description: "Password must be at least 6 characters long." });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords Do Not Match", description: "Please ensure both password fields match." });
      return;
    }

    setUpdatingPassword(true);
    try {
      await updateUserPassword(user, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "🔒 Password Updated Successfully!",
        description: "Your account password has been changed securely.",
      });
    } catch (err: any) {
      console.error("Password update error:", err);
      let desc = "Failed to update password. You may need to log out and log back in to verify your identity.";
      if (err.code === "auth/requires-recent-login") {
        desc = "This operation is sensitive and requires recent authentication. Please log out and sign in again before changing password.";
      }
      toast({
        variant: "destructive",
        title: "Password Update Failed",
        description: desc,
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Reset Workspace Dialog State
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const isConfirmationMatched = resetConfirmInput.trim() === "RESET DATA";

  const handleResetWorkspace = async () => {
    if (!isConfirmationMatched) {
      toast({
        variant: "destructive",
        title: "Confirmation Mismatch",
        description: 'Please type "RESET DATA" to confirm workspace reset.',
      });
      return;
    }
    setIsResetting(true);
    // Let React paint the progress state before starting Firestore work so the
    // confirmation dialog never looks like a frozen browser tab.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    try {
      await clearAllData();
      setResetDialogOpen(false);
      setResetConfirmInput("");
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Reset failed:", error);
      toast({
        variant: "destructive",
        title: "Workspace Reset Failed",
        description: "Firebase could not delete every workspace record. Please check your connection and try again.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Settings & Business Setup</h1>
          <p className="text-xs text-muted-foreground">Manage your AI Copilot profile, workspace preferences, and plan tier.</p>
        </div>

        <Button
          onClick={() => setShowOnboardingWizard(true)}
          variant="outline"
          className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Re-run Setup Wizard
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Business Profile Card */}
        <Card className="ios-glass rounded-2xl border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Business Profile & AI Personalization
                </CardTitle>
                <CardDescription className="text-xs">
                  Your business context directly customizes AI Advisor recommendations and benchmarks.
                </CardDescription>
              </div>
              <Badge className="bg-primary/15 text-primary border-primary/25 text-xs px-3 py-1">
                {INDUSTRY_CONFIGS[bizType]?.label || bizType}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="biz-name">Business Name</Label>
                <Input
                  id="biz-name"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="biz-type">Business Type</Label>
                <Select value={bizType} onValueChange={(val: BusinessType) => setBizType(val)}>
                  <SelectTrigger id="biz-type" className="rounded-xl">
                    <SelectValue placeholder="Select Business Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(INDUSTRY_CONFIGS).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="biz-size">Team Size</Label>
                <Select value={bizSize} onValueChange={(val: BusinessSize) => setBizSize(val)}>
                  <SelectTrigger id="biz-size" className="rounded-xl">
                    <SelectValue placeholder="Select Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Solo', '2-10 Employees', '11-50 Employees', '50+'].map((sz) => (
                      <SelectItem key={sz} value={sz}>
                        {sz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Base Currency</Label>
                <Select value={currency} onValueChange={(val) => setCurrency(val)}>
                  <SelectTrigger id="currency" className="rounded-xl">
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR (₹)">INR (₹)</SelectItem>
                    <SelectItem value="USD ($)">USD ($)</SelectItem>
                    <SelectItem value="EUR (€)">EUR (€)</SelectItem>
                    <SelectItem value="GBP (£)">GBP (£)</SelectItem>
                    <SelectItem value="AED (Dhs)">AED (Dhs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Business Logo Upload */}
              <div className="space-y-2 md:col-span-2 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label htmlFor="settings-biz-logo" className="text-xs font-semibold flex items-center gap-1.5">
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
                          alt="Business Logo"
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">Logo Configured</p>
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
                              id="settings-biz-logo"
                              placeholder="https://example.com/logo.png"
                              value={logoUrl}
                              onChange={(e) => setLogoUrl(e.target.value)}
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

            <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/40 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" /> Industry AI Context Active
              </div>
              <p className="text-muted-foreground">{INDUSTRY_CONFIGS[bizType]?.aiPriority}</p>
            </div>

            <Button onClick={handleSaveBusinessProfile} className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground">
              Save Business Profile
            </Button>
          </CardContent>
        </Card>

        {/* Proactive Monitoring & Notification Preferences Card */}
        <Card className="ios-glass rounded-2xl border-primary/20">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Proactive Business Monitoring & Notification Preferences
            </CardTitle>
            <CardDescription className="text-xs">
              Configure automated event monitoring thresholds, alert category filters, and auto-resolution rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Minimum Priority Filter</Label>
                <Select defaultValue="ALL">
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue placeholder="Select Minimum Priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Meaningful Alerts (Recommended)</SelectItem>
                    <SelectItem value="HIGH">High & Critical Priority Only</SelectItem>
                    <SelectItem value="CRITICAL">Critical Priority Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Alert Auto-Resolution</Label>
                <Select defaultValue="auto">
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue placeholder="Auto-Resolve Status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-Resolve when inventory is replenished (Recommended)</SelectItem>
                    <SelectItem value="manual">Manual Resolution Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <Label className="text-xs font-semibold block">Active Monitoring Categories</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="font-medium">Inventory & Stockouts</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="font-medium">Supplier & Lead Time</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="font-medium">Profit & Margin Erosion</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="font-medium">Demand Forecasting</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="font-medium">Return Rate Surges</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => toast({ title: 'Notification Preferences Saved', description: 'Updated proactive monitoring event rules.' })}
              className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground mt-2"
            >
              Save Monitoring Preferences
            </Button>
          </CardContent>
        </Card>

        {/* Compact 2-Column Grid: Appearance & Data Export */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Appearance & Theme Preferences Card */}
          <Card className="ios-glass rounded-2xl border-border/50 flex flex-col justify-between">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Moon className="w-4 h-4 text-primary" />
                Appearance & Theme
              </CardTitle>
              <CardDescription className="text-xs">
                Toggle light, dark, or follow system default theme.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  onClick={() => setTheme('light')}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-xl px-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Light</span>
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  onClick={() => setTheme('dark')}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-xl px-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Dark</span>
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  onClick={() => setTheme('system')}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-xl px-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>System</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SaaS Workspace Data Export Card */}
          <Card className="ios-glass rounded-2xl border-border/50 flex flex-col justify-between">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                SaaS Data Export
              </CardTitle>
              <CardDescription className="text-xs">
                Export workspace inventory, suppliers, orders & reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-secondary/30 border border-border/30 text-xs">
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground text-xs truncate">Workspace Archive (JSON)</h4>
                  <p className="text-muted-foreground text-[10.5px] truncate">
                    Structured records for SaaS data portability
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const dump = JSON.stringify({ businessProfile, products, transactions, suppliers, returns }, null, 2);
                    const blob = new Blob([dump], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `AnalyzeUp_Workspace_Export_${Date.now()}.json`;
                    a.click();
                    toast({ title: 'Workspace Exported', description: 'JSON archive downloaded.' });
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 border-border/40 shrink-0 h-9 px-3 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2-Column Grid: Account & Security Management */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Account & Session Card */}
          <Card className="ios-glass rounded-2xl border-border/50 flex flex-col justify-between">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-500" />
                Account & Session
              </CardTitle>
              <CardDescription className="text-xs">
                Manage your active session or log out safely.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-3">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30 text-xs">
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground text-xs truncate">Active Login</h4>
                  <p className="text-muted-foreground text-[10.5px] truncate mt-0.5">
                    Logged in as <span className="text-primary font-mono font-medium">{user?.email || 'founder@business.com'}</span>
                  </p>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="destructive"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 shrink-0 bg-rose-600 hover:bg-rose-500 text-white font-bold h-9 px-3.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </Button>
              </div>

              <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/30 text-[11px] text-muted-foreground">
                <p>Multi-tenant isolated workspace connected with your unique Firebase account.</p>
              </div>
            </CardContent>
          </Card>

          {/* Security & Password Management Card */}
          <Card className="ios-glass rounded-2xl border-border/50 flex flex-col justify-between">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                Security & Password Management
              </CardTitle>
              <CardDescription className="text-xs">
                Update your account password or credentials securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="newPassword" className="text-[11px] font-semibold">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 chars"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-8 h-9 rounded-xl bg-secondary/30 border-border/50 text-xs"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirmPassword" className="text-[11px] font-semibold">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Repeat password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-8 h-9 rounded-xl bg-secondary/30 border-border/50 text-xs"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <p className="text-[10px] text-muted-foreground">
                    Min 6 characters.
                  </p>
                  <Button
                    type="submit"
                    disabled={updatingPassword || !newPassword || !confirmPassword}
                    className="rounded-xl text-xs gap-1.5 bg-primary text-primary-foreground font-bold shadow-md h-8 px-3.5 cursor-pointer"
                  >
                    {updatingPassword ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Demo Business & Workspace Reset Maintenance Card */}
        <Card className="ios-glass rounded-2xl border-border/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Demo Data & Workspace Maintenance
            </CardTitle>
            <CardDescription className="text-xs">
              Load sample demo business data or permanently clear all workspace records.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30 text-xs">
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5 truncate">
                    Explore Demo Business
                    {hasDemoData && <Badge className="bg-emerald-500/20 text-emerald-500 text-[9px] py-0 px-1.5">Loaded</Badge>}
                  </h4>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    200+ products, 15+ suppliers & 500+ orders
                  </p>
                </div>
                <Button
                  onClick={() => loadDemoBusiness(bizType)}
                  disabled={isLoadingDemo}
                  size="sm"
                  className={cn(
                    "rounded-xl text-xs gap-1.5 bg-amber-600 hover:bg-amber-500 text-white shrink-0 h-9 px-3.5 cursor-pointer font-semibold transition-all duration-200 shadow-md",
                    isLoadingDemo && "opacity-90 shadow-lg shadow-amber-500/40 animate-pulse cursor-wait"
                  )}
                >
                  {isLoadingDemo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-100" />
                      <span>Uploading Demo...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{hasDemoData ? 'Reload Demo' : 'Load Demo'}</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs">
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-rose-500 truncate">Reset Workspace Data</h4>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    Permanently delete all workspace records
                  </p>
                </div>

                <Dialog open={resetDialogOpen} onOpenChange={(open) => {
                  setResetDialogOpen(open);
                  if (!open) setResetConfirmInput("");
                }}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="rounded-xl text-xs gap-1.5 shrink-0 h-9 px-3 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                      Reset Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl max-w-md bg-card dark:bg-zinc-950 border border-rose-500/30 p-6 shadow-2xl">
                    <DialogHeader className="space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <DialogTitle className="text-lg font-bold text-foreground">
                        Reset Entire Workspace?
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                        This action will permanently wipe all products, sales transactions, purchase orders, customer insights, demographs, simulations, and audit history. Your account login credentials and business settings will remain intact as a brand-new clean workspace.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                      <p className="text-sm font-medium text-foreground">
                        To confirm, type <span className="font-semibold text-foreground select-all">&quot;RESET DATA&quot;</span> in the box below
                      </p>

                      <Input
                        value={resetConfirmInput}
                        onChange={(e) => setResetConfirmInput(e.target.value)}
                        className="rounded-xl text-sm font-medium border-rose-500/60 focus-visible:ring-rose-500/40 focus-visible:border-rose-500 bg-secondary/50 dark:bg-zinc-900/60 h-11 px-3.5"
                        autoFocus
                      />
                    </div>

                    <DialogFooter className="flex flex-row items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setResetDialogOpen(false);
                          setResetConfirmInput("");
                        }}
                        className="rounded-xl text-xs"
                        disabled={isResetting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleResetWorkspace}
                        disabled={!isConfirmationMatched || isResetting}
                        className={cn(
                          "rounded-xl text-xs font-bold gap-1.5 transition-all",
                          !isConfirmationMatched
                            ? "bg-rose-500/10 text-rose-400/50 border border-rose-500/20 hover:bg-rose-500/10 cursor-not-allowed opacity-60"
                            : "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/25"
                        )}
                      >
                        {isResetting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Clearing Workspace...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            Permanently Reset Workspace
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
