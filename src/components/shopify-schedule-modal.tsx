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
  Clock,
  Zap,
  Calendar,
  RefreshCw,
  Sliders,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

interface ShopifyScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShopifyScheduleModal({ open, onOpenChange }: ShopifyScheduleModalProps) {
  const {
    businessProfile,
    updateShopifyScheduleSettings,
    autoSyncShopifyNow,
  } = useData();
  const { toast } = useToast();
  const { user } = useUser();

  const [realtimeEnabled, setRealtimeEnabled] = useState(
    businessProfile?.shopifyRealtimeSyncEnabled !== undefined
      ? Boolean(businessProfile.shopifyRealtimeSyncEnabled)
      : false
  );
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(
    businessProfile?.shopifyAutoSyncEnabled !== undefined
      ? Boolean(businessProfile.shopifyAutoSyncEnabled)
      : false
  );
  const [scheduleType, setScheduleType] = useState<'recurring' | 'custom_datetime'>(
    businessProfile?.shopifySyncFrequency === 'custom_datetime' ? 'custom_datetime' : 'recurring'
  );
  const [frequency, setFrequency] = useState<
    '1_min' | '5_mins' | '15_mins' | '30_mins' | '1_hour' | '6_hours' | '12_hours' | 'daily' | 'weekly'
  >(
    businessProfile?.shopifySyncFrequency && businessProfile.shopifySyncFrequency !== 'custom_datetime' && businessProfile.shopifySyncFrequency !== 'realtime'
      ? (businessProfile.shopifySyncFrequency as any)
      : 'daily'
  );
  const [syncTime, setSyncTime] = useState(businessProfile?.shopifySyncTime || '09:00');
  const [syncDay, setSyncDay] = useState(businessProfile?.shopifySyncDay || 'monday');

  // Helper date/time functions
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseDateTime = (dtStr?: string) => {
    if (dtStr && dtStr.includes('T')) {
      const [d, t] = dtStr.split('T');
      return { date: d || getTomorrowDate(), time: (t || '09:00').slice(0, 5) };
    }
    return { date: getTomorrowDate(), time: '09:00' };
  };

  const initialDt = parseDateTime(businessProfile?.shopifyScheduledDateTime);
  const [scheduledDate, setScheduledDate] = useState(initialDt.date);
  const [scheduledTime, setScheduledTime] = useState(initialDt.time);

  const scheduledDateTime = `${scheduledDate}T${scheduledTime}`;

