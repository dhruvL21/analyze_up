'use client';

import React, { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { useData } from '@/context/data-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Bot,
  Sparkles,
  Loader2,
  AlertTriangle,
  Activity,
  Truck,
  PackageX,
  Send,
  RefreshCw,
  Info,
  ShieldCheck,
  Lock,
  ArrowRight,
  HelpCircle,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { askAnalyzeUpChat, ChatMessage } from '@/ai/flows/chat';
import { computeBusinessHealth, generateActionTasks } from '@/lib/command-center-engine';
import { processCopilotQuery, getCopilotSuggestions, getCopilotCategories, CopilotResponse } from '@/lib/copilot-engine';
import { logBusinessAction } from '@/lib/audit-store';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { sanitizePlainData } from '@/lib/utils';
import { FormattedMarkdown } from '@/components/formatted-markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function AIAdvisorPage() {
  const { products, transactions, suppliers, orders, returns = [], activePlan, setShowSubscriptionModal, businessProfile, updateProduct, addOrder } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const hasData = (products && products.length > 0) || (transactions && transactions.length > 0);

  const [confirmData, setConfirmData] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isChatPending, startChatTransition] = useTransition();
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Chat console state
  const [chatMessage, setChatMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [chatHistory, setChatHistory] = useState<(ChatMessage & { copilotRes?: CopilotResponse })[]>([
    {
      role: 'assistant',
      content: hasData
        ? "Hello! I am your AI Business Copilot. Ask me questions like 'What should I do today?', 'Why did profit drop?', or 'Which products are dead stock?'."
        : "Hello! I am your AI Business Copilot. You can ask me any questions about uploading your business data, our 22-column CSV template, or click any of the quick questions below to get started!",
    },
  ]);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Single Source-of-Truth Business Health Engine
  const healthSummary = React.useMemo(() => {
    return computeBusinessHealth(products, transactions, suppliers, returns);
  }, [products, transactions, suppliers, returns]);

  const actionTasks = React.useMemo(() => {
    return generateActionTasks(products, transactions, suppliers, orders, businessProfile, returns);
  }, [products, transactions, suppliers, orders, businessProfile, returns]);

  const isPaid = activePlan !== 'Free Trial';

  // Auto scroll chat
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatHistory, isChatPending]);

  const handleSendMessage = useCallback((textToSend?: string) => {
    const text = textToSend || chatMessage;
    if (!text.trim() || isChatPending) return;

    setChatMessage('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setChatHistory(prev => [...prev, userMsg]);

    // 1. Calculate deterministic copilot response immediately in milliseconds
    const copilotRes = processCopilotQuery(
      text,
      chatHistory,
      products,
      transactions,
      suppliers,
      orders,
      returns,
      businessProfile
    );

    // If recognized business intent, provide the computed response INSTANTLY with zero wait time!
    if (copilotRes.intent !== 'UNKNOWN') {
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: copilotRes.answerMarkdown,
        },
      ]);
      return;
    }

    // 2. For open-ended or unknown questions, call server with a compact slice for fast LLM synthesis
    startChatTransition(async () => {
      try {
        const reply = await askAnalyzeUpChat(
          text,
          chatHistory.slice(-6),
          sanitizePlainData(products.slice(0, 30)),
          sanitizePlainData(transactions.slice(-20)),
          sanitizePlainData(suppliers.slice(0, 10)),
          sanitizePlainData(orders.slice(0, 10)),
          sanitizePlainData(returns.slice(0, 10)),
          sanitizePlainData(businessProfile)
        );

        setChatHistory(prev => [
          ...prev,
          {
            role: 'assistant',
            content: reply || copilotRes.answerMarkdown,
          },
        ]);
      } catch (err) {
        console.error(err);
        setChatHistory(prev => [...prev, { role: 'assistant', content: copilotRes.answerMarkdown }]);
      }
    });
  }, [chatMessage, isChatPending, chatHistory, products, transactions, suppliers, orders, returns, businessProfile]);

  // Listen for analyzeup_open_copilot event
  useEffect(() => {
    const handleOpen = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ query?: string }>;
      if (customEvt.detail?.query) {
        handleSendMessage(customEvt.detail.query);
      }
    };
    window.addEventListener('analyzeup_open_copilot', handleOpen);
    return () => window.removeEventListener('analyzeup_open_copilot', handleOpen);
  }, [handleSendMessage]);

  const handleExecuteAction = (recAction: NonNullable<CopilotResponse['recommendedAction']>) => {
    if (recAction.targetRoute) {
      router.push(recAction.targetRoute);
      toast({ title: `🚀 Navigating to ${recAction.label}`, description: 'Opening target module.' });
    } else if (recAction.actionTask) {
      logBusinessAction({
        title: recAction.actionTask.title,
        productName: recAction.actionTask.targetName || 'Catalog Product',
        actionType: recAction.actionTask.actionType as any,
        changeDetails: recAction.actionTask.recommendation,
        impactValue: recAction.actionTask.estimatedBenefit,
      });
      toast({
        title: '✅ Action Added to Action Center!',
        description: `Task "${recAction.actionTask.title}" logged in Action Center.`,
      });
    }
  };

  const categories = getCopilotCategories(hasData);
  const suggestions = getCopilotSuggestions(hasData);

  const filteredSuggestions = selectedCategory === 'All'
    ? suggestions
    : suggestions.filter(s => s.category === selectedCategory);

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto px-2 sm:px-4 pb-12">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/30 pb-4">
        <div>
          <h1 className="text-xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Bot className="w-7 h-7 text-primary" /> Ask?
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 font-medium">
            Your Decision Intelligence Advisor answering questions using actual business logs, inventory velocity, and vendor data.
          </p>
        </div>
      </div>

      {/* Row 1: Health Score & Copilot Chat Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Business Health Quotient */}
        <Card className="lg:col-span-5 relative overflow-hidden ios-glass border border-primary/20 flex flex-col justify-between shadow-xl p-4 sm:p-6">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20" />
          <CardHeader className="p-0 pb-4 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">
                    Business Health Quotient
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Deterministic score derived from inventory & financial metrics.
                  </CardDescription>
                </div>
              </div>
              <Badge className={`px-3 py-1 font-bold text-xs uppercase ${healthSummary.badgeClass}`}>
                {healthSummary.category}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0 py-6 space-y-6 flex-1">
            {/* Dynamic Filled Circular Score Gauge */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
                  {/* Background Track Circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    className="text-secondary/40 stroke-current"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Dynamic Filled Progress Stroke */}
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    stroke={healthSummary.score >= 80 ? '#10b981' : healthSummary.score >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="10"
                    strokeDasharray={326.726}
                    strokeDashoffset={326.726 - (326.726 * Math.min(100, Math.max(0, healthSummary.score))) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">
                    {healthSummary.score}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground block -mt-0.5">
                    /100
                  </span>
                </div>
              </div>
            </div>

            {/* Health parameters */}
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Inventory Health</span>
                  <span className="text-primary font-bold">{healthSummary.factors.inventoryHealth}%</span>
                </div>
                <Progress value={healthSummary.factors.inventoryHealth} className="h-1.5" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Profit Margin Index</span>
                  <span className="text-primary font-bold">{healthSummary.factors.marginHealth}%</span>
                </div>
                <Progress value={healthSummary.factors.marginHealth} className="h-1.5" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Capital Efficiency</span>
                  <span className="text-primary font-bold">{healthSummary.factors.capitalEfficiency}%</span>
                </div>
                <Progress value={healthSummary.factors.capitalEfficiency} className="h-1.5" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Supplier Performance</span>
                  <span className="text-primary font-bold">{healthSummary.factors.supplierPerformance}%</span>
                </div>
                <Progress value={healthSummary.factors.supplierPerformance} className="h-1.5" />
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-secondary/20 rounded-2xl border border-border/40 p-4 space-y-1.5 flex flex-col items-start text-xs">
            <span className="font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Executive Verdict
            </span>
            <p className="text-foreground/90 leading-relaxed">{healthSummary.summarySentence}</p>
          </CardFooter>
        </Card>

        {/* Copilot Natural Language Console */}
        <Card className="lg:col-span-7 border border-primary/20 ios-glass flex flex-col justify-between overflow-hidden relative min-h-[520px] shadow-xl p-4 sm:p-6">
          <CardHeader className="p-0 pb-4 border-b border-border/40 shrink-0">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Bot className="h-5 w-5 text-primary" />
              AnalyzeUp AI
            </CardTitle>
            <CardDescription className="text-xs">
              Grounds all answers in actual inventory, transactions, and supplier database logs.
            </CardDescription>
          </CardHeader>

          <div className="relative flex-1 flex flex-col justify-between mt-4">
            <div className={`flex-1 flex flex-col justify-between ${!isPaid ? 'blur-[5px] select-none pointer-events-none opacity-40' : ''}`}>
              {/* Chat Messages */}
              <div
                ref={chatBodyRef}
                className="flex-1 overflow-y-auto p-2 space-y-4 min-h-[300px] max-h-[380px] text-xs scrollbar-thin"
              >
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-2.5 max-w-[90%] ${
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div
                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground font-semibold rounded-tr-none shadow-sm'
                            : 'bg-secondary/40 text-foreground border border-border/40 rounded-tl-none font-medium'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <FormattedMarkdown content={msg.content} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isChatPending && (
                  <div className="flex gap-2.5 max-w-[85%] mr-auto items-center text-xs text-muted-foreground">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <span>Copilot is retrieving business context & computing metrics...</span>
                  </div>
                )}
              </div>

              {/* Categorized Suggestions & Input Form */}
              <CardFooter className="flex-col gap-3 border-t border-border/40 pt-4 p-0 shrink-0 mt-3">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 scrollbar-none text-[11px]">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-full font-semibold transition-all shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Suggested Questions */}
                <div className="flex flex-wrap gap-1.5 w-full">
                  {filteredSuggestions.slice(0, 4).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.question)}
                      disabled={isChatPending}
                      className="text-[11px] bg-secondary/40 hover:bg-primary/10 border border-border/50 hover:border-primary/30 px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-all font-medium"
                    >
                      {item.question}
                    </button>
                  ))}
                </div>

                {/* Input Form */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2.5 w-full"
                >
                  <Input
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    placeholder="Ask Copilot: 'Why is profit down?', 'What to reorder?', or 'Which supplier is best?'..."
                    disabled={isChatPending}
                    className="flex-1 bg-secondary/30 border-border/60 text-xs h-10 rounded-xl px-4"
                  />
                  <Button
                    type="submit"
                    disabled={!chatMessage.trim() || isChatPending}
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground hover:brightness-110 shadow-md"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardFooter>
            </div>

            {!isPaid && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-card/10 backdrop-blur-[2px] z-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-sm mb-3">
                  <Lock className="h-6 w-6 animate-pulse" />
                </div>
                <p className="font-bold text-base text-foreground">Premium Copilot Decision Engine</p>
                <Button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="bg-primary text-primary-foreground font-semibold rounded-xl px-5 py-2 text-sm mt-3"
                >
                  Upgrade to Unlock Copilot
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
