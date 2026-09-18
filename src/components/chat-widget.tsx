'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useData } from '@/context/data-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { X, Send, Bot, Sparkles, Loader2, Lock, FileText, Database } from 'lucide-react';
import type { ChatMessage } from '@/ai/flows/chat';
import type { Citation, RAGResponse } from '@/ai/rag/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sanitizePlainData } from '@/lib/utils';
import { FormattedMarkdown } from '@/components/formatted-markdown';

interface ExtendedChatMessage extends ChatMessage {
  citations?: Citation[];
  ragResponse?: RAGResponse;
}

export function ChatWidget() {
  const { products, transactions, suppliers, orders, returns, activePlan, setShowSubscriptionModal, businessProfile, incrementAiQueryCount, aiQueryCount } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const totalIndexedRecords = products.length + transactions.length + suppliers.length + orders.length + returns.length;
  const hasData = totalIndexedRecords > 0;

  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([
    {
      role: 'assistant',
      content: hasData
        ? "Hello! I am your AnalyzeUp AI Business Copilot. Ask me questions like 'What is our gross profit?', 'Which products are dead stock?', 'What was total revenue?', or lookup any specific SKU or order."
        : "Hello! I am your AI Business Copilot. Ask me questions about uploading your business data, our 22-column CSV template, or click any of the quick questions below to get started!",
    },
  ]);
  const [isPending, startTransition] = useTransition();
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    import('@/lib/copilot-engine').then(({ getCopilotSuggestions }) => {
      if (active) setSuggestions(getCopilotSuggestions(hasData).slice(0, 4).map((suggestion) => suggestion.question));
    });
    return () => { active = false; };
  }, [isOpen, hasData]);

  // Listen for global analyzeup_open_copilot trigger
  useEffect(() => {
    const handleOpenCopilot = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ query?: string }>;
      setIsOpen(true);
      if (customEvt.detail?.query) {
        const queryText = customEvt.detail.query;
        handleSendMessage(queryText);
      }
    };

    window.addEventListener('analyzeup_open_copilot', handleOpenCopilot);
    return () => window.removeEventListener('analyzeup_open_copilot', handleOpenCopilot);
  }, [products, transactions, suppliers, orders, returns, businessProfile]);

  const FREE_TRIAL_QUERY_LIMIT = 15;
  const isPaid = activePlan !== 'Free Trial';
  const hasTrialQuota = !isPaid && (aiQueryCount || 0) < FREE_TRIAL_QUERY_LIMIT;
  const isAccessAllowed = isPaid || hasTrialQuota;

  // Auto scroll to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isPending, isOpen]);

  const handleSendMessage = (messageText: string) => {
    if (!messageText.trim() || isPending) return;

    const userMsg: ExtendedChatMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    // Increment workspace AI Copilot query counter
    incrementAiQueryCount(1);

    startTransition(async () => {
      try {
        const { askAnalyzeUpRAGChat } = await import('@/ai/flows/chat');
        const { text, ragResponse } = await askAnalyzeUpRAGChat(
          messageText,
          messages.slice(-8),
          sanitizePlainData(products),
          sanitizePlainData(transactions),
          sanitizePlainData(suppliers),
          sanitizePlainData(orders),
          sanitizePlainData(returns),
          sanitizePlainData(businessProfile)
        );

        const assistantMsg: ExtendedChatMessage = {
          role: 'assistant',
          content: text,
          citations: ragResponse?.citations,
          ragResponse,
        };

        setMessages(prev => [...prev, assistantMsg]);
      } catch (err: any) {
        console.error('Chat error:', err);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'I encountered an error analyzing that question against your business data. Please check your network and try again.',
          },
        ]);
      }
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      {isOpen && (
        <div className="w-[450px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100dvh-100px)] rounded-3xl border border-border/80 bg-card/95 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/5 blur-[80px]" />

          {!isAccessAllowed ? (
            <div className="flex-1 flex flex-col justify-between p-6 h-full relative z-10">
              <div className="flex justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-md mb-4">
                  <Lock className="h-6 w-6 animate-pulse" />
                </div>
                <h4 className="font-bold text-lg text-foreground tracking-tight mb-2">
                  Trial Query Limit Reached
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mb-6">
                  You have used all {FREE_TRIAL_QUERY_LIMIT} free trial AI queries. Upgrade to continue asking unlimited business questions.
                </p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowSubscriptionModal(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="relative flex items-center justify-between px-5 py-3 border-b border-border/40 bg-secondary/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/25 shadow-sm">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-foreground tracking-tight">
                        AnalyzeUp AI
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Database className="w-3 h-3 text-muted-foreground/70" />
                      <span className="text-[10.5px] text-muted-foreground font-medium">
                        {totalIndexedRecords.toLocaleString()} records connected
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages Body */}
              <div
                ref={chatBodyRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin"
              >
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-2.5 max-w-[92%] ${
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20 mt-1 shadow-sm">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div
                        className={`rounded-2xl px-4 py-3 leading-relaxed text-xs ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground font-medium rounded-tr-none shadow-sm'
                            : 'bg-secondary/40 text-foreground border border-border/40 rounded-tl-none font-normal'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <FormattedMarkdown content={msg.content} />
                        )}
                      </div>

                      {/* Verified Source Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-1 pl-1 space-y-1">
                          <div className="text-[10px] font-bold text-muted-foreground/80 flex items-center gap-1 uppercase tracking-wider">
                            <FileText className="w-3 h-3 text-primary" /> Verified Sources ({msg.citations.length})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {msg.citations.slice(0, 4).map((cit, cIdx) => (
                              <Badge
                                key={cIdx}
                                variant="outline"
                                className="text-[10px] font-normal py-0.5 px-2 bg-background/50 border-border/60 text-muted-foreground hover:text-foreground cursor-default transition-colors truncate max-w-[200px]"
                                title={cit.snippet || cit.label}
                              >
                                {cit.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isPending && (
                  <div className="flex gap-2.5 max-w-[85%] mr-auto items-center text-xs text-muted-foreground">
                    <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <span>AnalyzeUp AI is thinking...</span>
                  </div>
                )}
              </div>

              {/* Suggestions & Input Bar */}
              <div className="p-3 border-t border-border/40 bg-secondary/10 space-y-2 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(suggestion)}
                      disabled={isPending}
                      className="text-[11px] bg-secondary/50 hover:bg-primary/10 border border-border/50 hover:border-primary/30 px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground transition-all shrink-0 font-medium"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendMessage(inputMessage);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    placeholder="Ask AnalyzeUp AI anything about your business..."
                    disabled={isPending}
                    className="flex-1 bg-secondary/40 border border-border/60 focus:border-primary text-xs h-9 rounded-xl px-3 text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  <Button
                    type="submit"
                    disabled={!inputMessage.trim() || isPending}
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:brightness-110 shadow-sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        data-tour="chat-widget"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-transparent hover:bg-secondary/50 text-foreground transition-all duration-300 hover:scale-105 active:scale-95 border border-border/40 backdrop-blur-md shadow-lg"
      >
        {isOpen ? (
          <X className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
        ) : (
          <div className="relative flex items-center justify-center">
            <Bot className="h-5.5 w-5.5 text-primary transition-transform duration-300 group-hover:rotate-12" />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-400 animate-pulse" />
          </div>
        )}
      </button>
    </div>
  );
}
