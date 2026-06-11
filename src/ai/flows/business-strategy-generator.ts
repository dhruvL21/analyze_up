'use server';

import { openai } from '@/ai/openai';
import { z } from 'zod';

/* -------------------- INPUT SCHEMA -------------------- */

const BusinessStrategyInputSchema = z.object({
  salesData: z.string().describe('Detailed sales data including revenue, product performance, and customer demographics.'),
  productData: z.string().describe('Detailed product data including cost, inventory levels, features, and descriptions.'),
  marketTrends: z.string().optional().describe('Optional information about current market trends relevant to the business.'),
});

export type BusinessStrategyInput = z.infer<typeof BusinessStrategyInputSchema>;

/* -------------------- OUTPUT SCHEMA -------------------- */

const BusinessStrategyOutputSchema = z.object({
  strategySummary: z.string().describe('A concise summary of the proposed business growth strategy.'),
  keyRecommendations: z.union([z.string(), z.array(z.string())]).describe('Clear, actionable recommendations for executing the strategy.'),
  potentialRisks: z.union([z.string(), z.array(z.string())]).describe('Possible risks and challenges associated with the strategy.'),
  expectedOutcomes: z.union([z.string(), z.array(z.any()), z.record(z.any())]).describe('Expected results and benefits from implementing the strategy.'),
});

export type BusinessStrategyOutput = {
  strategySummary: string;
  keyRecommendations: string;
  potentialRisks: string;
  expectedOutcomes: string;
};

/* -------------------- EXPORT FUNCTION -------------------- */

export async function generateBusinessStrategy(
  input: BusinessStrategyInput
): Promise<BusinessStrategyOutput> {
  const prompt = `
You are a seasoned business consultant tasked with creating a comprehensive business growth strategy.

Analyze the data provided below carefully:

Sales Data:
${input.salesData}

Product Data:
${input.productData}

Market Trends (if available):
${input.marketTrends || 'Not provided'}

Based on this information, generate:

1. A concise summary of the overall business strategy.
2. Key actionable recommendations to implement the strategy successfully.
3. Potential risks or obstacles the business might face.
4. Expected outcomes and impact of the strategy when executed effectively.

Focus on practicality and relevance, ensuring the strategy aligns with the data provided.
Respond ONLY in valid JSON with these exact keys:
"strategySummary", "keyRecommendations", "potentialRisks", "expectedOutcomes"
`;

  try {
    console.log('Generating business strategy...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful business consultant. You must respond strictly with the requested JSON structure.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error('No output received from the AI model.');
    }

    console.log('AI Raw Response:', content);
    const rawParsed = JSON.parse(content);
    
    // Attempt to fix common key naming variations from AI
    const normalizedData = {
        strategySummary: rawParsed.strategySummary || rawParsed.summary || rawParsed.strategy_summary || '',
        keyRecommendations: rawParsed.keyRecommendations || rawParsed.recommendations || rawParsed.key_recommendations || '',
        potentialRisks: rawParsed.potentialRisks || rawParsed.risks || rawParsed.potential_risks || '',
        expectedOutcomes: rawParsed.expectedOutcomes || rawParsed.outcomes || rawParsed.expected_outcomes || '',
    };

    const validated = BusinessStrategyOutputSchema.parse(normalizedData);

    // Sanitize the output to ensure everything is a string for the UI
    const formatValue = (val: any): string => {
        if (Array.isArray(val)) return val.join('\n');
        if (typeof val === 'object' && val !== null) return JSON.stringify(val, null, 2);
        return String(val);
    };

    return {
      strategySummary: formatValue(validated.strategySummary),
      keyRecommendations: formatValue(validated.keyRecommendations),
      potentialRisks: formatValue(validated.potentialRisks),
      expectedOutcomes: formatValue(validated.expectedOutcomes),
    };
  } catch (error) {
    console.error('Error in generateBusinessStrategy:', error);
    throw error;
  }
}

