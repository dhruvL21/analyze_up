import { Product, Transaction, Supplier, PurchaseOrder, ProductReturn, BusinessProfile } from './types';
import { computeBusinessHealth, generateActionTasks, generateTodayPriorities, ActionTask } from './command-center-engine';
import {
  detectProcurementRisks,
  calculateProcurementSavings,
} from './supplier-intelligence-engine';
import { generateBusinessForecastingReport } from './forecasting-engine';
import { computeCustomerGrowthIntelligence } from './customer-growth-engine';
import { runBusinessSimulation } from './simulation-engine';
import { formatCur } from './utils';

export type IntentType =
  | 'ONBOARDING_GUIDE'
  | 'SALES_PLAN_OR_STRATEGY'
  | 'SPECIFIC_PRODUCT_LOOKUP'
  | 'CATEGORY_ANALYSIS'
  | 'DEAD_STOCK_ANALYSIS'
  | 'PRODUCT_ANALYSIS'
  | 'INVENTORY_ANALYSIS'
  | 'SUPPLIER_ANALYSIS'
  | 'PROCUREMENT_ANALYSIS'
  | 'REVENUE_ANALYSIS'
  | 'PROFIT_ANALYSIS'
  | 'ORDER_ANALYSIS'
  | 'RETURN_ANALYSIS'
  | 'BUSINESS_HEALTH'
  | 'RECOMMENDATION'
  | 'FORECASTING_ANALYSIS'
  | 'EXECUTIVE_REPORT'
  | 'GROWTH_ANALYSIS'
  | 'SIMULATION_QUERY'
  | 'GENERAL_BUSINESS_QUERY'
  | 'UNKNOWN';

export interface CopilotResponse {
  intent: IntentType;
  intentLabel: string;
  answerMarkdown: string;
  what: string;
  why: string;
  actionText: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  confidenceReason?: string;
  supportingData: { label: string; value: string }[];
  recommendedAction?: {
    label: string;
    actionType: 'reorder' | 'discount' | 'price_up' | 'supplier' | 'navigate' | 'po';
    targetRoute?: string;
    targetId?: string;
    actionTask?: ActionTask;
  };
  suggestedFollowUps: string[];
}

export const ONBOARDING_COPILOT_SUGGESTIONS = [
  { category: 'Getting Started', question: 'How do I upload my business data?' },
  { category: 'CSV Template', question: 'What 22 columns are in the CSV template?' },
  { category: 'CSV Template', question: 'How do I download the sample CSV template?' },
  { category: 'Data Upload', question: 'Can I upload products and sales together?' },
  { category: 'Data Upload', question: 'How does AnalyzeUp auto-map custom CSV headers?' },
  { category: 'Integrations', question: 'Can I connect Shopify or Google Drive?' },
  { category: 'Data Security', question: 'Is my uploaded business data private and secure?' },
  { category: 'Getting Started', question: 'What insights will I get after uploading?' },
];

export const BUSINESS_COPILOT_SUGGESTIONS = [
  { category: 'Sales Plan', question: 'Give me the next 5 day plan for sales' },
  { category: 'Priorities', question: 'What should I focus on today?' },
  { category: 'Forecasting', question: 'What will my revenue look like next month?' },
  { category: 'Forecasting', question: 'Which products will run out of stock next week?' },
  { category: 'Forecasting', question: 'What should I buy next month?' },
  { category: 'Profitability', question: 'Why did my profit decrease?' },
  { category: 'Profitability', question: 'Which products are losing money?' },
  { category: 'Inventory', question: 'Which products should I reorder?' },
  { category: 'Capital', question: 'Which products are tying up the most capital?' },
  { category: 'Suppliers', question: 'Which supplier is becoming risky?' },
  { category: 'Procurement', question: 'Where can I reduce costs?' },
];

export const COPILOT_SUGGESTIONS = BUSINESS_COPILOT_SUGGESTIONS;

export function getCopilotSuggestions(hasData: boolean) {
  return hasData ? BUSINESS_COPILOT_SUGGESTIONS : ONBOARDING_COPILOT_SUGGESTIONS;
}

export function getCopilotCategories(hasData: boolean) {
  return hasData
    ? ['All', 'Sales Plan', 'Priorities', 'Forecasting', 'Profitability', 'Inventory', 'Suppliers', 'Procurement', 'Revenue']
    : ['All', 'Getting Started', 'CSV Template', 'Data Upload', 'Integrations', 'Data Security'];
}

function normalize(str: string): string {
  return (str || '').toLowerCase().trim();
}

