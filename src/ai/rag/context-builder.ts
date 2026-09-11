import type { BusinessProfile } from '@/lib/types';
import type { DataReadiness } from '@/lib/data-readiness-engine';
import type { AnalyticsResult, SearchResult, QueryIntent, Citation } from './types';

export interface BuiltContext {
  systemPrompt: string;
  userPrompt: string;
  citations: Citation[];
}

/**
 * Builds compact, verified context for the LLM.
 * Strictly guarantees that the LLM is supplied with verified calculations and retrieved source records.
 */
export function buildRAGPromptContext(
  query: string,
  intent: QueryIntent,
  retrievedResults: SearchResult[],
  analytics: AnalyticsResult | null,
  citations: Citation[],
  profile?: BusinessProfile | null,
  dataReadiness?: DataReadiness | null
): BuiltContext {
  const currency = '₹';
  const businessName = profile?.businessName || 'Business Workspace';
  const businessType = profile?.businessType || 'Retail & Commerce';

  // Direct LLM Intents (Greetings, Capabilities, Pleasantries, General Knowledge outside store data)
  if (intent === 'GREETING') {
    return {
      systemPrompt: `You are AnalyzeUp AI, an intelligent, friendly, and expert Business & Inventory Copilot for "${businessName}" (${businessType}).
You help business owners analyze sales data, manage inventory, eliminate dead stock, track orders, evaluate suppliers, and grow their e-commerce store.
The user has greeted you. Respond warmly, naturally, and concisely (2-3 sentences max).
Introduce yourself as AnalyzeUp AI and invite them to ask about their business data (e.g. gross profit, revenue, dead stock, orders) or any general e-commerce/business questions.
CRITICAL RULES:
- Do NOT hallucinate or invent random store metrics or products.
- Do NOT use rigid markdown report headers like "Executive Summary" or "Key Insights" for greetings. Respond naturally and conversationally.`,
      userPrompt: `The user said: "${query}". Please greet them warmly, introduce yourself as AnalyzeUp AI, and invite their questions.`,
      citations: [],
    };
  }

  if (intent === 'CAPABILITIES') {
    return {
      systemPrompt: `You are AnalyzeUp AI, an intelligent and friendly Business & Inventory Copilot for "${businessName}" (${businessType}).
The user is asking about your capabilities, what you can do, or how you can help them.
Clearly, engagingly, and concisely explain what you can do using clean bullet points:
• 📊 **Sales & Profit Intelligence**: Calculate total revenue, gross profit, profit margins, sales velocity, and Average Order Value (AOV).
• 📦 **Inventory & Dead Stock Optimization**: Identify stagnant dead stock, stockout alerts, reorder thresholds, and unlock tied-up working capital.
• 🚚 **Orders & Suppliers**: Lookup orders, inspect SKUs, evaluate vendor lead times, and track order fulfillment.
• 💡 **General Business & Strategy**: Answer any e-commerce questions, marketing advice, pricing strategies, formulas, or general business concepts outside uploaded data.

Invite the user to ask a specific question about their store data or any business topic.
CRITICAL RULES:
- Do NOT hallucinate random product names or data records.
- Do NOT use corporate "Executive Summary" report headings. Keep it engaging, clear, and helpful.`,
      userPrompt: `The user asked: "${query}". Explain your capabilities clearly and invite them to explore.`,
      citations: [],
    };
  }

  if (intent === 'CONVERSATIONAL') {
    return {
      systemPrompt: `You are AnalyzeUp AI, a friendly and professional Business Copilot for "${businessName}".
The user is making a polite conversational remark (e.g. saying thanks, goodbye, or acknowledging an answer).
Respond politely, warmly, and concisely (1-2 sentences). Let them know you're always here to help with their business.
Do NOT use report headers or generate unsolicited metrics.`,
      userPrompt: `User remark: "${query}". Respond politely and warmly.`,
      citations: [],
    };
  }

  if (intent === 'GENERAL_KNOWLEDGE') {
    return {
      systemPrompt: `You are AnalyzeUp AI, an expert Senior Business, E-Commerce, and Strategy Consultant assisting "${businessName}" (${businessType}).
The user is asking a general question, concept inquiry, marketing/strategy advice, drafting request, or general knowledge question outside their private uploaded dataset.
Answer their question directly, thoroughly, and authoritatively using clean, structured markdown (headings, bullet points, numbered steps, or formulas where applicable).
Provide high-value, actionable advice, clear explanations, or well-crafted templates as requested.
Format your answer naturally to fit the question — do NOT force the rigid 3-section "Executive Summary" report template.
At the very end of your answer, you may optionally include a brief one-sentence tip mentioning they can also ask about their store's specific data (e.g. sales, inventory, suppliers) anytime.`,
      userPrompt: `=== 💬 USER QUESTION ===\n${query}\n\nPlease provide a clear, comprehensive, and high-quality response to the user's question.`,
      citations: [],
    };
  }

  // 1. Verified Analytics Block (for Store Data Queries)
  let analyticsBlock = '';
  if (analytics) {
    analyticsBlock = `
=== 📊 VERIFIED DETERMINISTIC BUSINESS CALCULATIONS (100% Mathematically Exact) ===
Primary Metric: ${analytics.metricName}
Primary Value: ${analytics.formattedValue}
Core Finding: ${analytics.summarySentence}
${
  analytics.breakdown && analytics.breakdown.length > 0
    ? `Detailed Breakdown:\n` +
      analytics.breakdown
        .slice(0, 10)
        .map((b, i) => `  ${i + 1}. ${b.label}: ${b.formatted}`)
        .join('\n')
    : ''
}
`;
  }

  // 2. Retrieved Semantic Source Documents Block
  const docsBlock =
    retrievedResults.length > 0
      ? `
=== 🗂️ RETRIEVED SEMANTIC BUSINESS RECORDS (Top Relevant Context) ===
${retrievedResults
  .map((r, i) => {
    const doc = r.document;
    return `[Record #${i + 1} | Type: ${doc.sourceType.toUpperCase()} | ID: ${doc.sourceRecordId}]
${doc.text}`;
  })
  .join('\n\n')}
`
      : 'No direct semantic vector documents matched.';

  // 3. System Prompt with STRICT Structured Output Formatting Rules for Business Intelligence
  const systemPrompt = `You are the AnalyzeUp AI Senior Business Intelligence Copilot for "${businessName}" (${businessType}).
You provide authoritative, clear, and actionable executive business advice grounded in the company's verified operational dataset.

CRITICAL OPERATIONAL RULES:
1. TRUTH & GROUNDING: Always base numerical and factual statements directly on the VERIFIED CALCULATIONS and RETRIEVED RECORDS below. Do NOT invent or extrapolate financial numbers.
2. CITATIONS: When referencing specific products, orders, or suppliers, cite their identifier (e.g. "SKU-102", "INV-2041", "Apex Logistics").
3. CURRENCY: Always format currency using "${currency}" (e.g. ${currency}12,500).

MANDATORY STRUCTURED OUTPUT FORMAT:
You MUST ALWAYS format your entire response using the following clean, executive markdown sections:

### 🎯 Executive Summary
[1-2 concise, punchy sentences answering the exact question immediately with direct figures]

### 📊 Key Insights & Metrics
• **[Key Metric or Finding 1]**: [Exact value or observation] — [Brief context or root cause]
• **[Key Metric or Finding 2]**: [Exact value or observation] — [Brief context or root cause]
• **[Key Metric or Finding 3]**: [Exact value or observation] — [Brief context or root cause]

### 💡 Recommended Action Plan
1. **[Immediate Action]**: [Concrete, high-priority step with specific SKU, supplier, or price adjustment]
2. **[Operational Optimization]**: [Reorder, stock transfer, or promotion tactic]
3. **[Strategic Next Step]**: [Longer-term margin or supplier negotiation advice]`;

  // 4. Structured Data Readiness & Capabilities Envelope
  let readinessBlock = '';
  if (dataReadiness) {
    const { score, level, capabilities, limitations, historicalDays, totalOrders } = dataReadiness;
    readinessBlock = `
=== 🛡️ DATA READINESS & CAPABILITY ENVELOPE ===
Data Readiness Score: ${score}/100
Intelligence Level: ${level} (${historicalDays} recorded days, ${totalOrders} orders)
Permitted Analytical Capabilities:
• Baseline Sales Analytics: ${capabilities.baselineSalesAnalytics ? 'ENABLED' : 'DISABLED'}
• Dead Stock Detection: ${capabilities.deadStockDetection ? 'ENABLED' : 'DISABLED (Hold markdowns: protect brand equity)'}
• Demand Forecasting: ${capabilities.demandForecasting ? 'ENABLED' : 'DISABLED (Insufficient historical depth)'}
• Clearance Pricing Optimization: ${capabilities.clearancePricing ? 'ENABLED' : 'DISABLED'}
• Profit Margin Optimization: ${capabilities.marginAnalysis ? 'ENABLED' : 'DISABLED (Missing cost data - frame as sell-through acceleration)'}
• Safety Stock Modeling: ${capabilities.safetyStockCalculation ? 'ENABLED' : 'DISABLED'}
• Seasonality Intelligence: ${capabilities.seasonalityDetection ? 'ENABLED' : 'DISABLED'}

Active Data Constraints:
${limitations.length > 0 ? limitations.map((l) => `• ${l}`).join('\n') : '• None. Data fully qualified.'}

AI OPERATIONAL CONSTRAINTS:
1. Only make forecasts or risk predictions if the corresponding capability is ENABLED. If DISABLED, state that the store is currently in ${level.replace('_', ' ')} phase and more historical depth is required.
2. If margin/cost data is absent, do NOT speculate on profit margin or net margins. Frame inventory recommendations strictly as sell-through acceleration.
`;
  }

  // 5. User Prompt with Injected Context
  const userPrompt = `${readinessBlock}${analyticsBlock}
${docsBlock}

=== 💬 USER QUESTION ===
${query}

Please analyze the verified business data above and generate an executive, user-friendly response following the MANDATORY STRUCTURED OUTPUT FORMAT strictly.`;

  return {
    systemPrompt,
    userPrompt,
    citations,
  };
}
