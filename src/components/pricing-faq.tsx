'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const PRICING_FAQS: FaqItem[] = [
  {
    question: 'Can I change my plan or cancel anytime?',
    answer:
      'Yes, all AnalyzeUp subscriptions are billed on a month-to-month or annual basis with zero long-term commitments. You can upgrade, downgrade, or cancel your subscription at any time directly from your billing dashboard.',
  },
  {
    question: 'How does annual billing work?',
    answer:
      'When you choose annual billing, you receive an automatic ~20% discount (equivalent to ~2 months free). Your workspace plan entitlements and capacity limits apply continuously across the 12-month billing period.',
  },
  {
    question: 'What happens if my catalog or orders exceed my plan limits?',
    answer:
      'AnalyzeUp alerts you transparently when you approach 80% and 100% of your product or transaction capacity. Your existing products, orders, and dashboards remain completely intact. You can easily upgrade to the next tier with one click to unlock additional capacity.',
  },
  {
    question: 'Can I start on the Free plan and upgrade later?',
    answer:
      'Absolutely! The Free tier is permanently free with no credit card required. It is designed to validate your ideas and test our algorithms on up to 50 products and 150 transactions. All your business records and preferences are preserved when you upgrade to Founder, Growth, or Scale.',
  },
  {
    question: 'How do Shopify integrations differ across plans?',
    answer:
      'The Free tier supports standard CSV and Excel catalog uploads. Founder and Growth plans support 1 automated real-time connected Shopify store. If your brand operates multiple Shopify stores or regions, the Scale plan unlocks Multi-Store Shopify integration.',
  },
  {
    question: 'What if our business requires more than 25,000 products or 15 team members?',
    answer:
      'If your inventory catalog exceeds 25,000 SKUs, 100,000 monthly transactions, or 15 team members, our team provides custom high-throughput enterprise infrastructure with dedicated API concurrency and tailored SLAs. Use the "Talk to AnalyzeUp" option in Find My Plan to connect with us.',
  },
];

export function PricingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="ios-glass rounded-2xl border border-border/50 bg-zinc-950/60 p-6 sm:p-8 space-y-6 my-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            Frequently Asked Questions
          </h3>
          <p className="text-xs text-muted-foreground">
            Common questions regarding billing, entitlements, and catalog limits.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {PRICING_FAQS.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className="rounded-xl border border-border/40 bg-secondary/10 overflow-hidden transition-colors hover:border-border/80"
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                className="w-full p-4 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-semibold text-foreground focus:outline-none"
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/30">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
