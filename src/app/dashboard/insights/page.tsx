'use client';

import { Timestamp } from 'firebase/firestore';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  IndianRupee,
  ShoppingCart,
  Package,
  Download,
} from 'lucide-react';
import { SalesChart } from '@/components/sales-chart';
import { InventoryValueChart } from '@/components/inventory-value-chart';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Papa from 'papaparse';
import type { Product, Transaction } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { subDays } from 'date-fns';
import { useData } from '@/context/data-context';

type ReportType = 'inventory_summary' | 'sales_report' | 'transaction_log';
type DateRange = '7' | '30' | '90' | 'all';

export default function InsightsPage() {
  const { products, transactions, isLoading } = useData();
  const [reportType, setReportType] = useState<ReportType>('inventory_summary');
  const [dateRange, setDateRange] = useState<DateRange>('30');

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
  }, [isLoading, reportType, dateRange]);

  const getFilteredTransactions = () => {
    if (dateRange === 'all') return transactions;
    
    // Find the date of the most recent transaction to anchor our date range
    let latestTime = 0;
    transactions.forEach(t => {
      const d = t.transactionDate instanceof Timestamp 
        ? t.transactionDate.toMillis() 
        : new Date(t.transactionDate as string).getTime();
      if (!isNaN(d) && d > latestTime) latestTime = d;
    });
    
    const referenceDate = latestTime > 0 ? new Date(latestTime) : new Date();
    const rangeStartDate = subDays(referenceDate, parseInt(dateRange));
    
    return transactions.filter((t) => {
      const transactionDate = t.transactionDate instanceof Timestamp 
        ? t.transactionDate.toDate() 
        : new Date(t.transactionDate as string);
      return transactionDate >= rangeStartDate;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  const totalRevenue =
    filteredTransactions
      .filter((t) => t.type === 'Sale')
      .reduce((acc, t) => {
        return acc + (t.totalRevenue || (t.quantity * (t.price || 0)));
      }, 0) || 0;

  const totalExpenses =
    filteredTransactions
      .filter((t) => t.type === 'Purchase')
      .reduce((acc, t) => {
        return acc + (t.totalCost || t.totalRevenue || (t.quantity * (t.price || 0)));
      }, 0) || 0;

  const totalCOGS =
    filteredTransactions
      .filter((t) => t.type === 'Sale')
      .reduce((acc, t) => {
        if (t.totalCost !== undefined) return acc + t.totalCost;
        if (t.costPerUnit !== undefined) return acc + (t.quantity * t.costPerUnit);
        const product = products.find((p) => p.id === t.productId || p.sku === t.sku);
        return acc + t.quantity * (product?.costPrice || 0);
      }, 0) || 0;

  const totalNetProfit = totalRevenue - totalCOGS;

  const topSellingProducts = [...products]
    .map(product => {
      const sales =
        filteredTransactions
          .filter((t) => t.productId === product.id && t.type === 'Sale')
          .reduce((acc, t) => acc + t.quantity, 0) || 0;
      const revenue = sales * product.price;
      return { ...product, revenue };
    })
    .sort((a,b) => b.revenue - a.revenue)
    .slice(0, 5);

  const totalProductsInStock =
    products.reduce((acc, p) => acc + p.stock, 0) || 0;
  const totalSalesCount = filteredTransactions.filter((t) => t.type === 'Sale').length || 0;
  const totalInventoryValue =
    products.reduce((acc, p) => acc + p.stock * p.price, 0) || 0;

  const handleDownloadCsv = () => {
    let dataToExport: any[] = [];
    let filename = 'report.csv';

    const localFilteredTransactions = getFilteredTransactions();

    switch (reportType) {
      case 'inventory_summary':
        dataToExport = products.map((p) => ({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          stock: p.stock,
          price: p.price.toFixed(2),
          costPrice: (p.costPrice || 0).toFixed(2),
          inventoryValue: (p.stock * p.price).toFixed(2),
          category: p.categoryId,
        }));
        filename = `inventory_summary_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'sales_report':
        dataToExport = localFilteredTransactions
          .filter((t) => t.type === 'Sale')
          .map((t) => {
            const product = products.find((p) => p.id === t.productId);
            const revenue = product ? t.quantity * product.price : 0;
            return {
              transactionId: t.id,
              transactionDate: t.transactionDate instanceof Timestamp 
                ? t.transactionDate.toDate().toISOString() 
                : t.transactionDate,
              productId: t.productId,
              productName: product?.name || 'Unknown',
              quantitySold: t.quantity,
              pricePerUnit: (t.price || 0).toFixed(2),
              totalRevenue: revenue.toFixed(2),
              profit: (revenue - (t.quantity * (product?.costPrice || 0))).toFixed(2),
            };
          });
        filename = `sales_report_${dateRange}days_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'transaction_log':
        dataToExport = localFilteredTransactions.map((t) => {
           const product = products.find((p) => p.id === t.productId);
            return {
                transactionId: t.id,
                transactionDate: t.transactionDate instanceof Timestamp 
                    ? t.transactionDate.toDate().toISOString() 
                    : t.transactionDate,
                type: t.type,
                productId: t.productId,
                productName: product?.name || 'Unknown',
                quantity: t.quantity,
                price: (t.price || 0).toFixed(2),
                locationId: t.locationId,
            }
        });
        filename = `transaction_log_${dateRange}days_${new Date().toISOString().split('T')[0]}.csv`;
        break;
    }

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-t8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <h1 className="text-lg font-semibold md:text-2xl">Insights</h1>
        <div className="sm:ml-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
           <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inventory_summary">Inventory Summary</SelectItem>
              <SelectItem value="sales_report">Sales Report</SelectItem>
              <SelectItem value="transaction_log">Transaction Log</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleDownloadCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {reportType === 'inventory_summary' && (
         <>
           {/* Inventory Cards */}
           <div className="grid gap-4 md:grid-cols-3">
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
                 <IndianRupee className="h-4 w-4 text-primary" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">
                   ₹
                   {totalInventoryValue.toLocaleString('en-IN', {
                     minimumFractionDigits: 2,
                     maximumFractionDigits: 2,
                   })}
                 </div>
                 <p className="text-xs text-muted-foreground">Total retail value of stock</p>
               </CardContent>
             </Card>
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Products in Stock</CardTitle>
                 <Package className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{totalProductsInStock.toLocaleString()}</div>
                 <p className="text-xs text-muted-foreground">Total unit volume across stock</p>
               </CardContent>
             </Card>
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                 <Package className="h-4 w-4 text-destructive" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{products.filter(p => p.stock < 20).length}</div>
                 <p className="text-xs text-muted-foreground">Items with stock level &lt; 20 units</p>
               </CardContent>
             </Card>
           </div>

           {/* Inventory Chart & Details Table */}
           <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
             <Card className="scroll-reveal-item">
               <CardHeader>
                 <CardTitle>Inventory Breakdown</CardTitle>
                 <CardDescription>Value breakdown by category.</CardDescription>
               </CardHeader>
               <CardContent>
                 <InventoryValueChart />
               </CardContent>
             </Card>
             
             <Card className="scroll-reveal-item relative">
               <CardHeader>
                 <CardTitle>Inventory Overview</CardTitle>
                 <CardDescription>Stock status details of your product lines.</CardDescription>
               </CardHeader>
               <CardContent className="p-0">
                 {/* Desktop table */}
                 <div className="hidden md:block overflow-x-auto">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Product Name</TableHead>
                         <TableHead>SKU</TableHead>
                         <TableHead className="text-right">Stock</TableHead>
                         <TableHead className="text-right">Price</TableHead>
                         <TableHead className="text-right">Total Value</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {products.slice(0, 10).map((p) => (
                         <TableRow key={p.id}>
                           <TableCell className="font-medium">{p.name}</TableCell>
                           <TableCell className="text-muted-foreground text-xs">{p.sku}</TableCell>
                           <TableCell className="text-right">{p.stock}</TableCell>
                           <TableCell className="text-right">₹{p.price.toLocaleString('en-IN')}</TableCell>
                           <TableCell className="text-right font-medium">₹{(p.stock * p.price).toLocaleString('en-IN')}</TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
                 {/* Mobile list view */}
                 <div className="md:hidden divide-y divide-border/50">
                   {products.slice(0, 10).map((p) => (
                     <div key={p.id} className="flex justify-between items-center p-4">
                       <div className="flex flex-col gap-1 min-w-0 pr-2">
                         <span className="font-medium text-sm text-foreground truncate">{p.name}</span>
                         <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>
                       </div>
                       <div className="flex flex-col items-end shrink-0 gap-1">
                         <span className="text-xs font-semibold text-muted-foreground">{p.stock} units</span>
                         <span className="text-sm font-semibold text-primary">₹{(p.stock * p.price).toLocaleString('en-IN')}</span>
                       </div>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           </div>
         </>
      )}

      {reportType === 'sales_report' && (
         <>
           {/* Sales Cards */}
           <div className="grid gap-4 md:grid-cols-3">
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                 <IndianRupee className="h-4 w-4 text-primary" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">
                   ₹
                   {totalRevenue.toLocaleString('en-IN', {
                     minimumFractionDigits: 2,
                     maximumFractionDigits: 2,
                   })}
                 </div>
                 <p className="text-xs text-muted-foreground">
                   {dateRange === 'all' ? 'From all sales' : `From sales in the last ${dateRange} days`}
                 </p>
               </CardContent>
             </Card>
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                 <IndianRupee className="h-4 w-4 text-primary" />
               </CardHeader>
               <CardContent>
                 <div className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {totalNetProfit >= 0 ? '+' : '-'}₹
                   {Math.abs(totalNetProfit).toLocaleString('en-IN', {
                     minimumFractionDigits: 2,
                     maximumFractionDigits: 2,
                   })}
                 </div>
                 <p className="text-xs text-muted-foreground">Sales minus Cost of Goods Sold</p>
               </CardContent>
             </Card>
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Total Sales Count</CardTitle>
                 <ShoppingCart className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{totalSalesCount}</div>
                 <p className="text-xs text-muted-foreground">
                   {dateRange === 'all' ? 'Total sales transactions' : `Sales transactions in the last ${dateRange} days`}
                 </p>
               </CardContent>
             </Card>
           </div>

           {/* Sales Chart & Top Selling Table */}
           <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
             <Card className="scroll-reveal-item">
               <CardHeader>
                 <CardTitle>Sales Overview</CardTitle>
                 <CardDescription>Your sales trend over the last 12 months.</CardDescription>
               </CardHeader>
               <CardContent>
                 <SalesChart />
               </CardContent>
             </Card>
             <Card className="scroll-reveal-item relative">
               <CardHeader>
                 <CardTitle>Top Selling Products</CardTitle>
                 <CardDescription>
                   {`Your best-performing products by revenue ${dateRange === 'all' ? 'of all time' : `in the last ${dateRange} days`}.`}
                 </CardDescription>
               </CardHeader>
               <CardContent className="p-0">
                 {/* Desktop Table View */}
                 <div className="hidden md:block overflow-x-auto">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Product</TableHead>
                         <TableHead className="text-right">Total Revenue</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {topSellingProducts.map((product) => (
                         <TableRow key={product.id}>
                           <TableCell className="font-medium">{product.name}</TableCell>
                           <TableCell className="text-right">
                             ₹
                             {product.revenue.toLocaleString('en-IN', {
                               minimumFractionDigits: 2,
                               maximumFractionDigits: 2,
                             })}
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
                 {/* Mobile List View */}
                 <div className="md:hidden divide-y divide-border/50">
                   {topSellingProducts.map((product, index) => (
                     <div key={product.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                       <div className="flex items-center gap-3 min-w-0 pr-2">
                         <span className="text-xs font-bold text-muted-foreground w-4">#{index + 1}</span>
                         <span className="font-medium text-sm text-foreground truncate">{product.name}</span>
                       </div>
                       <span className="text-sm font-semibold text-primary shrink-0">
                         ₹{product.revenue.toLocaleString('en-IN', {
                           minimumFractionDigits: 2,
                           maximumFractionDigits: 2,
                         })}
                       </span>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           </div>
         </>
      )}

      {reportType === 'transaction_log' && (
         <>
           {/* Transaction Cards */}
           <div className="grid gap-4 md:grid-cols-3">
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                 <IndianRupee className="h-4 w-4 text-destructive" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">
                   ₹
                   {totalExpenses.toLocaleString('en-IN', {
                     minimumFractionDigits: 2,
                     maximumFractionDigits: 2,
                   })}
                 </div>
                 <p className="text-xs text-muted-foreground">Total cost of acquisitions</p>
               </CardContent>
             </Card>
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Total Sales Revenue</CardTitle>
                 <IndianRupee className="h-4 w-4 text-primary" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">
                   ₹
                   {totalRevenue.toLocaleString('en-IN', {
                     minimumFractionDigits: 2,
                     maximumFractionDigits: 2,
                   })}
                 </div>
                 <p className="text-xs text-muted-foreground">Total revenue from sales</p>
               </CardContent>
             </Card>
             <Card className="scroll-reveal-item">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                 <ShoppingCart className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{filteredTransactions.length}</div>
                 <p className="text-xs text-muted-foreground">Total log movements recorded</p>
               </CardContent>
             </Card>
           </div>

           {/* Transaction Ledger Table */}
           <Card className="scroll-reveal-item relative w-full">
             <CardHeader>
               <CardTitle>Transaction Ledger</CardTitle>
               <CardDescription>A comprehensive audit trail of inventory movements.</CardDescription>
             </CardHeader>
             <CardContent className="p-0">
               {/* Desktop ledger view */}
               <div className="hidden md:block overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Date</TableHead>
                       <TableHead>Type</TableHead>
                       <TableHead>Product Name</TableHead>
                       <TableHead className="text-right">Quantity</TableHead>
                       <TableHead className="text-right">Unit Price</TableHead>
                       <TableHead className="text-right">Total Price</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredTransactions.slice(0, 15).map((t) => {
                       const product = products.find((p) => p.id === t.productId || p.sku === t.sku);
                       const date = t.transactionDate instanceof Timestamp 
                         ? t.transactionDate.toDate() 
                         : new Date(t.transactionDate as string);
                       const totalPrice = t.totalCost || t.totalRevenue || (t.quantity * (t.price || 0));

                       return (
                         <TableRow key={t.id}>
                           <TableCell className="text-xs text-muted-foreground">{date.toLocaleDateString()}</TableCell>
                           <TableCell>
                             <span className={cn(
                               "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
                               t.type === 'Sale' ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                             )}>
                               {t.type}
                             </span>
                           </TableCell>
                           <TableCell className="font-medium">{product?.name || t.productName || 'Unknown Product'}</TableCell>
                           <TableCell className="text-right">{t.quantity}</TableCell>
                           <TableCell className="text-right">₹{(t.price || 0).toLocaleString('en-IN')}</TableCell>
                           <TableCell className="text-right font-medium">₹{totalPrice.toLocaleString('en-IN')}</TableCell>
                         </TableRow>
                       );
                     })}
                   </TableBody>
                 </Table>
               </div>
               {/* Mobile ledger view */}
               <div className="md:hidden divide-y divide-border/50">
                 {filteredTransactions.slice(0, 15).map((t) => {
                   const product = products.find((p) => p.id === t.productId || p.sku === t.sku);
                   const date = t.transactionDate instanceof Timestamp 
                     ? t.transactionDate.toDate() 
                     : new Date(t.transactionDate as string);
                   const isSale = t.type === 'Sale';
                   const totalPrice = t.totalCost || t.totalRevenue || (t.quantity * (t.price || 0));

                   return (
                     <div key={t.id} className="flex justify-between items-center p-4">
                       <div className="flex flex-col gap-1 min-w-0 pr-2">
                         <span className="font-medium text-sm text-foreground truncate">{product?.name || t.productName || 'Unknown Product'}</span>
                         <span className="text-xs text-muted-foreground">{date.toLocaleDateString()}</span>
                       </div>
                       <div className="flex items-center gap-3 shrink-0">
                         <span className={cn("text-xs font-bold uppercase", isSale ? "text-red-500" : "text-green-500")}>
                           {t.type}
                         </span>
                         <span className="text-sm font-semibold text-primary">
                           ₹{totalPrice.toLocaleString('en-IN')}
                         </span>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </CardContent>
           </Card>
         </>
      )}
    </div>
  );
}
