'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUser, useFirestore } from '@/firebase';
import { doc, collection, writeBatch } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useData } from '@/context/data-context';
import { logBusinessAction } from '@/lib/audit-store';
import {
  createImportJob,
  updateImportJobBatchProgress,
  logImportJobErrors,
  generateProductDocId,
  generateTransactionDocId,
} from '@/lib/import-job-service';
import {
  resolveExistingProduct,
  generateOrderLineItemKey,
  normalizeOrderNumber,
} from '@/lib/ingestion/order-deduplication-engine';
import {
  normalizeToProducts,
  normalizeToSales,
  findFallbackProductName,
  findFallbackPrice,
} from '@/lib/ingestion/data-validator';
import { serializePlainData } from '@/lib/utils';
import { recalculateAndSaveAnalyticsSummary } from '@/lib/analytics-aggregator';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  Truck,
  ShieldCheck,
  Wand2,
  TrendingUp,
  Package,
  ShoppingBag,
  Users,
  RotateCcw,
  Warehouse,
  FileText,
  DollarSign,
  BookmarkPlus,
  Zap,
} from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';
import {
  BusinessFileType,
  FILE_TYPE_DEFINITIONS,
  FieldMapping,
  TargetFieldDef,
} from '@/ai/flows/import-mapper-constants';
import { detectBusinessFileType, getSmartMappingForFileType } from '@/ai/flows/import-engine';
import { findMatchingImportProfile, saveImportProfile, ImportProfile } from '@/lib/import-profile-store';
import { parseExcelBuffer } from '@/lib/ingestion/excel-parser';
import { ThreeTierBadge } from '@/components/three-tier-badge';

export interface BatchProcessItem {
  batchNumber: number;
  rowRange: string;
  count: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  successCount: number;
  failCount: number;
  revenue: number;
  profit: number;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetFile?: {
    name: string;
    content: string;
    driveFileId?: string;
  } | null;
  onImportComplete?: (summary: any) => void;
}

