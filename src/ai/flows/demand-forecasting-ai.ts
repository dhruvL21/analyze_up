'use server';

import { openai, isOpenAIConfigured, AI_MODELS, createChatCompletionWithFallback } from '@/ai/openai';
import type { Product, Transaction, BusinessProfile } from '@/lib/types';

export interface FrontierForecastScenario {
  scenario: 'CONSERVATIVE' | 'BASELINE' | 'HIGH_GROWTH_SURGE';
  projected30DayDemand: number;
  projected60DayDemand: number;
  projected90DayDemand: number;
  stockoutRiskPercent: number;
  recommendedBufferUnits: number;
  reorderWindowDays: number;
  strategicRationale: string;
}

export interface FrontierProductForecast {
  productId: string;
  productName: string;
  currentStock: number;
  dailyVelocity: number;
  predictedStockoutDate: string;
  seasonalityImpact: string;
  supplierLeadTimeRisk: string;
  scenarios: FrontierForecastScenario[];
  executiveActionPlan: string;
}

export interface FrontierForecastResult {
  overallHorizon: '30_60_90_DAYS';
  forecastModel: string;
  macroFactorsAnalyzed: string[];
  productForecasts: FrontierProductForecast[];
  aggregateCapitalRequirementINR: number;
  executiveSummary: string;
}

/**
 * Executes Frontier Deep Demand Forecasting & Macro Scenario Analysis
 * Powered by GPT-5 (with resilient fallback to GPT-4o).
 */
