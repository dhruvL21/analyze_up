
'use client';

import { useState, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bot, Lightbulb, Loader2, CheckCircle, Lock } from 'lucide-react';
import { useData } from '@/context/data-context';
import type { AIStockAdvisorOutput } from '@/ai/flows/low-stock-alerts';
import { aiStockAdvisor } from '@/ai/flows/low-stock-alerts';
import { generateBusinessStrategy } from '@/ai/flows/business-strategy-generator';
import type { BusinessStrategyOutput } from '@/ai/flows/business-strategy-generator';
import { Badge } from './ui/badge';

export function AIStockAdvisor() {
  const { products, transactions, activePlan, setShowSubscriptionModal } = useData();
  const [isPending, startTransition] = useTransition();
  const [isStrategyPending, startStrategyTransition] = useTransition();

  const [recommendations, setRecommendations] = useState<AIStockAdvisorOutput[]>([]);
  const [strategy, setStrategy] = useState<BusinessStrategyOutput | null>(null);

  const isPaid = activePlan !== 'Free Trial';

  const handleGetSuggestions = () => {
    if (!isPaid) return;
    startTransition(async () => {
        // Sort by urgency: (stock / averageDailySales)
        // If sales are 0, we prioritize by lowest stock
        const prioritizedProducts = [...products]
            .filter(p => p.stock < 20)
            .sort((a, b) => {
                const urgencyA = a.averageDailySales > 0 ? a.stock / a.averageDailySales : a.stock;
                const urgencyB = b.averageDailySales > 0 ? b.stock / b.averageDailySales : b.stock;
                return urgencyA - urgencyB;
            })
            .slice(0, 10);

        if (prioritizedProducts.length === 0) return;
        
        const promises = prioritizedProducts.map(p => aiStockAdvisor({
            productName: p.name,
            currentStockLevel: p.stock,
            averageDailySales: p.averageDailySales,
            supplierLeadTimeDays: p.leadTimeDays,
        }));

        const results = await Promise.all(promises);
        setRecommendations(results.filter(r => r.stockoutRisk));
    });
  };

  const handleGenerateStrategy = () => {
    if (!isPaid) return;
    startStrategyTransition(async () => {
        const salesData = JSON.stringify(transactions.filter(t => t.type === 'Sale'));
        const productData = JSON.stringify(products);
        
        const result = await generateBusinessStrategy({ salesData, productData });
        setStrategy(result);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Card className="relative overflow-hidden flex flex-col h-full">
            <CardHeader className="relative bg-gradient-to-br from-secondary/50 to-background rounded-t-lg shrink-0">
                <CardTitle className="flex items-center gap-2">
                <CheckCircle className="text-primary"/>
                What Should I Reorder?
                </CardTitle>
                <CardDescription>
                Get intelligent recommendations for products that are running low on
                stock based on sales velocity and lead times.
                </CardDescription>
                 {recommendations.length > 0 && isPaid && <Badge variant="secondary" className="absolute top-4 right-4">Verified</Badge>}
            </CardHeader>
            <CardContent className="relative flex-1 flex flex-col justify-center p-6 min-h-[220px]">
                <div className={`transition-all duration-300 ${!isPaid ? 'blur-[5px] select-none pointer-events-none opacity-40' : ''}`}>
                    {recommendations.length > 0 ? (
                    <div className="space-y-4 pt-6">
                        {recommendations.map((item, index) => (
                        <div
                            key={index}
                            className="flex items-start justify-between p-4 rounded-lg bg-muted/50 gap-4"
                        >
                            <div className="flex-1">
                            <p className="font-semibold">{item.productName}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                               {item.reasoning}
                            </p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <p className="text-sm font-medium text-destructive">Reorder</p>
                                <p className="text-2xl font-bold text-destructive">
                                    {item.recommendedReorderQuantity}
                                </p>
                                <p className="text-sm text-destructive/80">units</p>
                            </div>
                        </div>
                        ))}
                    </div>
                    ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-muted rounded-lg h-full mt-6">
                        <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                        No recommendations available yet. Click the button to analyze your
                        low stock items.
                        </p>
                    </div>
                    )}
                </div>

                {/* Paywall Overlay */}
                {!isPaid && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-card/10 backdrop-blur-[2px] rounded-lg z-10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm mb-2.5">
                      <Lock className="h-5 w-5 animate-pulse" />
                    </div>
                    <p className="font-bold text-sm text-foreground">Premium Reorder Advisor</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                      Get dynamic order quantity recommendations based on real-time sales velocity and supplier lead times.
                    </p>
                  </div>
                )}
            </CardContent>
            <CardFooter className="shrink-0 pt-0">
                <Button 
                  onClick={isPaid ? handleGetSuggestions : () => setShowSubscriptionModal(true)} 
                  disabled={isPending && isPaid}
                  className="w-full sm:w-auto"
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {!isPaid ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Unlock Reorder Advisor
                    </>
                  ) : isPending ? (
                    'Analyzing...'
                  ) : (
                    'Get Suggestions'
                  )}
                </Button>
            </CardFooter>
        </Card>

        <Card className="relative overflow-hidden flex flex-col h-full">
            <CardHeader className="relative bg-gradient-to-br from-secondary/50 to-background rounded-t-lg shrink-0">
                <CardTitle className='flex items-center gap-2'>
                    <CheckCircle className='text-primary' />
                    Growth Suggestions
                </CardTitle>
                <CardDescription>
                    Receive an AI-powered growth strategy based on your sales and product data.
                </CardDescription>
                 {strategy && isPaid && <Badge variant="secondary" className="absolute top-4 right-4">Verified</Badge>}
            </CardHeader>
            <CardContent className="relative flex-1 flex flex-col justify-center p-6 min-h-[220px]">
                 <div className={`transition-all duration-300 ${!isPaid ? 'blur-[5px] select-none pointer-events-none opacity-40' : ''}`}>
                     {strategy ? (
                        <div className="space-y-4 pt-6">
                            <h4 className="font-semibold whitespace-pre-wrap">{strategy.strategySummary}</h4>
                            <div>
                                <p className='font-medium text-sm'>Key Recommendations:</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{strategy.keyRecommendations}</p>
                            </div>
                             <div>
                                <p className='font-medium text-sm'>Expected Outcomes:</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{strategy.expectedOutcomes}</p>
                             </div>
                             <div>
                                <p className='font-medium text-sm'>Risk Factors:</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{strategy.potentialRisks}</p>
                             </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-muted rounded-lg h-full mt-6">
                            <Lightbulb className="h-10 w-10 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                            Generate a business strategy based on your current performance data.
                            </p>
                        </div>
                    )}
                 </div>

                {/* Paywall Overlay */}
                {!isPaid && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-card/10 backdrop-blur-[2px] rounded-lg z-10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm mb-2.5">
                      <Lock className="h-5 w-5 animate-pulse" />
                    </div>
                    <p className="font-bold text-sm text-foreground">Advanced Growth Suggestions</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                      Receive automated, personalized growth advice tailored to your inventory metrics and sales history.
                    </p>
                  </div>
                )}
            </CardContent>
            <CardFooter className="shrink-0 pt-0">
                <Button 
                  onClick={isPaid ? handleGenerateStrategy : () => setShowSubscriptionModal(true)} 
                  disabled={isStrategyPending && isPaid}
                  className="w-full sm:w-auto"
                >
                  {isStrategyPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {!isPaid ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Unlock Growth Strategy
                    </>
                  ) : isStrategyPending ? (
                    'Generating...'
                  ) : (
                    'Generate Strategy'
                  )}
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
