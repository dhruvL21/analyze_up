import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal-page-shell';
import {
  ShieldCheck,
  Scale,
  Lock,
  Boxes,
  Cpu,
  AlertTriangle,
  FileCheck2,
  Users,
  RefreshCw,
  Clock,
  HelpCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | AnalyzeUp Intelligence Platform',
  description:
    'Terms of Service governing access, multi-tenant workspace rules, Shopify integrations, AI copilot usage, and merchant data rights for AnalyzeUp.',
};

const TOC = [
  { id: 'acceptance', title: '1. Acceptance of Terms & Eligibility' },
  { id: 'services', title: '2. Description of Services & AI Intelligence' },
  { id: 'workspaces', title: '3. Workspaces, Accounts & Security' },
  { id: 'multi-tenant', title: '4. Multi-Tenant Architecture & Data Isolation' },
  { id: 'shopify-integrations', title: '5. Shopify & Third-Party Platform Integrations' },
  { id: 'data-ownership', title: '6. Merchant Data Ownership & Intellectual Property' },
  { id: 'acceptable-use', title: '7. Acceptable Use Policy & Platform Restrictions' },
  { id: 'ai-disclaimers', title: '8. AI Copilot, Predictive Engine & Analytical Disclaimers' },
  { id: 'service-availability', title: '9. Service Availability & Scheduled Maintenance' },
  { id: 'billing-fees', title: '10. Fees, Subscriptions & Payment Processing' },
  { id: 'limitation-liability', title: '11. Limitation of Liability' },
  { id: 'indemnification', title: '12. Indemnification' },
  { id: 'termination', title: '13. Term, Suspension & Account Termination' },
  { id: 'governing-law', title: '14. Governing Law & Dispute Resolution' },
  { id: 'modifications', title: '15. Modifications to Terms' },
  { id: 'contact', title: '16. Contact & Legal Inquiries' },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      subtitle="These Terms of Service create a legally binding agreement between you ('Merchant', 'User', or 'You') and AnalyzeUp ('AnalyzeUp', 'We', 'Us', or 'Our') governing your access to and utilization of our commerce intelligence platform, demand forecasting systems, and connected integrations."
      documentType="terms"
      lastUpdated="September 8, 2026"
      effectiveDate="September 8, 2026"
      toc={TOC}
    >
      {/* Executive Summary & Key Descriptions At a Glance */}
      <div className="p-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-card via-secondary/20 to-card space-y-4 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <FileCheck2 className="w-5 h-5 text-primary" />
          <span>Executive Summary: Terms of Service at a Glance</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">100% Data Ownership</span>
            <p className="text-muted-foreground">You retain exclusive ownership over your product catalog, orders, and sales telemetry.</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">Multi-Tenant Isolation</span>
            <p className="text-muted-foreground">Every workspace is isolated by database rules and server security; no cross-tenant exposure.</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">Shopify 2026-07 Integration</span>
            <p className="text-muted-foreground">Strict 5 OAuth access scopes (read_products, read_orders, read_inventory, read_locations, write_inventory).</p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/40 bg-secondary/20 space-y-1">
            <span className="font-semibold text-foreground">AI Copilot Advisory Role</span>
            <p className="text-muted-foreground">Demand forecasts and restock alerts are decision-support recommendations to guide purchasing.</p>
          </div>
        </div>
      </div>

      {/* 1. Acceptance of Terms & Eligibility */}
      <section id="acceptance" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Scale className="w-4 h-4" /> Section 01
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          1. Acceptance of Terms & Eligibility
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            By creating an account, authenticating via OAuth with Shopify or any connected commerce channel, accessing our web application, or provisioning an AnalyzeUp workspace, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service (&quot;Terms&quot;) and our companion{' '}
            <Link href="/privacy" className="text-primary font-semibold hover:underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/subscription-terms" className="text-primary font-semibold hover:underline">
              Subscription Terms
            </Link>.
          </p>
          <p>
            If you are registering or operating an AnalyzeUp workspace on behalf of a company, partnership, merchant enterprise, or other legal entity, you represent and warrant that you possess the full legal authority to bind that entity to these Terms. If you do not agree with all of the provisions set forth herein, you must immediately cease all access and utilization of the AnalyzeUp platform.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 2. Description of Services & AI Intelligence */}
      <section id="services" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Cpu className="w-4 h-4" /> Section 02
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          2. Description of Services & AI Intelligence
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp is a cloud-based Software-as-a-Service (SaaS) business intelligence platform engineered to assist e-commerce retailers, wholesale operators, and digital brands in optimizing catalog inventory, predicting future stock depletion, detecting dead inventory, automating supplier purchase orders, and analyzing margin performance.
          </p>
          <p>
            Our service incorporates proprietary machine learning models, statistical heuristic engines, generative AI copilot interfaces, and programmatic connectors that synchronize catalog, order, and stock telemetry across verified sales channels.
          </p>
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 flex items-start gap-3 mt-3">
            <Boxes className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-foreground">Continuous Evolution of Features</span>
              <p>
                We continually improve our algorithmic models, scoring metrics, and integration capabilities. We reserve the right to modify, enhance, or deprecate non-core features, provided that we do not materially reduce the core contracted capabilities of your active subscription plan without reasonable advance notice.
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 3. Workspaces, Accounts & Security */}
      <section id="workspaces" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Users className="w-4 h-4" /> Section 03
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          3. Workspaces, Accounts & Role-Based Security
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            To utilize the platform, you must establish an authenticated workspace account. You agree to provide accurate, current, and complete registration details and maintain the prompt accuracy of such information.
          </p>
          <p>
            AnalyzeUp provides granular Role-Based Access Control (RBAC) permitting workspace owners to assign discrete operational privileges:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li><strong className="text-foreground">OWNER:</strong> Full billing administration, workspace deletion, team management, and API key provisioning.</li>
            <li><strong className="text-foreground">ADMIN:</strong> Configuration of integrations, supplier networks, reorder policies, and user invitations.</li>
            <li><strong className="text-foreground">MANAGER:</strong> Operations management, inventory adjustments, purchase order issuance, and reporting.</li>
            <li><strong className="text-foreground">STAFF:</strong> Day-to-day catalog lookup, inventory audit logging, and warehouse stock updates.</li>
            <li><strong className="text-foreground">VIEWER:</strong> Read-only visibility into executive metrics, demand forecasts, and inventory summaries.</li>
          </ul>
          <p>
            You are solely responsible for maintaining the confidentiality of your credentials and multi-factor authentication tokens. You agree to notify AnalyzeUp immediately at <a href="mailto:security@analyzeup.com" className="text-primary font-medium hover:underline">security@analyzeup.com</a> upon becoming aware of any unauthorized access to your workspace.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 4. Multi-Tenant Architecture & Data Isolation */}
      <section id="multi-tenant" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Lock className="w-4 h-4" /> Section 04
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          4. Multi-Tenant Architecture & Data Isolation
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp operates on a hardened multi-tenant cloud infrastructure. Each workspace is assigned a distinct tenant identifier (`tenantId`). All database operations, search indexing, real-time synchronization pipelines, and AI copilot interactions are logically partitioned and guarded by strict cryptographic and server-side authorization boundaries.
          </p>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-400 text-xs">
              <ShieldCheck className="w-4 h-4" /> Strict Tenant Isolation Guarantee
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AnalyzeUp strictly guarantees that no merchant&apos;s proprietary sales data, inventory valuations, supplier details, or customer transaction records will ever be exposed to, shared with, or accessible by another tenant. Cross-tenant reads or writes are programmatically blocked by database rules and server-level privilege checks.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 5. Shopify & Third-Party Platform Integrations */}
      <section id="shopify-integrations" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <RefreshCw className="w-4 h-4" /> Section 05
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          5. Shopify & Third-Party Platform Integrations
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp integrates with the Shopify commerce platform via Shopify&apos;s official GraphQL Admin API (Version 2026-07). When you authenticate your Shopify store with AnalyzeUp:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              You authorize AnalyzeUp to request and receive only the strictly required OAuth access scopes:
              <span className="font-mono text-foreground font-medium ml-1">
                read_products, read_orders, read_inventory, read_locations, write_inventory
              </span>.
            </li>
            <li>
              Offline access tokens issued by Shopify are encrypted at rest using AES-256 and stored exclusively on secure server-side infrastructure. Tokens are never exposed to browser sessions or client code.
            </li>
            <li>
              AnalyzeUp utilizes automated webhook subscriptions to keep catalog records, orders, returns, and inventory levels synchronized. Inbound webhook payloads are cryptographically verified via HMAC-SHA256 signatures prior to ingestion.
            </li>
            <li>
              You agree to comply at all times with Shopify&apos;s Acceptable Use Policy, Shopify API License and Terms of Use, and all applicable merchant policies. AnalyzeUp is an independent technology provider and is not endorsed, sponsored, or affiliated with Shopify Inc.
            </li>
            <li>
              <strong className="text-foreground">Google Drive Integration:</strong> When connecting Google Drive, you authorize AnalyzeUp to access and process select inventory spreadsheets, purchase order documents, and catalog CSV files via Google APIs (<span className="font-mono text-primary text-[11px]">drive.readonly</span>, <span className="font-mono text-primary text-[11px]">drive.file</span>, and <span className="font-mono text-primary text-[11px]">userinfo.email</span>). AnalyzeUp&apos;s use of information received from Google APIs adheres to the Google API Services User Data Policy, including Limited Use requirements.
            </li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 6. Merchant Data Ownership & Intellectual Property */}
      <section id="data-ownership" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <FileCheck2 className="w-4 h-4" /> Section 06
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          6. Merchant Data Ownership & Intellectual Property
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Your Data Remains Exclusively Yours:</strong> As between you and AnalyzeUp, you retain all right, title, and interest (including all intellectual property rights) in and to all data, product catalogs, customer purchase orders, transaction history, and custom supplier metadata ingested into or processed by your workspace (&quot;Merchant Data&quot;).
          </p>
          <p>
            You grant AnalyzeUp a limited, non-exclusive, worldwide, royalty-free license solely to access, process, host, cache, and transmit Merchant Data to the extent necessary to provide, maintain, and support the platform for your workspace.
          </p>
          <p>
            <strong className="text-foreground">AnalyzeUp Platform IP:</strong> AnalyzeUp and its licensors retain all proprietary rights, copyright, trade secret, trademark, and intellectual property rights in the AnalyzeUp platform, source code, user interface designs, mathematical forecasting heuristics, predictive models, algorithms, documentation, and platform branding.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 7. Acceptable Use Policy & Platform Restrictions */}
      <section id="acceptable-use" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" /> Section 07
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          7. Acceptable Use Policy & Platform Restrictions
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>You expressly agree that you will not, and will not authorize any third party to:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Reverse engineer, decompile, disassemble, or derive the source code or algorithms of the AnalyzeUp platform or AI copilot engines.</li>
            <li>Circumvent, disable, or tamper with security controls, rate limits, plan usage boundaries, or authentication mechanisms.</li>
            <li>Deploy automated bots, scrapers, spiders, or extraction scripts against our dashboard or APIs without prior written consent.</li>
            <li>Transmit viruses, malware, trojans, malicious code, or participate in denial-of-service activities.</li>
            <li>Utilize AnalyzeUp to facilitate unlawful trade, deceptive merchant practices, fraudulent order creation, or intellectual property infringement.</li>
            <li>Resell, sublicense, lease, or operate a commercial bureau or time-sharing service based on AnalyzeUp without an Enterprise Partnership agreement.</li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 8. AI Copilot, Predictive Engine & Analytical Disclaimers */}
      <section id="ai-disclaimers" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Cpu className="w-4 h-4" /> Section 08
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          8. AI Copilot, Predictive Engine & Analytical Disclaimers
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4" /> Advisory Nature of Predictive AI
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AnalyzeUp provides automated demand projections, restock suggestions, dead-stock flags, and copilot conversational responses using advanced statistical modeling and artificial intelligence. These analytical outputs are intended solely as operational decision-support recommendations.
            </p>
          </div>
          <p>
            You acknowledge that retail markets, supply chains, shipping delays, consumer preferences, and vendor lead times are inherently variable. AnalyzeUp does not warrant or guarantee that following an inventory reorder suggestion or price-elasticity recommendation will yield specific financial profits, eliminate stockouts completely, or prevent capital loss. You maintain final managerial discretion for all purchasing, procurement, inventory write-offs, and pricing decisions.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 9. Service Availability & Scheduled Maintenance */}
      <section id="service-availability" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Clock className="w-4 h-4" /> Section 09
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          9. Service Availability & Scheduled Maintenance
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            AnalyzeUp strives to maintain a target platform availability of 99.9% uptime for core dashboard and webhook ingestion infrastructure, excluding planned maintenance windows.
          </p>
          <p>
            We deploy routine security patches, schema updates, and performance optimizations. Where feasible, maintenance windows with anticipated service disruptions are scheduled during off-peak hours with advance dashboard notices. We do not assume liability for temporary disruptions caused by third-party outages (including Shopify API downtime, cloud provider failures, or telecommunications disruptions).
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 10. Fees, Subscriptions & Payment Processing */}
      <section id="billing-fees" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Scale className="w-4 h-4" /> Section 10
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          10. Fees, Subscriptions & Payment Processing
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            Access to premium tiers of AnalyzeUp (Starter, Growth, Enterprise Pro) requires payment of periodic subscription fees. Payment processing is facilitated through authorized payment partners (such as Razorpay). By subscribing, you authorize recurring charges in accordance with our detailed{' '}
            <Link href="/subscription-terms" className="text-primary font-semibold hover:underline">
              Subscription Terms & Billing Policy
            </Link>.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 11. Limitation of Liability */}
      <section id="limitation-liability" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Scale className="w-4 h-4" /> Section 11
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          11. Limitation of Liability
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p className="uppercase text-xs font-mono text-muted-foreground">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              IN NO EVENT SHALL ANALYZEUP, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING DAMAGES FOR LOSS OF PROFITS, REVENUE, GOODWILL, DATA, SALES OPPORTUNITIES, OR SUPPLY CHAIN DOWNTIME, EVEN IF ADVISED OF THE POSSIBILITY THEREOF.
            </li>
            <li>
              ANALYZEUP&apos;S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO ANALYZEUP IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM GIVING RISE TO SUCH LIABILITY.
            </li>
          </ul>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 12. Indemnification */}
      <section id="indemnification" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" /> Section 12
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          12. Indemnification
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            You agree to defend, indemnify, and hold harmless AnalyzeUp, its parent entities, officers, directors, employees, and agents from and against any third-party claims, liabilities, damages, losses, and reasonable legal expenses arising out of: (a) your violation of these Terms; (b) your violation of third-party platform rules (including Shopify policies); (c) any infringement or misappropriation of third-party rights by your Merchant Data; or (d) gross negligence or willful misconduct by your personnel.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 13. Term, Suspension & Account Termination */}
      <section id="termination" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Clock className="w-4 h-4" /> Section 13
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          13. Term, Suspension & Account Termination
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            These Terms remain in full effect while you maintain an active workspace or utilize our services. You may cancel your subscription or terminate your account at any time directly through your billing portal.
          </p>
          <p>
            AnalyzeUp reserves the right to suspend or terminate your workspace access immediately if: (a) you fail to pay due subscription fees following grace notice; (b) you commit a material breach of these Terms; (c) your activity poses security or operational risks to other tenants; or (d) required by law enforcement or competent regulatory authority.
          </p>
          <p>
            Upon termination, your right to access the platform ceases. In accordance with our{' '}
            <Link href="/privacy" className="text-primary font-semibold hover:underline">
              Privacy Policy
            </Link>, we will securely purge your merchant access tokens and schedule workspace record deletion within 48 hours.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 14. Governing Law & Dispute Resolution */}
      <section id="governing-law" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <Scale className="w-4 h-4" /> Section 14
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          14. Governing Law & Dispute Resolution
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            These Terms and any dispute arising out of or related to your use of AnalyzeUp shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law principles.
          </p>
          <p>
            The parties agree to attempt in good faith to resolve any dispute through amicable negotiation for a period of thirty (30) days prior to initiating formal judicial proceedings. Any formal litigation shall be subject to the exclusive jurisdiction of the competent courts situated in Mumbai, India.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 15. Modifications to Terms */}
      <section id="modifications" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <RefreshCw className="w-4 h-4" /> Section 15
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          15. Modifications to Terms
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            We may revise these Terms from time to time to reflect operational improvements, statutory mandates, or new product features. When material changes are made, we will update the &quot;Last Updated&quot; date at the top of this document and notify workspace administrators via dashboard banner or email. Your continued use of the platform after the effective date of revised Terms constitutes your full acceptance.
          </p>
        </div>
      </section>

      <hr className="border-border/40" />

      {/* 16. Contact & Legal Inquiries */}
      <section id="contact" className="scroll-mt-28 space-y-4">
        <div className="flex items-center gap-2.5 text-primary font-bold text-sm uppercase tracking-wider">
          <HelpCircle className="w-4 h-4" /> Section 16
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          16. Contact & Legal Inquiries
        </h2>
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          <p>
            For legal notices, contract inquiries, or clarifications regarding these Terms of Service, please contact our legal counsel and compliance desk:
          </p>
          <div className="p-4 rounded-xl border border-border/40 bg-secondary/20 text-xs space-y-1">
            <p className="font-semibold text-foreground">AnalyzeUp Intelligence Platform Legal Department</p>
            <p>Email: <a href="mailto:legal@analyzeup.com" className="text-primary font-medium hover:underline">legal@analyzeup.com</a></p>
            <p>Support Desk: <a href="mailto:support@analyzeup.com" className="text-primary font-medium hover:underline">support@analyzeup.com</a></p>
            <p>Response SLA: Within 2 business days</p>
          </div>
        </div>
      </section>
    </LegalPageShell>
  );
}
