'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuditLogs, clearAuditLogs, BusinessAuditLog } from '@/lib/audit-store';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { History, Tag, TrendingUp, PackagePlus, FileSpreadsheet, Trash2, ShieldCheck, Sparkles } from 'lucide-react';

interface AuditLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogModal({ open, onOpenChange }: AuditLogModalProps) {
  const { user } = useUser();
  const [logs, setLogs] = useState<BusinessAuditLog[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const { toast } = useToast();

  const loadLogs = () => {
    setLogs(user?.uid ? getAuditLogs(user.uid) : []);
  };

  useEffect(() => {
    if (open) {
      loadLogs();
    }
  }, [open, user?.uid]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvt = e as CustomEvent;
      const targetUid = customEvt.detail?.userId;
      if (!targetUid || (user?.uid && targetUid === user.uid)) {
        loadLogs();
      }
    };
    window.addEventListener('analyzeup_audit_logged', handler);
    return () => window.removeEventListener('analyzeup_audit_logged', handler);
  }, [user?.uid]);

  const handleClear = () => {
    clearAuditLogs(user?.uid);
    setLogs([]);
    toast({
      title: 'Audit Trail Cleared',
      description: 'Business change history reset.',
    });
  };

  const filteredLogs = logs.filter(log => {
    if (filterType === 'all') return true;
    return log.actionType === filterType;
  });

  const getActionBadge = (type: BusinessAuditLog['actionType']) => {
    switch (type) {
      case 'discount':
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-xs gap-1 px-2.5 py-0.5 font-bold">
            <Tag className="w-3.5 h-3.5" /> Clearance Promo
          </Badge>
        );
      case 'price_up':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1 px-2.5 py-0.5 font-bold">
            <TrendingUp className="w-3.5 h-3.5" /> Margin Increase
          </Badge>
        );
      case 'reorder':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1 px-2.5 py-0.5 font-bold">
            <PackagePlus className="w-3.5 h-3.5" /> PO
          </Badge>
        );
      case 'import':
        return (
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs gap-1 px-2.5 py-0.5 font-bold">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Database Import
          </Badge>
        );
      default:
        return (
          <Badge className="bg-secondary text-foreground text-xs gap-1 px-2.5 py-0.5 font-bold">
            <Sparkles className="w-3.5 h-3.5" /> Task Executed
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto ios-glass p-6 md:p-8 border border-emerald-500/20 shadow-2xl flex flex-col">
        <DialogHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <History className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2.5">
                  Business Audit Log
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs px-2.5 py-0.5 font-bold">
                    {logs.length} Actions Logged
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                  Complete audit trail of all purchase orders (POs), clearance promos, price optimizations, and founder decisions
                </DialogDescription>
              </div>
            </div>

            {logs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-8 text-xs text-muted-foreground hover:text-rose-400 gap-1 rounded-xl font-semibold"
              >
                <Trash2 className="w-4 h-4" /> Clear History
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3 flex-1 overflow-y-auto text-sm">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Executed Actions' },
              { id: 'discount', label: 'Clearance Promos' },
              { id: 'price_up', label: 'Price Optimizations' },
              { id: 'reorder', label: 'POs' },
              { id: 'import', label: 'Imports' },
            ].map(tab => (
              <Button
                key={tab.id}
                size="sm"
                variant={filterType === tab.id ? 'default' : 'outline'}
                onClick={() => setFilterType(tab.id)}
                className={`rounded-xl text-xs h-8 px-3.5 shrink-0 ${
                  filterType === tab.id ? 'bg-emerald-600 text-white font-semibold' : 'border-border/60'
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-secondary/30 border border-border/40 space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-foreground text-base">No Executed Changes Found</h4>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                When you click "Apply Promo", "Optimize Price", or "Execute Action", every business change will be tracked here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/50 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        {getActionBadge(log.actionType)}
                        <h4 className="font-bold text-foreground text-sm">{log.productName}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{log.title}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-muted-foreground font-mono block font-medium">{log.timestamp}</span>
                      <span className="text-xs text-emerald-400 font-bold">{log.performedBy}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-background/80 border border-border/40 flex items-center justify-between text-xs md:text-sm gap-2">
                    <span className="text-foreground/90 leading-relaxed font-medium">{log.changeDetails}</span>
                    {log.impactValue && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs shrink-0 font-bold px-2.5 py-0.5">
                        {log.impactValue}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button variant="secondary" className="rounded-xl text-sm font-semibold px-5">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
