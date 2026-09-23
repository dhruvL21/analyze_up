'use server';

import { openai, AI_MODELS } from '@/ai/openai';
import { withPrivacySession } from '@/ai/privacy/privacy-gateway';
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
  strategySummary: z.any().describe('A concise summary of the proposed business growth strategy.'),
  keyRecommendations: z.any().describe('Clear, actionable recommendations for executing the strategy.'),
  potentialRisks: z.any().describe('Possible risks and challenges associated with the strategy.'),
  expectedOutcomes: z.any().describe('Expected results and benefits from implementing the strategy.'),
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
  const validatedInput = BusinessStrategyInputSchema.parse(input);

  return withPrivacySession(async (session) => {
    const sanitizedSales = session.sanitizeText(validatedInput.salesData);
    const sanitizedProduct = session.sanitizeText(validatedInput.productData);
    const sanitizedMarket = validatedInput.marketTrends ? session.sanitizeText(validatedInput.marketTrends) : 'Not provided';

    const prompt = `
You are a seasoned business consultant tasked with creating a comprehensive business growth strategy.

Analyze the sanitized data provided below carefully:

Sales Data:
${sanitizedSales}

Product Data:
${sanitizedProduct}

Market Trends (if available):
${sanitizedMarket}

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
      const response = await openai.chat.completions.create({
        model: AI_MODELS.FLAGSHIP,
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

      const rawParsed = JSON.parse(content);
      const detokenized = session.detokenizeObject(rawParsed);
      
      // Attempt to fix common key naming variations from AI
      const normalizedData = {
          strategySummary: detokenized.strategySummary || detokenized.summary || detokenized.strategy_summary || '',
          keyRecommendations: detokenized.keyRecommendations || detokenized.recommendations || detokenized.key_recommendations || '',
          potentialRisks: detokenized.potentialRisks || detokenized.risks || detokenized.potential_risks || '',
          expectedOutcomes: detokenized.expectedOutcomes || detokenized.outcomes || detokenized.expected_outcomes || '',
      };

      const validated = BusinessStrategyOutputSchema.parse(normalizedData);

    // Sanitize the output to ensure everything is a string for the UI
    const formatValue = (val: any): string => {
        if (val === undefined || val === null) return '';

        if (Array.isArray(val)) {
            return val
                .map((item) => {
                    if (typeof item === 'object' && item !== null) {
                        const keys = Object.keys(item);
                        if (keys.length === 1) {
                            const v = item[keys[0]];
                            return `• ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
                        }
                        const entries = Object.entries(item)
                            .map(([k, v]) => {
                                const cleanedKey = k
                                    .replace(/([A-Z])/g, ' $1')
                                    .replace(/^./, (str) => str.toUpperCase())
                                    .replace(/_/g, ' ');
                                const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
                                return `${cleanedKey}: ${valStr}`;
                            })
                            .join('\n  ');
                        return `• ${entries}`;
                    }
                    return `• ${String(item)}`;
                })
                .join('\n');
        }

        if (typeof val === 'object') {
            const keys = Object.keys(val);
            if (keys.length === 1) {
                const v = val[keys[0]];
                return typeof v === 'object' ? JSON.stringify(v) : String(v);
            }
            return Object.entries(val)
                .map(([k, v]) => {
                    const cleanedKey = k
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase())
                        .replace(/_/g, ' ');
                    const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
                    return `${cleanedKey}: ${valStr}`;
                })
                .join('\n');
        }

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
  });
}

