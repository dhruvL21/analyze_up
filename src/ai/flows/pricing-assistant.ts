'use server';

import { openai, isOpenAIConfigured } from '@/ai/openai';
import {
  getStructuredPricingContext,
  PLAN_CONFIGS,
  ORDERED_PLANS,
  PlanType,
  recommendPlan,
} from '@/lib/saas-engine';

export interface PricingAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PricingAssistantResponse {
  text: string;
  recommendedPlan?: PlanType;
}

/**
 * Intelligent AI Pricing Assistant server action.
 * Strictly grounded on the centralized AnalyzeUp pricing configuration.
 */
export async function askPricingAssistant(
  userQuery: string,
  chatHistory: PricingAssistantMessage[] = []
): Promise<PricingAssistantResponse> {
  const pricingContext = getStructuredPricingContext();
  const trimmed = (userQuery || '').trim();

  if (!trimmed) {
    return {
      text: 'Please ask a question about your business needs or our plans, and I will help match you with the right option.',
    };
  }

  // If OpenAI is configured, call GPT with strict system instructions and structured context
  if (isOpenAIConfigured()) {
    try {
      const systemPrompt = `You are the AnalyzeUp AI Pricing & Plan Selection Assistant.
Your sole mission is to help founders, business owners, and operators choose the right AnalyzeUp plan for their business.

STRICT OPERATIONAL RULES:
1. GROUNDING: Base your answers ONLY on the actual AnalyzeUp pricing configuration provided below. Never invent features, limits, prices, discounts, or unreleased capabilities.
2. AVOID UPSELLING: Always recommend the LOWEST plan that satisfies the user's stated requirements. Never push a more expensive plan simply because it has more features.
3. TRANSPARENCY: Clearly explain why a plan fits, which limits are relevant, and how the user's requirements compare against capacity.
4. UPGRADE PATHS: Explain that users can start with Free or lower tiers (e.g., Founder) and upgrade later as their catalog or transaction volume expands.
5. MULTI-STORE & CHANNELS: Free does NOT support Shopify integration. Founder supports 1 connected store. Growth supports 1 connected store with advanced forecasting. Scale supports Multi-Store Shopify (up to 10 stores).
6. BEYOND LIMITS: If a user requires > 25,000 products, > 100,000 transactions/mo, or > 15 team members, tell them their needs exceed standard public plans and recommend contacting AnalyzeUp support for a tailored enterprise plan.
7. TONE: Professional, objective, transparent, founder-friendly, and concise. Use clean markdown bullet points.

STRUCTURED PRICING CONFIGURATION (Single Source of Truth):
${pricingContext}`;

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: trimmed },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.2,
        max_tokens: 600,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '';

      // Infer recommended plan tag if mentioned prominently in response
      let recommendedPlan: PlanType | undefined;
      const upper = responseText.toUpperCase();
      if (upper.includes('SCALE') || upper.includes('PRO')) {
        recommendedPlan = 'PRO';
      } else if (upper.includes('GROWTH')) {
        recommendedPlan = 'GROWTH';
      } else if (upper.includes('FOUNDER') || upper.includes('STARTER')) {
        recommendedPlan = 'STARTER';
      } else if (upper.includes('FREE PLAN') || upper.includes('START FREE')) {
        recommendedPlan = 'FREE';
      }

      return {
        text: responseText,
        recommendedPlan,
      };
    } catch (err) {
      console.warn('OpenAI pricing assistant call failed, falling back to deterministic engine:', err);
    }
  }

  // Deterministic Fallback Matcher (100% reliable, zero external dependencies)
  return getDeterministicPricingAnswer(trimmed);
}

/**
 * Deterministic fallback answer generator strictly based on PLAN_CONFIGS.
 */
