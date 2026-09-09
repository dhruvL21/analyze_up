'use client';

import React, { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useData } from '@/context/data-context';
import {
  formatShopifyScheduleSummary,
  getNextShopifySyncDisplay,
} from '@/lib/shopify-sync-helper';
import {
  Clock,
  Zap,
  Calendar,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShopifyScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShopifyScheduleModal({ open, onOpenChange }: ShopifyScheduleModalProps) {
  const {
    businessProfile,
    updateShopifyScheduleSettings,
    autoSyncShopifyNow,
    isShopifySyncing,
  } = useData();

  const [realtimeEnabled, setRealtimeEnabled] = useState(
    businessProfile?.shopifyRealtimeSyncEnabled ?? true
  );
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(
    businessProfile?.shopifyAutoSyncEnabled ?? true
  );
  const [scheduleType, setScheduleType] = useState<'recurring' | 'custom_datetime'>(
    businessProfile?.shopifySyncFrequency === 'custom_datetime' ? 'custom_datetime' : 'recurring'
  );
  const [frequency, setFrequency] = useState<
    '1_min' | '5_mins' | '15_mins' | '30_mins' | '1_hour' | '6_hours' | '12_hours' | 'daily' | 'weekly'
  >(
    businessProfile?.shopifySyncFrequency && businessProfile.shopifySyncFrequency !== 'custom_datetime' && businessProfile.shopifySyncFrequency !== 'realtime'
      ? (businessProfile.shopifySyncFrequency as any)
      : '1_min'
  );
  const [syncTime, setSyncTime] = useState(businessProfile?.shopifySyncTime || '09:00');
  const [syncDay, setSyncDay] = useState(businessProfile?.shopifySyncDay || 'monday');

  // Default target date/time: tomorrow at 09:00 local time
  const getTomorrowDefault = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T09:00`;
  };

  const [scheduledDateTime, setScheduledDateTime] = useState(
    businessProfile?.shopifyScheduledDateTime || getTomorrowDefault()
  );

  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever modal opens or businessProfile changes
  useEffect(() => {
    if (open && businessProfile) {
      setRealtimeEnabled(businessProfile.shopifyRealtimeSyncEnabled ?? true);
      setAutoSyncEnabled(businessProfile.shopifyAutoSyncEnabled ?? true);
      if (businessProfile.shopifySyncFrequency === 'custom_datetime') {
        setScheduleType('custom_datetime');
      } else {
        setScheduleType('recurring');
        if (
          businessProfile.shopifySyncFrequency &&
          businessProfile.shopifySyncFrequency !== 'realtime'
        ) {
          setFrequency(businessProfile.shopifySyncFrequency as any);
        }
      }
      if (businessProfile.shopifySyncTime) setSyncTime(businessProfile.shopifySyncTime);
      if (businessProfile.shopifySyncDay) setSyncDay(businessProfile.shopifySyncDay);
      if (businessProfile.shopifyScheduledDateTime) {
        setScheduledDateTime(businessProfile.shopifyScheduledDateTime);
      }
    }
  }, [open, businessProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const chosenFrequency = scheduleType === 'custom_datetime'
        ? 'custom_datetime'
        : frequency;

      await updateShopifyScheduleSettings({
        shopifyRealtimeSyncEnabled: realtimeEnabled,
        shopifyAutoSyncEnabled: autoSyncEnabled,
        shopifySyncFrequency: chosenFrequency,
        shopifySyncTime: syncTime,
        shopifySyncDay: syncDay,
        shopifyScheduledDateTime: scheduleType === 'custom_datetime' ? (scheduledDateTime || '') : '',
      });

      // Register webhooks in background if store is connected
      if (businessProfile?.shopifyStoreUrl && businessProfile?.shopifyAccessToken) {
        fetch('/api/shopify/webhooks/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: businessProfile.shopifyStoreUrl,
            accessToken: businessProfile.shopifyAccessToken,
          }),
        }).catch(console.warn);
      }

      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const previewProfile = {
    shopifyConnected: true,
    shopifyStoreUrl: businessProfile?.shopifyStoreUrl,
    shopifyRealtimeSyncEnabled: realtimeEnabled,
    shopifySyncFrequency: scheduleType === 'custom_datetime'
      ? 'custom_datetime'
      : frequency,
    shopifySyncTime: syncTime,
    shopifySyncDay: syncDay,
    shopifyScheduledDateTime: scheduledDateTime,
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md ios-glass rounded-3xl p-6 border-border/50 text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Shopify Sync & Automation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set real-time instant sync and scheduled auto-sync for catalog & sales.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3 text-xs">
          {/* OPTION 1: REAL-TIME INSTANT SYNC */}
          <div className={cn(
            "p-4 rounded-2xl border transition-all space-y-3",
            realtimeEnabled
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-secondary/20 border-border/40"
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-foreground text-sm">Real-Time Sync</span>
                  {realtimeEnabled && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] py-0 px-2">
                      Live
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Whenever a sale happens or a product is added/updated in Shopify, immediately sync into AnalyzeUp to recalculate predictions and insights.
                </p>
              </div>
              <Switch
                checked={realtimeEnabled}
                onCheckedChange={setRealtimeEnabled}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            {realtimeEnabled && (
              <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-[10px] text-emerald-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Webhook Orders & Catalog</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Instant Model Ingestion</span>
                </div>
              </div>
            )}
          </div>

          {/* OPTION 2: SCHEDULED AUTO-SYNC */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="font-bold text-foreground text-sm">Scheduled Auto-Sync</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Set specific date & time or recurring automated synchronization.
                </p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
              />
            </div>

            {autoSyncEnabled && (
              <div className="space-y-4 pt-2 border-t border-border/30">
                {/* Schedule Type Selection */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Schedule Mode
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleType('custom_datetime')}
                      className={cn(
                        "py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        scheduleType === 'custom_datetime'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Set Date & Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleType('recurring')}
                      className={cn(
                        "py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        scheduleType === 'recurring'
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Recurring Schedule
                    </button>
                  </div>
                </div>

                {/* MODE A: CUSTOM SPECIFIC DATE & TIME */}
                {scheduleType === 'custom_datetime' && (
                  <div className="space-y-2.5 p-3 rounded-xl bg-secondary/40 border border-border/40">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      Set Automatic Sync Date & Time
                    </Label>
                    <Input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="text-xs rounded-xl h-9 bg-background/60 border-border/60"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        {
                          label: 'In 1 Minute',
                          calc: () => {
                            const d = new Date(Date.now() + 60 * 1000);
                            return d.toISOString().slice(0, 16);
                          },
                        },
                        {
                          label: 'In 5 Minutes',
                          calc: () => {
                            const d = new Date(Date.now() + 5 * 60 * 1000);
                            return d.toISOString().slice(0, 16);
                          },
                        },
                        {
                          label: '+1 Hour',
                          calc: () => {
                            const d = new Date(Date.now() + 60 * 60 * 1000);
                            return d.toISOString().slice(0, 16);
                          },
                        },
                        {
                          label: 'Tomorrow 9 AM',
                          calc: () => {
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T09:00`;
                          },
                        },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setScheduledDateTime(preset.calc())}
                          className="text-[10px] py-1 px-2 rounded-lg bg-secondary border border-border/40 hover:bg-secondary/80 text-muted-foreground transition-all cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* MODE B: RECURRING INTERVAL */}
                {scheduleType === 'recurring' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Sync Frequency</Label>
                      <Select
                        value={frequency}
                        onValueChange={(val: any) => setFrequency(val)}
                      >
                        <SelectTrigger className="w-full rounded-xl text-xs bg-secondary/40 border-border/60">
                          <SelectValue placeholder="Select Frequency" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="1_min">⚡ Every 1 Minute (Fast Auto-Sync & Testing)</SelectItem>
                          <SelectItem value="5_mins">Every 5 Minutes</SelectItem>
                          <SelectItem value="15_mins">Every 15 Minutes</SelectItem>
                          <SelectItem value="30_mins">Every 30 Minutes</SelectItem>
                          <SelectItem value="1_hour">Every 1 Hour</SelectItem>
                          <SelectItem value="6_hours">Every 6 Hours</SelectItem>
                          <SelectItem value="12_hours">Every 12 Hours</SelectItem>
                          <SelectItem value="daily">Daily (Once per day at set time)</SelectItem>
                          <SelectItem value="weekly">Weekly (Once per week on set day)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Day of Week Selector (Weekly only) */}
                    {frequency === 'weekly' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">Day of Week</Label>
                        <Select value={syncDay} onValueChange={setSyncDay}>
                          <SelectTrigger className="w-full rounded-xl text-xs bg-secondary/40 border-border/60 capitalize">
                            <SelectValue placeholder="Select Day" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
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
                    {(frequency === 'daily' || frequency === 'weekly') && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-foreground">Sync Time (Local)</Label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { label: '9:00 AM', value: '09:00' },
                            { label: '12:00 PM', value: '12:00' },
                            { label: '6:00 PM', value: '18:00' },
                            { label: '11:59 PM', value: '23:59' },
                          ].map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setSyncTime(preset.value)}
                              className={cn(
                                "py-1.5 px-2 rounded-xl text-[11px] font-medium border text-center transition-all cursor-pointer",
                                syncTime === preset.value
                                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                                  : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary"
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">Custom time:</span>
                          <Input
                            type="time"
                            value={syncTime}
                            onChange={(e) => setSyncTime(e.target.value)}
                            className="h-8 w-32 text-xs rounded-xl bg-secondary/40 border-border/60"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ACTIVE SUMMARY PREVIEW PILL */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between text-emerald-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="space-y-0.5">
                <span className="block font-bold text-foreground">
                  {formatShopifyScheduleSummary(previewProfile)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Next Check: {getNextShopifySyncDisplay(previewProfile)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isShopifySyncing}
              onClick={() => autoSyncShopifyNow(true)}
              className="rounded-xl text-[11px] h-7 px-2.5 text-emerald-400 hover:bg-emerald-500/20 gap-1"
            >
              <RefreshCw className={cn("w-3 h-3", isShopifySyncing && "animate-spin")} />
              Sync Now
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs h-9 px-4 border-border/60 hover:bg-secondary"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl text-xs font-bold px-4 h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
