'use client';

import { Timestamp } from 'firebase/firestore';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IndianRupee,
  PackageX,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Shirt,
  ShoppingBag,
  Check,
  Loader2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useEffect } from 'react';
import { useData } from '@/context/data-context';
import { InventoryValueChart } from '@/components/inventory-value-chart';
import { SalesChart } from '@/components/sales-chart';
import { AIStockAdvisor } from '@/components/ai-stock-advisor';

function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* Row 1 Skeletons */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Inventory Value
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-1/2" />
          </CardContent>
        </Card>
      </div>

      {/* Row 2 Skeletons */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Items
            </CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-1/4" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Selling Product
            </CardTitle>
            <Shirt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-3/4" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items Sold
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-1/4" />
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
         <Card>
          <CardHeader>
            <CardTitle>Sales Performance</CardTitle>
            <CardDescription>
              A look at your sales performance over the past 12 months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            An overview of the latest inventory movements.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Skeleton Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-8" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-24 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Mobile Skeleton List */}
          <div className="md:hidden divide-y divide-border/50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { products, transactions, isLoading, activePlan, isProcessingPayment, handleUpgrade } = useData();

  useEffect(() => {
    if (isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          } else {
            entry.target.classList.remove("revealed");
          }
        });
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: "0px 0px -10% 0px"
      }
    );

    const items = document.querySelectorAll(".scroll-reveal-item");
    items.forEach(el => observer.observe(el));

    return () => items.forEach(el => observer.unobserve(el));
  }, [isLoading]);

  const lowStockProducts = products.filter((p) => p.stock < 20);

  const totalInventoryValue =
    products.reduce((acc, product) => acc + product.stock * product.price, 0) ||
    0;

  const totalSales =
    transactions
      .filter((t) => t.type === 'Sale')
      .reduce((acc, t) => {
        return acc + (t.totalRevenue || (t.quantity * (t.price || 0)));
      }, 0) || 0;

  const totalExpenses =
    transactions
      .filter((t) => t.type === 'Purchase')
      .reduce((acc, t) => {
        return acc + (t.totalCost || t.totalRevenue || (t.quantity * (t.price || 0)));
      }, 0) || 0;

  const totalCOGS = 
    transactions
      .filter((t) => t.type === 'Sale')
      .reduce((acc, t) => {
        if (t.totalCost !== undefined) return acc + t.totalCost;
        if (t.costPerUnit !== undefined) return acc + (t.quantity * t.costPerUnit);
        const product = products.find((p) => p.id === t.productId || p.sku === t.sku);
        return acc + t.quantity * (product?.costPrice || 0);
      }, 0) || 0;

  const totalProfit = totalSales - totalCOGS;

  const totalItemsSold =
    transactions
      .filter((t) => t.type === 'Sale')
      .reduce((acc, t) => acc + t.quantity, 0) || 0;

  const topSellingProductMap = useMemo(() => 
    (transactions || [])
      .filter((t) => t.type === 'Sale')
      .reduce((acc, t) => {
        const productName =
          t.productName || products.find((p) => p.id === t.productId || p.sku === t.sku)?.name || 'Unknown';
        acc[productName] = (acc[productName] || 0) + t.quantity;
        return acc;
      }, {} as { [key: string]: number })
  , [transactions, products]);

  const topSeller =
    Object.keys(topSellingProductMap).length > 0
      ? Object.entries(topSellingProductMap).sort((a, b) => b[1] - a[1])[0]
      : ['N/A', 0];
      
  const recentTransactions = (transactions || []).slice(0, 5).reverse();

  if (isLoading) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="scroll-reveal-item">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Inventory Value
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹
              {totalInventoryValue.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Total value of all products in stock
            </p>
          </CardContent>
        </Card>
        <Card className="scroll-reveal-item">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              +₹
              {totalSales.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Total revenue from all sales
            </p>
          </CardContent>
        </Card>
        <Card className="scroll-reveal-item">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹
              {totalExpenses.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Total cost of inventory purchased
            </p>
          </CardContent>
        </Card>
        <Card className="scroll-reveal-item">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {totalProfit >= 0 ? '+' : '-'}₹
              {Math.abs(totalProfit).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue minus cost of goods sold
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="scroll-reveal-item">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Items
            </CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Items needing reordering
            </p>
          </CardContent>
        </Card>
        <Card className="scroll-reveal-item">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Selling Product
            </CardTitle>
            <Shirt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{topSeller[0]}</div>
            <p className="text-xs text-muted-foreground">
              {topSeller[1]} units sold
            </p>
          </CardContent>
        </Card>
        <Card className="scroll-reveal-item">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items Sold
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItemsSold.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Units sold to customers
            </p>
          </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 gap-8 scroll-reveal-item">
         <AIStockAdvisor />
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 scroll-reveal-item">
          <Card>
            <CardHeader>
              <CardTitle>Sales Performance</CardTitle>
              <CardDescription>
                Monthly revenue trends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Distribution</CardTitle>
              <CardDescription>
                Value breakdown by category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryValueChart />
            </CardContent>
          </Card>
      </div>

      <Card className="scroll-reveal-item">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            An overview of the latest inventory movements.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {transaction.productName || products.find(p => p.id === transaction.productId)?.name || 'Unknown Product'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.type === 'Sale'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="capitalize"
                      >
                        <div className="flex items-center">
                          {transaction.type === 'Sale' ? (
                            <ArrowDownRight className="mr-1 h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="mr-1 h-3 w-3" />
                          )}
                          {transaction.type}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell>{transaction.quantity}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const date = transaction.transactionDate instanceof Timestamp 
                          ? transaction.transactionDate.toDate() 
                          : new Date(transaction.transactionDate as string);
                        return date.toLocaleDateString();
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-border/50">
            {recentTransactions.map((transaction) => {
              const productName = transaction.productName || products.find(p => p.id === transaction.productId)?.name || 'Unknown Product';
              const isSale = transaction.type === 'Sale';
              const date = transaction.transactionDate instanceof Timestamp 
                ? transaction.transactionDate.toDate() 
                : new Date(transaction.transactionDate as string);
              
              return (
                <div key={transaction.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <span className="font-medium text-sm text-foreground truncate">{productName}</span>
                    <span className="text-xs text-muted-foreground">{date.toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground">{transaction.type}</span>
                    <Badge
                      variant={isSale ? 'destructive' : 'secondary'}
                      className="capitalize font-semibold text-xs py-0.5 px-2"
                    >
                      {isSale ? '-' : '+'}{transaction.quantity}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Billing & Subscriptions Card */}
      <Card className="scroll-reveal-item">
        <CardHeader>
          <CardTitle>Billing & Subscriptions</CardTitle>
          <CardDescription>
            Manage your workspace subscription plan. Current tier:{" "}
            <span className="font-bold text-primary">{activePlan}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Plan 1: Free Trial */}
            <div
              className={`flex flex-col justify-between p-5 rounded-2xl border ${
                activePlan === "Free Trial"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card"
              } transition-all duration-200`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base">Free Trial</span>
                  {activePlan === "Free Trial" && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-3xl font-extrabold mb-4">
                  ₹0{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / month
                  </span>
                </div>
                <ul className="space-y-2.5 mb-6 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Up to 50 products
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Basic inventory tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Manual reporting
                  </li>
                </ul>
              </div>
              <Button variant="outline" disabled={activePlan === "Free Trial"} className="w-full">
                {activePlan === "Free Trial" ? "Current Plan" : "Downgrade"}
              </Button>
            </div>

            {/* Plan 2: Starter Plan */}
            <div
              className={`flex flex-col justify-between p-5 rounded-2xl border ${
                activePlan === "Starter Plan"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card"
              } transition-all duration-200`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base">Starter Plan</span>
                  {activePlan === "Starter Plan" && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-3xl font-extrabold mb-4">
                  ₹499{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / month
                  </span>
                </div>
                <ul className="space-y-2.5 mb-6 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Up to 500 products
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> AI reorder alerts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Dynamic CSV exports
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => handleUpgrade("starter_monthly", 499, "Starter Plan")}
                disabled={activePlan === "Starter Plan" || isProcessingPayment !== null}
                className={
                  activePlan === "Starter Plan"
                    ? "w-full"
                    : "w-full bg-primary text-primary-foreground hover:bg-primary/90"
                }
              >
                {isProcessingPayment === "starter_monthly" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : activePlan === "Starter Plan" ? (
                  "Current Plan"
                ) : (
                  "Upgrade to Starter"
                )}
              </Button>
            </div>

            {/* Plan 3: Pro Plan */}
            <div
              className={`flex flex-col justify-between p-5 rounded-2xl border ${
                activePlan === "Pro Plan"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card"
              } transition-all duration-200`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-base">Pro Plan</span>
                  {activePlan === "Pro Plan" && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-3xl font-extrabold mb-4">
                  ₹999{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    / month
                  </span>
                </div>
                <ul className="space-y-2.5 mb-6 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Unlimited products
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Advanced AI Advisor
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" /> Dynamic PDFs & analytics
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => handleUpgrade("pro_monthly", 999, "Pro Plan")}
                disabled={activePlan === "Pro Plan" || isProcessingPayment !== null}
                className={
                  activePlan === "Pro Plan"
                    ? "w-full"
                    : "w-full bg-primary text-primary-foreground hover:bg-primary/90"
                }
              >
                {isProcessingPayment === "pro_monthly" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : activePlan === "Pro Plan" ? (
                  "Current Plan"
                ) : (
                  "Upgrade to Pro"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