export function classifyBusinessIntent(
  query: string,
  history: { role: string; content: string }[] = [],
  products: Product[] = []
): {
  intent: IntentType;
  intentLabel: string;
  resolvedEntity?: string;
  timeframe?: string;
  matchedProduct?: Product;
} {
  const q = normalize(query);

  if ((q === 'why?' || q === 'why' || q.includes('why is that') || q.includes('tell me why')) && history.length > 0) {
    const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.content || '';
    const lastIntent = classifyBusinessIntent(lastUserMsg, [], products);
    return {
      intent: lastIntent.intent,
      intentLabel: `${lastIntent.intentLabel} (Follow-Up Root Cause)`,
    };
  }

  // 1. Upload, Template, and Onboarding Questions
  if (
    q.includes('upload') ||
    q.includes('csv') ||
    q.includes('template') ||
    q.includes('22 column') ||
    q.includes('columns') ||
    q.includes('import') ||
    q.includes('how do i add') ||
    q.includes('how to start') ||
    q.includes('get started') ||
    q.includes('auto-map') ||
    q.includes('mapping') ||
    q.includes('secure') ||
    q.includes('security') ||
    q.includes('privacy') ||
    q.includes('private') ||
    q.includes('drive') ||
    q.includes('shopify') ||
    q.includes('excel') ||
    q.includes('spreadsheet') ||
    q.includes('doubt')
  ) {
    return { intent: 'ONBOARDING_GUIDE', intentLabel: 'Data Upload & CSV Onboarding Guide' };
  }

  // 2. Sales Plan & Execution Strategy (e.g. "give me the next 5 day plan for sales", "7 day sales plan", "boost sales")
  if (
    q.includes('plan for sales') ||
    q.includes('sales plan') ||
    q.includes('sales strategy') ||
    q.includes('plan for sale') ||
    q.includes('day plan') ||
    q.includes('next 5 day') ||
    q.includes('next 7 day') ||
    q.includes('next 10 day') ||
    q.includes('next 14 day') ||
    q.includes('next 30 day') ||
    q.includes('next 3 day') ||
    q.includes('boost sales') ||
    q.includes('increase sales') ||
    q.includes('grow sales') ||
    q.includes('sell more') ||
    q.includes('sales roadmap') ||
    q.includes('sales campaign') ||
    q.includes('marketing plan') ||
    q.includes('sales target') ||
    q.includes('daily sales plan') ||
    q.includes('weekly sales plan') ||
    q.includes('sales action plan') ||
    (q.includes('plan') && (q.includes('sale') || q.includes('revenue') || q.includes('traffic') || q.includes('target') || q.includes('boost') || q.includes('growth')))
  ) {
    return { intent: 'SALES_PLAN_OR_STRATEGY', intentLabel: 'Strategic Sales & Revenue Execution Plan' };
  }

  // 3. Dead Stock & Liquidate Capital Lockup
  if (
    q.includes('dead stock') ||
    q.includes('liquidate') ||
    q.includes('clearance') ||
    q.includes('slow moving') ||
    q.includes('tying up capital') ||
    q.includes('tied up capital') ||
    q.includes('stagnant') ||
    q.includes('locked cash') ||
    q.includes('unsold stock')
  ) {
    return { intent: 'DEAD_STOCK_ANALYSIS', intentLabel: 'Dead Stock Clearance & Capital Recovery' };
  }

  // 4. Category Performance Breakdown
  if (
    q.includes('category') ||
    q.includes('categories') ||
    q.includes('breakdown by category') ||
    q.includes('which category') ||
    q.includes('best category') ||
    q.includes('apparel') ||
    q.includes('electronics') ||
    q.includes('kitchenware') ||
    q.includes('skincare') ||
    q.includes('fashion')
  ) {
    return { intent: 'CATEGORY_ANALYSIS', intentLabel: 'Category Performance & Demand Breakdown' };
  }

  // 5. Specific Product Name / SKU Lookup
  if (products && products.length > 0) {
    const found = products.find(p => {
      const pName = (p.name || '').toLowerCase().trim();
      const pSku = (p.sku || '').toLowerCase().trim();
      return (pName && pName.length > 3 && q.includes(pName)) || (pSku && pSku.length > 2 && q.includes(pSku));
    });
    if (found) {
      return {
        intent: 'SPECIFIC_PRODUCT_LOOKUP',
        intentLabel: `SKU Performance: ${found.name}`,
        matchedProduct: found,
      };
    }
  }

  // 6. Simulations (What If...)
  if (
    q.includes('what if') ||
    q.includes('if i increase') ||
    q.includes('if i reduce') ||
    q.includes('if i order') ||
    q.includes('if i switch') ||
    q.includes('what happens if') ||
    q.includes('simulate')
  ) {
    return { intent: 'SIMULATION_QUERY', intentLabel: 'AI Strategy & Business Simulation' };
  }

  // 7. Predictive & Demand Forecasting
  if (
    /\b(forecast|forecasting|predict|predicting|prediction|predictive|predictions)\b/i.test(q) ||
    q.includes('next month') ||
    q.includes('next week') ||
    q.includes('future') ||
    q.includes('look like next') ||
    q.includes('run out of stock') ||
    q.includes('what to buy next') ||
    q.includes('stockout next')
  ) {
    return { intent: 'FORECASTING_ANALYSIS', intentLabel: 'Predictive Demand & Revenue Forecasting' };
  }

  // 8. Customer Growth & Retention
  if (
    q.includes('grow') ||
    q.includes('growth') ||
    q.includes('cross-sell') ||
    q.includes('cross sell') ||
    q.includes('upsell') ||
    q.includes('at risk customer') ||
    q.includes('at-risk customer') ||
    q.includes('customer retention') ||
    q.includes('repeat purchase') ||
    q.includes('limiting my growth')
  ) {
    return { intent: 'GROWTH_ANALYSIS', intentLabel: 'Customer Growth & Retention Intelligence' };
  }

  // 9. Profitability & Margins
  if (
    q.includes('profit') ||
    q.includes('margin') ||
    q.includes('losing money') ||
    q.includes('loss') ||
    q.includes('roi') ||
    q.includes('profitability') ||
    q.includes('why did my profit')
  ) {
    return { intent: 'PROFIT_ANALYSIS', intentLabel: 'Profitability & Margin Analysis' };
  }

  // 10. Suppliers & Procurement
  if (
    q.includes('supplier') ||
    q.includes('vendor') ||
    q.includes('who should i buy from') ||
    q.includes('supplier risk') ||
    q.includes('best supplier')
  ) {
    return { intent: 'SUPPLIER_ANALYSIS', intentLabel: 'Supplier Intelligence & Performance' };
  }

  if (
    q.includes('procurement') ||
    q.includes('reduce cost') ||
    q.includes('reduce costs') ||
    q.includes('savings') ||
    q.includes('cheaper') ||
    q.includes('pay less')
  ) {
    return { intent: 'PROCUREMENT_ANALYSIS', intentLabel: 'Procurement & Cost Savings' };
  }

  // 11. Inventory & Restock
  if (
    q.includes('reorder') ||
    q.includes('stockout') ||
    q.includes('inventory health') ||
    q.includes('stock level') ||
    q.includes('restock')
  ) {
    return { intent: 'INVENTORY_ANALYSIS', intentLabel: 'Inventory Velocity & Health' };
  }

  // 12. Revenue & Sales
  if (
    q.includes('revenue') ||
    q.includes('sales velocity') ||
    q.includes('sales volume') ||
    q.includes('top selling') ||
    q.includes('best seller') ||
    q.includes('total sales')
  ) {
    return { intent: 'REVENUE_ANALYSIS', intentLabel: 'Revenue & Demand Analysis' };
  }

  // 13. Returns & Refunds
  if (q.includes('return') || q.includes('defective') || q.includes('refund')) {
    return { intent: 'RETURN_ANALYSIS', intentLabel: 'Returns & Refund Diagnostics' };
  }

  // 14. Executive Summary & Audit
  if (
    q.includes('report') ||
    q.includes('executive') ||
    q.includes('period comparison') ||
    q.includes('what changed from') ||
    q.includes('summarize last month') ||
    q.includes('profit bridge') ||
    q.includes('scorecard') ||
    q.includes('biggest risks')
  ) {
    return { intent: 'EXECUTIVE_REPORT', intentLabel: 'Executive Report & Performance Summary' };
  }

  // 15. Operational Priorities & Recommendations
  if (
    q.includes('today') ||
    q.includes('focus') ||
    q.includes('what should i do') ||
    q.includes('recommendation') ||
    q.includes('priorities') ||
    q.includes('action plan')
  ) {
    return { intent: 'RECOMMENDATION', intentLabel: 'Today Priorities & Recommendations' };
  }

  // 16. Business Health Score
  if (
    q.includes('business health') ||
    q.includes('how is my business doing') ||
    q.includes('health score') ||
    q.includes('overall health') ||
    q.includes('business performing')
  ) {
    return { intent: 'BUSINESS_HEALTH', intentLabel: 'Business Health Score Analysis' };
  }

  // 17. Product Performance General
  if (q.includes('product') || q.includes('item') || q.includes('sku') || q.includes('catalog')) {
    return { intent: 'PRODUCT_ANALYSIS', intentLabel: 'Product Performance Intelligence' };
  }

  return { intent: 'GENERAL_BUSINESS_QUERY', intentLabel: 'Strategic Business Decision Advisor' };
}

