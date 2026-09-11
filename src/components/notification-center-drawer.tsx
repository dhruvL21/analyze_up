'use client';

import React, { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  Bell,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Activity,
  Filter,
  Bot,
  Truck,
  Boxes,
  Coins,
  PackageX,
  X,
} from 'lucide-react';
import {
  detectBusinessEvents,
  getStoredEventStatuses,
  saveEventStatus,
  clearAllEventStatuses,
} from '@/lib/business-event-engine';
import { BusinessEvent, EventSeverity, EventStatus } from '@/lib/types';

interface NotificationCenterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationCenterDrawer({ open, onOpenChange }: NotificationCenterDrawerProps) {
  const { products, transactions, suppliers, orders, returns, businessProfile } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [eventStatuses, setEventStatuses] = useState<Record<string, EventStatus>>({});
  const [detectedEvents, setDetectedEvents] = useState<BusinessEvent[]>([]);

  // Sync stored event statuses on drawer open or window update
  React.useEffect(() => {
    const sync = () => setEventStatuses(getStoredEventStatuses());
    sync();
    window.addEventListener('analyzeup_events_updated', sync);
    return () => window.removeEventListener('analyzeup_events_updated', sync);
  }, [open]);

  // This can run several large-data intelligence engines. Defer it until the
  // drawer is visible so opening the menu never blocks the rest of the page.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const calculate = () => {
      const nextEvents = detectBusinessEvents(products, transactions, suppliers, orders, returns, businessProfile);
      if (!cancelled) setDetectedEvents(nextEvents);
    };
    const idleId = window.setTimeout(calculate, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(idleId);
    };
  }, [open, products, transactions, suppliers, orders, returns, businessProfile]);

  // Apply user status overrides
  const events = useMemo(() => {
    return detectedEvents.map(e => ({
      ...e,
      status: eventStatuses[e.id] || e.status,
    }));
  }, [detectedEvents, eventStatuses]);

  // Filter events (exclude RESOLVED/dismissed notifications)
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (e.status === 'RESOLVED') return false;
      if (selectedSeverity === 'ALL') return true;
      return e.severity === selectedSeverity;
    });
  }, [events, selectedSeverity]);

  const activeCount = events.filter(e => e.status !== 'RESOLVED').length;

  const handleAcknowledge = (eventId: string) => {
    saveEventStatus(eventId, 'ACKNOWLEDGED');
    setEventStatuses(prev => ({ ...prev, [eventId]: 'ACKNOWLEDGED' }));
    toast({ title: 'Event Acknowledged', description: 'Marked as reviewed.' });
  };

  const handleDismiss = (eventId: string) => {
    saveEventStatus(eventId, 'RESOLVED');
    setEventStatuses(prev => ({ ...prev, [eventId]: 'RESOLVED' }));
    toast({ title: 'Notification Dismissed', description: 'Notification removed from active alerts.' });
  };

  const handleDismissAll = () => {
    const ids = events.map(e => e.id);
    clearAllEventStatuses(ids);
    const updated: Record<string, EventStatus> = {};
    ids.forEach(id => {
      updated[id] = 'RESOLVED';
    });
    setEventStatuses(updated);
    toast({ title: 'All Notifications Cleared', description: 'All active alerts marked as resolved.' });
  };

  const handleExecuteAction = (event: BusinessEvent) => {
    setEventStatuses(prev => ({ ...prev, [event.id]: 'ACTION_TAKEN' }));

    if (event.actionPayload?.targetRoute) {
      router.push(event.actionPayload.targetRoute);
      onOpenChange(false);
      toast({
        title: `Executing Action: ${event.title}`,
        description: `Navigating to target module.`,
      });
    }
  };

  const handleAskCopilot = (event: BusinessEvent) => {
    onOpenChange(false);
    // Dispatch custom event for ChatWidget to capture and open with query
    const customEvt = new CustomEvent('analyzeup_open_copilot', {
      detail: { query: `Why did this happen: ${event.title}? ${event.description}` },
    });
    window.dispatchEvent(customEvt);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95vw] sm:max-w-md p-6 ios-glass flex flex-col justify-between">
        {/* Header */}
        <SheetHeader className="pb-3 border-b border-border/40 space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Bell className="w-4.5 h-4.5" />
              </div>
              Business Monitoring Alerts
            </SheetTitle>
            {activeCount > 0 && (
              <Badge className="bg-rose-500 text-white font-bold text-xs">
                {activeCount} Active Alerts
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <SheetDescription className="text-xs text-muted-foreground">
              Continuous event engine monitoring stockouts, margin erosion, vendor risks, and return rate surges.
            </SheetDescription>
            {activeCount > 0 && (
              <button
                onClick={handleDismissAll}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline shrink-0"
              >
                Clear All
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1.5 py-2 overflow-x-auto border-b border-border/30 text-xs">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all shrink-0 ${
                selectedSeverity === sev
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {sev === 'ALL' ? 'All Alerts' : `${sev} Priority`}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-thin">
          {filteredEvents.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <h4 className="font-bold text-sm text-foreground">Zero Active Critical Alerts</h4>
              <p className="text-xs text-muted-foreground max-w-xs">
                Your business operations, inventory levels, and margins are running within normal parameters.
              </p>
            </div>
          ) : (
            filteredEvents.map(event => (
              <div
                key={event.id}
                className={`p-3.5 rounded-2xl border space-y-2.5 transition-all text-xs ${
                  event.severity === 'CRITICAL'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : event.severity === 'HIGH'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-secondary/30 border-border/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge
                      className={`text-[10px] font-bold uppercase mb-1 ${
                        event.severity === 'CRITICAL'
                          ? 'bg-rose-500 text-white'
                          : event.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {event.severity} • {event.category}
                    </Badge>
                    <h4 className="font-bold text-foreground text-sm leading-snug">{event.title}</h4>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      Impact: {event.impactScore}/100
                    </span>
                    <button
                      onClick={() => handleDismiss(event.id)}
                      className="p-1 rounded-full text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Dismiss notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-muted-foreground text-[11px] leading-relaxed">{event.description}</p>

                {/* Footer Action Buttons */}
                <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleAskCopilot(event)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Bot className="w-3.5 h-3.5 text-primary" /> Ask Copilot
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDismiss(event.id)}
                      className="text-[11px] text-muted-foreground hover:text-rose-400 font-semibold px-2 py-1"
                    >
                      Dismiss
                    </button>
                    {event.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleAcknowledge(event.id)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-semibold px-2 py-1"
                      >
                        Acknowledge
                      </button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-[11px] font-bold rounded-xl gap-1 bg-primary text-primary-foreground hover:brightness-110"
                      onClick={() => handleExecuteAction(event)}
                    >
                      Execute <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="pt-3 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
          <span>Continuous Monitoring Active</span>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => {
              router.push('/dashboard/settings');
              onOpenChange(false);
            }}
          >
            Notification Settings
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
