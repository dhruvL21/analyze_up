'use client';

import React, { useState, useEffect, useTransition } from 'react';
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
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { generateAIAdvisorInsights } from '@/ai/flows/ai-advisor';
import { askAnalyzeUpChat, ChatMessage } from '@/ai/flows/chat';

export default function AIAdvisorPage() {
  const { products, transactions, suppliers, isLoading, activePlan, setShowSubscriptionModal } = useData();
  const [isPending, startTransition] = useTransition();
  const [isChatPending, startChatTransition] = useTransition();
  const [aiInsights, setAiInsights] = useState<{
    businessHealthComment: string;
    deadStockTips: Record<string, string>;
    supplierInsights: Record<string, string>;
  } | null>(null);

  // Chat console state
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I am your AI Advisor. I can answer specific questions regarding your inventory health, supplier optimization, or dead stock liquidation strategy. Ask me anything!",
    },
  ]);

  const suggestions = [
    'Suggest a plan to clear my dead stock.',
    'How can I improve my Business Health Score?',
    'Show me supplier risk breakdown.',
    'Which product has the highest profit runway?'
  ];

  // Computations for real data
  const hasData = products.length > 0;

  // Calculate Real Business Health Score
  const healthStats = React.useMemo(() => {
    if (!hasData) {
      return {
        score: 78,
        inventoryHealth: 82,
        capitalEfficiency: 75,
        marginHealth: 80,
        totalTiedUpDeadStock: 149943,
        deadStockCount: 2,
        deadStockList: [
          { name: 'Vintage Leather Jacket', sku: 'V-LJ-01', stock: 12, price: 4999, costPrice: 3000, tiedUp: 59988, recommendation: 'Run a bundle promotion with matching leather belts, or offer a 15% discount for newsletter subscribers.' },
          { name: 'Wireless Earbuds Pro', sku: 'WE-P-09', stock: 45, price: 1999, costPrice: 1200, tiedUp: 89955, recommendation: 'Create a flash sale or gift-with-purchase bundle for orders above ₹5,000 to clear inventory.' }
        ],
        supplierDetails: [
          { name: 'Apex Electronics', productCount: 4, value: 145000, avgLeadTime: 10, risk: 'Medium', insight: 'High lead times (10 days). Consider adding backup suppliers for wireless chips to mitigate delay risks.' },
          { name: 'Zenith Textiles', productCount: 8, value: 85000, avgLeadTime: 5, risk: 'Low', insight: 'High reliability and low lead times. Excellent candidate for negotiating better payment terms.' }
        ]
      };
    }

    // 1. Inventory Health: % of products not running low (stock >= 20)
    const lowStockCount = products.filter(p => p.stock < 20).length;
    const inventoryHealth = Math.round(((products.length - lowStockCount) / products.length) * 100);

    // 2. Dead stock: Products with stock > 0 but no sales transactions
    const saleProductIds = new Set(transactions.filter(t => t.type === 'Sale').map(t => t.productId));
    const deadStockProducts = products.filter(p => p.stock > 0 && !saleProductIds.has(p.id));
    const deadStockCount = deadStockProducts.length;
    
    // Capital tied up in dead stock
    const totalTiedUpDeadStock = deadStockProducts.reduce((sum, p) => sum + (p.stock * (p.costPrice || p.price * 0.6)), 0);
    const totalInventoryVal = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
    const capitalEfficiency = totalInventoryVal > 0 
      ? Math.round(Math.max(20, 100 - (totalTiedUpDeadStock / totalInventoryVal) * 100))
      : 100;

    // 3. Margin health: calculate total profit margin
    const totalSales = transactions
      .filter(t => t.type === 'Sale')
      .reduce((sum, t) => sum + (t.totalRevenue || (t.quantity * (t.price || 0))), 0);
    const totalCOGS = transactions
      .filter(t => t.type === 'Sale')
      .reduce((sum, t) => {
        if (t.totalCost !== undefined) return sum + t.totalCost;
        const p = products.find(prod => prod.id === t.productId || prod.sku === t.sku);
        return sum + t.quantity * (p?.costPrice || 0);
      }, 0);
    const margin = totalSales > 0 ? ((totalSales - totalCOGS) / totalSales) * 100 : 25;
    const marginHealth = Math.min(100, Math.round((margin / 40) * 100)); // Normalize 40% margin as 100 score

    // Combined score
    const score = Math.round((inventoryHealth * 0.4) + (capitalEfficiency * 0.4) + (marginHealth * 0.2));

    // Map dead stock list
    const deadStockList = deadStockProducts.map(p => {
      const costPrice = p.costPrice || p.price * 0.6;
      return {
        name: p.name,
        sku: p.sku || 'N/A',
        stock: p.stock,
        price: p.price,
        costPrice,
        tiedUp: p.stock * costPrice,
        recommendation: aiInsights?.deadStockTips[p.name] || 'Offer a discount of 15-20% to clear this slow-moving stock.'
      };
    });

    // Supplier details
    const supplierDetails = suppliers.map(s => {
      const supplierProducts = products.filter(p => p.supplierId === s.id);
      const value = supplierProducts.reduce((sum, p) => sum + (p.stock * p.price), 0);
      const avgLeadTime = supplierProducts.length > 0
        ? Math.round(supplierProducts.reduce((sum, p) => sum + (p.leadTimeDays || 7), 0) / supplierProducts.length)
        : 7;
      const risk = avgLeadTime > 10 ? 'High' : avgLeadTime > 6 ? 'Medium' : 'Low';
      return {
        name: s.name,
        productCount: supplierProducts.length,
        value,
        avgLeadTime,
        risk,
        insight: aiInsights?.supplierInsights[s.name] || (risk === 'High' ? 'Long lead time detected. Order earlier to prevent stockout.' : 'Reliable delivery cycle. Low disruption risk.')
      };
    });

    return {
      score,
      inventoryHealth,
      capitalEfficiency,
      marginHealth,
      totalTiedUpDeadStock,
      deadStockCount,
      deadStockList,
      supplierDetails
    };
  }, [products, transactions, suppliers, hasData, aiInsights]);

  // Load insights from AI
  const fetchAIInsights = () => {
    startTransition(async () => {
      try {
        const simplifiedProducts = products.map((p) => ({
          name: p.name,
          sku: p.sku || '',
          stock: p.stock || 0,
          price: p.price || 0,
          costPrice: p.costPrice || p.price * 0.6 || 0,
          leadTimeDays: p.leadTimeDays || 7,
        }));
        
        const simplifiedTransactions = transactions.slice(0, 30).map((t) => ({
          productName: t.productName || '',
          type: t.type,
          quantity: t.quantity || 0,
          price: t.price || 0,
        }));

        const simplifiedSuppliers = suppliers.map(s => ({
          name: s.name,
          email: s.email
        }));

        const data = await generateAIAdvisorInsights(simplifiedProducts, simplifiedTransactions, simplifiedSuppliers);
        setAiInsights(data);
      } catch (err) {
        console.error('Failed to get AI advisor insights:', err);
      }
    });
  };

  const isPaid = activePlan !== 'Free Trial';

  useEffect(() => {
    if (hasData && isPaid) {
      fetchAIInsights();
    }
  }, [products.length, transactions.length, suppliers.length, isPaid, hasData]);

  const handleSendMessage = (textToSend?: string) => {
    if (!isPaid) return;
    const text = textToSend || chatMessage;
    if (!text.trim() || isChatPending) return;

    setChatMessage('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setChatHistory(prev => [...prev, userMsg]);

    startChatTransition(async () => {
      try {
        const simplifiedProducts = products.map((p) => ({
          name: p.name,
          sku: p.sku || '',
          stock: p.stock || 0,
          price: p.price || 0,
          costPrice: p.costPrice || p.price * 0.6 || 0,
          leadTimeDays: p.leadTimeDays || 7,
        }));

        const simplifiedTransactions = transactions.slice(0, 20).map((t) => ({
          productName: t.productName || '',
          type: t.type,
          quantity: t.quantity || 0,
          price: t.price || 0,
        }));

        const reply = await askAnalyzeUpChat(text, chatHistory.slice(-6), simplifiedProducts, simplifiedTransactions);
        setChatHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      } catch (err) {
        console.error(err);
        setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, I failed to process that request.' }]);
      }
    });
  };

  const currentVerdict = aiInsights?.businessHealthComment || (hasData 
    ? 'Calculating dynamic AI insights...' 
    : 'Your overall business health is in good standing. Your net profit margin is healthy at 22%. However, 14% of your total capital is tied up in dead stock, and your average supplier lead time of 9.2 days presents a mild stockout risk for your top seller.');

  return (
    <div className="flex flex-col gap-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
            AI Advisor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your advanced AI Business Consultant with automated stock detectors, health scoring, and supplier diagnostics.
          </p>
        </div>
        {hasData && (
          <Button
            size="sm"
            variant="outline"
            className="w-fit gap-2 border-border/80 bg-secondary/15 hover:bg-secondary/35 active:scale-95 transition-all"
            onClick={fetchAIInsights}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <RefreshCw className="h-4 w-4 text-primary" />
            )}
            Recalculate Advisor
          </Button>
        )}
      </div>

      {!hasData && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-amber-500">Viewing Sample Data</h4>
            <p className="text-xs text-muted-foreground mt-1">
              You haven't uploaded or created any inventory products yet. Below is a mock simulation showing how the AI Advisor operates once you begin tracking inventory.
            </p>
          </div>
        </div>
      )}

      {/* Row 1: Health Score & Dynamic Natural Language Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Business Health Score */}
        <Card className="lg:col-span-2 relative overflow-hidden backdrop-blur-xl border border-border/80 flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Activity className="h-4.5 w-4.5 text-primary" />
              Business Health Score
            </CardTitle>
            <CardDescription>
              Real-time health quotient based on inventory metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1">
            {/* Circle Score Gauge */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative h-28 w-28 flex items-center justify-center rounded-full border-[6px] border-secondary/20 shadow-inner">
                {/* Visual indicator ring */}
                <div 
                  className={`absolute inset-0 rounded-full border-[6px] border-transparent ${
                    healthStats.score >= 80 ? 'border-t-emerald-500 border-r-emerald-500' : 'border-t-primary border-r-primary'
                  } rotate-45`} 
                />
                <div className="text-center">
                  <span className="text-3xl font-black text-foreground">{healthStats.score}</span>
                  <span className="text-xs text-muted-foreground block">/100</span>
                </div>
              </div>
              <Badge 
                variant="secondary" 
                className={`mt-4 px-3 py-1 font-semibold text-xs tracking-wide uppercase ${
                  healthStats.score >= 80 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {healthStats.score >= 80 ? 'Stable' : 'Needs Optimization'}
              </Badge>
            </div>

            {/* Health parameters */}
            <div className="space-y-3.5">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5">Inventory Health</span>
                  <span>{healthStats.inventoryHealth}%</span>
                </div>
                <Progress value={healthStats.inventoryHealth} className="h-1.5 bg-secondary/35" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5">Capital Efficiency</span>
                  <span>{healthStats.capitalEfficiency}%</span>
                </div>
                <Progress value={healthStats.capitalEfficiency} className="h-1.5 bg-secondary/35" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5">Margin Health</span>
                  <span>{healthStats.marginHealth}%</span>
                </div>
                <Progress value={healthStats.marginHealth} className="h-1.5 bg-secondary/35" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-secondary/10 border-t border-border/30 p-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                AI Health Verdict
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentVerdict}
              </p>
            </div>
          </CardFooter>
        </Card>

        {/* Natural Language AI Chat Console */}
        <Card className="lg:col-span-3 border border-border/80 backdrop-blur-xl flex flex-col justify-between overflow-hidden relative min-h-[360px]">
          <CardHeader className="border-b border-border/40 py-4 shrink-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Bot className="h-4.5 w-4.5 text-primary" />
              Natural Language AI Advisor
            </CardTitle>
            <CardDescription>
              Ask contextual questions about your inventory or business metrics.
            </CardDescription>
          </CardHeader>
          
          <div className="relative flex-1 flex flex-col justify-between">
            {/* Chat Body & Input with conditional blur */}
            <div className={`flex-1 flex flex-col justify-between transition-all duration-300 ${!isPaid ? 'blur-[5px] select-none pointer-events-none opacity-40' : ''}`}>
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[260px] min-h-[220px] scrollbar-thin">
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 max-w-[85%] ${
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground font-semibold rounded-tr-none shadow-sm'
                          : 'bg-secondary/30 text-foreground border border-border/20 rounded-tl-none whitespace-pre-wrap'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isChatPending && (
                  <div className="flex gap-3 max-w-[85%] mr-auto items-start">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <div className="rounded-2xl rounded-tl-none px-4 py-2 text-xs bg-secondary/20 text-muted-foreground border border-border/10">
                      Advisor is analyzing your inventory logs...
                    </div>
                  </div>
                )}
              </div>

              <CardFooter className="flex-col gap-3 border-t border-border/40 p-4 bg-secondary/5 shrink-0">
                {/* Suggetions */}
                <div className="flex flex-wrap gap-1.5 w-full">
                  {suggestions.map((query) => (
                    <button
                      key={query}
                      onClick={() => handleSendMessage(query)}
                      disabled={isChatPending}
                      className="text-[10px] bg-secondary/20 hover:bg-primary/10 border border-border/30 hover:border-primary/30 px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95"
                    >
                      {query}
                    </button>
                  ))}
                </div>

                {/* Input Form */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2 w-full"
                >
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask me to review supplier safety margins or spot dead stock..."
                    disabled={isChatPending}
                    className="flex-1 bg-secondary/25 border-border/60 hover:border-border/80 focus:border-primary/80 focus:ring-1 text-xs"
                  />
                  <Button
                    type="submit"
                    disabled={!chatMessage.trim() || isChatPending}
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </CardFooter>
            </div>

            {/* Paywall Overlay */}
            {!isPaid && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-card/10 backdrop-blur-[2px] z-10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm mb-2.5">
                  <Lock className="h-5 w-5 animate-pulse" />
                </div>
                <p className="font-bold text-sm text-foreground">Premium AI Chat Advisor</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mb-4">
                  Ask deep, natural-language questions about safety margins, dead stock clearance, or profit margins.
                </p>
                <Button 
                  onClick={() => setShowSubscriptionModal(true)} 
                  size="sm"
                  className="bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90 active:scale-95"
                >
                  Upgrade to Unlock
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Dead Stock Detector */}
      <Card className="border border-border/80 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-500/10 via-red-500/40 to-red-500/10" />
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <PackageX className="h-4.5 w-4.5 text-red-500" />
              Dead Stock Detector
            </CardTitle>
            <CardDescription>
              Identify sluggish items with zero recent sales tie-up value.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground">Tied-up Capital</span>
            <span className="font-extrabold text-red-500 text-lg">
              ₹{healthStats.totalTiedUpDeadStock.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {healthStats.deadStockList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock Level</TableHead>
                    <TableHead className="text-right">Retail Price</TableHead>
                    <TableHead className="text-right">Tied Capital</TableHead>
                    <TableHead className="min-w-[280px]">AI Strategic Advice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthStats.deadStockList.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold text-sm">{item.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.sku}</TableCell>
                      <TableCell className="text-right font-medium">{item.stock}</TableCell>
                      <TableCell className="text-right">₹{item.price.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-bold text-red-500/80">₹{item.tiedUp.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs text-muted-foreground flex items-start gap-1.5 py-3">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <span>{item.recommendation}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center border-t border-dashed border-border/40 text-center">
              <ShieldCheck className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-sm font-semibold text-foreground">Zero Dead Stock Detected!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Congratulations, your current inventory has healthy turnover. Every product has recorded sales in your log.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Supplier Intelligence */}
      <Card className="border border-border/80 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500/10 via-emerald-500/40 to-emerald-500/10" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Truck className="h-4.5 w-4.5 text-emerald-500" />
            Supplier Intelligence
          </CardTitle>
          <CardDescription>
            Performance runway, supply chains risks, and lead-time optimization indicators.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {healthStats.supplierDetails.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-center">SKUs Supplied</TableHead>
                    <TableHead className="text-right">Inventory Volume Value</TableHead>
                    <TableHead className="text-center">Avg Lead Time</TableHead>
                    <TableHead className="text-center">Lead-Time Risk</TableHead>
                    <TableHead className="min-w-[280px]">AI Strategic Recommendations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthStats.supplierDetails.map((sup, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold text-sm">{sup.name}</TableCell>
                      <TableCell className="text-center font-medium">{sup.productCount}</TableCell>
                      <TableCell className="text-right font-medium">₹{sup.value.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-center font-medium">{sup.avgLeadTime} days</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="secondary"
                          className={
                            sup.risk === 'High' 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                              : sup.risk === 'Medium' 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }
                        >
                          {sup.risk}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground flex items-start gap-1.5 py-3">
                        <Bot className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{sup.insight}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center border-t border-dashed border-border/40 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-foreground">No Suppliers Linked</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Add suppliers in the suppliers page and link them to products to unlock supplier intelligence audits.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