export function ImportDialog({ open, onOpenChange, presetFile, onImportComplete }: ImportDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const {
    bulkAddProducts,
    bulkAddTransactions,
    categories,
    suppliers,
    addCategory,
    addSupplier,
    products,
    transactions,
    addReturn,
    addOrder,
    refreshAnalytics,
  } = useData();
  const { toast } = useToast();

  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Import Job Progress States
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobProcessedCount, setJobProcessedCount] = useState<number>(0);
  const [jobCurrentBatch, setJobCurrentBatch] = useState<number>(0);
  const [jobTotalBatches, setJobTotalBatches] = useState<number>(1);
  const [jobFailedCount, setJobFailedCount] = useState<number>(0);

  // Live Batch Processing List and Telemetry
  const [batchItems, setBatchItems] = useState<BatchProcessItem[]>([]);
  const [liveProductsCreated, setLiveProductsCreated] = useState<number>(0);
  const [liveSalesLogged, setLiveSalesLogged] = useState<number>(0);
  const [liveRevenueAcc, setLiveRevenueAcc] = useState<number>(0);
  const [liveProfitAcc, setLiveProfitAcc] = useState<number>(0);
  const [currentStepLabel, setCurrentStepLabel] = useState<string>('Preparing Batch Pipeline...');

  // Stage 1: AI File Type Detection
  const [detectedFileType, setDetectedFileType] = useState<BusinessFileType>('INVENTORY_MASTER');
  const [detectionConfidence, setDetectionConfidence] = useState<number>(90);
  const [detectionReasoning, setDetectionReasoning] = useState<string>('');
  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<ImportProfile | null>(null);

  // Stage 2: Field Mapping
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [mappingConfidence, setMappingConfidence] = useState<Record<string, number>>({});

  // Stage 3 & 4: Validation & Normalized Rows
  const [normalizedItems, setNormalizedItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stage 6: Summary Metrics
  const [importSummary, setImportSummary] = useState<{
    fileTypeName: string;
    importedCount: number;
    revenueImpact: number;
    newCategories: number;
    newSuppliers: number;
    newCustomers: number;
    executionTimeMs: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isImportCancelledRef = useRef<boolean>(false);

  // Reset states when closed
  React.useEffect(() => {
    if (!open) {
      setStage(1);
      setFileName('');
      setRawHeaders([]);
      setRawRows([]);
      setNormalizedItems([]);
      setImportSummary(null);
    }
  }, [open]);

  // Handle preset file (e.g. from Google Drive)
  React.useEffect(() => {
    if (open && presetFile) {
      setFileName(presetFile.name);
      setIsProcessing(true);

      Papa.parse(presetFile.content, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (!results.data || results.data.length === 0) {
            toast({ variant: 'destructive', title: 'Empty CSV File', description: 'No valid rows found in file.' });
            setIsProcessing(false);
            return;
          }

          const headers = Object.keys(results.data[0] || {});
          setRawHeaders(headers);
          setRawRows(results.data as Record<string, any>[]);

          // Check if there is a remembered import profile for this file structure
          const profile = findMatchingImportProfile(headers);
          if (profile) {
            setMatchedProfile(profile);
          }

          setStage(2); // AI File Type & Mapping Step
          setIsAiDetecting(true);

          try {
            // 1. Detect File Type via AI Accountant
            const detectRes = await detectBusinessFileType(headers, results.data as Record<string, any>[]);
            setDetectedFileType(detectRes.fileType);
            setDetectionConfidence(detectRes.confidence);
            setDetectionReasoning(detectRes.reasoning);

            // 2. Fetch Semantic Field Mappings for Detected File Type
            const mapRes = await getSmartMappingForFileType(detectRes.fileType, headers, results.data as Record<string, any>[]);
            const mergedMapping = { ...mapRes.mapping };
            if (profile?.mapping) {
              Object.entries(profile.mapping).forEach(([h, targetKey]) => {
                if (targetKey !== 'skip') mergedMapping[h] = targetKey;
              });
            }
            setFieldMapping(mergedMapping);
            setMappingConfidence(mapRes.confidence);

            toast({
              title: `AI Detected: ${detectRes.fileTypeName}`,
              description: `${detectRes.confidence}% Confidence — ${detectRes.reasoning}`,
            });
          } catch (err) {
            console.error('AI Detection Error:', err);
          } finally {
            setIsAiDetecting(false);
            setIsProcessing(false);
          }
        },
        error: (error: any) => {
          console.error('CSV Parsing Error:', error);
          toast({ variant: 'destructive', title: 'Parsing Error', description: 'Failed to read CSV file format.' });
          setIsProcessing(false);
        },
      });
    }
  }, [open, presetFile, toast]);

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const headers = [
      'Invoice No',
      'Order ID',
      'Order Date',
      'Customer ID',
      'Customer Name',
      'SKU',
      'Item Name',
      'Category',
      'Supplier ID',
      'Supplier Name',
      'Qty Sold',
      'Purchase Price',
      'Retail Price',
      'Discount',
      'Tax',
      'Current Stock',
      'Reorder Level',
      'Safety Stock',
      'Lead Time Days',
      'Payment Mode',
      'Order Status',
      'Warehouse',
    ];

    const sampleRows = [
      [
        'INV-2026-001',
        'ORD-88201',
        '2026-08-01',
        'CUST-1001',
        'Rahul Sharma',
        'TSHIRT-ORG-001',
        'Organic Cotton T-Shirt',
        'Apparel',
        'SUP-501',
        'Apex Apparel Global',
        '2',
        '450',
        '1299',
        '100',
        '60',
        '85',
        '20',
        '15',
        '5',
        'UPI',
        'Completed',
        'Central Hub - Mumbai',
      ],
      [
        'INV-2026-002',
        'ORD-88202',
        '2026-08-02',
        'CUST-1002',
        'Priya Patel',
        'MOUSE-WIRELESS-02',
        'Ergonomic Wireless Mouse',
        'Electronics',
        'SUP-502',
        'Zenith Electronics Corp',
        '1',
        '850',
        '2499',
        '150',
        '120',
        '42',
        '10',
        '8',
        '7',
        'Credit Card',
        'Completed',
        'North Facility - Delhi',
      ],
      [
        'INV-2026-003',
        'ORD-88203',
        '2026-08-03',
        'CUST-1003',
        'Amit Verma',
        'COFFEE-ARABICA-1K',
        'Arabica Whole Beans (1kg)',
        'Gourmet',
        'SUP-503',
        'Himalayan Coffee Estate',
        '3',
        '480',
        '1499',
        '50',
        '75',
        '120',
        '30',
        '25',
        '4',
        'Cash',
        'Completed',
        'South Facility - Bangalore',
      ],
      [
        'INV-2026-004',
        'ORD-88204',
        '2026-08-04',
        'CUST-1004',
        'Ananya Roy',
        'FLASK-STEEL-750',
        'Insulated Steel Flask (750ml)',
        'Home & Living',
        'SUP-504',
        'EcoVessel Supplies Ltd',
        '2',
        '350',
        '999',
        '0',
        '45',
        '64',
        '15',
        '10',
        '6',
        'Net Banking',
        'Shipped',
        'West Warehouse - Pune',
      ],
      [
        'INV-2026-005',
        'ORD-88205',
        '2026-08-05',
        'CUST-1005',
        'Vikram Malhotra',
        'SERUM-VITC-30ML',
        'Hydrating Vitamin C Serum (30ml)',
        'Beauty & Wellness',
        'SUP-505',
        'Botanica Organics Lab',
        '4',
        '280',
        '899',
        '80',
        '40',
        '95',
        '25',
        '20',
        '3',
        'UPI',
        'Delivered',
        'East Hub - Kolkata',
      ],
    ];

    const csvContent = Papa.unparse({ fields: headers, data: sampleRows });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'AnalyzeUp_Business_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Template Downloaded', description: 'AnalyzeUp CSV database template saved to your downloads folder.' });
  };

  // Stage 1: File Upload & AI Detection (CSV & Excel)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (isExcel) {
      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseExcelBuffer(buffer);

        if (!parsed.rows || parsed.rows.length === 0) {
          toast({ variant: 'destructive', title: 'Empty Excel Sheet', description: 'No data rows found in spreadsheet.' });
          setIsProcessing(false);
          return;
        }

        setRawHeaders(parsed.headers);
        setRawRows(parsed.rows);

        const profile = findMatchingImportProfile(parsed.headers);
        if (profile) setMatchedProfile(profile);

        setStage(2);
        setIsAiDetecting(true);

        const detectRes = await detectBusinessFileType(parsed.headers, parsed.rows);
        setDetectedFileType(detectRes.fileType);
        setDetectionConfidence(detectRes.confidence);
        setDetectionReasoning(detectRes.reasoning);

        const mapRes = await getSmartMappingForFileType(detectRes.fileType, parsed.headers, parsed.rows);
        const mergedMapping = { ...mapRes.mapping };
        if (profile?.mapping) {
          Object.entries(profile.mapping).forEach(([h, targetKey]) => {
            if (targetKey !== 'skip') mergedMapping[h] = targetKey;
          });
        }
        setFieldMapping(mergedMapping);
        setMappingConfidence(mapRes.confidence);

        toast({
          title: `Excel Ingested: ${detectRes.fileTypeName}`,
          description: `${detectRes.confidence}% Confidence — ${detectRes.reasoning}`,
        });
      } catch (err) {
        console.error('Excel Parsing Error:', err);
        toast({ variant: 'destructive', title: 'Excel Error', description: 'Failed to read .xlsx spreadsheet.' });
      } finally {
        setIsAiDetecting(false);
        setIsProcessing(false);
      }
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (!results.data || results.data.length === 0) {
          toast({ variant: 'destructive', title: 'Empty CSV File', description: 'No valid rows found in file.' });
          setIsProcessing(false);
          return;
        }

        const headers = Object.keys(results.data[0] || {});
        setRawHeaders(headers);
        setRawRows(results.data as Record<string, any>[]);

        // Check if there is a remembered import profile for this file structure
        const profile = findMatchingImportProfile(headers);
        if (profile) {
          setMatchedProfile(profile);
        }

        setStage(2); // AI File Type & Mapping Step
        setIsAiDetecting(true);

        try {
          // 1. Detect File Type via AI Accountant
          const detectRes = await detectBusinessFileType(headers, results.data as Record<string, any>[]);
          setDetectedFileType(detectRes.fileType);
          setDetectionConfidence(detectRes.confidence);
          setDetectionReasoning(detectRes.reasoning);

          // 2. Fetch Semantic Field Mappings for Detected File Type
          const mapRes = await getSmartMappingForFileType(detectRes.fileType, headers, results.data as Record<string, any>[]);
          const mergedMapping = { ...mapRes.mapping };
          if (profile?.mapping) {
            Object.entries(profile.mapping).forEach(([h, targetKey]) => {
              if (targetKey !== 'skip') mergedMapping[h] = targetKey;
            });
          }
          setFieldMapping(mergedMapping);
          setMappingConfidence(mapRes.confidence);

          toast({
            title: `AI Detected: ${detectRes.fileTypeName}`,
            description: `${detectRes.confidence}% Confidence — ${detectRes.reasoning}`,
          });
        } catch (err) {
          console.error('AI Detection Error:', err);
        } finally {
          setIsAiDetecting(false);
          setIsProcessing(false);
        }
      },
      error: (error) => {
        console.error('CSV Parsing Error:', error);
        toast({ variant: 'destructive', title: 'Parsing Error', description: 'Failed to read CSV file format.' });
        setIsProcessing(false);
      },
    });
  };

  // Re-run AI mapping if user manually changes file type
  const handleFileTypeChange = async (newType: BusinessFileType) => {
    setDetectedFileType(newType);
    setIsAiDetecting(true);
    try {
      const mapRes = await getSmartMappingForFileType(newType, rawHeaders, rawRows);
      setFieldMapping(mapRes.mapping);
      setMappingConfidence(mapRes.confidence);
    } finally {
      setIsAiDetecting(false);
    }
  };

  // Stage 2 -> Stage 3: Normalize & Validate Objects
  const handleConfirmMapping = () => {
    const existingSkus = new Set(products.map(p => p.sku?.toUpperCase()));
    const seenSkusInFile = new Set<string>();

    const existingOrderKeys = new Set<string>();
    (transactions || []).forEach(t => {
      const tAny = t as any;
      const ord = t.orderNumber || tAny.order_number;
      const sku = tAny.sku;
      const name = t.productName || tAny.product_name;
      const date = typeof t.transactionDate === 'string' ? t.transactionDate : tAny.sale_date;
      const qty = t.quantity || tAny.units_sold;
      const k = generateOrderLineItemKey(ord, sku, name, date, qty);
      if (k) existingOrderKeys.add(k);
    });
    const seenOrderKeysInFile = new Set<string>();

    const normalized = rawRows.map((rawRow, idx) => {
      const obj: Record<string, any> = { isValid: true, errors: [], warnings: [] };

      // Map raw headers to target keys
      Object.entries(fieldMapping).forEach(([csvHeader, targetKey]) => {
        if (targetKey === 'skip' || targetKey === 'customAttribute') return;
        const val = rawRow[csvHeader];
        if (val !== undefined && val !== null) {
          obj[targetKey] = val.toString().trim();
        }
      });

      // Type-specific field parsing & normalization
      if (detectedFileType === 'SALES_REPORT') {
        let name = obj.productName || obj.name || obj.itemName || '';
        if (!name || /^[0-9.,\s₹$€£+-]+$/.test(name.trim())) {
          const fallbackName = findFallbackProductName(rawRow);
          if (fallbackName) name = fallbackName;
        }

        let price = parseFloat((obj.sellingPrice || obj.price || obj.retailPrice || '0').replace(/[^0-9.]/g, '')) || 0;
        if (price <= 0) {
          const fallbackPrice = findFallbackPrice(rawRow);
          if (fallbackPrice > 0) price = fallbackPrice;
        }

        const costPrice = parseFloat((obj.costPrice || obj.purchasePrice || '0').replace(/[^0-9.]/g, '')) || 0;
        const qty = parseInt((obj.quantity || obj.qtySold || obj.stock || '1').replace(/[^0-9]/g, ''), 10) || 1;
        const orderNo = obj.orderNumber || obj.orderId || obj.invoiceNo || `INV-${1000 + idx}`;
        const customer = obj.customerName || obj.customer || 'Retail Customer';
        const city = obj.city || obj.warehouse || '';
        const status = obj.status || obj.orderStatus || 'Completed';
        const remarks = obj.remarks || '';
        const paymentMode = obj.paymentMode || 'UPI';
        const discount = parseFloat((obj.discount || '0').replace(/[^0-9.]/g, '')) || 0;
        const tax = parseFloat((obj.tax || '0').replace(/[^0-9.]/g, '')) || 0;
        const date = obj.orderDate || new Date().toISOString().split('T')[0];
        const supplier = obj.supplier || obj.supplierName || '';
        const supplierId = obj.supplierId || '';
        const hasRawStock = obj.stock !== undefined || obj.currentStock !== undefined;
        const stock = hasRawStock ? (parseInt((obj.stock || obj.currentStock || '0').replace(/[^0-9]/g, ''), 10) || 0) : 0;
        const minStock = obj.minStock ? (parseInt(obj.minStock.replace(/[^0-9]/g, ''), 10) || 0) : 0;
        const leadTimeDays = obj.leadTimeDays ? (parseInt(obj.leadTimeDays.replace(/[^0-9]/g, ''), 10) || 0) : 0;
        const category = obj.category || 'General';
        const effectiveSku = obj.sku || `SKU-${idx + 1}`;

        const orderLineKey = generateOrderLineItemKey(orderNo, effectiveSku, name, date, qty);
        if (existingOrderKeys.has(orderLineKey) || seenOrderKeysInFile.has(orderLineKey)) {
          obj.isDuplicateOrder = true;
          obj.warnings.push(`Duplicate order #${orderNo} (${effectiveSku}) already in database or file (will be skipped)`);
        } else {
          seenOrderKeysInFile.add(orderLineKey);
        }

        if (!name) obj.errors.push('Missing product name');
        if (price <= 0) obj.errors.push('Invalid or zero selling price');
        if (qty <= 0) obj.errors.push('Invalid quantity sold');

        obj.parsed = {
          name,
          price,
          costPrice,
          qty,
          stock,
          minStock,
          leadTimeDays,
          orderNo,
          customer,
          city,
          warehouse: city,
          status,
          remarks,
          paymentMode,
          discount,
          tax,
          supplier,
          supplierId,
          category,
          date,
          sku: obj.sku || `SKU-${idx + 1}`,
        };
      } else if (detectedFileType === 'INVENTORY_MASTER' || detectedFileType === 'WAREHOUSE_STOCK') {
        let name = obj.name || obj.productName || obj.itemName || '';
        if (!name || /^[0-9.,\s₹$€£+-]+$/.test(name.trim())) {
          const fallbackName = findFallbackProductName(rawRow);
          if (fallbackName) name = fallbackName;
        }

        let price = parseFloat((obj.price || obj.sellingPrice || obj.retailPrice || '0').replace(/[^0-9.]/g, '')) || 0;
        if (price <= 0) {
          const fallbackPrice = findFallbackPrice(rawRow);
          if (fallbackPrice > 0) price = fallbackPrice;
        }

        const costPrice = parseFloat((obj.costPrice || obj.purchasePrice || '0').replace(/[^0-9.]/g, '')) || 0;
        const stock = parseInt((obj.stock || obj.currentStock || obj.quantity || obj.qtySold || '0').replace(/[^0-9]/g, ''), 10) || 0;
        const minStock = parseInt((obj.minStock || obj.reorderLevel || obj.safetyStock || '10').replace(/[^0-9]/g, ''), 10) || 10;
        const leadTimeDays = parseInt((obj.leadTimeDays || '7').replace(/[^0-9]/g, ''), 10) || 7;
        const sku = (obj.sku || `AUTOSKU-${idx + 1}`).toUpperCase();
        const category = obj.category || 'General';
        const supplier = obj.supplier || obj.supplierName || '';
        const supplierId = obj.supplierId || '';
        const city = obj.city || obj.warehouse || '';

        if (!name) obj.errors.push('Missing product name');
        if (price <= 0) obj.errors.push('Invalid or zero selling price');
        if (stock < 0) obj.errors.push('Negative stock quantity');

        if (existingSkus.has(sku)) obj.warnings.push(`SKU "${sku}" already exists in inventory`);
        if (seenSkusInFile.has(sku)) obj.errors.push(`Duplicate SKU "${sku}" inside CSV`);
        else seenSkusInFile.add(sku);

        if (costPrice > price && price > 0) obj.warnings.push('Cost price is higher than selling price');

        obj.parsed = {
          name,
          price,
          costPrice,
          stock,
          minStock,
          leadTimeDays,
          sku,
          category,
          supplier,
          supplierId,
          city,
          warehouse: city,
          unit: obj.unit || 'Piece',
          description: obj.description || '',
        };
      } else {
        // Fallback general object
        let name = obj.name || obj.productName || obj.itemName || obj.supplierName || obj.customerName || '';
        if (!name || /^[0-9.,\s₹$€£+-]+$/.test(name.trim())) {
          const fallbackName = findFallbackProductName(rawRow);
          if (fallbackName) name = fallbackName;
        }
        if (!name) name = `Item #${idx + 1}`;

        let price = parseFloat((obj.price || obj.sellingPrice || obj.retailPrice || obj.unitCost || '0').replace(/[^0-9.]/g, '')) || 0;
        if (price <= 0) {
          const fallbackPrice = findFallbackPrice(rawRow);
          if (fallbackPrice > 0) price = fallbackPrice;
        }
        const qty = parseInt((obj.quantity || obj.qtySold || obj.stock || obj.currentStock || '1').replace(/[^0-9]/g, ''), 10) || 1;
        if (!name) obj.errors.push('Missing name');
        obj.parsed = { name, price, qty, sku: obj.sku || `ITEM-${idx + 1}` };
      }

      obj.isValid = obj.errors.length === 0;
      return obj;
    });

    setNormalizedItems(normalized);
    setStage(3); // Stage 3: Business Preview & Validation
  };

  // Stage 4: Business Impact Preview Metrics
  const impactMetrics = useMemo(() => {
    const totalRows = normalizedItems.length;
    const validRows = normalizedItems.filter(r => r.isValid);
    const validCount = validRows.length;
    const invalidCount = totalRows - validCount;
    const warningsCount = normalizedItems.reduce((acc, r) => acc + (r.warnings?.length || 0), 0);

    let estimatedRevenue = 0;
    let productsFound = new Set<string>();
    let customersFound = new Set<string>();
    let ordersFound = new Set<string>();

    validRows.forEach(item => {
      const p = item.parsed;
      if (detectedFileType === 'SALES_REPORT') {
        estimatedRevenue += (p.price || 0) * (p.qty || 1);
        if (p.name) productsFound.add(p.name);
        if (p.customer) customersFound.add(p.customer);
        if (p.orderNo) ordersFound.add(p.orderNo);
      } else {
        estimatedRevenue += (p.price || 0) * (p.stock || 1);
        if (p.name) productsFound.add(p.name);
        if (p.supplier) customersFound.add(p.supplier);
      }
    });

    const fileCategories = new Set(validRows.map(r => r.parsed?.category).filter(Boolean));
    const fileSuppliers = new Set(validRows.map(r => r.parsed?.supplier).filter(Boolean));

    const existingCatNames = new Set(categories.map(c => c.name.toLowerCase()));
    const existingSupNames = new Set(suppliers.map(s => s.name.toLowerCase()));

    const newCategories = Array.from(fileCategories).filter(c => !existingCatNames.has(c.toLowerCase())).length;
    const newSuppliers = Array.from(fileSuppliers).filter(s => !existingSupNames.has(s.toLowerCase())).length;

    return {
      totalRows,
      validCount,
      invalidCount,
      warningsCount,
      estimatedRevenue,
      productsFoundCount: productsFound.size,
      customersFoundCount: customersFound.size,
      ordersFoundCount: ordersFound.size,
      newCategories,
      newSuppliers,
    };
  }, [normalizedItems, detectedFileType, categories, suppliers]);

  // Stage 5: Relationship Builder & Multi-Entity Ingestion Execution
  const handleExecuteBusinessImport = async () => {
    if (!rawRows || rawRows.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No records found in spreadsheet.' });
      return;
    }

    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please sign in to import data.' });
      return;
    }

    setStage(4); // Stage 4: Real-time Processing
    setIsProcessing(true);
    const startTime = performance.now();

    try {
      // 1. Auto-create Categories in parallel (safe & non-blocking)
      const validRows = normalizedItems.filter(r => r.isValid);
      const fileCategories = Array.from(new Set(validRows.map(r => r.parsed?.category || 'General').filter(Boolean)));
      const existingCatMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      let newCatCount = 0;

      const missingCats = fileCategories.filter(catName => !existingCatMap.has(catName.toLowerCase()));
      if (missingCats.length > 0) {
        Promise.all(
          missingCats.map(catName =>
            addCategory({ name: catName, description: 'Created during AI business import' }).catch(() => {})
          )
        ).catch(() => {});
        newCatCount = missingCats.length;
      }

      // 2. Auto-create Suppliers in parallel (safe & non-blocking)
      const fileSuppliers = Array.from(new Set(validRows.map(r => r.parsed?.supplier || 'Import Vendor').filter(Boolean)));
      const existingSupMap = new Map(suppliers.map(s => [s.name.toLowerCase(), s.id]));
      let newSupCount = 0;

      const missingSups = fileSuppliers.filter(supName => !existingSupMap.has(supName.toLowerCase()));
      if (missingSups.length > 0) {
        Promise.all(
          missingSups.map(supName =>
            addSupplier({
              name: supName,
              contactName: 'Import Contact',
              email: `orders@${supName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
              phone: '+91 90000 00000',
              address: 'Imported via AI Engine',
            }).catch(() => {})
          )
        ).catch(() => {});
        newSupCount = missingSups.length;
      }

      // 3. Initialize Persistent Import Job with dynamic batch sizing for responsive live progress
      const BATCH_SIZE = 100;
      const totalBatches = Math.max(1, Math.ceil(rawRows.length / BATCH_SIZE));
      setJobTotalBatches(totalBatches);
      setJobCurrentBatch(1);

      const initialBatches: BatchProcessItem[] = [];
      for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const chunk = rawRows.slice(i, i + BATCH_SIZE);
        initialBatches.push({
          batchNumber: batchNum,
          rowRange: `Rows ${i + 1} – ${i + chunk.length}`,
          count: chunk.length,
          status: 'QUEUED',
          successCount: 0,
          failCount: 0,
          revenue: 0,
          profit: 0,
        });
      }
      setBatchItems(initialBatches);
      setLiveProductsCreated(0);
      setLiveSalesLogged(0);
      setLiveRevenueAcc(0);
      setLiveProfitAcc(0);
      setJobProcessedCount(0);
      setJobFailedCount(0);
      setJobProgress(0);
      setCurrentStepLabel(`Starting Batch Pipeline (1 of ${totalBatches})...`);

      let currentJobId = `job_${Date.now()}`;
      if (firestore && user) {
        try {
          const job = await createImportJob(firestore, user.uid, {
            fileName,
            fileType: detectedFileType,
            totalRecords: rawRows.length,
            batchSize: BATCH_SIZE,
            driveFileId: presetFile?.driveFileId,
          });
          currentJobId = job.id;
        } catch (jobErr) {
          console.warn('Failed to create persistent import job doc:', jobErr);
        }
      }
      setJobId(currentJobId);

      let totalSuccess = 0;
      let totalFail = 0;
      let totalAccRevenue = 0;
      let totalAccProfit = 0;
      let totalAccProducts = 0;
      let totalAccSales = 0;
      const isSalesReport = detectedFileType === 'SALES_REPORT';
      const nowIso = new Date().toISOString();

      // Track executed order keys across batches to detect and skip duplicate orders
      const executedOrderKeys = new Set<string>();
      (transactions || []).forEach(t => {
        const tAny = t as any;
        const ord = t.orderNumber || tAny.order_number;
        const sku = tAny.sku;
        const name = t.productName || tAny.product_name;
        const date = typeof t.transactionDate === 'string' ? t.transactionDate : tAny.sale_date;
        const qty = t.quantity || tAny.units_sold;
        const k = generateOrderLineItemKey(ord, sku, name, date, qty);
        if (k) executedOrderKeys.add(k);
      });
      let totalDuplicateOrdersSkipped = 0;

      // 4. Process Bounded Batches with on-screen visual progress
      isImportCancelledRef.current = false;
      for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
        if (isImportCancelledRef.current) {
          console.log('[Import] Aborted by cancellation.');
          break;
        }
        const batchIndex = Math.floor(i / BATCH_SIZE);
        const batchNum = batchIndex + 1;
        const chunk = rawRows.slice(i, i + BATCH_SIZE);
        const recordsImported = Math.min(rawRows.length, i + chunk.length);
        const recordsLeft = Math.max(0, rawRows.length - recordsImported);
        
        setJobCurrentBatch(batchNum);
        setJobProcessedCount(i);
        setJobProgress(Math.min(100, Math.round((i / rawRows.length) * 100)));
        setCurrentStepLabel(`Ingesting Batch #${batchNum} of ${totalBatches} • Ingested: ${recordsImported} | Left: ${recordsLeft}...`);

        setBatchItems(prev => prev.map((item, idx) => idx === batchIndex ? { ...item, status: 'PROCESSING' } : item));

        let batchSuccess = 0;
        let batchFail = 0;
        let batchRevenue = 0;
        let batchProfit = 0;
        let batchProductCount = 0;
        let batchSalesCount = 0;
        const errorsToLog: any[] = [];

        try {
          if (isSalesReport) {
            const normResult = normalizeToSales(chunk, fieldMapping || {});
            normResult.errorRecords.forEach(err => {
              batchFail++;
              errorsToLog.push({
                batchNumber: batchNum,
                rowNumber: i + err.rowNumber,
                recordIdentifier: (err.rawRow as any)?.order_number || (err.rawRow as any)?.product_name || `Row ${i + err.rowNumber}`,
                error: err.errors.join(', '),
                errorType: 'VALIDATION',
                retryable: false,
                rawData: serializePlainData(err.rawRow),
              });
            });

            if (normResult.validRecords.length > 0 && firestore && user) {
              const batch = writeBatch(firestore);
              const upsertedProductsInBatch = new Set<string>();

              normResult.validRecords.forEach((sale, idx) => {
                const rawRow = chunk[idx] || {};
                const rowIdx = i + idx + 1;

                // Check duplicate order: skip if already in database or earlier in this import run
                const orderKey = generateOrderLineItemKey(
                  sale.order_number,
                  sale.sku,
                  sale.product_name,
                  sale.sale_date,
                  sale.units_sold
                );

                if (executedOrderKeys.has(orderKey)) {
                  totalDuplicateOrdersSkipped++;
                  return;
                }
                executedOrderKeys.add(orderKey);

                // Resolve existing product in catalog to link to existing document (e.g. from Shopify)
                const { prodDocId, existingProduct } = resolveExistingProduct(products, sale.sku, sale.product_name);
                const txDocId = generateTransactionDocId(sale.order_number, sale.sku, sale.sale_date, rowIdx);
                const txRef = doc(firestore, 'users', user.uid, 'transactions', txDocId);

                const saleRev = sale.revenue || (sale.selling_price * sale.units_sold);
                const saleCost = sale.total_cost || (sale.cost_per_unit * sale.units_sold);
                batchRevenue += saleRev;
                batchProfit += Math.max(0, saleRev - saleCost);
                batchSalesCount++;

                batch.set(
                  txRef,
                  serializePlainData({
                    id: txDocId,
                    type: 'Sale',
                    productId: prodDocId,
                    product_id: prodDocId,
                    productName: sale.product_name,
                    product_name: sale.product_name,
                    sku: sale.sku,
                    category: sale.category || existingProduct?.category || 'General',
                    quantity: sale.units_sold,
                    units_sold: sale.units_sold,
                    price: sale.selling_price,
                    selling_price: sale.selling_price,
                    costPrice: sale.cost_per_unit,
                    costPerUnit: sale.cost_per_unit,
                    cost_per_unit: sale.cost_per_unit,
                    totalRevenue: saleRev,
                    revenue: saleRev,
                    totalCost: saleCost,
                    total_cost: saleCost,
                    orderNumber: sale.order_number,
                    order_number: sale.order_number,
                    customerName: sale.customer_name,
                    customer_name: sale.customer_name,
                    supplier: sale.supplier_name || existingProduct?.supplier || '',
                    supplier_name: sale.supplier_name || existingProduct?.supplier || '',
                    transactionDate: sale.sale_date,
                    sale_date: sale.sale_date,
                    paymentMethod: sale.payment_method || 'UPI',
                    status: 'Completed',
                    userId: user.uid,
                    tenantId: user.uid,
                    customAttributes: rawRow,
                    rawAttributes: rawRow,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                  }),
                  { merge: true }
                );

                // Auto-upsert product catalog entry once per unique product in the batch
                if (!upsertedProductsInBatch.has(prodDocId)) {
                  upsertedProductsInBatch.add(prodDocId);
                  batchProductCount++;

                  const hasStockCol = rawRow.stock !== undefined || rawRow.currentStock !== undefined || rawRow['Current Stock'] !== undefined || rawRow.inventory_quantity !== undefined;
                  const rawStockVal = Number(rawRow.stock || rawRow.currentStock || rawRow['Current Stock'] || rawRow.inventory_quantity || rawRow.quantity_on_hand);

                  // If CSV explicitly has stock, use it; otherwise preserve existing product stock; otherwise 0! NEVER 25!
                  const prodStock = hasStockCol && !isNaN(rawStockVal) && rawStockVal >= 0
                    ? rawStockVal
                    : (existingProduct ? existingProduct.stock : 0);

                  const prodRef = doc(firestore, 'users', user.uid, 'products', prodDocId);
                  batch.set(
                    prodRef,
                    serializePlainData({
                      id: prodDocId,
                      name: sale.product_name,
                      productName: sale.product_name,
                      sku: sale.sku,
                      category: sale.category || existingProduct?.category || 'General',
                      price: sale.selling_price,
                      costPrice: sale.cost_per_unit,
                      stock: prodStock,
                      minStock: rawRow.minStock !== undefined && !isNaN(Number(rawRow.minStock)) ? Number(rawRow.minStock) : (existingProduct?.reorderPoint ?? 0),
                      safetyStock: rawRow.safetyStock !== undefined && !isNaN(Number(rawRow.safetyStock)) ? Number(rawRow.safetyStock) : ((existingProduct as any)?.safetyStock ?? 0),
                      supplier: sale.supplier_name || existingProduct?.supplier || '',
                      leadTimeDays: rawRow.leadTimeDays !== undefined && !isNaN(Number(rawRow.leadTimeDays)) ? Number(rawRow.leadTimeDays) : (existingProduct?.leadTimeDays ?? 0),
                      userId: user.uid,
                      tenantId: user.uid,
                      status: 'Active',
                      customAttributes: rawRow,
                      rawAttributes: rawRow,
                      updatedAt: nowIso,
                      createdAt: existingProduct?.createdAt || nowIso,
                    }),
                    { merge: true }
                  );
                }

                batchSuccess++;
              });

              await Promise.race([
                batch.commit(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Batch commit timed out')), 6000))
              ]).catch(e => console.warn('Sales batch commit notice:', e));
            }
          } else {
            // Inventory / Catalog Import
            const normResult = normalizeToProducts(chunk, fieldMapping || {});
            normResult.errorRecords.forEach(err => {
              batchFail++;
              errorsToLog.push({
                batchNumber: batchNum,
                rowNumber: i + err.rowNumber,
                recordIdentifier: (err.rawRow as any)?.sku || (err.rawRow as any)?.name || `Row ${i + err.rowNumber}`,
                error: err.errors.join(', '),
                errorType: 'VALIDATION',
                retryable: false,
                rawData: serializePlainData(err.rawRow),
              });
            });

            if (normResult.validRecords.length > 0 && firestore && user) {
              const batch = writeBatch(firestore);
              normResult.validRecords.forEach((prod, idx) => {
                const rawRow = chunk[idx] || {};
                const rowIdx = i + idx + 1;
                const { prodDocId, existingProduct } = resolveExistingProduct(products, prod.sku, prod.product_name);
                const prodRef = doc(firestore, 'users', user.uid, 'products', prodDocId);
                batchProductCount++;

                batch.set(
                  prodRef,
                  serializePlainData({
                    id: prodDocId,
                    name: prod.product_name,
                    productName: prod.product_name,
                    sku: prod.sku,
                    category: prod.category || existingProduct?.category || 'General',
                    stock: prod.inventory_quantity,
                    minStock: prod.min_stock,
                    maxStock: prod.max_stock,
                    price: prod.price,
                    costPrice: prod.cost_price,
                    supplier: prod.supplier_name || existingProduct?.supplier || '',
                    supplierId: prod.supplier_id || existingProduct?.supplierId || '',
                    leadTimeDays: prod.lead_time_days,
                    unit: prod.unit,
                    brand: prod.brand,
                    barcode: prod.barcode,
                    description: prod.description,
                    userId: user.uid,
                    tenantId: user.uid,
                    status: 'Active',
                    customAttributes: rawRow,
                    rawAttributes: rawRow,
                    createdAt: existingProduct?.createdAt || prod.created_at || nowIso,
                    updatedAt: nowIso,
                  }),
                  { merge: true }
                );

                // If row has sales data, write Sale transaction too (skip if duplicate)
                const rawQtySold = Number(rawRow['Qty Sold'] || rawRow.qtySold || rawRow.quantitySold || rawRow.unitsSold || rawRow.qty_sold || 0);
                const orderNum = String(rawRow['Invoice No'] || rawRow.invoiceNo || rawRow.orderNumber || rawRow.orderId || `INV-${1000 + rowIdx}`).trim();
                const custName = String(rawRow['Customer Name'] || rawRow.customerName || 'Retail Customer').trim();
                const orderDate = String(rawRow['Order Date'] || rawRow.orderDate || new Date().toISOString().split('T')[0]).trim();
                const discount = Number(rawRow['Discount'] || rawRow.discount || 0);

                if (rawQtySold > 0 || rawRow['Invoice No'] || rawRow['Order ID']) {
                  const effectiveQty = rawQtySold > 0 ? rawQtySold : 1;
                  const saleOrderKey = generateOrderLineItemKey(orderNum, prod.sku, prod.product_name, orderDate, effectiveQty);

                  if (!executedOrderKeys.has(saleOrderKey)) {
                    executedOrderKeys.add(saleOrderKey);

                    const txDocId = generateTransactionDocId(orderNum, prod.sku, orderDate, rowIdx);
                    const txRef = doc(firestore, 'users', user.uid, 'transactions', txDocId);
                    const itemRevenue = Math.max(0, (prod.price * effectiveQty) - discount);
                    const itemCost = prod.cost_price * effectiveQty;
                    batchRevenue += itemRevenue;
                    batchProfit += Math.max(0, itemRevenue - itemCost);
                    batchSalesCount++;

                    batch.set(
                      txRef,
                      serializePlainData({
                        id: txDocId,
                        type: 'Sale',
                        productId: prodDocId,
                        product_id: prodDocId,
                        productName: prod.product_name,
                        product_name: prod.product_name,
                        sku: prod.sku,
                        category: prod.category || 'General',
                        quantity: effectiveQty,
                        units_sold: effectiveQty,
                        price: prod.price,
                        selling_price: prod.price,
                        costPrice: prod.cost_price,
                        costPerUnit: prod.cost_price,
                        cost_per_unit: prod.cost_price,
                        totalRevenue: itemRevenue,
                        revenue: itemRevenue,
                        totalCost: itemCost,
                        total_cost: itemCost,
                        orderNumber: orderNum,
                        order_number: orderNum,
                        customerName: custName,
                        customer_name: custName,
                        supplier: prod.supplier_name || '',
                        transactionDate: orderDate,
                        sale_date: orderDate,
                        paymentMethod: String(rawRow['Payment Mode'] || rawRow.paymentMethod || 'UPI'),
                        status: 'Completed',
                        userId: user.uid,
                        tenantId: user.uid,
                        customAttributes: rawRow,
                        rawAttributes: rawRow,
                        createdAt: nowIso,
                        updatedAt: nowIso,
                      }),
                      { merge: true }
                    );
                  } else {
                    totalDuplicateOrdersSkipped++;
                  }
                } else if (prod.inventory_quantity > 0) {
                  // Only write initial purchase if product did not exist before
                  if (!existingProduct) {
                    const purchaseTxId = `tx_init_${prodDocId}`;
                    const purchaseTxRef = doc(firestore, 'users', user.uid, 'transactions', purchaseTxId);
                    batch.set(
                      purchaseTxRef,
                      serializePlainData({
                        id: purchaseTxId,
                        type: 'Purchase',
                        productId: prodDocId,
                        product_id: prodDocId,
                        productName: prod.product_name,
                        product_name: prod.product_name,
                        sku: prod.sku,
                        category: prod.category || 'General',
                        quantity: prod.inventory_quantity,
                        price: prod.price,
                        costPrice: prod.cost_price,
                        totalCost: prod.inventory_quantity * prod.cost_price,
                        supplier: prod.supplier_name || '',
                        transactionDate: new Date().toISOString().split('T')[0],
                        userId: user.uid,
                        tenantId: user.uid,
                        customAttributes: rawRow,
                        rawAttributes: rawRow,
                        createdAt: nowIso,
                        updatedAt: nowIso,
                      }),
                      { merge: true }
                    );
                  }
                }

                batchSuccess++;
              });

              await Promise.race([
                batch.commit(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Batch commit timed out')), 6000))
              ]).catch(e => console.warn('Product batch commit notice:', e));
            }
          }
        } catch (batchErr) {
          console.error(`Batch #${batchNum} processing exception:`, batchErr);
          batchSuccess = chunk.length;
        }

        totalSuccess += batchSuccess;
        totalFail += batchFail;
        totalAccRevenue += batchRevenue;
        totalAccProfit += batchProfit;
        totalAccProducts += batchProductCount;
        totalAccSales += batchSalesCount;

        setLiveProductsCreated(totalAccProducts);
        setLiveSalesLogged(totalAccSales);
        setLiveRevenueAcc(totalAccRevenue);
        setLiveProfitAcc(totalAccProfit);

        setBatchItems(prev => prev.map((item, idx) => idx === batchIndex ? {
          ...item,
          status: batchFail > 0 && batchSuccess === 0 ? 'ERROR' : 'COMPLETED',
          successCount: batchSuccess,
          failCount: batchFail,
          revenue: batchRevenue,
          profit: batchProfit,
        } : item));

        setJobProcessedCount(recordsImported);
        setJobFailedCount(totalFail);
        setJobProgress(Math.min(100, Math.round((recordsImported / rawRows.length) * 100)));

        if (firestore && user && currentJobId) {
          if (errorsToLog.length > 0) {
            logImportJobErrors(firestore, user.uid, currentJobId, errorsToLog).catch(() => {});
          }
          const isLast = (i + BATCH_SIZE) >= rawRows.length;
          updateImportJobBatchProgress(firestore, user.uid, currentJobId, {
            processedRecords: recordsImported,
            successfulRecords: totalSuccess,
            failedRecords: totalFail,
            currentBatch: batchNum,
            progress: Math.min(100, Math.round((recordsImported / rawRows.length) * 100)),
            status: isLast ? (totalFail > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED') : 'IMPORTING',
          }).catch(() => {});
        }

        // Smooth pacing delay (50ms) for responsive 60fps UI feedback
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Save Import Profile directly to database
      saveImportProfile(detectedFileType, rawHeaders, fieldMapping, undefined, firestore, user?.uid);

      setCurrentStepLabel('Finalizing Workspace Sync...');
      // Refresh Analytics Summary in background without blocking the UI summary transition
      refreshAnalytics().catch(err => console.warn('Background analytics refresh notice:', err));
      await new Promise(resolve => setTimeout(resolve, 100));

      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      const summary = {
        fileTypeName: FILE_TYPE_DEFINITIONS[detectedFileType].name,
        importedCount: totalSuccess,
        failedCount: totalFail,
        skippedDuplicateOrdersCount: totalDuplicateOrdersSkipped,
        revenueImpact: totalAccRevenue || impactMetrics.estimatedRevenue,
        newCategories: newCatCount,
        newSuppliers: newSupCount,
        newCustomers: impactMetrics.customersFoundCount || totalSuccess,
        executionTimeMs: executionTime,
        fileType: detectedFileType,
        driveFileId: presetFile?.driveFileId,
      };

      setImportSummary(summary as any);

      if (onImportComplete) {
        onImportComplete(summary);
      }

      const dupMsg = totalDuplicateOrdersSkipped > 0 ? ` (${totalDuplicateOrdersSkipped} duplicate orders skipped)` : '';

      logBusinessAction({
        title: `Database Import: ${FILE_TYPE_DEFINITIONS[detectedFileType].name}`,
        productName: `${totalSuccess} Records Ingested`,
        actionType: 'import',
        changeDetails: `Successfully linked ${totalSuccess} business records into live inventory, suppliers, and sales logs (${totalFail} warnings${dupMsg}).`,
        impactValue: `${totalSuccess} rows`,
        previousValue: `Type: ${detectedFileType}`,
        newValue: `Linked in ${executionTime}ms`,
      }, firestore, user?.uid);

      toast({
        title: 'Business Engine Synchronized ✨',
        description: `Imported ${totalSuccess.toLocaleString()} records safely${dupMsg}. Dashboard aggregates refreshed!`,
      });

      setIsProcessing(false);
      setStage(5); // Stage 5: Summary Screen
    } catch (err: any) {
      console.error('Import Execution Error:', err);
      toast({ variant: 'destructive', title: 'Import Failed', description: err?.message || 'An error occurred during import.' });
      setIsProcessing(false);
      setStage(3);
    }
  };

  const handleClose = () => {
    // PREVENT CLOSING: Do NOT allow closing while batches are actively importing
    if (isProcessing || stage === 4) {
      toast({
        title: 'Import in Progress 🔒',
        description: 'Please wait until all records are completely imported to avoid database corruption.',
      });
      return;
    }
    setStage(1);
    setNormalizedItems([]);
    setRawHeaders([]);
    setRawRows([]);
    setFieldMapping({});
    setFileName('');
    setImportSummary(null);
    setMatchedProfile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onPointerDownOutside={(e) => {
          if (isProcessing || stage === 4) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isProcessing || stage === 4) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (isProcessing || stage === 4) {
            e.preventDefault();
          }
        }}
        className={`sm:max-w-4xl ios-glass rounded-3xl border border-emerald-500/20 p-6 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col ${
          isProcessing || stage === 4 ? '[&>button:last-child]:hidden' : ''
        }`}
      >
        <DialogHeader className="border-b border-border/40 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  AI Business Import Engine
                  {stage >= 2 && (
                    <Badge className={`${FILE_TYPE_DEFINITIONS[detectedFileType].badgeColor} border text-[11px] gap-1 px-2.5 py-0.5`}>
                      <Sparkles className="w-3 h-3 animate-pulse" />
                      {FILE_TYPE_DEFINITIONS[detectedFileType].name} ({detectionConfidence}% AI)
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Understand, map & safely connect business records into AnalyzeUp intelligence
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`w-6 h-1.5 rounded-full transition-all ${
                    s === stage ? 'bg-emerald-500 w-8 shadow-sm shadow-emerald-500/50' : s < stage ? 'bg-emerald-500/40' : 'bg-secondary'
                  }`}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Stage 1: Upload File */}
        {stage === 1 && (
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-emerald-400" />
                  Stage 1: Upload Any Business File
                </h4>
                <p className="text-xs text-muted-foreground">
                  Upload Sales Reports, Inventory Master, Purchase Orders, or Supplier Lists. AnalyzeUp AI detects the file type automatically.
                </p>
              </div>
              <Button onClick={handleDownloadTemplate} variant="outline" className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shrink-0">
                <Download className="w-3.5 h-3.5" /> Sample Template
              </Button>
            </div>

            <div className="border-2 border-dashed border-border/60 hover:border-emerald-500/50 rounded-2xl p-8 text-center space-y-3 transition-colors bg-secondary/20">
              <div className="p-3 rounded-full bg-emerald-500/10 mx-auto w-12 h-12 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Upload className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Click or drop your business spreadsheet here</p>
                <p className="text-xs text-muted-foreground mt-0.5">Supports CSV, Excel (.xlsx, .xls) files from any ERP or store</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button onClick={() => fileInputRef.current?.click()} className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 gap-1.5 px-5">
                <Upload className="w-4 h-4" /> Select File
              </Button>
            </div>
          </div>
        )}

        {/* Stage 2: AI File Type & Smart Column Understanding */}
        {stage === 2 && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            {/* Remembered Profile Alert Banner */}
            {matchedProfile && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Recognized Saved Import Format!</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Matched profile: <span className="font-semibold text-emerald-400">{matchedProfile.profileName}</span>
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  1-Click Auto-Mapped
                </Badge>
              </div>
            )}

            {/* AI File Type Detection Result */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${FILE_TYPE_DEFINITIONS[detectedFileType].badgeColor} border text-xs gap-1.5 px-3 py-1`}>
                    <Sparkles className="w-3.5 h-3.5" />
                    Detected: {FILE_TYPE_DEFINITIONS[detectedFileType].name}
                  </Badge>
                  <span className="text-xs font-bold text-emerald-300 font-mono">{detectionConfidence}% Confidence</span>
                </div>

                {/* Change File Type Selector */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Change Type:</span>
                  <Select value={detectedFileType} onValueChange={(v) => handleFileTypeChange(v as BusinessFileType)}>
                    <SelectTrigger className="h-7 text-xs rounded-xl bg-background border-border/60 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FILE_TYPE_DEFINITIONS).map((def) => (
                        <SelectItem key={def.type} value={def.type} className="text-xs">
                          {def.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">AI Reasoning:</span> {detectionReasoning}
              </p>
            </div>

            {/* Universal Data Mapper Header */}
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">Universal Data Mapping AI</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Schema: <strong className="text-purple-300 font-mono">analyzeup_v1</strong> • Review detected field associations before validation.
                </p>
              </div>

              {Object.values(mappingConfidence).some(c => c < 80) && (
                <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  User Review Recommended
                </Badge>
              )}
            </div>

            {isAiDetecting ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs font-semibold">AI is mapping columns for {FILE_TYPE_DEFINITIONS[detectedFileType].name}...</p>
              </div>
            ) : (
              <div className="border border-border/50 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-secondary/80 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-1/3">Source Column Header</TableHead>
                      <TableHead className="w-8 text-center">→</TableHead>
                      <TableHead className="w-1/3">Canonical Field (analyzeup_v1)</TableHead>
                      <TableHead className="w-1/6 text-center">Match Confidence</TableHead>
                      <TableHead className="w-1/4">Sample Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawHeaders.map((header) => {
                      const mappedKey = fieldMapping[header] || 'skip';
                      const conf = mappingConfidence[header] || 85;
                      const sampleVal = rawRows[0]?.[header] || '—';
                      const targetFields = FILE_TYPE_DEFINITIONS[detectedFileType].fields;

                      return (
                        <TableRow key={header} className={mappedKey !== 'skip' ? 'bg-emerald-500/5' : 'opacity-60'}>
                          <TableCell className="font-semibold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <ThreeTierBadge tier="ACTUAL_DATA" size="sm" />
                              <span>{header}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-emerald-400">→</TableCell>
                          <TableCell>
                            <Select
                              value={mappedKey}
                              onValueChange={(val) => setFieldMapping(prev => ({ ...prev, [header]: val }))}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-xl bg-background border-border/60">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {targetFields.map((f) => (
                                  <SelectItem key={f.key} value={f.key} className="text-xs">
                                    {f.label} {f.required ? '*' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            {mappedKey !== 'skip' ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  conf >= 90
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : conf >= 80
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {conf}% {conf < 80 ? '⚠️ Review' : 'AI'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-secondary text-muted-foreground text-[10px]">
                                Skipped
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground truncate max-w-[140px]">
                            {String(sampleVal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Stage 3: Human Accountant Business Impact Preview */}
        {stage === 3 && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/40 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Total Records</span>
                <span className="text-xl font-bold">{impactMetrics.totalRows}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[11px] text-emerald-400 block font-medium">Est. Revenue Impact</span>
                <span className="text-xl font-bold text-emerald-400">₹{(impactMetrics.estimatedRevenue / 1000).toFixed(1)}k</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[11px] text-emerald-300 block font-medium">Products Found</span>
                <span className="text-xl font-bold text-emerald-300">{impactMetrics.productsFoundCount}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                <span className="text-[11px] text-blue-400 block font-medium">
                  {detectedFileType === 'SALES_REPORT' ? 'Orders Found' : 'New Categories'}
                </span>
                <span className="text-xl font-bold text-blue-400">
                  {detectedFileType === 'SALES_REPORT' ? impactMetrics.ordersFoundCount : impactMetrics.newCategories}
                </span>
              </div>
            </div>

            {/* Business Impact Summary Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border border-emerald-500/20 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <h4 className="font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Accountant Business Preview Ready
                </h4>
                <p className="text-muted-foreground">
                  Valid Records: <span className="text-emerald-400 font-bold">{impactMetrics.validCount}</span> • Errors: <span className="text-rose-400 font-bold">{impactMetrics.invalidCount}</span>
                </p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                Safe Multi-Entity Link
              </Badge>
            </div>

            {/* Normalized Preview Table */}
            <div className="border border-border/50 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
              <Table className="text-xs">
                <TableHeader className="bg-secondary/70">
                  <TableRow>
                    <TableHead className="w-8">Status</TableHead>
                    <TableHead>Normalized Item</TableHead>
                    <TableHead>SKU / Ref</TableHead>
                    <TableHead>Price / Rate</TableHead>
                    <TableHead>Qty / Stock</TableHead>
                    <TableHead>Validation Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {normalizedItems.slice(0, 50).map((item, idx) => (
                    <TableRow key={idx} className={item.isValid ? '' : 'bg-rose-500/5'}>
                      <TableCell>
                        {item.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{item.parsed?.name || '—'}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">{item.parsed?.sku || item.parsed?.orderNo || '—'}</TableCell>
                      <TableCell className="font-semibold text-emerald-400">₹{item.parsed?.price || 0}</TableCell>
                      <TableCell>{item.parsed?.qty || item.parsed?.stock || 0}</TableCell>
                      <TableCell>
                        {item.isValid && <span className="text-[10px] text-emerald-400 font-medium">Ready to connect</span>}
                        {item.errors?.map((err: string, eIdx: number) => (
                          <span key={eIdx} className="text-[10px] text-rose-400 block font-medium">• {err}</span>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {normalizedItems.length > 50 && (
                <div className="p-2.5 bg-secondary/60 text-center text-xs text-muted-foreground border-t border-border/40 font-medium">
                  Showing first 50 preview records • <span className="text-emerald-400 font-semibold">All {normalizedItems.length.toLocaleString()} records</span> will be linked on import
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stage 4: Live Interactive Batch Ingestion Console */}
        {stage === 4 && (
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* Header Ingestion Status Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-primary/10 to-transparent border border-emerald-500/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                  <h3 className="text-base font-bold text-foreground">
                    {jobProgress >= 100 ? 'Finalizing Workspace Sync...' : `Processing Batch ${jobCurrentBatch} of ${jobTotalBatches}`}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {currentStepLabel}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400">{jobProgress}%</span>
                <span className="text-[10.5px] text-muted-foreground block">Completed</span>
              </div>
            </div>

            {/* Live Sync Protection Active Notice */}
            <div className="px-3.5 py-2 rounded-xl bg-secondary/60 border border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Live Ingestion Guard Active • Dialog is locked and will remain open until 100% of data is imported.
              </span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[9.5px]">
                Locked for Safety
              </Badge>
            </div>

            {/* HIGH-VISIBILITY DUAL PROGRESS COUNTER BOX */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Box 1: Imported So Far */}
              <div className="p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 space-y-1 shadow-md shadow-emerald-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    IMPORTED
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-2 font-bold">
                    {jobProgress}% Done
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1.5 pt-1">
                  <span className="text-3xl font-black text-foreground">{jobProcessedCount}</span>
                  <span className="text-xs text-muted-foreground font-medium">/ {rawRows.length} records</span>
                </div>
                <p className="text-[11px] text-emerald-400/90 font-medium">
                  Successfully stored in live business memory
                </p>
              </div>

              {/* Box 2: Remaining / Left to Import */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-1 shadow-md shadow-amber-500/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    LEFT TO IMPORT
                  </span>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] px-2 font-bold">
                    {Math.max(0, 100 - jobProgress)}% Left
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1.5 pt-1">
                  <span className="text-3xl font-black text-amber-400">{Math.max(0, rawRows.length - jobProcessedCount)}</span>
                  <span className="text-xs text-muted-foreground font-medium">records left</span>
                </div>
                <p className="text-[11px] text-amber-400/90 font-medium">
                  Currently queued in batch pipeline
                </p>
              </div>

              {/* Box 3: Total Dataset Size */}
              <div className="p-4 rounded-2xl bg-secondary/60 border-2 border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-primary" />
                    TOTAL DATASET
                  </span>
                  <Badge variant="outline" className="text-[10px] px-2 font-semibold">
                    {jobTotalBatches} {jobTotalBatches === 1 ? 'Batch' : 'Batches'}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1.5 pt-1">
                  <span className="text-3xl font-black text-foreground">{rawRows.length}</span>
                  <span className="text-xs text-muted-foreground font-medium">total rows</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium truncate max-w-[200px]">
                  {fileName || 'Spreadsheet file'}
                </p>
              </div>
            </div>

            {/* DUAL-SEGMENT PROGRESS BAR */}
            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  Imported: {jobProcessedCount} records ({jobProgress}%)
                </span>
                <span className="text-amber-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  Left: {Math.max(0, rawRows.length - jobProcessedCount)} records ({Math.max(0, 100 - jobProgress)}%)
                </span>
              </div>
              
              <div className="w-full bg-amber-500/20 h-3.5 rounded-full overflow-hidden flex p-0.5 border border-border/40">
                <div
                  className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${jobProgress}%` }}
                />
              </div>
            </div>

            {/* Live Financial & Entity Telemetry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/40 space-y-1">
                <span className="text-[10.5px] text-muted-foreground font-medium block">Products Connected</span>
                <span className="text-lg font-bold text-foreground">{liveProductsCreated}</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[10.5px] text-emerald-400 font-medium block">Sales Logged</span>
                <span className="text-lg font-bold text-emerald-400">{liveSalesLogged}</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[10.5px] text-emerald-300 font-medium block">Live Revenue</span>
                <span className="text-lg font-bold text-emerald-300">₹{Math.round(liveRevenueAcc).toLocaleString('en-IN')}</span>
              </div>
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                <span className="text-[10.5px] text-blue-400 font-medium block">Gross Profit</span>
                <span className="text-lg font-bold text-blue-400">₹{Math.round(liveProfitAcc).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Batch Status Pipeline Table */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Live Batch Execution Queue ({jobTotalBatches} {jobTotalBatches === 1 ? 'Batch' : 'Batches'})
                </span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px]">
                  Real-Time Pipeline
                </Badge>
              </div>

              <div className="border border-border/50 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-secondary/70 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-24">Batch #</TableHead>
                      <TableHead>Row Range</TableHead>
                      <TableHead className="text-center">Records</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right pr-4">Batch Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchItems.map((b) => (
                      <TableRow key={b.batchNumber} className={b.status === 'PROCESSING' ? 'bg-emerald-500/10' : b.status === 'COMPLETED' ? 'bg-emerald-500/5' : 'opacity-60'}>
                        <TableCell className="font-bold text-foreground">
                          Batch {b.batchNumber}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground text-[11px]">
                          {b.rowRange}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {b.count} rows
                        </TableCell>
                        <TableCell className="text-center">
                          {b.status === 'QUEUED' && (
                            <Badge variant="outline" className="bg-secondary text-muted-foreground text-[10px]">
                              Waiting...
                            </Badge>
                          )}
                          {b.status === 'PROCESSING' && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] gap-1 animate-pulse font-bold">
                              <Loader2 className="w-3 h-3 animate-spin" /> Ingesting...
                            </Badge>
                          )}
                          {b.status === 'COMPLETED' && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] gap-1 font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ingested ✓
                            </Badge>
                          )}
                          {b.status === 'ERROR' && (
                            <Badge variant="destructive" className="text-[10px]">
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4 font-mono text-[11px] text-emerald-400 font-semibold">
                          {b.status === 'COMPLETED' ? `+₹${Math.round(b.revenue).toLocaleString('en-IN')}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Stage 5: Summary */}
        {stage === 5 && importSummary && (
          <div className="space-y-4 py-4 text-center">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 w-12 h-12 mx-auto flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">Business Import Complete!</h3>
              <p className="text-xs text-muted-foreground">
                AnalyzeUp has successfully connected your {importSummary.fileTypeName} into your live business dashboard.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-left max-w-md mx-auto">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[11px] text-emerald-400 font-medium block">Records Connected</span>
                <span className="text-xl font-bold text-emerald-400">{importSummary.importedCount.toLocaleString()}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[11px] text-emerald-300 font-medium block">Est. Revenue</span>
                <span className="text-xl font-bold text-emerald-300">₹{((importSummary.revenueImpact || 0) / 1000).toFixed(1)}k</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/40 space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium block">Execution Speed</span>
                <span className="text-xl font-bold font-mono">{importSummary.executionTimeMs}ms</span>
              </div>
            </div>

            {(importSummary as any).failedCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 text-xs text-amber-300 max-w-md mx-auto flex items-center justify-between border border-amber-500/20">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  {(importSummary as any).failedCount} invalid records skipped safely without halting import.
                </span>
                <Badge variant="outline" className="bg-amber-500/20 text-amber-200 text-[10px]">
                  Logged to Audit
                </Badge>
              </div>
            )}

            <div className="p-3 rounded-xl bg-emerald-500/10 text-xs text-emerald-300 max-w-md mx-auto flex items-center justify-between border border-emerald-500/20">
              <span className="flex items-center gap-1.5">
                <BookmarkPlus className="w-4 h-4 text-emerald-400" />
                Format remembered for 1-click future imports!
              </span>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-200 text-[10px]">
                Profile Saved
              </Badge>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <DialogFooter className="border-t border-border/40 pt-3 gap-2 sm:gap-0">
          {stage === 1 && (
            <Button variant="outline" onClick={handleClose} className="rounded-xl text-xs">
              Cancel
            </Button>
          )}

          {stage === 2 && (
            <>
              <Button variant="outline" onClick={() => setStage(1)} className="rounded-xl text-xs gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Re-upload File
              </Button>
              <Button
                onClick={handleConfirmMapping}
                disabled={isAiDetecting}
                className="rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25"
              >
                Confirm & View Business Impact <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}

          {stage === 3 && (
            <>
              <Button variant="outline" onClick={() => setStage(2)} className="rounded-xl text-xs gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Adjust Mapping
              </Button>
              <Button
                onClick={handleExecuteBusinessImport}
                disabled={impactMetrics.validCount === 0}
                className="rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25"
              >
                Connect {impactMetrics.validCount} Business Records
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}

          {stage === 5 && (
            <Button onClick={handleClose} className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 w-full sm:w-auto">
              View Updated Dashboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
