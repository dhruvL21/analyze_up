'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useData } from '@/context/data-context';
import { Upload, FileText, Check, Loader2, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { getSmartMapping, FieldMapping } from '@/ai/flows/import-mapper';
import { Product, Transaction } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRODUCT_FIELDS: { label: string; value: string }[] = [
  { label: 'Name', value: 'name' },
  { label: 'SKU', value: 'sku' },
  { label: 'Price (Selling)', value: 'price' },
  { label: 'Cost Price (Buying)', value: 'costPrice' },
  { label: 'Stock', value: 'stock' },
  { label: 'Description', value: 'description' },
  { label: 'Category ID', value: 'categoryId' },
  { label: 'Supplier ID', value: 'supplierId' },
];

const TRANSACTION_FIELDS: { label: string; value: string }[] = [
    { label: 'Transaction ID', value: 'transactionId' },
    { label: 'Date', value: 'transactionDate' },
    { label: 'Product Name', value: 'productName' },
    { label: 'SKU', value: 'sku' },
    { label: 'Category', value: 'category' },
    { label: 'Quantity Sold/Purchased', value: 'quantity' },
    { label: 'Unit Price', value: 'price' },
    { label: 'Total Revenue', value: 'totalRevenue' },
    { label: 'Cost Per Unit', value: 'costPerUnit' },
    { label: 'Total Cost', value: 'totalCost' },
    { label: 'Supplier', value: 'supplier' },
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Payment Method', value: 'paymentMethod' },
    { label: 'Status', value: 'status' },
    { label: 'Type (Sale/Purchase)', value: 'type' },
];

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { bulkAddProducts, bulkUpdateProducts, bulkAddTransactions, products, suppliers, categories } = useData();
  const [importType, setImportType] = useState<'products' | 'sales'>('products');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setParsing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields || [];
        setRawData(results.data);
        
        // Get smart mapping from AI
        const aiMapping = await getSmartMapping(headers, importType);
        setMapping(aiMapping);
        setStep('map');
        setParsing(false);
      },
      error: (error) => {
        console.error('CSV Parsing Error:', error);
        setParsing(false);
      },
    });
  };

  const handleImport = async () => {
    if (!mapping || rawData.length === 0) return;
    setImporting(true);

    const productsToImport: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[] = rawData.map((row) => {
      const product: any = {};
      
      // Defaults
      product.categoryId = categories[0]?.id || 'essentials';
      product.supplierId = suppliers[0]?.id || 'SUP001';
      product.description = '';
      product.imageUrl = '';
      product.stock = 0;
      product.price = 0;

      // Map from mapping
      Object.entries(mapping).forEach(([externalKey, targetKey]) => {
        if (targetKey !== 'skip') {
          let value = row[externalKey];
          if (targetKey === 'price' || targetKey === 'stock' || targetKey === 'costPrice') {
            value = parseFloat(value) || 0;
          }
          product[targetKey] = value;
        }
      });

      return product as Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
    });

    try {
      if (importType === 'products') {
        await bulkAddProducts(productsToImport);
      } else {
        // Import Sales/Transactions
        const missingProductsMap = new Map<string, Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>();
        const existingProductsUpdatesMap = new Map<string, Partial<Product> & { id: string }>();
        
        const transactionsToImport: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>[] = rawData.map((row) => {
            const trn: any = {};
            
            // Map from mapping
            Object.entries(mapping).forEach(([externalKey, targetKey]) => {
                if (targetKey !== 'skip') {
                    let value = row[externalKey];
                    // Numerical fields
                    if (['quantity', 'price', 'totalRevenue', 'costPerUnit', 'totalCost'].includes(targetKey)) {
                        value = parseFloat(value) || 0;
                    }
                    trn[targetKey] = value;
                }
            });

            // Find existing product or prepare to create a new one
            let product = products.find(p => (trn.sku && p.sku === trn.sku) || (trn.productName && p.name === trn.productName));
            
            if (!product && (trn.sku || trn.productName)) {
                const key = trn.sku || trn.productName;
                if (!missingProductsMap.has(key)) {
                    missingProductsMap.set(key, {
                        name: trn.productName || trn.sku || 'Imported Product',
                        sku: trn.sku || `SKU-${Math.random().toString(36).substring(7).toUpperCase()}`,
                        price: trn.price || 0,
                        costPrice: trn.costPerUnit || (trn.price ? trn.price * 0.6 : 0),
                        stock: Number(trn.quantity) ? Number(trn.quantity) + 20 : 100, // Set initial stock so inventory is not empty
                        categoryId: trn.category || categories[0]?.id || 'imported',
                        supplierId: trn.supplier || suppliers[0]?.id || 'imported',
                        description: `Auto-created from transaction import.`,
                        imageUrl: '',
                        averageDailySales: 0,
                        leadTimeDays: 7
                    });
                }
            } else if (product && product.stock === 0 && Number(trn.quantity)) {
                // If the product exists but has 0 stock (e.g. from a previous incomplete import), give it some stock
                const qty = Number(trn.quantity);
                if (!existingProductsUpdatesMap.has(product.id)) {
                     existingProductsUpdatesMap.set(product.id, { id: product.id, stock: qty + 20 });
                } else {
                     const existingUpdate = existingProductsUpdatesMap.get(product.id)!;
                     existingUpdate.stock = (existingUpdate.stock || 0) + qty;
                }
            }

            return {
                productId: product?.id,
                sku: trn.sku || product?.sku,
                productName: trn.productName || product?.name,
                category: trn.category || product?.categoryId,
                type: (trn.type || 'Sale') as 'Sale' | 'Purchase',
                quantity: Number(trn.quantity) || 1,
                price: Number(trn.price) || (trn.type === 'Purchase' ? product?.costPrice : product?.price) || 0,
                totalRevenue: trn.totalRevenue,
                costPerUnit: trn.costPerUnit,
                totalCost: trn.totalCost,
                supplier: trn.supplier,
                customerName: trn.customerName,
                paymentMethod: trn.paymentMethod,
                status: trn.status,
                transactionId: trn.transactionId,
                transactionDate: trn.transactionDate ? new Date(trn.transactionDate).toISOString() : new Date().toISOString(),
                locationId: 'MAIN-WAREHOUSE'
            };
        });

        // 1. Create missing products first
        if (missingProductsMap.size > 0) {
            await bulkAddProducts(Array.from(missingProductsMap.values()));
        }

        // 2. Update existing products stock if needed
        if (existingProductsUpdatesMap.size > 0) {
            await bulkUpdateProducts(Array.from(existingProductsUpdatesMap.values()));
        }

        // 3. Add transactions
        await bulkAddTransactions(transactionsToImport);
      }
      onOpenChange(false);
      setStep('upload');
      setFile(null);
      setMapping(null);
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setMapping(null);
    setStep('upload');
    setRawData([]);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if(!val) reset(); }}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto ios-glass p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>Import Data Streams</DialogTitle>
            <DialogDescription>
               Upload a CSV or JSON file. AI will help map the attributes to our financial models.
            </DialogDescription>
          </DialogHeader>

          {step === 'upload' && (
            <div className="space-y-6 mt-6">
              <Tabs value={importType} onValueChange={(v) => setImportType(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-auto gap-1 p-1">
                      <TabsTrigger value="products" className="py-2 text-xs sm:text-sm">Inventory Database</TabsTrigger>
                      <TabsTrigger value="sales" className="py-2 text-xs sm:text-sm">Sales & Transactions</TabsTrigger>
                  </TabsList>
              </Tabs>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl p-6 sm:p-12 gap-4">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground">CSV, JSON (Max 10MB)</p>
            </div>
            <input
              type="file"
              accept=".csv,.json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              {file ? file.name : 'Select File'}
            </Button>
            {file && (
              <Button className="w-full mt-4" onClick={processFile} disabled={parsing}>
                {parsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Schema with AI...
                  </>
                ) : (
                  'Process File'
                )}
              </Button>
            )}
          </div>
        </div>
        )}

        {step === 'map' && mapping && (
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto pr-2">
            <Alert variant="default" className="bg-primary/10 border-primary/20">
              <Check className="h-4 w-4 text-primary" />
              <AlertTitle>Smart Mapping Active</AlertTitle>
              <AlertDescription>
                AI has automatically mapped your database columns to our system. Review them below.
              </AlertDescription>
            </Alert>
            
            <div className="grid gap-4">
              {Object.keys(mapping).map((externalKey) => (
                <div key={externalKey} className="grid grid-cols-1 sm:grid-cols-2 items-start sm:items-center gap-2 sm:gap-4 border-b pb-3 sm:pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium truncate">{externalKey}</span>
                  </div>
                  <Select
                    value={mapping[externalKey]}
                    onValueChange={(val) => setMapping({ ...mapping, [externalKey]: val as any })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip Field</SelectItem>
                      {(importType === 'products' ? PRODUCT_FIELDS : TRANSACTION_FIELDS).map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

          <DialogFooter className="p-6 bg-muted/30 gap-2 border-t">
            {step === 'map' && (
              <>
                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep('upload')}>Back</Button>
                <Button className="w-full sm:w-auto" onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>Finalize Import ({rawData.length})</>
                  )}
                </Button>
              </>
            )}
            {step === 'upload' && (
               <DialogClose asChild>
                  <Button variant="ghost" className="w-full sm:w-auto">Cancel</Button>
               </DialogClose>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