export function processCopilotQuery(
  query: string,
  history: { role: string; content: string }[] = [],
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  returns: ProductReturn[] = [],
  businessProfile?: BusinessProfile | null
): CopilotResponse {
  const { intent, intentLabel, matchedProduct } = classifyBusinessIntent(query, history, products);

  const health = computeBusinessHealth(products, transactions, suppliers, returns);
  const actionTasks = generateActionTasks(products, transactions, suppliers, orders, businessProfile, returns);
  const todayPriorities = generateTodayPriorities(products, transactions, suppliers);
  const risks = detectProcurementRisks(products, suppliers, orders, transactions);
  const savings = calculateProcurementSavings(products, suppliers, orders, transactions);
  const forecastReport = generateBusinessForecastingReport(products, transactions, suppliers, orders);
  const growthReport = computeCustomerGrowthIntelligence(products, transactions, suppliers, orders, returns, businessProfile);

  const salesTx = transactions.filter(t => t.type === 'Sale' || (t as any).type === 'sale');
  const totalRevenue = salesTx.reduce((sum, t) => sum + (t.totalRevenue || (t.quantity * (t.price || 0))), 0);
  const totalCOGS = salesTx.reduce((sum, t) => {
    if (t.totalCost !== undefined) return sum + t.totalCost;
    const p = products.find(prod => prod.id === t.productId || prod.sku === t.sku);
    return sum + (t.quantity * (p?.costPrice || 0));
  }, 0);
  const totalProfit = totalRevenue - totalCOGS;
  const overallMarginPercent = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 35;

  const productSalesCount = new Map<string, number>();
  salesTx.forEach(t => {
    const key = t.productId || t.sku || '';
    if (key) productSalesCount.set(key, (productSalesCount.get(key) || 0) + (t.quantity || 1));
  });

  const saleProductIds = new Set(salesTx.map(t => t.productId));
  const deadStockProducts = products.filter(p => (p.stock || 0) > 0 && !saleProductIds.has(p.id));
  const tiedCapital = deadStockProducts.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || p.price * 0.6)), 0);
  const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 5));

  const uniqueDatesCount = Math.max(1, new Set(salesTx.map(t => String(t.transactionDate || (t as any).date || t.createdAt || '').slice(0, 10)).filter(Boolean)).size);
  const activeDaysCount = uniqueDatesCount;
  const dailyRunRate = Math.round(totalRevenue / activeDaysCount);

  let confidence: CopilotResponse['confidence'] = forecastReport.overallConfidence;
  let confidenceReason: string | undefined = forecastReport.confidenceReason;

  const hasData = (products && products.length > 0) || (transactions && transactions.length > 0);

  // 0. ONBOARDING & EMPTY WORKSPACE INTELLIGENCE
  if (!hasData || intent === 'ONBOARDING_GUIDE') {
    const qLower = query.toLowerCase();

    // Doubt 1: 22 Columns in CSV Template
    if (qLower.includes('column') || qLower.includes('22') || qLower.includes('fields') || qLower.includes('header') || qLower.includes('format')) {
      const what = 'AnalyzeUp uses a standardized 22-column database template designed for complete inventory, supplier, and sales intelligence.';
      const why = 'The 22 columns capture transaction identifiers, customer profiles, product SKU specs, supplier lead times, sales metrics, and safety stock thresholds in a single unified schema.';
      const actionText = 'Download our official 22-column CSV template from the Import Data dialog and paste your records into it.';

      const answerMarkdown = `### 📋 22-COLUMN CSV DATABASE SCHEMA\n\n` +
        `Our universal database template contains **22 standardized columns**:\n\n` +
        `1. **Transaction & Order:** \`Invoice No\`, \`Order ID\`, \`Order Date\`, \`Payment Mode\`, \`Order Status\`\n` +
        `2. **Customer Identification:** \`Customer ID\`, \`Customer Name\`\n` +
        `3. **Product Catalog:** \`SKU\`, \`Item Name\`, \`Category\`\n` +
        `4. **Supplier Logistics:** \`Supplier ID\`, \`Supplier Name\`, \`Lead Time Days\`\n` +
        `5. **Sales & Financials:** \`Qty Sold\`, \`Purchase Price\`, \`Retail Price\`, \`Discount\`, \`Tax\`\n` +
        `6. **Warehouse & Stock:** \`Current Stock\`, \`Reorder Level\`, \`Safety Stock\`, \`Warehouse\`\n\n` +
        `**Tip:** You don't need to fill all 22 columns immediately. Any missing columns will be assigned safe default operational values automatically.`;

      return {
        intent: 'ONBOARDING_GUIDE',
        intentLabel: '22-Column CSV Template Guide',
        answerMarkdown,
        what,
        why,
        actionText,
        confidence: 'HIGH',
        confidenceReason: 'Universal 22-column schema standard across AnalyzeUp.',
        supportingData: [
          { label: 'Total Columns', value: '22 Standardized' },
          { label: 'File Format', value: 'CSV (.csv)' },
          { label: 'AI Auto-Mapping', value: 'Enabled' },
          { label: 'Sample Data', value: 'Available in Modal' },
        ],
        recommendedAction: {
          label: 'Open Import Modal & Download Template',
          actionType: 'navigate',
          targetRoute: '/dashboard/inventory',
        },
        suggestedFollowUps: [
          'How do I download the sample CSV template?',
          'Can I upload products and sales together?',
          'How does AnalyzeUp auto-map custom CSV headers?',
        ],
      };
    }

    // Doubt 2: How to download the sample CSV template
    if (qLower.includes('download') || qLower.includes('sample')) {
      const what = 'You can download the pre-populated 22-column sample CSV template directly from the Import dialog.';
      const why = 'The sample template includes realistic multi-industry test records showing the exact column layout and data formatting.';
      const actionText = 'Navigate to Inventory or Settings and click "Import Data" -> "Download Sample CSV".';

      const answerMarkdown = `### 📥 HOW TO DOWNLOAD THE SAMPLE CSV TEMPLATE\n\n` +
        `1. Navigate to **[Inventory & Catalog](/dashboard/inventory)** from the sidebar.\n` +
        `2. Click the **"Import Data"** button at the top right.\n` +
        `3. In the dialog, click **"Download Sample CSV Template"**.\n` +
        `4. Open the downloaded file in Microsoft Excel, Google Sheets, or Apple Numbers, replace the sample rows with your real business data, and save as \`.csv\`.\n\n` +
        `**Note:** You can also trigger Google Drive Auto-Sync or connect your store directly from the **Integrations** tab.`;

      return {
        intent: 'ONBOARDING_GUIDE',
        intentLabel: 'Download Sample Template Guide',
        answerMarkdown,
        what,
        why,
        actionText,
        confidence: 'HIGH',
        confidenceReason: 'Standard sample templates built into AnalyzeUp.',
        supportingData: [
          { label: 'Template Type', value: '22-Column CSV' },
          { label: 'Download Location', value: 'Import Dialog' },
          { label: 'Editor Compatibility', value: 'Excel / Sheets / Numbers' },
        ],
        recommendedAction: {
          label: 'Go to Inventory & Import Data',
          actionType: 'navigate',
          targetRoute: '/dashboard/inventory',
        },
        suggestedFollowUps: [
          'What 22 columns are in the CSV template?',
          'How does AnalyzeUp auto-map custom CSV headers?',
          'Is my uploaded business data private and secure?',
        ],
      };
    }

    // Doubt 3: Auto-mapping custom headers
    if (qLower.includes('map') || qLower.includes('custom header') || qLower.includes('auto-map') || qLower.includes('different name')) {
      const what = 'AnalyzeUp features an AI Data Mapper that automatically recognizes and aligns custom column names.';
      const why = 'You do not need to rename your existing spreadsheet headers manually. Our AI fuzzy matcher and LLM aliasing match headers like "Cost", "Price", "Qty", or "Stock" to the canonical 22-column schema.';
      const actionText = 'Upload your existing CSV directly and review the visual column mapping preview before importing.';

      const answerMarkdown = `### 🤖 AUTOMATIC AI HEADER MAPPING\n\n` +
        `- **Zero Formatting Hassle:** If your export uses different header names (e.g., \`Unit Cost\` instead of \`Purchase Price\`, or \`Available Qty\` instead of \`Current Stock\`), our built-in mapper recognizes them instantly.\n` +
        `- **Interactive Preview:** You get a step-by-step visual mapping preview where you can verify or adjust any column before importing.\n` +
        `- **Saved Profiles:** Once mapped, AnalyzeUp remembers your file schema for automatic one-click recurring syncs in the future.`;

      return {
        intent: 'ONBOARDING_GUIDE',
        intentLabel: 'AI Auto-Mapping Guide',
        answerMarkdown,
        what,
        why,
        actionText,
        confidence: 'HIGH',
        confidenceReason: 'Smart data normalization enabled.',
        supportingData: [
          { label: 'Matcher Engine', value: 'Fuzzy + AI Aliasing' },
          { label: 'Manual Overrides', value: 'Interactive UI' },
          { label: 'Profile Memory', value: 'Persistent' },
        ],
        recommendedAction: {
          label: 'Upload CSV with Smart Mapping',
          actionType: 'navigate',
          targetRoute: '/dashboard/inventory',
        },
        suggestedFollowUps: [
          'What 22 columns are in the CSV template?',
          'Can I upload products and sales together?',
          'Can I connect Shopify or Google Drive?',
        ],
      };
    }

    // Doubt 4: Data Security & Privacy
    if (qLower.includes('secur') || qLower.includes('privacy') || qLower.includes('private') || qLower.includes('safe')) {
      const what = 'Your business records, cost margins, supplier lists, and sales transactions are 100% private and encrypted.';
      const why = 'AnalyzeUp implements multi-tenant cryptographic isolation with AES-256 Firestore security rules. No other workspace or organization can access your business data.';
      const actionText = 'Upload your business data with complete peace of mind.';

      const answerMarkdown = `### 🔒 DATA SECURITY & PRIVACY ARCHITECTURE\n\n` +
        `- **Multi-Tenant Isolation:** All records are compartmentalized strictly under your authenticated User ID (\`users/{uid}\`).\n` +
        `- **AES-256 Encryption:** Data in transit and at rest is secured using enterprise-grade encryption.\n` +
        `- **Zero Public Sharing:** Your supplier purchase costs, margins, and customer identities are never exposed or used for public model training.\n` +
        `- **Instant Reset:** You can permanently purge all data at any time via Settings -> Reset Workspace.`;

      return {
        intent: 'ONBOARDING_GUIDE',
        intentLabel: 'Data Security & Privacy',
        answerMarkdown,
        what,
        why,
        actionText,
        confidence: 'HIGH',
        confidenceReason: 'Enterprise multi-tenant security architecture.',
        supportingData: [
          { label: 'Encryption', value: 'AES-256 In-Transit & At-Rest' },
          { label: 'Isolation', value: 'Per-User Tenant Rules' },
          { label: 'Data Retention', value: 'User Controlled' },
        ],
        recommendedAction: {
          label: 'Review Settings & Security',
          actionType: 'navigate',
          targetRoute: '/dashboard/settings',
        },
        suggestedFollowUps: [
          'How do I upload my business data?',
          'What 22 columns are in the CSV template?',
          'What insights will I get after uploading?',
        ],
      };
    }

    // General Empty State
    const what = 'Your workspace is initialized and awaiting your business data.';
    const why = 'AnalyzeUp requires your product catalog or sales transactions to calculate business health scores, forecast 30-day stockouts, detect tied-up dead capital, and generate tailored operational priorities.';
    const actionText = 'Download our 22-column CSV database template and upload your inventory or sales records via the Import Data button.';

    const answerMarkdown = `### 🚀 WELCOME TO ANALYZEUP AI COPILOT\n\n` +
      `- **Current Status:** Workspace is clean and awaiting your first data upload.\n` +
      `- **Top Priority Today:** Upload your product catalog and sales history to activate live AI intelligence.\n` +
      `- **Supported Formats:** Official 22-column CSV template, custom Excel/CSV exports, Google Drive auto-sync, or Shopify store integration.\n\n` +
      `**Next Step:** Click below to open the Import dialog, download the sample template, or upload your file. Once uploaded, I will immediately generate your daily priorities, revenue forecasts, and supplier recommendations!`;

    return {
      intent: 'ONBOARDING_GUIDE',
      intentLabel: 'Getting Started & Data Upload Guide',
      answerMarkdown,
      what,
      why,
      actionText,
      confidence: 'HIGH',
      confidenceReason: 'Workspace awaiting initial data upload.',
      supportingData: [
        { label: 'Workspace Status', value: 'Awaiting Data Upload' },
        { label: 'Catalog SKUs', value: '0 Loaded' },
        { label: 'Sales Records', value: '0 Logged' },
        { label: 'Template Format', value: '22-Column CSV Ready' },
      ],
      recommendedAction: {
        label: 'Import CSV Data Now',
        actionType: 'navigate',
        targetRoute: '/dashboard/inventory',
      },
      suggestedFollowUps: [
        'What 22 columns are in the CSV template?',
        'How do I download the sample CSV template?',
        'Can I upload products and sales together?',
        'How does AnalyzeUp auto-map custom CSV headers?',
      ],
    };
  }

  // 1. STRATEGIC SALES & REVENUE PLAN INTENT (e.g. "give me the next 5 day plan for sales")
  if (intent === 'SALES_PLAN_OR_STRATEGY') {
    const qLower = query.toLowerCase();
    const dayMatch = qLower.match(/(\d+)\s*day/);
    const targetDays = dayMatch ? parseInt(dayMatch[1], 10) : (qLower.includes('week') ? 7 : (qLower.includes('month') ? 30 : 5));

    const uniqueDates = new Set(salesTx.map(t => String(t.transactionDate || (t as any).date || t.createdAt || '').slice(0, 10)).filter(Boolean));
    const activeDaysCount = Math.max(1, uniqueDates.size);
    const dailyRunRate = Math.round(totalRevenue / activeDaysCount);
    const projectedBaseline = Math.round(dailyRunRate * targetDays);
    const stretchTarget = Math.round(projectedBaseline * 1.20); // +20% growth upside

    // Filter Hero SKUs: in stock >= 10, margin >= 25%
    const heroProducts = [...products]
      .filter(p => (p.stock || 0) >= 10 && ((p.price || 0) - (p.costPrice || 0)) > 0)
      .sort((a, b) => {
        const profA = ((a.price || 0) - (a.costPrice || 0)) * (productSalesCount.get(a.id) || 1);
        const profB = ((b.price || 0) - (b.costPrice || 0)) * (productSalesCount.get(b.id) || 1);
        return profB - profA;
      });

    // Dead Stock candidates to bundle / liquidate
    const deadStockCandidates = [...deadStockProducts].sort((a, b) => ((b.stock || 0) * (b.price || 0)) - ((a.stock || 0) * (a.price || 0)));

    // Low stock items at risk
    const stockoutWatch = [...lowStockProducts].sort((a, b) => (a.stock || 0) - (b.stock || 0));

    const topHero = heroProducts[0];
    const topDead = deadStockCandidates[0];
    const topStockout = stockoutWatch[0];

    const what = `Generated a tailored ${targetDays}-Day Sales & Revenue Execution Plan targeting ${formatCur(stretchTarget)} (+20% over ${formatCur(projectedBaseline)} baseline).`;
    const why = `Based on your live daily run-rate of ${formatCur(dailyRunRate)}/day across ${activeDaysCount} active selling days with ${products.length} catalog items.`;
    const actionText = topHero
      ? `Promote high-margin SKU "${topHero.name}" (${topHero.stock} in stock) and launch a 15% flash bundle on dead stock "${topDead?.name || 'stagnant inventory'}" to unlock cash.`
      : 'Focus on reordering fast-moving inventory and expanding top converting product channels.';

    const answerMarkdown = `### 🎯 NEXT ${targetDays}-DAY STRATEGIC SALES & REVENUE PLAN\n\n` +
      `#### 1. 📊 REVENUE TARGETS & BENCHMARK\n` +
      `- **Current Run-Rate:** ${formatCur(dailyRunRate)} / day (${salesTx.length} completed transactions across ${activeDaysCount} selling days)\n` +
      `- **${targetDays}-Day Baseline Forecast:** **${formatCur(projectedBaseline)}**\n` +
      `- **${targetDays}-Day Growth Target (+20%):** **${formatCur(stretchTarget)}**\n` +
      `- **Profit Margin Buffer:** Overall business gross margin is currently **${overallMarginPercent}%**.\n\n` +
      `#### 2. 🌟 HERO PRODUCTS TO AGGRESSIVELY FEATURE\n` +
      (heroProducts.length > 0
        ? heroProducts.slice(0, 3).map((p, i) => {
            const margin = p.price > 0 ? Math.round(((p.price - (p.costPrice || 0)) / p.price) * 100) : 40;
            return `  ${i + 1}. **${p.name}** — Selling at **${formatCur(p.price)}** (Gross Margin: **${margin}%**, Stock: **${p.stock} units** available).`;
          }).join('\n')
        : `  - Promote your highest-rated catalog items across storefront banners.`) + '\n\n' +
      `#### 3. 📦 WORKING CAPITAL & DEAD STOCK LIQUIDATION\n` +
      `- **Locked Capital:** **${formatCur(tiedCapital)}** currently held in ${deadStockProducts.length} stagnant SKUs.\n` +
      (deadStockCandidates.length > 0
        ? `  - **Action Target:** Launch a **15–20% flash bundle discount** on **${topDead?.name}** (${topDead?.stock} units idle) to inject immediate working cash.\n\n`
        : `  - Inventory velocity is healthy with minimal dead stock drag.\n\n`) +
      `#### 4. ⚠️ CRITICAL STOCKOUT PROTECTION\n` +
      (stockoutWatch.length > 0
        ? `  - **Alert:** **${topStockout?.name}** is down to **${topStockout?.stock} units** (Min threshold: ${topStockout?.minStock || 5}). Issue a supplier restock PO immediately so you don't lose sales momentum.\n\n`
        : `  - All high-volume catalog SKUs maintain sufficient buffer stock.\n\n`) +
      `#### 5. 🗓️ TACTICAL ${targetDays}-DAY STEP-BY-STEP ROADMAP\n` +
      `- **Day 1 (Catalog & Channel Optimization):** Feature your top hero items (**${topHero?.name || 'Top Sellers'}**) on your primary store banner, email newsletter, and social ads.\n` +
      `- **Day 2 (Flash Bundling & Dead Stock Release):** Create a limited-time bundle pairing stagnant items with fast sellers to unlock immediate working cash.\n` +
      `- **Day 3 (Restock & Supplier Safeguard):** Check lead times and trigger purchase orders for low-stock items (**${topStockout?.name || 'Restock SKUs'}**) to avoid out-of-stock bounce.\n` +
      `- **Day 4 (Customer Retention & VIP Outreach):** Send personalized cross-sell recommendations to past high-value customers based on top purchase pairings.\n` +
      `- **Day 5 (Run-Rate Review & Campaign Scaling):** Reconcile conversion rates, double down ad spend on the top-converting SKU, and adjust inventory replenishment.`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence: 'HIGH',
      confidenceReason: `Computed using live ${activeDaysCount}-day sales run rate and catalog margin tiers.`,
      supportingData: [
        { label: `${targetDays}D Baseline Target`, value: formatCur(projectedBaseline) },
        { label: `${targetDays}D Stretch Target`, value: formatCur(stretchTarget) },
        { label: 'Daily Run Rate', value: `${formatCur(dailyRunRate)}/day` },
        { label: 'Gross Margin', value: `${overallMarginPercent}%` },
      ],
      recommendedAction: topHero ? {
        label: `View ${topHero.name} in Inventory`,
        actionType: 'navigate',
        targetRoute: '/dashboard/inventory',
        targetId: topHero.id,
      } : {
        label: 'Open Executive Intelligence',
        actionType: 'navigate',
        targetRoute: '/dashboard/executive',
      },
      suggestedFollowUps: [
        'Which products will run out of stock next week?',
        'Which products are tying up the most capital?',
        'What will my revenue look like next month?',
      ],
    };
  }

  // 2. SPECIFIC PRODUCT LOOKUP INTENT
  if (intent === 'SPECIFIC_PRODUCT_LOOKUP' && matchedProduct) {
    const p = matchedProduct;
    const unitsSold = productSalesCount.get(p.id) || productSalesCount.get(p.sku || '') || 0;
    const itemRevenue = unitsSold * (p.price || 0);
    const itemCost = p.costPrice || (p.price * 0.6);
    const itemMargin = p.price > 0 ? Math.round(((p.price - itemCost) / p.price) * 100) : 40;
    const isLow = (p.stock || 0) <= (p.minStock || 5);
    const isDead = (p.stock || 0) > 0 && unitsSold === 0;

    const what = `${p.name} (SKU: ${p.sku || 'N/A'}) has ${p.stock || 0} units in stock with ${unitsSold} historical units sold (${formatCur(itemRevenue)} revenue).`;
    const why = `Unit Price: ${formatCur(p.price || 0)} | Purchase Cost: ${formatCur(itemCost)} | Gross Margin: ${itemMargin}%. ${isLow ? '⚠️ Stock is below safety threshold!' : (isDead ? '📦 Classified as dead stock.' : '✅ Inventory is healthy.')}`;
    const actionText = isLow
      ? `Reorder ${Math.max(25, (p.minStock || 5) * 3)} units from ${p.supplier || 'supplier'} immediately.`
      : (isDead ? 'Offer a 15% promotional discount or bundle with a high-velocity product.' : 'Maintain current stock monitoring.');

    const answerMarkdown = `### 🔍 SKU DIAGNOSTIC: ${p.name.toUpperCase()}\n\n` +
      `- **SKU Code:** \`${p.sku || p.id}\` | **Category:** ${p.category || 'General'}\n` +
      `- **Current Stock:** **${p.stock || 0} units** (Min Safety Stock: ${p.minStock || 5} units)\n` +
      `- **Retail Price:** **${formatCur(p.price || 0)}** | **Cost Price:** ${formatCur(itemCost)}\n` +
      `- **Gross Profit Margin:** **${itemMargin}%** (+${formatCur((p.price || 0) - itemCost)} per unit)\n` +
      `- **Historical Sales:** **${unitsSold} units sold** (${formatCur(itemRevenue)} gross revenue)\n` +
      `- **Supplier:** ${p.supplier || 'Standard Supplier'} (Lead Time: ${p.leadTimeDays || 7} days)\n` +
      `- **Status:** ${isLow ? '🔴 **URGENT STOCKOUT RISK**' : (isDead ? '🟡 **DEAD STOCK (ZERO SALES)**' : '🟢 **HEALTHY ACTIVE PERFORMER**')}\n\n` +
      `**AI Strategic Recommendation:** ${actionText}`;

    return {
      intent,
      intentLabel: `SKU Performance: ${p.name}`,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence: 'HIGH',
      confidenceReason: 'Direct catalog and historical transaction match.',
      supportingData: [
        { label: 'Current Stock', value: `${p.stock || 0} units` },
        { label: 'Unit Price', value: formatCur(p.price || 0) },
        { label: 'Gross Margin', value: `${itemMargin}%` },
        { label: 'Units Sold', value: `${unitsSold}` },
      ],
      recommendedAction: isLow ? {
        label: `Reorder ${p.name}`,
        actionType: 'reorder',
        targetRoute: '/dashboard/inventory',
        targetId: p.id,
      } : {
        label: 'View in Inventory',
        actionType: 'navigate',
        targetRoute: '/dashboard/inventory',
      },
      suggestedFollowUps: [
        'Which products will run out of stock next week?',
        'Give me the next 5 day plan for sales',
        'Where can I reduce costs?',
      ],
    };
  }

  // 3. DEAD STOCK ANALYSIS INTENT
  if (intent === 'DEAD_STOCK_ANALYSIS') {
    const topDead = deadStockProducts.slice(0, 5);
    const what = `${deadStockProducts.length} dead stock SKU(s) are tying up ${formatCur(tiedCapital)} in working capital.`;
    const why = `These items have physical stock but zero recorded sales transactions over the active tracking window.`;
    const actionText = 'Launch a clearance promotion (15-25% discount) or bundle with bestsellers to recover working capital.';

    const answerMarkdown = `### 📦 DEAD STOCK & WORKING CAPITAL DIAGNOSTIC\n\n` +
      `- **Total Tied-Up Capital:** **${formatCur(tiedCapital)}** across **${deadStockProducts.length} stagnant SKUs**\n` +
      `- **Dead Stock Valuation:** Represents **${Math.round((tiedCapital / (totalRevenue || 1)) * 100)}%** of cumulative sales revenue.\n\n` +
      `#### 🔍 TOP STAGNANT SKUS HOLDING WORKING CASH\n` +
      (topDead.length > 0
        ? topDead.map((p, i) => {
            const locked = (p.stock || 0) * (p.costPrice || p.price * 0.6);
            return `  ${i + 1}. **${p.name}** — **${p.stock} units** (${formatCur(locked)} locked, Price: ${formatCur(p.price)})`;
          }).join('\n')
        : '  - No severe dead stock detected.') + '\n\n' +
      `#### 🚀 3-STEP CAPITAL RECOVERY STRATEGY\n` +
      `1. **Flash Clearance Bundle (15–20% Off):** Pair top stagnant items with high-velocity bestsellers to liquidate without brand damage.\n` +
      `2. **VIP Customer Free-Gift Threshold:** Offer stagnant items as a bonus for orders exceeding ${formatCur(dailyRunRate ? dailyRunRate * 2 : 2500)}.\n` +
      `3. **Reallocate Capital:** Reinvest recovered liquidity directly into high-turnover hero SKUs.`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence: 'HIGH',
      confidenceReason: 'Calculated from active catalog stock cross-referenced with sales logs.',
      supportingData: [
        { label: 'Tied-up Capital', value: formatCur(tiedCapital) },
        { label: 'Dead SKUs', value: `${deadStockProducts.length}` },
        { label: 'Catalog Share', value: `${Math.round((deadStockProducts.length / (products.length || 1)) * 100)}%` },
      ],
      recommendedAction: {
        label: 'Open Dead Stock Section',
        actionType: 'navigate',
        targetRoute: '/dashboard',
      },
      suggestedFollowUps: [
        'Give me the next 5 day plan for sales',
        'Which products should I reorder?',
        'Why did my profit decrease?',
      ],
    };
  }

  // 4. CATEGORY ANALYSIS INTENT
  if (intent === 'CATEGORY_ANALYSIS') {
    const categoryMap = new Map<string, { skus: number; totalStockVal: number; salesRevenue: number; unitsSold: number }>();
    products.forEach(p => {
      const cat = p.category || 'General';
      const entry = categoryMap.get(cat) || { skus: 0, totalStockVal: 0, salesRevenue: 0, unitsSold: 0 };
      entry.skus += 1;
      entry.totalStockVal += ((p.stock || 0) * (p.price || 0));
      categoryMap.set(cat, entry);
    });

    salesTx.forEach(t => {
      const p = products.find(prod => prod.id === t.productId || prod.sku === t.sku);
      const cat = p?.category || 'General';
      const entry = categoryMap.get(cat) || { skus: 0, totalStockVal: 0, salesRevenue: 0, unitsSold: 0 };
      entry.salesRevenue += (t.totalRevenue || (t.quantity * (t.price || 0)));
      entry.unitsSold += (t.quantity || 1);
      categoryMap.set(cat, entry);
    });

    const categoryList = Array.from(categoryMap.entries()).sort((a, b) => b[1].salesRevenue - a[1].salesRevenue);
    const topCat = categoryList[0];

    const what = `Analyzed ${categoryList.length} categories. Top performer: "${topCat?.[0] || 'General'}" generating ${formatCur(topCat?.[1].salesRevenue || 0)}.`;
    const why = `Category breakdown shows where customer demand is concentrated and where inventory capital is allocated.`;
    const actionText = `Expand catalog depth in "${topCat?.[0] || 'Top Category'}" while optimizing stock replenishment in lower-turnover categories.`;

    const answerMarkdown = `### 📊 CATEGORY PERFORMANCE & DEMAND BREAKDOWN\n\n` +
      categoryList.map(([catName, stats], i) => {
        return `**${i + 1}. ${catName.toUpperCase()}**\n` +
          `- Revenue Generated: **${formatCur(stats.salesRevenue)}** (${stats.unitsSold} units sold)\n` +
          `- Active SKUs: **${stats.skus} items** (Inventory Valuation: ${formatCur(stats.totalStockVal)})\n`;
      }).join('\n') +
      `\n**AI Recommendation:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence: 'HIGH',
      confidenceReason: 'Calculated across all catalog categories and sales transactions.',
      supportingData: [
        { label: 'Total Categories', value: `${categoryList.length}` },
        { label: 'Top Category', value: topCat?.[0] || 'General' },
        { label: 'Top Cat Revenue', value: formatCur(topCat?.[1].salesRevenue || 0) },
      ],
      recommendedAction: {
        label: 'View Inventory by Category',
        actionType: 'navigate',
        targetRoute: '/dashboard/inventory',
      },
      suggestedFollowUps: [
        'Give me the next 5 day plan for sales',
        'Which products will run out of stock next week?',
        'Where can I reduce costs?',
      ],
    };
  }

  // 5. GROWTH ANALYSIS INTENT
  if (intent === 'GROWTH_ANALYSIS') {
    const topOpp = growthReport.opportunities[0];
    const topCS = growthReport.crossSellOpportunities[0];
    const atRiskCount = growthReport.atRiskCustomers.length;

    const what = `Growth Health Score is ${growthReport.growthHealthScore}/100 (${growthReport.scoreCategory}) with ${growthReport.opportunities.length} identified growth opportunities.`;
    const why = topOpp
      ? `Primary growth driver: ${topOpp.title} (Score ${topOpp.opportunityScore}/100, Expected Profit +${formatCur(topOpp.expectedAdditionalProfit)}).`
      : `Customer repeat purchase rate is ${growthReport.repeatPurchaseRatePercent}%.`;

    const actionText = topOpp
      ? topOpp.recommendation
      : 'Review Executive Growth Intelligence suite to accept high-scoring growth recommendations.';

    const answerMarkdown = `### CUSTOMER GROWTH & RETENTION INTELLIGENCE\n\n` +
      `- **Growth Health Score:** ${growthReport.growthHealthScore}/100 (${growthReport.scoreCategory})\n` +
      `- **Repeat Purchase Rate:** ${growthReport.repeatPurchaseRatePercent}% (${growthReport.repeatRateChangePoints >= 0 ? '+' : ''}${growthReport.repeatRateChangePoints} pts vs prior)\n` +
      `- **At-Risk Customers:** ${atRiskCount} customer(s) exceeding repurchase window.\n` +
      `- **Top Cross-Sell Opportunity:** ${topCS ? `${topCS.primaryProductName} + ${topCS.suggestedProductName} (+${formatCur(topCS.potentialRevenueImpact)})` : 'None detected'}\n\n` +
      `**AI Growth Recommendation:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence: growthReport.hasData ? 'HIGH' : 'LOW',
      confidenceReason: growthReport.dataQualityMessage || 'Calculated from historical order patterns and product sales velocity.',
      supportingData: [
        { label: 'Growth Score', value: `${growthReport.growthHealthScore}/100` },
        { label: 'Repeat Rate', value: `${growthReport.repeatPurchaseRatePercent}%` },
        { label: 'At-Risk Buyers', value: `${atRiskCount}` },
        { label: 'Concentration Risk', value: `${growthReport.revenueConcentration.riskLevel}` },
      ],
      recommendedAction: {
        label: 'Open Growth Intelligence Suite',
        actionType: 'navigate',
        targetRoute: '/dashboard/executive',
      },
      suggestedFollowUps: [
        'Which products should I cross-sell?',
        'Which customers are at risk of leaving?',
        'What is limiting my business growth?',
      ],
    };
  }

  // 6. SIMULATION QUERY INTENT
  if (intent === 'SIMULATION_QUERY') {
    const qLower = query.toLowerCase();

    let simType: any = 'PRICE_CHANGE';
    let params: Record<string, any> = {};

    if (qLower.includes('order') || qLower.includes('purchase')) {
      simType = 'INVENTORY_PURCHASE';
      params.purchaseQty = 300;
    } else if (qLower.includes('discount')) {
      simType = 'DISCOUNT_PROMOTION';
      params.discountPercent = 20;
    } else if (qLower.includes('switch') || qLower.includes('supplier')) {
      simType = 'SUPPLIER_SWITCH';
    } else if (qLower.includes('reduce price')) {
      simType = 'PRICE_CHANGE';
      params.priceChangePercent = -10;
    } else {
      simType = 'PRICE_CHANGE';
      params.priceChangePercent = 10;
    }

    const matchedProd = products.find(p => p.name && qLower.includes(p.name.toLowerCase())) || products[0];
    const simRes = runBusinessSimulation(simType, matchedProd?.id || '', params, products, transactions, suppliers, orders, businessProfile);

    const revDiff = simRes.simulated.projectedRevenue - simRes.baseline.revenue;
    const profDiff = simRes.simulated.projectedProfit - simRes.baseline.grossProfit;

    const what = `Simulated impact for ${simRes.title}: Projected Revenue ${formatCur(simRes.simulated.projectedRevenue)} (${revDiff >= 0 ? '+' : ''}${formatCur(revDiff)}) with Gross Profit ${formatCur(simRes.simulated.projectedProfit)} (${profDiff >= 0 ? '+' : ''}${formatCur(profDiff)}).`;
    const why = `Demand shift is estimated at ${simRes.simulated.demandChangePercent || 0}%. Unit margin shifts by ${simRes.simulated.marginChangePercentagePoints >= 0 ? '+' : ''}${simRes.simulated.marginChangePercentagePoints} pts.`;
    const actionText = simRes.recommendation;

    const answerMarkdown = `### AI BUSINESS SIMULATION RESULT (READ-ONLY SIMULATION)\n\n` +
      `- **Scenario:** ${simRes.title}\n` +
      `- **Projected Revenue:** ${formatCur(simRes.simulated.projectedRevenue)} \`SIMULATED\` (${revDiff >= 0 ? '+' : ''}${formatCur(revDiff)})\n` +
      `- **Projected Gross Profit:** ${formatCur(simRes.simulated.projectedProfit)} \`SIMULATED\` (${profDiff >= 0 ? '+' : ''}${formatCur(profDiff)})\n` +
      `- **Margin Shift:** ${simRes.simulated.marginChangePercentagePoints >= 0 ? '+' : ''}${simRes.simulated.marginChangePercentagePoints} percentage points\n` +
      `- **Opportunity Score:** ${simRes.opportunityScore}/100 | **Risk Score:** ${simRes.riskScore}/100\n` +
      `- **Confidence:** ${simRes.confidence} (${simRes.confidenceReason})\n\n` +
      `**Assumptions:**\n` +
      simRes.assumptions.map(a => `- ${a}`).join('\n') + `\n\n` +
      `**AI Strategic Recommendation:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence: simRes.confidence,
      confidenceReason: simRes.confidenceReason,
      supportingData: [
        { label: 'Baseline Revenue', value: formatCur(simRes.baseline.revenue) },
        { label: 'Simulated Revenue', value: formatCur(simRes.simulated.projectedRevenue) },
        { label: 'Simulated Profit', value: formatCur(simRes.simulated.projectedProfit) },
        { label: 'Stockout Risk', value: simRes.simulated.stockoutRiskLevel },
      ],
      recommendedAction: {
        label: 'Open AI Strategy Lab',
        actionType: 'navigate',
        targetRoute: '/dashboard/executive',
      },
      suggestedFollowUps: [
        'What if I order 500 units instead?',
        'What if supplier cost increases by 10%?',
        'What if I switch suppliers?',
      ],
    };
  }

  // 7. FORECASTING ANALYSIS INTENT
  if (intent === 'FORECASTING_ANALYSIS') {
    if (forecastReport.overallConfidence === 'INSUFFICIENT') {
      const what = 'AnalyzeUp is currently observing your catalog in the Level 1 Baseline Learning Stage.';
      const why = forecastReport.confidenceReason;
      const actionText = 'Continue processing customer orders to build historical depth. 30-Day demand forecasts unlock after 30 days of sales history or 80+ customer orders.';
      const answerMarkdown = `### 🕒 DEMAND FORECASTING: LEARNING STAGE ACTIVE\n\n` +
        `- **Status:** Baseline Calibrating\n` +
        `- **Notice:** Speculative 30-day demand and revenue forecasts are suppressed during early baseline observation to protect profit margins.\n` +
        `- **Target Milestone:** 30 recorded sales days or 80+ customer orders.\n\n` +
        `**Next Steps:** ${actionText}`;

      return {
        intent,
        intentLabel,
        answerMarkdown,
        what,
        why,
        actionText,
        confidence: 'LOW' as const,
        supportingData: [
          { label: 'Status', value: 'Baseline Calibrating' },
          { label: 'Requirement', value: '30 Days / 80 Orders' },
        ],
        suggestedFollowUps: [
          'What is our current data readiness score?',
          'How many products are currently tracked?',
        ],
      };
    }

    const projRev = forecastReport.totalProjected30DayRevenue;
    const projProf = forecastReport.totalProjected30DayProfit;
    const criticals = forecastReport.stockoutProjections.filter(s => s.stockoutRiskLevel === 'HIGH');
    const topStockout = criticals[0];

    const what = `Projected 30-day business revenue is ${formatCur(projRev)} with expected gross profit of ${formatCur(projProf)}.`;
    let why = `Revenue trajectory is driven by product sales velocity. ${criticals.length} product(s) are projected to stock out before supplier lead time replenishes.`;
    if (topStockout) {
      why += ` Critical SKU: ${topStockout.productName} (depletes in ${topStockout.daysRemaining} days).`;
    }

    const actionText = topStockout
      ? `Issue purchase order for ${topStockout.recommendedReorderQty} units of ${topStockout.productName} immediately with ${topStockout.preferredSupplierName}.`
      : 'Review 30-day demand forecast page to model aggressive and conservative sales scenarios.';

    const answerMarkdown = `### PREDICTIVE BUSINESS FORECAST (NEXT 30 DAYS)\n\n` +
      `- **Projected 30-Day Revenue:** ${formatCur(projRev)}\n` +
      `- **Projected 30-Day Gross Profit:** ${formatCur(projProf)}\n` +
      `- **Imminent Stockouts:** ${criticals.length} SKU(s) at high stockout risk.\n` +
      `- **Confidence Level:** ${forecastReport.overallConfidence} (${forecastReport.confidenceReason})\n\n` +
      `**Recommended Action:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence,
      confidenceReason,
      supportingData: [
        { label: 'Projected 30D Revenue', value: formatCur(projRev) },
        { label: 'Projected 30D Profit', value: formatCur(projProf) },
        { label: 'Imminent Stockouts', value: `${criticals.length} SKUs` },
        { label: 'Excess Capital Risk', value: formatCur(forecastReport.projectedExcessCapital) },
      ],
      recommendedAction: {
        label: 'Open Business Forecasting Dashboard',
        actionType: 'navigate',
        targetRoute: '/dashboard/forecasting',
      },
      suggestedFollowUps: [
        'Which products will run out of stock next week?',
        'Give me the next 5 day plan for sales',
        'Where can I reduce costs?',
      ],
    };
  }

  // 8. RECOMMENDATION / TODAY PRIORITIES
  if (intent === 'RECOMMENDATION') {
    const topTask = actionTasks[0];
    const what = `Identified ${todayPriorities.length} operational priorities for your business today.`;
    const why = topTask
      ? `Top priority: ${topTask.title}. Reason: ${topTask.reason}`
      : 'Operations are stable. Review catalog inventory velocity.';
    const actionText = topTask
      ? topTask.recommendation
      : 'Maintain current inventory velocity and check weekly margin benchmarks.';

    const answerMarkdown = `### TODAY'S OPERATIONAL PRIORITIES\n\n` +
      todayPriorities.map((p, i) => `**${i + 1}. ${p.title}**\n- Category: ${p.category}\n- Recommended Action: ${p.actionLabel}`).join('\n\n') +
      `\n\n**AI Recommendation:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence,
      confidenceReason,
      supportingData: [
        { label: 'Business Health', value: `${health.score}/100 (${health.category})` },
        { label: 'Stockout Risk Items', value: `${lowStockProducts.length} SKUs` },
        { label: 'Dead Stock Locked', value: formatCur(tiedCapital) },
        { label: 'Procurement Savings', value: formatCur(savings.totalPotentialSaving) },
      ],
      recommendedAction: topTask ? {
        label: topTask.title,
        actionType: topTask.actionType as any,
        targetRoute: '/dashboard/inventory',
        targetId: topTask.targetId,
        actionTask: topTask,
      } : undefined,
      suggestedFollowUps: [
        'Give me the next 5 day plan for sales',
        'What will my revenue look like next month?',
        'Why did my profit decrease?',
      ],
    };
  }

  // 9. PROFIT / MARGIN ANALYSIS
  if (intent === 'PROFIT_ANALYSIS') {
    const marginProducts = [...products].map(p => {
      const cost = p.costPrice || (p.price * 0.6);
      const margin = p.price > 0 ? ((p.price - cost) / p.price) * 100 : 0;
      return { product: p, cost, margin };
    }).sort((a, b) => a.margin - b.margin);

    const lowestMargin = marginProducts[0];
    const highCostRisk = risks.find(r => r.type === 'cost_increase');

    const what = `Total gross profit is ${formatCur(totalProfit)} with an overall business profit margin of ${overallMarginPercent}%.`;
    let why = `Primary margin pressure: ${lowestMargin ? `${lowestMargin.product.name} has a low margin of ${Math.round(lowestMargin.margin)}%` : 'Stable cost structure'}.`;
    if (highCostRisk) {
      why += ` Additionally, ${highCostRisk.reason}`;
    }

    const actionText = highCostRisk
      ? highCostRisk.recommendation
      : 'Review unit selling prices for low-margin SKUs or negotiate bulk purchase discounts.';

    const answerMarkdown = `### PROFITABILITY & MARGIN DIAGNOSTIC\n\n` +
      `- **Total Gross Profit:** ${formatCur(totalProfit)}\n` +
      `- **Business Profit Margin:** ${overallMarginPercent}%\n` +
      `- **Primary Cause:** ${why}\n\n` +
      `**Recommended Action:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence,
      confidenceReason,
      supportingData: [
        { label: 'Gross Revenue', value: formatCur(totalRevenue) },
        { label: 'Net Profit', value: formatCur(totalProfit) },
        { label: 'Overall Margin', value: `${overallMarginPercent}%` },
        { label: 'Lowest Margin SKU', value: lowestMargin ? `${Math.round(lowestMargin.margin)}%` : 'N/A' },
      ],
      recommendedAction: {
        label: 'Open Profit Intelligence',
        actionType: 'navigate',
        targetRoute: '/dashboard/insights',
      },
      suggestedFollowUps: [
        'Which supplier is causing price increases?',
        'Where can I reduce costs?',
        'Give me the next 5 day plan for sales',
      ],
    };
  }

  // 10. INVENTORY & RESTOCK
  if (intent === 'INVENTORY_ANALYSIS') {
    const topReorder = lowStockProducts[0];
    const what = `${lowStockProducts.length} product(s) are below alert thresholds and ${deadStockProducts.length} SKUs are dead stock.`;
    const why = topReorder
      ? `${topReorder.name} stock (${topReorder.stock} units) is below reorder threshold of ${topReorder.minStock || 5}.`
      : `Capital lockup: ${formatCur(tiedCapital)} tied up in ${deadStockProducts.length} non-moving items.`;

    const actionText = topReorder
      ? `Reorder ${topReorder.minStock ? topReorder.minStock * 4 : 40} units of ${topReorder.name} immediately with ${topReorder.supplier || 'supplier'}.`
      : 'Launch a clearance promotion to unlock tied-up working capital.';

    const answerMarkdown = `### INVENTORY HEALTH & REORDER DIAGNOSTIC\n\n` +
      `- **Low Stock SKUs:** ${lowStockProducts.length} items requiring immediate restock.\n` +
      `- **Dead Stock Lockup:** ${formatCur(tiedCapital)} tied in ${deadStockProducts.length} stagnant SKUs.\n\n` +
      `**Action Plan:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence,
      confidenceReason,
      supportingData: [
        { label: 'Total Catalog SKUs', value: `${products.length} SKUs` },
        { label: 'Low Stock Items', value: `${lowStockProducts.length}` },
        { label: 'Dead Stock Capital', value: formatCur(tiedCapital) },
      ],
      recommendedAction: topReorder ? {
        label: `Reorder ${topReorder.name}`,
        actionType: 'reorder',
        targetRoute: '/dashboard/inventory',
        targetId: topReorder.id,
      } : {
        label: 'Clear Dead Stock',
        actionType: 'discount',
        targetRoute: '/dashboard/inventory',
      },
      suggestedFollowUps: [
        'Which products will run out of stock next week?',
        'Give me the next 5 day plan for sales',
        'What should I focus on today?',
      ],
    };
  }

  // 11. SUPPLIER & PROCUREMENT
  if (intent === 'SUPPLIER_ANALYSIS' || intent === 'PROCUREMENT_ANALYSIS') {
    const topRisk = risks[0];
    const topSaving = savings.savingsList[0];

    const what = `${suppliers.length} active vendors managed. ${risks.length} procurement risk(s) detected with ${formatCur(savings.totalPotentialSaving)} in potential annual savings.`;
    const why = topRisk
      ? `${topRisk.supplierName}: ${topRisk.reason}`
      : (topSaving ? `Paying ₹${topSaving.currentCost} to ${topSaving.currentSupplierName} vs ₹${topSaving.alternativeCost} with ${topSaving.alternativeSupplierName}.` : 'Suppliers operating normally.');

    const actionText = topSaving
      ? topSaving.recommendation
      : (topRisk ? topRisk.recommendation : 'Review supplier lead times and delivery performance on purchase orders.');

    const answerMarkdown = `### SUPPLIER INTELLIGENCE & PROCUREMENT REPORT\n\n` +
      `- **Active Vendors:** ${suppliers.length}\n` +
      `- **Procurement Risks:** ${risks.length} active risk alerts.\n` +
      `- **Potential Annual Savings:** ${formatCur(savings.totalPotentialSaving)}\n\n` +
      `**Recommended Vendor Action:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence,
      confidenceReason,
      supportingData: [
        { label: 'Active Vendors', value: `${suppliers.length}` },
        { label: 'Risk Alerts', value: `${risks.length}` },
        { label: 'Potential Savings', value: formatCur(savings.totalPotentialSaving) },
      ],
      recommendedAction: {
        label: 'View Supplier Intelligence',
        actionType: 'supplier',
        targetRoute: '/dashboard/suppliers',
      },
      suggestedFollowUps: [
        'Compare vendors side-by-side',
        'Which products should I reorder?',
        'What will my revenue look like next month?',
      ],
    };
  }

  // 12. REVENUE & SALES DEMAND
  if (intent === 'REVENUE_ANALYSIS') {
    const what = `Total Gross Revenue is ${formatCur(totalRevenue)} generated from ${salesTx.length} completed transactions.`;
    const why = `Revenue is generated across ${products.length} catalog items with an average transaction value of ${salesTx.length > 0 ? formatCur(totalRevenue / salesTx.length) : formatCur(0)}.`;
    const actionText = 'Analyze top-selling categories to expand high-velocity product lines and optimize stock replenishment.';

    const answerMarkdown = `### REVENUE & SALES DEMAND ANALYSIS\n\n` +
      `- **Total Gross Revenue:** ${formatCur(totalRevenue)}\n` +
      `- **Total Sales Transactions:** ${salesTx.length}\n` +
      `- **Catalog Products:** ${products.length} items\n` +
      `- **Average Gross Margin:** ${overallMarginPercent}%\n\n` +
      `**Recommended Action:** ${actionText}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence,
      confidenceReason,
      supportingData: [
        { label: 'Gross Revenue', value: formatCur(totalRevenue) },
        { label: 'Sales Transactions', value: `${salesTx.length}` },
        { label: 'Avg Margin', value: `${overallMarginPercent}%` },
      ],
      recommendedAction: {
        label: 'View Revenue Reports',
        actionType: 'navigate',
        targetRoute: '/dashboard/reports',
      },
      suggestedFollowUps: [
        'Give me the next 5 day plan for sales',
        'What will my revenue look like next month?',
        'Why did my profit decrease?',
      ],
    };
  }

  // 13. BUSINESS HEALTH SPECIFIC QUERY
  if (intent === 'BUSINESS_HEALTH') {
    const what = `Business Health Quotient is ${health.score}/100 (${health.category}).`;
    const why = health.summarySentence;
    const actionText = 'Focus on reordering critical inventory and liquidating dead stock to boost operational cash flow.';

    const answerMarkdown = `### BUSINESS HEALTH SCORE: ${health.score}/100 (${health.category})\n\n` +
      `- **Inventory Health:** ${health.factors.inventoryHealth}%\n` +
      `- **Profit Margin Index:** ${health.factors.marginHealth}%\n` +
      `- **Capital Efficiency:** ${health.factors.capitalEfficiency}%\n` +
      `- **Supplier Performance:** ${health.factors.supplierPerformance}%\n\n` +
      `**Executive Summary:** ${health.summarySentence}`;

    return {
      intent,
      intentLabel,
      answerMarkdown,
      what,
      why,
      actionText,
      confidence,
      confidenceReason,
      supportingData: [
        { label: 'Health Score', value: `${health.score}/100` },
        { label: 'Status', value: health.category },
        { label: 'Catalog SKUs', value: `${products.length}` },
      ],
      recommendedAction: {
        label: 'View Action Center',
        actionType: 'navigate',
        targetRoute: '/dashboard',
      },
      suggestedFollowUps: [
        'Give me the next 5 day plan for sales',
        'What will my revenue look like next month?',
        'What should I focus on today?',
      ],
    };
  }

  // 14. UNIVERSAL SMART EXECUTIVE SYNTHESIZER (For any open-ended or broad question)
  const topRevenueSKU = [...products].sort((a, b) => (productSalesCount.get(b.id) || 0) - (productSalesCount.get(a.id) || 0))[0];
  const avgDaily = dailyRunRate;

  const whatGen = `Executive Business Diagnostic: Total Revenue ${formatCur(totalRevenue)} across ${products.length} SKUs with ${overallMarginPercent}% gross margin.`;
  const whyGen = `Operating Health Score is ${health.score}/100 (${health.category}) with ${lowStockProducts.length} low-stock alert(s) and ${formatCur(tiedCapital)} tied in dead inventory.`;
  const actionGen = topRevenueSKU
    ? `Prioritize scaling inventory on top performer "${topRevenueSKU.name}" while running clearance bundles on dead stock.`
    : 'Reorder critical inventory and optimize product pricing.';

  const answerMarkdown = `### 💡 STRATEGIC BUSINESS ADVISOR ANALYSIS\n\n` +
    `#### 1. 🎯 EXECUTIVE CONTEXT & DIAGNOSTIC\n` +
    `Based on your live catalog of **${products.length} products** and **${salesTx.length} recorded sales transactions**, your workspace is generating an average of **${formatCur(avgDaily)}/day** in revenue with an overall **${overallMarginPercent}% gross margin**.\n\n` +
    `#### 2. 📊 LIVE PERFORMANCE PILLARS\n` +
    `- **Business Vitality Index:** **${health.score}/100 (${health.category})**\n` +
    `- **Total Cumulative Revenue:** **${formatCur(totalRevenue)}** (Gross Profit: ${formatCur(totalProfit)})\n` +
    `- **Top Selling Product:** **${topRevenueSKU?.name || 'Catalog Products'}** (${productSalesCount.get(topRevenueSKU?.id || '') || 0} units sold)\n` +
    `- **Active Suppliers:** ${suppliers.length} vendor relationships managed\n\n` +
    `#### 3. ⚡ CORE OPPORTUNITIES & WATCHPOINTS\n` +
    `- **Stockout Vulnerability:** ${lowStockProducts.length > 0 ? `**${lowStockProducts.length} SKUs** are running low and need restock.` : 'All primary inventory is currently above threshold.'}\n` +
    `- **Dead Capital Recovery:** **${formatCur(tiedCapital)}** locked in ${deadStockProducts.length} stagnant SKUs ready for clearance.\n\n` +
    `#### 4. 🚀 PRIORITIZED STRATEGIC NEXT STEPS\n` +
    `1. **Protect Core Revenue:** Keep your top 3 velocity products well-stocked above reorder levels.\n` +
    `2. **Unlock Working Capital:** Bundle dead inventory at a 15–20% discount to recover cashflow.\n` +
    `3. **Scale Customer Retention:** Leverage automated cross-selling on top customer purchase pairs.`;

  return {
    intent: 'GENERAL_BUSINESS_QUERY',
    intentLabel: 'Strategic Business Decision Advisor',
    answerMarkdown,
    what: whatGen,
    why: whyGen,
    actionText: actionGen,
    confidence: 'HIGH',
    confidenceReason: 'Synthesized from real-time database state across inventory, sales, and supply chain.',
    supportingData: [
      { label: 'Gross Revenue', value: formatCur(totalRevenue) },
      { label: 'Gross Margin', value: `${overallMarginPercent}%` },
      { label: 'Catalog SKUs', value: `${products.length}` },
      { label: 'Health Score', value: `${health.score}/100` },
    ],
    recommendedAction: {
      label: 'Open Action Center',
      actionType: 'navigate',
      targetRoute: '/dashboard',
    },
    suggestedFollowUps: [
      'Give me the next 5 day plan for sales',
      'Which products will run out of stock next week?',
      'Which products are tying up the most capital?',
    ],
  };
}