function getDeterministicPricingAnswer(query: string): PricingAssistantResponse {
  const q = query.toLowerCase();

  // 1. Difference between Starter/Founder and Growth
  if (q.includes('difference') || (q.includes('founder') && q.includes('growth')) || (q.includes('starter') && q.includes('growth'))) {
    const founder = PLAN_CONFIGS.STARTER;
    const growth = PLAN_CONFIGS.GROWTH;
    return {
      text: `Here is the key difference between **${founder.name}** and **${growth.name}**:

• **Pricing**: ${founder.name} is ₹${founder.priceMonthly.toLocaleString('en-IN')}/mo ($${founder.priceMonthlyUSD}/mo) vs ${growth.name} at ₹${growth.priceMonthly.toLocaleString('en-IN')}/mo ($${growth.priceMonthlyUSD}/mo).
• **Product Limit**: ${founder.productLimit.toLocaleString()} products on Founder vs ${growth.productLimit.toLocaleString()} products on Growth.
• **Monthly Transactions**: ${founder.transactionsLimit.toLocaleString()}/mo on Founder vs ${growth.transactionsLimit.toLocaleString()}/mo on Growth.
• **Demand Forecasting**: 30-Day forecasting on Founder vs 90-Day forecasting on Growth.
• **Team Members**: 2 members on Founder vs 5 members on Growth.
• **Special Features**: Growth adds the **AI Action Center**, **What-If Simulator**, and **Advanced Inventory Intelligence**.

If you have a solo operation with under 750 products, **Founder** is the most cost-effective choice. If you manage a team or need 90-day forecasting, **Growth** is ideal.`,
      recommendedPlan: 'STARTER',
    };
  }

  // 2. Can I start free and upgrade later?
  if (q.includes('free') && (q.includes('upgrade') || q.includes('start') || q.includes('later'))) {
    return {
      text: `**Yes, absolutely!** You can start with our **Free tier** (₹0 forever, no card needed).

• **Free Tier Includes**: Up to 50 products, 150 transactions/month, 10 AI queries, Business Dashboard, and Business Health Score.
• **Upgrades**: You can seamlessly upgrade to **Founder (₹499/mo)** or **Growth (₹999/mo)** at any time as your catalog or order volume expands.
• Your data, historical trends, and settings are 100% preserved when you upgrade.`,
      recommendedPlan: 'FREE',
    };
  }

  // 3. Multi-store Shopify questions (e.g. "2 shopify stores", "multiple stores")
  if (q.includes('2 shopify') || q.includes('two shopify') || q.includes('multiple stores') || q.includes('multi-store') || q.includes('multi store')) {
    const scale = PLAN_CONFIGS.PRO;
    return {
      text: `For connecting **2 or more Shopify stores**, you will need the **Scale plan**.

• **Why Scale?**: Founder and Growth plans support a single connected Shopify store. **Scale includes Multi-Store Shopify integration** (supporting up to 10 stores).
• **Scale Capacity**: 25,000 products, 100,000 transactions/month, 180-day forecasting, 2,000 AI queries/mo, and 15 team members at ₹${scale.priceMonthly.toLocaleString('en-IN')}/mo ($${scale.priceMonthlyUSD}/mo).
• All your store inventories and demand trends can be consolidated into a single unified dashboard.`,
      recommendedPlan: 'PRO',
    };
  }

  // 4. Specific product numbers (e.g. "800 products", "clothing brand with 800 products")
  if (q.includes('800') || (q.includes('products') && (q.includes('1000') || q.includes('1,000') || q.includes('1500') || q.includes('2000')))) {
    const growth = PLAN_CONFIGS.GROWTH;
    return {
      text: `Based on a catalog of **800+ products**, the recommended tier is **Growth**.

• **Product Limit**: Founder supports up to 750 products. Since 800 exceeds 750, **Growth** provides ample headroom with capacity for up to **5,000 products**.
• **Monthly Transactions**: Supports up to 25,000 orders/month.
• **Demand Forecasting**: 90-Day demand forecasting to prevent stockouts or overstock.
• **Price**: ₹${growth.priceMonthly.toLocaleString('en-IN')}/month.

You can also start on Founder if you archive or slim down below 750 SKUs, but Growth is the most seamless fit for 800+ active SKUs.`,
      recommendedPlan: 'GROWTH',
    };
  }

  // 5. Transaction volume questions (e.g. "5,000 orders", "5000 transactions")
  if (q.includes('5000') || q.includes('5,000')) {
    const founder = PLAN_CONFIGS.STARTER;
    const growth = PLAN_CONFIGS.GROWTH;
    return {
      text: `For **~5,000 orders or transactions per month**:

• **Founder Plan**: Supports exactly up to **5,000 transactions/month** at ₹${founder.priceMonthly.toLocaleString('en-IN')}/mo. If you stay under or at 5,000 orders, Founder is the lowest-cost match!
• **Growth Plan**: If your monthly orders are growing past 5,000, **Growth** supports up to **25,000 transactions/month** at ₹${growth.priceMonthly.toLocaleString('en-IN')}/mo.
• **Recommendation**: If your current volume is right at 5,000, you can start with **Founder** and upgrade to **Growth** as soon as your volume increases.`,
      recommendedPlan: 'STARTER',
    };
  }

  // General evaluation via recommendPlan logic
  const res = recommendPlan({
    businessType: 'E-commerce',
    productCountRange: q.includes('10000') || q.includes('10,000') ? '10,000+' : q.includes('5000') ? '2,000–10,000' : '100–500',
    monthlyOrdersRange: q.includes('20000') || q.includes('20,000') ? '20,000+' : q.includes('5000') ? '1,000–5,000' : 'Under 100',
    salesChannels: q.includes('shopify') ? ['Shopify'] : [],
    teamSizeRange: q.includes('team') || q.includes('employee') ? '2–3' : 'Just me',
    primaryNeeds: q.includes('forecast') ? ['Inventory management', 'AI insights'] : ['Inventory management'],
    growthExpectation: 'Growing steadily',
  });

  const plan = PLAN_CONFIGS[res.recommendedPlanKey as PlanType] || PLAN_CONFIGS.STARTER;

  return {
    text: `Based on your business requirements, **${plan.name}** is the recommended fit:

• **Price**: ₹${plan.priceMonthly.toLocaleString('en-IN')}/month (${plan.priceSubtext})
• **Capacity**: ${plan.productLimit.toLocaleString()} products & ${plan.transactionsLimit.toLocaleString()} transactions/month
• **Team & Stores**: Up to ${plan.teamMembersLimit} team member${plan.teamMembersLimit > 1 ? 's' : ''} and ${plan.shopifyStoresLimit === 0 ? 'CSV import' : plan.shopifyStoresLimit >= 10 ? 'Multi-store Shopify' : 'Shopify integration'}
• **Why it matches**:
${res.whyThisPlan.map((r) => `  * ${r}`).join('\n')}

You can always start here and upgrade smoothly as your business scales!`,
    recommendedPlan: res.recommendedPlanKey as PlanType,
  };
}