export async function runFrontierDemandForecast(
  products: Product[],
  transactions: Transaction[] = [],
  businessProfile?: BusinessProfile | null
): Promise<FrontierProductForecast[]> {
  if (!products || products.length === 0) {
    return [];
  }

  // Filter top 15 critical / moving items for deep reasoning
  const activeProducts = products.slice(0, 15);

  if (!isOpenAIConfigured()) {
    // Deterministic mathematical fallback
    return activeProducts.map((p) => {
      const stock = Number(p.stock) || 0;
      const velocity = Math.max(0.2, (Number(p.stock) || 10) / 30);
      const daysUntilStockout = Math.round(stock / velocity);
      const stockoutDate = new Date(Date.now() + daysUntilStockout * 86400000).toISOString().split('T')[0];

      return {
        productId: p.id,
        productName: p.name,
        currentStock: stock,
        dailyVelocity: Number(velocity.toFixed(2)),
        predictedStockoutDate: stockoutDate,
        seasonalityImpact: 'Steady baseline holding cycle',
        supplierLeadTimeRisk: 'Standard 7-14 day vendor fulfillment',
        scenarios: [
          {
            scenario: 'CONSERVATIVE',
            projected30DayDemand: Math.round(velocity * 25),
            projected60DayDemand: Math.round(velocity * 50),
            projected90DayDemand: Math.round(velocity * 75),
            stockoutRiskPercent: stock < velocity * 30 ? 75 : 15,
            recommendedBufferUnits: Math.round(velocity * 7),
            reorderWindowDays: Math.max(3, daysUntilStockout - 10),
            strategicRationale: 'Conservative run-rate assumption with minimal promotional spend.',
          },
          {
            scenario: 'BASELINE',
            projected30DayDemand: Math.round(velocity * 30),
            projected60DayDemand: Math.round(velocity * 60),
            projected90DayDemand: Math.round(velocity * 90),
            stockoutRiskPercent: stock < velocity * 30 ? 90 : 20,
            recommendedBufferUnits: Math.round(velocity * 14),
            reorderWindowDays: Math.max(2, daysUntilStockout - 7),
            strategicRationale: 'Baseline steady-state sales with standard replenishment.',
          },
          {
            scenario: 'HIGH_GROWTH_SURGE',
            projected30DayDemand: Math.round(velocity * 45),
            projected60DayDemand: Math.round(velocity * 95),
            projected90DayDemand: Math.round(velocity * 145),
            stockoutRiskPercent: stock < velocity * 45 ? 99 : 45,
            recommendedBufferUnits: Math.round(velocity * 25),
            reorderWindowDays: Math.max(1, daysUntilStockout - 14),
            strategicRationale: 'Surge scenario factoring marketing campaigns and seasonal spikes.',
          },
        ],
        executiveActionPlan: `Reorder ${Math.round(velocity * 30)} units before ${stockoutDate} to protect stock continuity.`,
      };
    });
  }

  const prompt = `
You are an advanced Supply Chain & Demand Forecasting AI for AnalyzeUp.
Analyze the following inventory and sales patterns to compute high-precision 30/60/90-day demand curves under macro scenarios.

BUSINESS CONTEXT:
- Business Vertical: ${businessProfile?.businessType || 'D2C Retail & E-Commerce'}
- Currency: ${businessProfile?.currency || 'INR'}
- Total Catalog SKUs: ${products.length}

PRODUCT SAMPLES (Top Critical SKUs):
${JSON.stringify(
  activeProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku || 'N/A',
    currentStock: p.stock,
    price: p.price,
    costPrice: p.costPrice || p.price * 0.6,
    category: p.category || 'General',
  })),
  null,
  2
)}

RECENT SALES ACTIVITY (Sample):
${JSON.stringify(transactions.slice(-25), null, 2)}

INSTRUCTIONS:
For each product, generate a deep predictive forecast accounting for:
1. Daily run-rate and stockout date estimation.
2. 3 Scenarios: CONSERVATIVE, BASELINE, HIGH_GROWTH_SURGE with 30, 60, and 90-day demand quantities.
3. Recommended safety stock buffer units and optimal reorder trigger window.
4. Strategic executive action plan for the merchant.

RESPOND STRICTLY IN VALID JSON matching this array structure:
[
  {
    "productId": "string",
    "productName": "string",
    "currentStock": number,
    "dailyVelocity": number,
    "predictedStockoutDate": "YYYY-MM-DD",
    "seasonalityImpact": "string",
    "supplierLeadTimeRisk": "string",
    "scenarios": [
      {
        "scenario": "CONSERVATIVE",
        "projected30DayDemand": number,
        "projected60DayDemand": number,
        "projected90DayDemand": number,
        "stockoutRiskPercent": number,
        "recommendedBufferUnits": number,
        "reorderWindowDays": number,
        "strategicRationale": "string"
      },
      {
        "scenario": "BASELINE",
        "projected30DayDemand": number,
        "projected60DayDemand": number,
        "projected90DayDemand": number,
        "stockoutRiskPercent": number,
        "recommendedBufferUnits": number,
        "reorderWindowDays": number,
        "strategicRationale": "string"
      },
      {
        "scenario": "HIGH_GROWTH_SURGE",
        "projected30DayDemand": number,
        "projected60DayDemand": number,
        "projected90DayDemand": number,
        "stockoutRiskPercent": number,
        "recommendedBufferUnits": number,
        "reorderWindowDays": number,
        "strategicRationale": "string"
      }
    ],
    "executiveActionPlan": "string"
  }
]
`;

  try {
    const response = await createChatCompletionWithFallback({
      model: AI_MODELS.FRONTIER,
      messages: [
        {
          role: 'system',
          content: 'You are an elite quantitative inventory forecasting system. Always output strictly valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response from Frontier model');

    const parsed = JSON.parse(content);
    const forecasts: FrontierProductForecast[] = Array.isArray(parsed)
      ? parsed
      : parsed.productForecasts || parsed.forecasts || Object.values(parsed)[0];

    return Array.isArray(forecasts) ? forecasts : [];
  } catch (error) {
    console.error('[Frontier Forecast Engine] Error executing AI forecast:', error);
    // Fallback to local heuristic computation
    return activeProducts.map((p) => {
      const stock = Number(p.stock) || 0;
      const velocity = Math.max(0.3, (Number(p.stock) || 10) / 30);
      const days = Math.round(stock / velocity);
      return {
        productId: p.id,
        productName: p.name,
        currentStock: stock,
        dailyVelocity: Number(velocity.toFixed(2)),
        predictedStockoutDate: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
        seasonalityImpact: 'Standard steady cycle',
        supplierLeadTimeRisk: '7-10 day supplier lead time',
        scenarios: [
          {
            scenario: 'BASELINE',
            projected30DayDemand: Math.round(velocity * 30),
            projected60DayDemand: Math.round(velocity * 60),
            projected90DayDemand: Math.round(velocity * 90),
            stockoutRiskPercent: stock < velocity * 30 ? 85 : 20,
            recommendedBufferUnits: Math.round(velocity * 10),
            reorderWindowDays: Math.max(2, days - 7),
            strategicRationale: 'Baseline run-rate protection.',
          },
        ],
        executiveActionPlan: `Maintain buffer stock of ${Math.round(velocity * 10)} units.`,
      };
    });
  }
}
