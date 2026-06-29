import { useState, useRef, useEffect, useTransition, useCallback } from 'react';
import { useData } from '@/context/data-context';
import { MessageSquare, X, Send, Bot, Sparkles, Loader2, ChevronRight, HelpCircle, Lock } from 'lucide-react';
import { askAnalyzeUpChat, ChatMessage } from '@/ai/flows/chat';

export function ChatWidget() {
  const { products, transactions, activePlan, setShowSubscriptionModal } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AnalyzeUp Copilot. Ask me anything about your profits, products, or sales. You can use the quick suggestions below to start analyzing!",
    },
  ]);
  const [isPending, startTransition] = useTransition();
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const isPaid = activePlan !== 'Free Trial';

  const suggestions = [
    'Why did my profit drop?',
    'What should I reorder?',
    'Which products are dead stock?',
    'How can I increase revenue by ₹10,000?',
  ];

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isPending, isOpen]);

  const handleSendMessage = (messageText: string) => {
    if (!isPaid || !messageText.trim() || isPending) return;

    const userMsg: ChatMessage = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');

    startTransition(async () => {
      try {
        // Serialize products & transactions safely on the client
        const simplifiedProducts = products.map((p) => ({
          name: p.name,
          sku: p.sku || '',
          stock: p.stock || 0,
          price: p.price || 0,
          costPrice: p.costPrice || p.price * 0.6 || 0,
          averageDailySales: p.averageDailySales || 0,
          leadTimeDays: p.leadTimeDays || 7,
        }));

        const simplifiedTransactions = (transactions || []).slice(0, 30).map((t) => {
          let dateStr = 'Recent';
          if (t.transactionDate) {
            if (typeof t.transactionDate === 'object' && t.transactionDate !== null && 'seconds' in t.transactionDate) {
              dateStr = new Date((t.transactionDate as any).seconds * 1000).toLocaleDateString();
            } else if (t.transactionDate instanceof Date) {
              dateStr = t.transactionDate.toLocaleDateString();
            } else {
              dateStr = String(t.transactionDate);
            }
          }
          return {
            productName: t.productName || '',
            sku: t.sku || '',
            type: t.type,
            quantity: t.quantity || 0,
            price: t.price || 0,
            date: dateStr,
          };
        });

        // Call OpenAI action with history (slice history to keep context windows reasonable)
        const historySlice = messages.slice(-10); // last 10 messages for conversational flow
        const response = await askAnalyzeUpChat(
          messageText,
          historySlice,
          simplifiedProducts,
          simplifiedTransactions
        );

        setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      } catch (err) {
        console.error('Chat error:', err);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I failed to process that request. Please try again.' },
        ]);
      }
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat Window Panel (Sleek modern glassmorphism mockup) */}
      {isOpen && (
        <div className="w-[400px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100dvh-120px)] rounded-2xl border border-border/80 bg-card/85 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 relative">
          {/* Top glowing strip */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/5 blur-[80px]" />
          <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/5 blur-[80px]" />

          {!isPaid ? (
            // Locked ChatWidget view
            <div className="flex-1 flex flex-col justify-between p-6 h-full relative z-10">
              <div className="flex justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-md mb-4">
                  <Lock className="h-6 w-6 animate-pulse" />
                </div>
                <h4 className="font-bold text-lg text-foreground tracking-tight mb-2">
                  Unlock AI Business Copilot
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mb-6">
                  Get instant answers about your products, sales trends, reorder quantities, and profit margins.
                </p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowSubscriptionModal(true);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  Upgrade Plan
                </button>
              </div>
              <div className="text-[10px] text-center text-muted-foreground/60 uppercase font-bold tracking-wider pt-4 border-t border-border/10">
                Premium Copilot Feature
              </div>
            </div>
          ) : (
            // Full ChatWidget content (original)
            <>
              {/* Chat Header */}
              <div className="relative flex items-center justify-between px-5 py-4 border-b border-border/40 bg-secondary/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground tracking-tight flex items-center gap-1.5">
                      Ask AnalyzeUp
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Business Copilot</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Messages */}
              <div
                ref={chatBodyRef}
                className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-muted"
              >
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/10 mt-1 shadow-inner">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-primary to-amber-700/80 text-primary-foreground font-medium rounded-tr-none border border-primary/20'
                          : 'bg-secondary/25 text-foreground border border-border/30 rounded-tl-none whitespace-pre-wrap backdrop-blur-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Loading Indicator */}
                {isPending && (
                  <div className="flex gap-3 max-w-[85%] mr-auto items-start">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/10 mt-1 shadow-inner">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <div className="rounded-2xl rounded-tl-none px-4 py-2.5 text-xs bg-secondary/20 text-muted-foreground border border-border/20 flex items-center gap-2 backdrop-blur-sm">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                      </span>
                      AnalyzeUp Copilot is analyzing your data...
                    </div>
                  </div>
                )}
                {/* Suggestions cards */}
                {!isPending && (
                  <div className="pt-4 border-t border-border/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      <HelpCircle className="h-3 w-3 text-primary" />
                      <span>Suggested Queries</span>
                    </div>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-1">
                      {suggestions.map((query) => (
                        <button
                          key={query}
                          onClick={() => handleSendMessage(query)}
                          disabled={isPending}
                          className="group flex items-center justify-between text-left text-xs bg-secondary/15 hover:bg-primary/10 border border-border/20 hover:border-primary/30 p-3 rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                        >
                          <span className="font-medium pr-2 truncate">{query}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-all duration-200 group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputMessage);
                }}
                className="p-4 border-t border-border/40 bg-secondary/5 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask anything about your data..."
                  disabled={isPending}
                  className="flex-1 min-w-0 bg-secondary/20 border border-border/60 hover:border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none disabled:opacity-50 text-foreground transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isPending}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-90 hover:scale-105 disabled:opacity-40 disabled:scale-100 disabled:hover:scale-100"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating Action Button (Glass Orb design with border glow) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-secondary/95 via-card/85 to-secondary/90 hover:from-primary/20 hover:to-primary/30 text-primary shadow-[0_8px_30px_rgb(0,0,0,0.45)] border border-primary/30 hover:border-primary/60 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-90 hover:shadow-[0_0_20px_rgba(212,143,56,0.3)]"
        title="Ask AnalyzeUp"
      >
        <div className="absolute inset-0 rounded-full bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {isOpen ? (
          <X className="h-5 w-5 text-foreground transition-transform duration-300 rotate-90" />
        ) : (
          <div className="relative flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary transition-all duration-300 group-hover:scale-105" />
            <Sparkles className="h-3 w-3 text-amber-400 absolute -top-1.5 -right-1.5 animate-pulse" />
          </div>
        )}
      </button>
    </div>
  );
}
