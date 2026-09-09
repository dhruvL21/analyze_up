'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  ShieldCheck,
  CreditCard,
  Search,
  Printer,
  ExternalLink,
  CheckCircle2,
  Lock,
  Boxes,
  Cpu,
  RefreshCw,
  Scale,
  Users,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  Server,
  X,
} from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy' | 'subscription';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: LegalDocType;
}

interface SectionData {
  id: string;
  number: string;
  title: string;
  badge?: string;
  content: React.ReactNode;
  keywords: string[];
}

export function LegalModal({ isOpen, onClose, defaultTab = 'terms' }: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalDocType>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Keep activeTab in sync when defaultTab changes
  React.useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
      setSearchQuery('');
    }
  }, [isOpen, defaultTab]);

  const handlePrint = () => {
    window.print();
  };

  // ==================== TERMS OF SERVICE DATA ====================
  const termsSections: SectionData[] = [
    {
      id: 'acceptance',
      number: '01',
      title: 'Acceptance of Terms & Eligibility',
      badge: 'Binding Agreement',
      keywords: ['acceptance', 'eligibility', 'agreement', 'binding', 'merchant', 'oauth'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            By creating an account, authenticating via OAuth with Shopify or any connected commerce channel, accessing our web application, or provisioning an AnalyzeUp workspace, you acknowledge that you have read, understood, and agreed to be legally bound by these Terms of Service (&quot;Terms&quot;) and our companion Privacy Policy and Subscription Terms.
          </p>
          <p>
            If you are registering or operating an AnalyzeUp workspace on behalf of a company, partnership, merchant enterprise, or other commercial legal entity, you represent and warrant that you possess the full legal authority to bind that entity to these Terms. If you do not agree with all of the provisions set forth herein, you must immediately cease all access and utilization of the AnalyzeUp platform.
          </p>
        </div>
      ),
    },
    {
      id: 'services',
      number: '02',
      title: 'Description of Services & AI Intelligence',
      badge: 'SaaS Platform',
      keywords: ['services', 'ai', 'demand forecasting', 'inventory', 'purchase orders', 'dead stock'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp is a cloud-based Software-as-a-Service (SaaS) business intelligence platform engineered to assist e-commerce retailers, wholesale operators, and digital brands in optimizing catalog inventory, predicting future stock depletion, detecting dead inventory, automating supplier purchase orders, and analyzing gross margins.
          </p>
          <p>
            Our service incorporates proprietary machine learning models, statistical heuristic engines, generative AI copilot interfaces, and programmatic connectors that synchronize catalog, order, and stock telemetry across verified sales channels.
          </p>
          <div className="p-3 rounded-xl border border-border/40 bg-secondary/20 text-xs">
            <span className="font-semibold text-foreground">Continuous Evolution of Features:</span> AnalyzeUp continually updates and refines its algorithmic forecasting models. We reserve the right to enhance or modify platform features provided core subscribed capabilities are preserved.
          </div>
        </div>
      ),
    },
    {
      id: 'workspaces',
      number: '03',
      title: 'Workspaces & Role-Based Access Control (RBAC)',
      badge: 'Security & Access',
      keywords: ['workspaces', 'accounts', 'rbac', 'roles', 'owner', 'admin', 'manager', 'staff', 'viewer'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp provides granular Role-Based Access Control (RBAC) permitting workspace owners to assign discrete operational privileges:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg border border-border/40 bg-secondary/15">
              <span className="font-bold text-foreground">OWNER:</span> Full billing administration, workspace deletion, team management, and API key provisioning.
            </div>
            <div className="p-2.5 rounded-lg border border-border/40 bg-secondary/15">
              <span className="font-bold text-foreground">ADMIN:</span> Configuration of integrations, supplier networks, reorder policies, and user invitations.
            </div>
            <div className="p-2.5 rounded-lg border border-border/40 bg-secondary/15">
              <span className="font-bold text-foreground">MANAGER:</span> Operations management, inventory adjustments, purchase order issuance, and reporting.
            </div>
            <div className="p-2.5 rounded-lg border border-border/40 bg-secondary/15">
              <span className="font-bold text-foreground">STAFF / VIEWER:</span> Day-to-day catalog lookup, inventory audit logging, or read-only analytical visibility.
            </div>
          </div>
          <p>
            You are solely responsible for maintaining credential confidentiality and multi-factor authentication tokens. Notify us immediately at <span className="text-primary font-medium">security@analyzeup.com</span> upon detecting unauthorized access.
          </p>
        </div>
      ),
    },
    {
      id: 'multi-tenant',
      number: '04',
      title: 'Multi-Tenant Architecture & Data Isolation',
      badge: 'Zero Cross-Tenant Leakage',
      keywords: ['multi-tenant', 'isolation', 'security', 'database', 'tenantid', 'encryption'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp operates on a hardened multi-tenant cloud infrastructure. Each workspace is assigned a distinct tenant identifier (<code className="text-primary font-mono text-xs">tenantId</code>). All database operations, search indexing, real-time synchronization pipelines, and AI copilot interactions are logically partitioned and guarded by strict cryptographic and server-side authorization boundaries.
          </p>
          <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-xs text-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Cryptographic Tenant Partitioning
            </div>
            <p className="text-muted-foreground">
              We strictly guarantee that no merchant&apos;s proprietary sales data, inventory valuations, supplier details, or customer transaction records will ever be exposed to, shared with, or accessible by another tenant. Cross-tenant reads or writes are programmatically blocked at the database engine level.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'shopify-terms',
      number: '05',
      title: 'Shopify 2026-07 API Compliance & OAuth Scopes',
      badge: 'Official API Integration',
      keywords: ['shopify', 'oauth', 'api', 'scopes', 'read_products', 'read_orders', 'read_inventory', 'read_locations', 'write_inventory'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp integrates with the Shopify commerce platform via Shopify&apos;s official GraphQL Admin API (Version 2026-07). When you authenticate your Shopify store with AnalyzeUp:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              We request only the minimum least-privilege OAuth scopes:
              <span className="font-mono text-primary font-medium ml-1">
                read_products, read_orders, read_inventory, read_locations, write_inventory
              </span>.
            </li>
            <li>
              Offline access tokens issued by Shopify are encrypted at rest using AES-256-GCM and stored exclusively on secure server-side infrastructure. Tokens are never exposed to browser sessions or client code.
            </li>
            <li>
              Inbound webhooks are cryptographically validated via HMAC-SHA256 signatures prior to processing.
            </li>
            <li>
              AnalyzeUp operates as an independent technology partner compliant with Shopify&apos;s API License and Merchant Terms.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'data-ownership',
      number: '06',
      title: '100% Merchant Data Ownership & Intellectual Property',
      badge: 'Merchant Ownership',
      keywords: ['data ownership', 'merchant data', 'intellectual property', 'export', 'license'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Your Data Remains Exclusively Yours:</strong> You retain complete and exclusive ownership, title, and intellectual property rights in and to all product catalogs, sales telemetry, purchase orders, customer transaction history, and custom supplier metadata ingested into or processed by your workspace (&quot;Merchant Data&quot;).
          </p>
          <p>
            You grant AnalyzeUp only a limited, revocable license strictly necessary to host, process, and analyze your data to deliver the platform services to your authorized users. AnalyzeUp retains all intellectual property in the AnalyzeUp platform code, machine learning architectures, and interfaces.
          </p>
        </div>
      ),
    },
    {
      id: 'ai-disclaimers',
      number: '07',
      title: 'AI Copilot & Analytical Disclaimers',
      badge: 'Decision-Support Advisory',
      keywords: ['ai copilot', 'disclaimer', 'forecasts', 'predictive', 'algorithms', 'advisory'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp&apos;s AI demand forecasts, stockout predictions, safety stock calculations, and automated purchase order drafts are automated decision-support aids designed to guide commercial procurement and inventory optimization.
          </p>
          <p>
            While our predictive algorithms achieve high commercial accuracy, external macroeconomic events, supplier lead-time variations, and volatile consumer demand can influence actual outcomes. You agree that final procurement, purchase order approvals, and financial capital commitments remain under your merchant executive discretion.
          </p>
        </div>
      ),
    },
    {
      id: 'uptime-liability',
      number: '08',
      title: 'Service Availability, SLAs & Limitation of Liability',
      badge: '99.9% Uptime Target',
      keywords: ['uptime', 'sla', 'liability', 'indemnification', 'warranty', 'guarantee'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            We target a 99.9% monthly platform uptime for our production cloud clusters. Scheduled maintenance is conducted during off-peak hours with advance dashboard announcements.
          </p>
          <p>
            To the maximum extent permitted by law, AnalyzeUp shall not be liable for any indirect, incidental, consequential, special, or punitive damages, or loss of profits arising out of platform usage. Our total aggregate liability is limited to the subscription fees paid by you in the 12 months preceding the claim.
          </p>
        </div>
      ),
    },
  ];

  // ==================== PRIVACY POLICY DATA ====================
  const privacySections: SectionData[] = [
    {
      id: 'privacy-commitment',
      number: '01',
      title: 'Core Privacy Commitment & Zero Data Selling',
      badge: 'Merchant Trust',
      keywords: ['privacy', 'commitment', 'zero data selling', 'no brokering', 'trust'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            At AnalyzeUp, transparency is the bedrock of merchant trust. We treat your commercial records with bank-grade confidentiality and security.
          </p>
          <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-xs text-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Our Uncompromising Promise
            </div>
            <p className="text-muted-foreground">
              We NEVER sell, rent, monetize, or broker merchant catalog data, customer order records, profit margins, or inventory telemetry to advertisers, brokers, or competing brands. Your data is processed exclusively to deliver your contracted intelligence features.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'info-collected',
      number: '02',
      title: 'Information We Collect & Process',
      badge: 'Data Minimization',
      keywords: ['information collected', 'catalog', 'orders', 'inventory', 'oauth token', 'telemetry'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>We collect only the minimum data required to compute inventory predictions, margin intelligence, and workflow automations:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg border border-border/40 bg-card/60">
              <span className="font-semibold text-foreground">Catalog & Stock Records:</span> Product titles, SKUs, barcodes, variants, stock quantities across locations, cost prices, and retail prices.
            </div>
            <div className="p-2.5 rounded-lg border border-border/40 bg-card/60">
              <span className="font-semibold text-foreground">Order & Return Telemetry:</span> Order timestamps, line items, quantities, order status, return codes, and fulfillment channels.
            </div>
            <div className="p-2.5 rounded-lg border border-border/40 bg-card/60">
              <span className="font-semibold text-foreground">Supplier & PO Metadata:</span> Supplier vendor names, contact email addresses, lead times, minimum order quantities, and purchase order history.
            </div>
            <div className="p-2.5 rounded-lg border border-border/40 bg-card/60">
              <span className="font-semibold text-foreground">Account & Session Data:</span> Merchant workspace email, display name, hashed auth tokens, and audit logs.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ai-privacy',
      number: '03',
      title: 'AI Copilot Privacy: Zero Public Foundation Model Training',
      badge: 'AI Confidentiality',
      keywords: ['ai privacy', 'llm', 'zero model training', 'openai', 'gemini', 'claude', 'confidentiality'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            When you interact with the AnalyzeUp AI Advisor or automated demand forecasting engines:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              <strong className="text-foreground">Zero Model Training:</strong> Your proprietary store sales numbers, inventory levels, supplier margins, and customer data are NEVER used to train public foundation models (such as OpenAI GPT, Google Gemini, or Claude).
            </li>
            <li>
              <strong className="text-foreground">Zero Data Retention by LLM Providers:</strong> External API calls to inference providers utilize zero-data-retention enterprise tiers where prompts are processed strictly in ephemeral memory and discarded immediately upon response completion.
            </li>
            <li>
              <strong className="text-foreground">Strict Tenant Scoping:</strong> All context passed to the AI Copilot is strictly bounded to your verified <code className="text-primary font-mono text-xs">tenantId</code>.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'encryption-vault',
      number: '04',
      title: 'AES-256 Token Vaulting & Cryptographic Storage',
      badge: 'Bank-Grade Security',
      keywords: ['aes-256', 'token vault', 'oauth', 'encryption', 'security', 'keys'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            All offline Shopify access tokens, ERP API keys, and external credentials are encrypted at rest using industry-standard <span className="text-foreground font-semibold">AES-256-GCM authenticated encryption</span>.
          </p>
          <p>
            Decryption keys are managed via hardware security modules and cloud key management infrastructure, isolated from client web applications. No unencrypted store access token is ever transmitted to the browser or stored in local storage.
          </p>
        </div>
      ),
    },
    {
      id: 'purge-retention',
      number: '05',
      title: 'Automated 48-Hour Data Purge & App Uninstallation',
      badge: 'Automated Erasure',
      keywords: ['purge', 'uninstallation', 'retention', '48 hours', 'erasure', 'gdpr', 'ccpa'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            We uphold strict merchant data lifecycle controls:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              <strong className="text-foreground">Shopify App Uninstall:</strong> When an app uninstall webhook is received from Shopify, your offline access token is immediately revoked and marked inactive.
            </li>
            <li>
              <strong className="text-foreground">Automated 48-Hour Purge:</strong> All cached catalog, inventory, and order records associated with the uninstalled store are permanently deleted from active databases within 48 hours.
            </li>
            <li>
              <strong className="text-foreground">On-Demand Erasure:</strong> You can initiate a complete workspace purge at any time in Dashboard &gt; Settings or by emailing <span className="text-primary font-medium">privacy@analyzeup.com</span>.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'merchant-rights',
      number: '06',
      title: 'Your Rights: GDPR, CCPA & Full Data Portability',
      badge: 'Data Portability',
      keywords: ['rights', 'gdpr', 'ccpa', 'export', 'csv', 'excel', 'portability'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            You maintain full sovereignty over your data under GDPR, CCPA, and global data privacy standards:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg border border-border/40 bg-secondary/15">
              <span className="font-semibold text-foreground">Right of Access & Portability:</span> Export all your catalog metrics, purchase orders, and audit logs at any time in standard CSV or Excel formats.
            </div>
            <div className="p-2.5 rounded-lg border border-border/40 bg-secondary/15">
              <span className="font-semibold text-foreground">Right to Rectification & Erasure:</span> Request immediate correction of erroneous records or permanent deletion of your workspace data.
            </div>
          </div>
        </div>
      ),
    },
  ];

  // ==================== SUBSCRIPTION TERMS DATA ====================
  const subscriptionSections: SectionData[] = [
    {
      id: 'sub-overview',
      number: '01',
      title: 'Subscription Overview & Transparent Pricing',
      badge: 'Zero Hidden Fees',
      keywords: ['subscription', 'overview', 'pricing', 'plans', 'transparent', 'tiers'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp provides straightforward, predictable monthly plans with zero hidden fees, automated recurring billing via Razorpay, and a merchant-first refund guarantee.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded-xl border border-border/50 bg-secondary/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Starter</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">₹1,499 / mo</Badge>
              </div>
              <p className="text-muted-foreground">For boutique stores up to 25,000 SKUs, 250 AI queries, and 5 team seats.</p>
            </div>
            <div className="p-3 rounded-xl border border-primary/40 bg-primary/5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary">Growth (Popular)</span>
                <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">₹3,999 / mo</Badge>
              </div>
              <p className="text-muted-foreground">For scaling brands up to 50,000 SKUs, 1,000 AI queries, 90-day forecast.</p>
            </div>
            <div className="p-3 rounded-xl border border-border/50 bg-secondary/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Enterprise Pro</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">₹8,999 / mo</Badge>
              </div>
              <p className="text-muted-foreground">For omni-channel retailers up to 250,000 SKUs, unlimited seats, 365-day forecast.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'free-trial',
      number: '02',
      title: '14-Day Free Trial Policy',
      badge: 'No Credit Card Needed',
      keywords: ['free trial', '14 days', 'no credit card', 'evaluation', 'test'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            Every new AnalyzeUp workspace begins with a comprehensive <strong className="text-foreground">14-day free trial</strong> with all features unlocked:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Zero credit card or payment authorization required to start.</li>
            <li>Connect your live Shopify store and run complete demand forecasts and dead-stock audits.</li>
            <li>At the conclusion of your 14-day trial, you may select a paid monthly tier or your workspace will transition to read-only mode without any unexpected charges.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'cancellation-terms',
      number: '03',
      title: '1-Click Self-Service Cancellation',
      badge: 'Zero Lock-in',
      keywords: ['cancellation', 'self-service', 'cancel', 'no lock-in', 'billing dashboard'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            We believe you should stay because of the value we provide, never because of contractual traps:
          </p>
          <div className="p-3 rounded-xl border border-border/40 bg-secondary/20 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Instant Self-Service Cancellation
            </div>
            <p className="text-muted-foreground">
              You can cancel your subscription at any time directly in <strong className="text-foreground">Dashboard &gt; Billing</strong> with a single click. There are no cancellation fees, no phone calls required, and no waiting periods.
            </p>
            <p className="text-muted-foreground">
              Upon cancellation, your subscription will remain active through the end of your prepaid billing period, after which no further charges will occur.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'refund-guarantee',
      number: '04',
      title: '7-Day Money-Back Guarantee & Refund Policy',
      badge: '100% Risk Free',
      keywords: ['refund', 'money-back guarantee', '7 days', 'risk-free', 'payment protection'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            We provide a <strong className="text-foreground">7-Day 100% Money-Back Guarantee</strong> on your first paid billing cycle:
          </p>
          <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 text-xs text-foreground space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <RotateCcw className="w-4 h-4" /> Hassle-Free Refund Process
            </div>
            <p className="text-muted-foreground">
              If within the first 7 days following your initial paid subscription you feel AnalyzeUp does not fit your operational workflow, simply email <span className="text-primary font-medium">billing@analyzeup.com</span>. We will refund 100% of your payment with no questions asked.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Refunds are credited back to the original payment source (credit card, debit card, or UPI via Razorpay) within 5 to 7 business days depending on your banking provider.
          </p>
        </div>
      ),
    },
    {
      id: 'gst-invoicing',
      number: '05',
      title: 'Taxes, Invoicing & GST Compliance',
      badge: 'GST ITC Compliant',
      keywords: ['taxes', 'gst', 'invoicing', 'input tax credit', 'itc', 'razorpay', 'receipts'],
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p>
            All subscriptions are processed securely through Razorpay in compliance with RBI standards and PCI-DSS Level 1 specifications:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              <strong className="text-foreground">GST Invoices:</strong> Registered Indian businesses can enter their GSTIN in Dashboard &gt; Billing. GST-compliant tax invoices with HSN/SAC codes are automatically generated and emailed for every cycle to claim Input Tax Credit (ITC).
            </li>
            <li>
              <strong className="text-foreground">International Currencies:</strong> Global merchants are billed in USD with equivalent regional tax calculations.
            </li>
            <li>
              <strong className="text-foreground">Payment Grace Period:</strong> If an automated monthly renewal payment fails, we provide a 7-day grace period during which your workspace remains active while you update your payment method.
            </li>
          </ul>
        </div>
      ),
    },
  ];

  // Active section list based on selected tab
  const currentSections = useMemo(() => {
    switch (activeTab) {
      case 'terms':
        return termsSections;
      case 'privacy':
        return privacySections;
      case 'subscription':
        return subscriptionSections;
      default:
        return termsSections;
    }
  }, [activeTab]);

  // Filter sections by search query if present
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return currentSections;
    const q = searchQuery.toLowerCase();
    return currentSections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [currentSections, searchQuery]);

  const activeDocMeta = useMemo(() => {
    switch (activeTab) {
      case 'terms':
        return {
          title: 'Terms of Service',
          badge: 'SaaS Agreement',
          subtitle: 'Official legal provisions governing your AnalyzeUp workspace, data isolation, and integrations.',
          icon: FileText,
          colorClass: 'text-primary',
          badgeClass: 'bg-primary/10 border-primary/20 text-primary',
          fullPageRoute: '/terms',
        };
      case 'privacy':
        return {
          title: 'Privacy Policy',
          badge: 'Enterprise Data Protection',
          subtitle: 'How we collect, encrypt, isolate, and protect your commercial records and catalog data.',
          icon: ShieldCheck,
          colorClass: 'text-emerald-400',
          badgeClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          fullPageRoute: '/privacy',
        };
      case 'subscription':
        return {
          title: 'Subscription Terms & Billing Policy',
          badge: 'Transparent Pricing & Refunds',
          subtitle: 'Clear rules on 14-day free trials, plan tiers, 1-click cancellations, and 7-day refund guarantee.',
          icon: CreditCard,
          colorClass: 'text-amber-400',
          badgeClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          fullPageRoute: '/subscription-terms',
        };
    }
  }, [activeTab]);

  const ActiveIcon = activeDocMeta.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] md:w-[90vw] h-[88vh] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-border/60 shadow-2xl rounded-2xl">
        {/* Top Header & Tab Navigation Bar */}
        <div className="p-4 sm:p-6 border-b border-border/40 bg-card/70 shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ActiveIcon className={`w-5 h-5 ${activeDocMeta.colorClass}`} />
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider ${activeDocMeta.badgeClass}`}>
                  {activeDocMeta.badge}
                </Badge>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  &bull; Effective September 8, 2026
                </span>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                {activeDocMeta.title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                {activeDocMeta.subtitle}
              </DialogDescription>
            </div>

            {/* Quick Actions: Print & Standalone Link */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs gap-1.5 border-border/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                title="Print or Save PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </Button>
              <Link href={activeDocMeta.fullPageRoute} target="_blank" onClick={onClose}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-border/50 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                  title="Open in dedicated page"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Full Page</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* All-in-One Switcher: 3 Unified Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/30 border border-border/40 overflow-x-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('terms');
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'terms'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Terms of Service
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('privacy');
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'privacy'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('subscription');
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'subscription'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Subscription Terms
              </button>
            </div>

            {/* In-Document Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeDocMeta.title}...`}
                className="h-8 pl-8 pr-7 text-xs bg-secondary/20 border-border/50 rounded-lg focus-visible:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
          {/* Document Key Takeaways Banner */}
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/15 backdrop-blur-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Key Provisions at a Glance
            </div>
            {activeTab === 'terms' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> 100% Merchant data ownership</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> Strict cryptographic tenant isolation</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> Shopify 2026-07 API compliant</div>
              </div>
            )}
            {activeTab === 'privacy' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Zero data monetization or selling</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Zero public LLM model training</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Automated 48-hr purge on uninstall</div>
              </div>
            )}
            {activeTab === 'subscription' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" /> 14-Day trial with zero card required</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" /> 1-Click self-serve cancellation</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" /> 7-Day 100% money-back guarantee</div>
              </div>
            )}
          </div>

          {/* Filtered Sections List */}
          {filteredSections.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Search className="w-8 h-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">No matching clauses found</p>
              <p className="text-xs text-muted-foreground">Try clearing your search query &quot;{searchQuery}&quot;</p>
              <Button size="sm" variant="outline" onClick={() => setSearchQuery('')} className="mt-2 text-xs">
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="space-y-6 divide-y divide-border/30">
              {filteredSections.map((sec, idx) => (
                <div key={sec.id} className={idx > 0 ? 'pt-6' : ''}>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {sec.number}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                          {sec.title}
                        </h3>
                      </div>
                      {sec.badge && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/30 text-muted-foreground border-border/40 hidden sm:inline-flex">
                          {sec.badge}
                        </Badge>
                      )}
                    </div>
                    {sec.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legal Support & Contact Footer inside document */}
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground mt-8">
            <div>
              <span className="font-bold text-foreground">Need legal or billing clarification?</span>
              <p className="text-[11px] text-muted-foreground">Our corporate compliance desk is available Monday through Friday.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href="mailto:support@analyzeup.com" className="text-primary hover:underline font-medium">
                support@analyzeup.com
              </a>
              <span className="text-muted-foreground/40">&bull;</span>
              <a href="mailto:privacy@analyzeup.com" className="text-primary hover:underline font-medium">
                privacy@analyzeup.com
              </a>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-border/40 bg-card/80 shrink-0 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground hidden sm:block">
            &copy; 2026 AnalyzeUp Intelligence Platform. All rights reserved.
          </div>
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs px-4 border-border/60 hover:bg-secondary/60 text-foreground"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={onClose}
              className="text-xs px-5 bg-primary text-primary-foreground font-semibold hover:brightness-110"
            >
              I Understand
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
