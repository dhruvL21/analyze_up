import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal-page-shell';
import {
  ShieldCheck,
  Lock,
  Eye,
  Database,
  RefreshCw,
  Cpu,
  Trash2,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Server,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | AnalyzeUp Intelligence Platform',
  description:
    'Comprehensive Privacy Policy explaining how AnalyzeUp collects, encrypts, isolates, processes, and protects merchant and store data, including Google Drive and Shopify integrations.',
};

const TOC = [
  { id: 'introduction', title: '1. Introduction & Our Privacy Commitment' },
  { id: 'information-collected', title: '2. Information We Collect' },
  { id: 'how-we-use-data', title: '3. How We Process & Utilize Data' },
  { id: 'data-isolation', title: '4. Multi-Tenant Isolation & Cloud Security' },
  { id: 'shopify-merchant-data', title: '5. Shopify Integration & Merchant Data Handling' },
  { id: 'google-drive-integration', title: '6. Google Drive Integration & Google API Limited Use Policy' },
  { id: 'ai-copilot-privacy', title: '7. AI Copilot, LLMs & Machine Learning Privacy' },
  { id: 'subprocessors', title: '8. Authorized Third-Party Sub-processors' },
  { id: 'data-retention-purge', title: '9. Data Retention, Uninstalls & Data Purge' },
  { id: 'merchant-rights', title: '10. Your Rights: GDPR, CCPA & Data Portability' },
  { id: 'security-measures', title: '11. Technical & Organizational Security Measures' },
  { id: 'cookies-telemetry', title: '12. Cookies, Sessions & Telemetry' },
  { id: 'children', title: "13. Children's Privacy" },
  { id: 'policy-updates', title: '14. Updates to this Privacy Policy' },
  { id: 'dpo-contact', title: '15. Data Protection Officer & Privacy Inquiries' },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="At AnalyzeUp, we believe transparency is the bedrock of merchant trust. This Privacy Policy details the exact mechanisms through which your business data, store orders, inventory records, and user credentials are collected, securely encrypted, strictly isolated, and processed."
      documentType="privacy"
      lastUpdated="September 9, 2026"
      effectiveDate="September 9, 2026"
      toc={TOC}
    >
      {/* Executive Summary & Key Descriptions At a Glance */}
      <div className="p-6 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-card via-secondary/20 to-card space-y-4 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Executive Summary: Privacy Protections at a Glance</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">Zero Data Selling</span>
            <p className="text-muted-foreground">We never sell, broker, or monetize your store catalog, orders, or customer transaction data.</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">Zero Public AI Model Training</span>
            <p className="text-muted-foreground">Your records are never used to train public LLMs (e.g. OpenAI or Google models).</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">AES-256 Encrypted Token Vault</span>
            <p className="text-muted-foreground">Shopify and Google OAuth access tokens are encrypted with AES-256-GCM and stored only in server-side vaults.</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">Automated 48-Hour Data Purge</span>
            <p className="text-muted-foreground">Disconnecting external stores immediately invalidates tokens and schedules full data erasure.</p>
          </div>
        </div>
      </div>

      {/* 1. Introduction & Privacy Commitment */}
      <section id="introduction" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" /> Section 01
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          1. Introduction & Our Core Privacy Commitment
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp Intelligence Platform (&quot;AnalyzeUp&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides automated inventory intelligence, reorder orchestration, and retail demand forecasting for digital merchants and commerce brands.
          </p>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4" /> Our Uncompromising Promise
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We never sell, rent, monetize, or broker merchant catalog data, customer order records, profit margins, or inventory telemetry to advertisers, brokers, or competing brands. Your data is processed exclusively to deliver your contracted intelligence features.
            </p>
          </div>
          <p>
            This policy applies to all visitors, registered workspace members, and merchants who install our application or connect external platforms (including Shopify, Google Drive, Zoho, Tally, or custom ERP systems).
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 2. Information We Collect */}
      <section id="information-collected" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Database className="w-4 h-4" /> Section 02
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          2. Information We Collect
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>We collect only the minimum data required to compute inventory predictions, margin intelligence, and workflow automations:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-border/40 bg-card/60 space-y-1.5">
              <span className="font-bold text-foreground block">Product Catalog Data</span>
              <p className="text-muted-foreground">
                Product titles, descriptions, SKUs, barcodes, variants, categories, weight, vendor names, and inventory tracking IDs.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-border/40 bg-card/60 space-y-1.5">
              <span className="font-bold text-foreground block">Stock & Warehouse Levels</span>
              <p className="text-muted-foreground">
                Current quantities across physical and digital fulfillment locations, safety stock thresholds, and replenishment lead times.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-border/40 bg-card/60 space-y-1.5">
              <span className="font-bold text-foreground block">Order & Sales Telemetry</span>
              <p className="text-muted-foreground">
                Order IDs, timestamps, line items, quantities purchased, fulfillment statuses, and returned product quantities. We do not store raw customer payment card numbers.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-border/40 bg-card/60 space-y-1.5">
              <span className="font-bold text-foreground block">Supplier & Cost Pricing</span>
              <p className="text-muted-foreground">
                Cost of goods sold (COGS), purchase order records, minimum order quantities (MOQ), and supplier vendor contact information.
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 3. How We Process & Utilize Data */}
      <section id="how-we-use-data" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Cpu className="w-4 h-4" /> Section 03
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          3. How We Process & Utilize Data
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>AnalyzeUp processes your data strictly for legitimate commercial purposes:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li><strong className="text-foreground">Predictive Analytics:</strong> Generating statistical sales velocity models, seasonal demand projections, and stock depletion forecasts.</li>
            <li><strong className="text-foreground">Dead-Stock Detection:</strong> Highlighting capital locked in non-moving inventory and formulating markdown or liquidation recommendations.</li>
            <li><strong className="text-foreground">Purchase Order Generation:</strong> Synthesizing reorder thresholds to automatically draft supplier purchase orders.</li>
            <li><strong className="text-foreground">Return Rate Intelligence:</strong> Identifying SKUs with high defect or return rates to protect gross margins.</li>
            <li><strong className="text-foreground">Security Auditing:</strong> Recording workspace authentication events, team member modifications, and integration synchronization logs.</li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 4. Multi-Tenant Isolation & Cloud Security */}
      <section id="data-isolation" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Lock className="w-4 h-4" /> Section 04
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          4. Multi-Tenant Isolation & Cloud Security
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp is built on an enterprise multi-tenant cloud architecture. Every merchant workspace is allocated a dedicated, immutable tenant identifier (<code className="font-mono text-primary text-xs">tenantId</code>).
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              <strong className="text-foreground">Database Level Segregation:</strong> All Firestore database rules and server queries require verified session tenant tokens matching the requested document&apos;s tenantId.
            </li>
            <li>
              <strong className="text-foreground">Zero Cross-Tenant Leakage:</strong> No merchant can view, query, or inadvertently access the inventory figures or sales history of any other merchant on the platform.
            </li>
            <li>
              <strong className="text-foreground">Encryption Everywhere:</strong> Data in transit is encrypted using Transport Layer Security (TLS 1.3), and all data at rest is encrypted using AES-256 standards.
            </li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 5. Shopify Integration & Merchant Data Handling */}
      <section id="shopify-merchant-data" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <RefreshCw className="w-4 h-4" /> Section 05
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          5. Shopify Integration & Merchant Data Handling
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            Our Shopify integration is built strictly adhering to Shopify Partner API best practices (API Version 2026-07).
          </p>
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 space-y-2">
            <span className="font-semibold text-foreground text-xs block">
              OAuth Scopes & Least Privilege Principle
            </span>
            <p className="text-xs text-muted-foreground">
              We request only the 5 specific access scopes necessary for our platform to function:
            </p>
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">read_products</span>
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">read_orders</span>
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">read_inventory</span>
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">read_locations</span>
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">write_inventory</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              We never request customer write access, payment gateway manipulation rights, or customer marketing write permissions.
            </p>
          </div>
          <p className="text-xs">
            <strong className="text-foreground">Token Vaulting:</strong> Permanent offline merchant access tokens are encrypted using military-grade AES-256-GCM encryption keys stored in isolated environment secret vaults. Tokens are never transmitted to client browsers or exposed in error logs.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 6. Google Drive Integration & Google API Limited Use Policy */}
      <section id="google-drive-integration" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <FileSpreadsheet className="w-4 h-4" /> Section 06
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          6. Google Drive Integration & Google API Limited Use Policy
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp provides an optional Google Drive integration to enable merchants to import catalog spreadsheets, synchronize supplier purchase orders, and automate stock records directly from their Google cloud storage.
          </p>

          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 space-y-2">
            <span className="font-semibold text-foreground text-xs block">
              Google OAuth Scopes Requested
            </span>
            <p className="text-xs text-muted-foreground">
              When you connect Google Drive, AnalyzeUp requests only the following minimal permissions:
            </p>
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">https://www.googleapis.com/auth/drive.readonly</span>
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">https://www.googleapis.com/auth/drive.file</span>
              <span className="px-2 py-0.5 rounded bg-background border border-border/50 text-foreground">https://www.googleapis.com/auth/userinfo.email</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4" /> Google API Services User Data Policy Compliance
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AnalyzeUp&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </div>

          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              <strong className="text-foreground">Explicit Merchant Action:</strong> AnalyzeUp only reads, parses, or modifies files that you explicitly select for inventory, PO, or supplier sync. We never scan, index, or access unrelated personal files or folders in your Google Drive.
            </li>
            <li>
              <strong className="text-foreground">Zero AI Model Training:</strong> Data obtained via Google Drive APIs is NEVER used to train, retrain, or fine-tune generalized artificial intelligence (AI) or machine learning (ML) foundation models.
            </li>
            <li>
              <strong className="text-foreground">Zero Advertising or Brokering:</strong> Google user data is never transferred, rented, or sold to third-party data brokers or advertising platforms.
            </li>
            <li>
              <strong className="text-foreground">Revocation of Access:</strong> You may disconnect Google Drive at any time from Dashboard &gt; Integrations, or directly revoke AnalyzeUp&apos;s access in your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold hover:underline"
              >
                Google Account Security Settings
              </a>.
            </li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 7. AI Copilot, LLMs & Machine Learning Privacy */}
      <section id="ai-copilot-privacy" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Cpu className="w-4 h-4" /> Section 07
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          7. AI Copilot, LLMs & Machine Learning Privacy
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp provides an AI Executive Copilot and autonomous brief generators. When you engage with the copilot or request AI-generated inventory summaries:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              <strong className="text-foreground">Zero Model Training:</strong> Your business data, catalog entries, and customer sales metrics are NEVER used to train, retrain, or fine-tune public foundation models (e.g., OpenAI or Google models).
            </li>
            <li>
              <strong className="text-foreground">Ephemeral Processing:</strong> Inquiries submitted to the copilot are processed ephemerally. Only aggregated numerical summaries (e.g. &quot;Top 5 low stock SKUs&quot;) are provided in prompt context to generate natural language explanations.
            </li>
            <li>
              <strong className="text-foreground">Data Anonymization:</strong> Personal names, credit card numbers, and raw shipping addresses are stripped prior to analytical processing.
            </li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 8. Authorized Third-Party Sub-processors */}
      <section id="subprocessors" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Server className="w-4 h-4" /> Section 08
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          8. Authorized Third-Party Sub-processors
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>We work with trusted tier-1 infrastructure providers bound by strict Data Protection Agreements (DPAs):</p>
          <div className="border border-border/40 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-secondary/40 border-b border-border/40 text-foreground font-semibold">
                <tr>
                  <th className="p-3">Sub-processor</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Data Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 text-muted-foreground">
                <tr>
                  <td className="p-3 font-medium text-foreground">Google Cloud Platform / Firebase</td>
                  <td className="p-3">Cloud hosting, multi-tenant Firestore database, authentication, Google Drive sync</td>
                  <td className="p-3">Global / US / Asia</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">Razorpay Technologies</td>
                  <td className="p-3">PCI-DSS certified subscription billing, invoicing, and payment processing</td>
                  <td className="p-3">India / Global</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">Shopify Inc.</td>
                  <td className="p-3">E-commerce API integration, catalog synchronization, webhooks</td>
                  <td className="p-3">Global</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">OpenAI LLC</td>
                  <td className="p-3">Natural language query inference for the AI Copilot (zero data retention)</td>
                  <td className="p-3">United States</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 9. Data Retention, Uninstalls & Data Purge */}
      <section id="data-retention-purge" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Trash2 className="w-4 h-4" /> Section 09
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          9. Data Retention, App Uninstalls & Automated Data Purge
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            We retain your data only for as long as your workspace remains active and in good standing.
          </p>
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
            <span className="font-semibold text-rose-400 text-xs flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> App Uninstall & Disconnect Lifecycle
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When a merchant uninstalls AnalyzeUp or disconnects integrations:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
              <li>Our webhook processor immediately receives platform disconnect events.</li>
              <li>Encrypted offline access tokens are scrubbed from database records immediately.</li>
              <li>Connection status is updated to `UNINSTALLED` and background sync jobs are halted.</li>
              <li>All historical cached order and catalog records are queued for permanent deletion within 48 hours unless a manual export is requested.</li>
            </ol>
          </div>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 10. Your Rights: GDPR, CCPA & Data Portability */}
      <section id="merchant-rights" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <FileCheck className="w-4 h-4" /> Section 10
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          10. Your Rights: GDPR, CCPA & Data Portability
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            Depending on your jurisdiction, you possess statutory rights regarding your personal and business data:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li><strong className="text-foreground">Right of Access:</strong> You may request a machine-readable copy of all catalog, order, and audit log records held by AnalyzeUp.</li>
            <li><strong className="text-foreground">Right to Rectification:</strong> You may modify inaccuracies directly via workspace settings or contact support.</li>
            <li><strong className="text-foreground">Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> You may request permanent deletion of your account and all associated tenant documents.</li>
            <li><strong className="text-foreground">Right to Data Portability:</strong> You can export full inventory intelligence reports, supplier lists, and purchase orders in CSV and Excel formats anytime directly from the dashboard.</li>
          </ul>
          <p className="text-xs">
            To exercise any of these rights, submit a formal request to <a href="mailto:privacy@analyzeup.com" className="text-primary font-semibold hover:underline">privacy@analyzeup.com</a>. We process all verified data requests within 14 calendar days.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 11. Technical & Organizational Security Measures */}
      <section id="security-measures" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Lock className="w-4 h-4" /> Section 11
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          11. Technical & Organizational Security Measures
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>AnalyzeUp adheres to comprehensive defense-in-depth security standards:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li><strong className="text-foreground">Encryption at Rest:</strong> High-entropy AES-256 encryption across all Firestore document stores and database backups.</li>
            <li><strong className="text-foreground">Encryption in Transit:</strong> Strict HTTPS with TLS 1.3 enforced across all web interfaces, APIs, and webhook ingress points.</li>
            <li><strong className="text-foreground">Privileged Access Control:</strong> Server-side Admin SDK operations are strictly confined to authenticated service account credentials; developers and operational staff have zero direct access to merchant private keys or raw tokens.</li>
            <li><strong className="text-foreground">Continuous Vulnerability Auditing:</strong> Automated code scanning, dependency security checks, and regular penetration assessments.</li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 12. Cookies, Sessions & Telemetry */}
      <section id="cookies-telemetry" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Eye className="w-4 h-4" /> Section 12
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          12. Cookies, Sessions & Telemetry
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            We use strictly necessary session tokens and cookies to maintain authenticated workspace sessions, prevent Cross-Site Request Forgery (CSRF), and remember interface preferences (such as Dark/Light theme mode). We do not deploy third-party advertising cookies or cross-site tracking pixels.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 13. Children's Privacy */}
      <section id="children" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" /> Section 13
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          13. Children&apos;s Privacy
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp is a commercial enterprise SaaS application tailored solely for commercial merchants and businesses. It is not intended for or directed toward children under 18 years of age. We do not knowingly collect personal information from minors.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 14. Updates to this Privacy Policy */}
      <section id="policy-updates" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <RefreshCw className="w-4 h-4" /> Section 14
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          14. Updates to this Privacy Policy
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            We may update this Privacy Policy periodically to reflect enhancements in technology, evolving data protection laws, or operational changes. When material modifications occur, we will post an announcement in the merchant dashboard and revise the &quot;Last Updated&quot; date at the top of this page.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 15. Data Protection Officer & Privacy Inquiries */}
      <section id="dpo-contact" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <HelpCircle className="w-4 h-4" /> Section 15
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          15. Data Protection Officer & Privacy Inquiries
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            For privacy inquiries, GDPR/CCPA data requests, or security audit reviews, please reach out directly to our Data Protection Officer:
          </p>
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 text-xs space-y-1">
            <p className="font-semibold text-foreground">AnalyzeUp Data Protection & Compliance Office</p>
            <p>Email: <a href="mailto:privacy@analyzeup.com" className="text-primary font-medium hover:underline">privacy@analyzeup.com</a></p>
            <p>Security Response: <a href="mailto:security@analyzeup.com" className="text-primary font-medium hover:underline">security@analyzeup.com</a></p>
            <p>Mailing Address: AnalyzeUp Intelligence Platform, Mumbai, Maharashtra, India</p>
          </div>
        </div>
      </section>
    </LegalPageShell>
  );
}
