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
import {
  IndianRupee,
  PackageX,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Shirt,
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
          <div className="overflow-x-auto">
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
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { products, transactions, isLoading } = useData();

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
        <Card className="scroll-reveal-item bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
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
        <Card className="scroll-reveal-item border-primary/50 bg-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
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
        <Card className="scroll-reveal-item bg-secondary/20">
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
        <Card className="scroll-reveal-item bg-secondary/10">
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
          <div className="overflow-x-auto">
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
        </CardContent>
      </Card>
    </div>
  );
}
