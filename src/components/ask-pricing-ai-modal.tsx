'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  ArrowRight,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormattedMarkdown } from '@/components/formatted-markdown';
import { askPricingAssistant, PricingAssistantMessage } from '@/ai/flows/pricing-assistant';
import { PLAN_CONFIGS, PlanType } from '@/lib/saas-engine';

interface AskPricingAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (planKey: PlanType) => void;
  onViewComparison?: () => void;
}

const STARTER_QUESTIONS = [
  'What plan is right for a Shopify clothing brand with 800 products?',
  'Which plan should I choose if I have 2 Shopify stores?',
  'I have 5,000 orders per month. What do I need?',
  "What's the difference between Starter and Growth?",
  'Can I start with Free and upgrade later?',
];

export function AskPricingAiModal({
  isOpen,
  onClose,
  onSelectPlan,
  onViewComparison,
}: AskPricingAiModalProps) {
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; recommendedPlan?: PlanType }>
  >([
    {
      role: 'assistant',
      content:
        "Hello! I'm your **AnalyzeUp Pricing Assistant**.\n\nTell me about your business (your product count, monthly orders, team size, or Shopify stores), and I'll objectively calculate which plan satisfies your requirements without upselling.\n\nYou can also click any of the suggested questions below to get started!",
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const newHistory: PricingAssistantMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: textToSend },
    ];

    setMessages((prev) => [...prev, { role: 'user', content: textToSend }]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await askPricingAssistant(textToSend, newHistory);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.text,
          recommendedPlan: res.recommendedPlan,
        },
      ]);
    } catch (err) {
      console.error('Pricing AI call failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "I'm sorry, I encountered a temporary connection issue. You can compare all limits in our feature comparison table, or feel free to rephrase your question!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Cinematic Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-2xl bg-zinc-950/95 border border-border/80 shadow-[0_25px_70px_rgba(0,0,0,0.85)] rounded-3xl overflow-hidden z-10 h-[88vh] max-h-[720px] flex flex-col backdrop-blur-2xl"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-amber-500/15 rounded-full blur-[80px] pointer-events-none -z-10" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/40 flex items-center justify-between relative bg-zinc-900/30">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              AI Pricing Copilot
            </div>
            <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-1.5">
              Ask AnalyzeUp AI
            </h2>
            <p className="text-xs text-muted-foreground">
              Tell me about your business and I'll help you understand which plan fits your needs.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Feed */}
        <div className="p-4 sm:p-5 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 flex-1 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 text-xs leading-relaxed ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm ml-auto shadow-md'
                    : 'bg-zinc-900/80 border border-border/60 text-zinc-200 rounded-tl-sm shadow-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <FormattedMarkdown content={msg.content} />
                )}

                {/* Optional Plan CTA Pill if a specific plan was recommended */}
                {msg.recommendedPlan && onSelectPlan && (
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Matched: <strong className="text-foreground">{PLAN_CONFIGS[msg.recommendedPlan]?.name}</strong>
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectPlan(msg.recommendedPlan!);
                        onClose();
                      }}
                      className="h-7 text-[11px] px-2.5 rounded-lg font-bold gap-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-sm"
                    >
                      <span>Start with {PLAN_CONFIGS[msg.recommendedPlan]?.name}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 text-xs justify-start items-center">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="rounded-2xl p-3 bg-zinc-900/80 border border-border/60 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Analyzing your business requirements against plan limits...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Suggested Starter Questions (Chips) */}
        {messages.length <= 2 && !isLoading && (
          <div className="px-4 py-2 bg-zinc-900/20 border-t border-border/30">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-primary" /> Suggested Questions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/50 text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-border/40 bg-zinc-900/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="e.g. 800 products, 2 shopify stores, 3 users. What plan do I need?"
              disabled={isLoading}
              className="flex-1 h-10 px-3.5 rounded-xl bg-background/90 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500 focus:outline-none transition-colors"
            />
            <Button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="h-10 px-4 rounded-xl text-xs font-bold gap-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black shadow-md shadow-amber-500/20"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">Ask AI</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