  const setFullDateTime = (isoString: string) => {
    const [d, t] = isoString.split('T');
    if (d) setScheduledDate(d);
    if (t) setScheduledTime(t.slice(0, 5));
  };

  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever modal opens or businessProfile changes
  useEffect(() => {
    if (open && businessProfile) {
      setRealtimeEnabled(
        businessProfile.shopifyRealtimeSyncEnabled !== undefined
          ? Boolean(businessProfile.shopifyRealtimeSyncEnabled)
          : false
      );
      setAutoSyncEnabled(
        businessProfile.shopifyAutoSyncEnabled !== undefined
          ? Boolean(businessProfile.shopifyAutoSyncEnabled)
          : false
      );
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
        const parsed = parseDateTime(businessProfile.shopifyScheduledDateTime);
        setScheduledDate(parsed.date);
        setScheduledTime(parsed.time);
      }
    }
  }, [open, businessProfile]);

  // Handle Real-Time Sync Toggle with immediate automatic Shopify sync
  const handleRealtimeToggle = async (checked: boolean) => {
    setRealtimeEnabled(checked);
    try {
      await updateShopifyScheduleSettings({
        shopifyRealtimeSyncEnabled: checked,
      });

      if (checked) {
        toast({
          title: 'Real-Time Auto-Sync Active! ⚡',
          description: 'Syncing live data from Shopify now. Real-time changes will reflect instantly.',
        });

        // Directly trigger Shopify sync immediately as soon as toggle is turned on
        autoSyncShopifyNow(true);

        // Silently register webhooks in background if applicable
        if (businessProfile?.shopifyStoreUrl) {
          fetch('/api/shopify/webhooks/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop: businessProfile.shopifyStoreUrl,
              ...(businessProfile?.shopifyAccessToken ? { accessToken: businessProfile.shopifyAccessToken } : {}),
            }),
          }).catch(() => {});
        }
      } else {
        toast({
          title: 'Real-Time Sync Paused',
          description: 'Automatic real-time sync is now paused. You can sync manually anytime.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error Updating Sync Setting',
        description: err.message || 'Could not update sync preference.',
      });
    }
  };

  // Handle Scheduled Auto-Sync Toggle
  const handleAutoSyncToggle = async (checked: boolean) => {
    setAutoSyncEnabled(checked);
    try {
      const chosenFrequency = scheduleType === 'custom_datetime' ? 'custom_datetime' : frequency;
      await updateShopifyScheduleSettings({
        shopifyAutoSyncEnabled: checked,
        shopifySyncFrequency: chosenFrequency,
        shopifySyncTime: syncTime,
        shopifySyncDay: syncDay,
        shopifyScheduledDateTime: scheduleType === 'custom_datetime' ? scheduledDateTime : '',
      });

      if (checked) {
        toast({
          title: 'Scheduled Auto-Sync Set! ⏰',
          description: scheduleType === 'custom_datetime'
            ? `Store will automatically sync on ${scheduledDate} at ${scheduledTime}.`
            : `Scheduled auto-sync active (${chosenFrequency}).`,
        });
      } else {
        toast({
          title: 'Scheduled Auto-Sync Paused',
          description: 'Scheduled sync paused. Manual sync is still available.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error Updating Auto-Sync',
        description: err.message || 'Could not update schedule preference.',
      });
    }
  };

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
        shopifyScheduledDateTime: scheduleType === 'custom_datetime' ? scheduledDateTime : '',
      });

      // Only trigger immediate sync if Real-Time sync was just newly activated
      if (realtimeEnabled && !businessProfile?.shopifyRealtimeSyncEnabled) {
        autoSyncShopifyNow(true);
      }

      // Background webhook registration
      if (businessProfile?.shopifyStoreUrl) {
        fetch('/api/shopify/webhooks/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: businessProfile.shopifyStoreUrl,
            ...(businessProfile?.shopifyAccessToken ? { accessToken: businessProfile.shopifyAccessToken } : {}),
          }),
        }).catch(console.warn);
      }

      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md max-w-full ios-glass rounded-3xl p-4 sm:p-6 border-border/50 text-foreground max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold flex items-center gap-2 truncate">
                Shopify Sync & Automation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-2">
                Set real-time instant sync and scheduled auto-sync for catalog & sales.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* OPTION 1: REAL-TIME INSTANT SYNC */}
          <div className={cn(
            "p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 overflow-hidden",
            realtimeEnabled
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-secondary/20 border-border/40"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-foreground text-sm">Real-Time Sync</span>
                  {realtimeEnabled && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] py-0 px-2 shrink-0">
                      Live Event-Driven
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Automatically syncs orders, products, and inventory the exact moment changes occur on Shopify. Zero continuous API polling.
                </p>
              </div>
              <Switch
                checked={realtimeEnabled}
                onCheckedChange={handleRealtimeToggle}
                className="shrink-0"
              />
            </div>

            {realtimeEnabled && (
              <div className="pt-3 border-t border-emerald-500/20 space-y-3 text-[11px]">
                <div className="p-3 rounded-xl bg-background/60 border border-emerald-500/25 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Instant Event-Driven Sync Active</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Whenever a sale, refund, or stock change occurs in Shopify, it is instantly pushed and reflected in your AnalyzeUp analytics with zero manual clicks.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-1 text-[10px] text-emerald-400 font-medium">
                    <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      <span>Live Order Reflection</span>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      <span>Instant Stock Sync</span>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      <span>Zero API Polling</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* OPTION 2: SCHEDULED AUTO-SYNC */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-secondary/30 border border-border/40 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-bold text-foreground text-sm truncate">Scheduled Auto-Sync</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Set specific date & time or recurring automated synchronization.
                </p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={handleAutoSyncToggle}
                className="shrink-0"
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

                {/* MODE A: CUSTOM SPECIFIC DATE & TIME (SEPARATE DATE AND TIME FIELDS) */}
                {scheduleType === 'custom_datetime' && (
                  <div className="space-y-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        Set Automatic Sync Date & Time
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {scheduledDate} • {scheduledTime}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Separate Date Field */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-400" />
                          <span>Sync Date</span>
                        </Label>
                        <Input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="text-xs rounded-xl h-9 bg-background/80 border-border/60 font-medium"
                        />
                      </div>

                      {/* Separate Time Field */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>Sync Time</span>
                        </Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="text-xs rounded-xl h-9 bg-background/80 border-border/60 font-medium"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1 pt-1 border-t border-border/30">
                      <span className="text-[10px] text-muted-foreground block font-medium">Quick Presets:</span>
                      <div className="flex flex-wrap gap-1.5">
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
                            onClick={() => setFullDateTime(preset.calc())}
                            className="text-[10px] py-1 px-2 rounded-lg bg-secondary border border-border/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer font-medium"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
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
                          <SelectItem value="1_min">Every 1 Minute (Fast Auto-Sync & Testing)</SelectItem>
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
