'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateTodayPriorities } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import { useRouter } from 'next/navigation';
import { CheckSquare, ArrowRight, Sparkles } from 'lucide-react';

export function BusinessPrioritiesCard() {
  const { products, transactions, suppliers } = useData();
  const router = useRouter();

  const priorities = generateTodayPriorities(products, transactions, suppliers);

  return (
    <Card className="ios-glass rounded-3xl border-border/50 p-5 shadow-lg space-y-4 h-full flex flex-col justify-between">
      <div>
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CheckSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">Founder Focus List</CardTitle>
              <CardDescription className="text-xs">Short, high-impact focus list for busy founders (Max 5)</CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline" 
            onClick={() => window.dispatchEvent(new CustomEvent('analyzeup_open_copilot', { detail: { query: 'What should I focus on today?' } }))}
            className="text-primary border-primary/30 text-xs font-bold cursor-pointer hover:bg-primary/20 hover:border-primary/50 transition-all active:scale-95 flex items-center gap-1"
            title="Open Focus Mode AI Copilot"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            Focus Mode
          </Badge>
        </CardHeader>

        <CardContent className="p-0 pt-3 space-y-2.5">
          {priorities.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => router.push(item.route)}
              className="p-3 rounded-2xl bg-secondary/40 hover:bg-secondary/70 border border-border/40 hover:border-primary/40 flex items-center justify-between gap-3 transition-all cursor-pointer group shadow-xs hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  {idx + 1}
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">{item.title}</p>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">
                    {item.category}
                  </Badge>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(item.route);
                }}
                className="rounded-xl text-xs gap-1 h-8 shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground font-semibold transition-colors shadow-xs"
              >
                {item.actionLabel}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          ))}
        </CardContent>
      </div>
    </Card>
  );
}
