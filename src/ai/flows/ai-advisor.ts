'use server';

import { openai } from '@/ai/openai';
import { z } from 'zod';

const AIAdvisorOutputSchema = z.object({
  businessHealthComment: z.string(),
  deadStockTips: z.record(z.string()), // maps product name to a tip
  supplierInsights: z.record(z.string()), // maps supplier name to an insight
});

export type AIAdvisorInsights = {
  businessHealthComment: string;
  deadStockTips: Record<string, string>;
  supplierInsights: Record<string, string>;
};

export async function generateAIAdvisorInsights(
  products: any[],
  transactions: any[],
  suppliers: any[]
): Promise<AIAdvisorInsights> {
  const prompt = `
You are a senior business intelligence consultant. You are analyzing data for a small business.
Here is the current business data:

Products:
${JSON.stringify(products, null, 2)}

Recent Transactions:
${JSON.stringify(transactions, null, 2)}

Suppliers:
${JSON.stringify(suppliers, null, 2)}

Based on this data, please generate:
1. A concise, professional, actionable comment on the overall Business Health Score (covering margins, dead stock risk, and stock availability). Mention the biggest opportunity or risk.
2. Strategic suggestions to clear "Dead Stock" items (items that have stock but no recent sales or zero sales). For each dead stock product, provide a short, specific, creative suggestion (e.g., "Bundle with [popular product] for a 15% discount" or "Run a BOGO clearance").
3. Supplier Intelligence insights: analyze lead time and stock out risks. For each supplier, provide a short actionable risk or performance comment (e.g., "High risk: lead time is 14 days and supplies low stock items. Place reorder immediately" or "Stable supplier, but consider diversifying for SKU X").

Respond ONLY in valid JSON with these exact keys:
"businessHealthComment": string
"deadStockTips": Record<string, string> (keys are exact product names, values are the suggestions)
"supplierInsights": Record<string, string> (keys are exact supplier names, values are the insights)
`;

  try {
    console.log('Generating AI Advisor Insights...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful business consultant. You must respond strictly with the requested JSON structure.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    return {
      businessHealthComment: parsed.businessHealthComment || 'No comments available.',
      deadStockTips: parsed.deadStockTips || {},
      supplierInsights: parsed.supplierInsights || {},
    };
  } catch (error) {
    console.error('Error generating AI advisor insights:', error);
    return {
      businessHealthComment: 'Failed to analyze business health insights. Please try again.',
      deadStockTips: {},
      supplierInsights: {},
    };
  }
}
