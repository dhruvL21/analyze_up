import { NextRequest, NextResponse } from 'next/server';
import { openai, isOpenAIConfigured } from '@/ai/openai';
import { getDefaultMarketIntelligence, IndustryCategory } from '@/lib/business-buddy-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      storeName = 'Store',
      industry = 'Footwear & Sneaker Retail',
      category = 'footwear_sneakers' as IndustryCategory,
      sampleProducts = [],
    } = body;

    const fallbackIntelligence = getDefaultMarketIntelligence(industry, category);

    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        success: true,
        source: 'local_heuristic',
        intelligence: fallbackIntelligence,
      });
    }

    const prompt = `
You are an expert e-commerce and retail analyst acting as an AI Business Buddy for a store founder.
Analyze this merchant's business and research the current market context:
- Store Name: ${storeName}
- Industry/Vertical: ${industry}
- Category: ${category}
- Sample Products: ${JSON.stringify(sampleProducts.slice(0, 8))}

Generate realistic, actionable market intelligence:
1. "detectedIndustry": Clean name for their exact retail vertical
2. "marketDemandTrend": Current consumer demand trends, trending silhouettes/styles, and volume drivers
3. "seasonalFactors": Seasonal surges or holding cycle patterns for this niche
4. "holdingPeriodDays": Realistic number of days an item should be held before marking as dead stock (e.g. 60-75 days for footwear/sneakers)
5. "holdingPeriodExplanation": 1-2 sentences explaining why this holding period fits their merchandise
6. "priceElasticitySummary": Summary of buyer price sensitivity in this niche
7. "buddyAdvice": A warm, encouraging, smart 2-3 sentence note directly to the founder from their AI Business Buddy explaining what pattern metrics you are observing during the 3-day calibration period.

Respond STRICTLY in JSON format with these exact keys:
{
  "detectedIndustry": string,
  "marketDemandTrend": string,
  "seasonalFactors": string,
  "holdingPeriodDays": number,
  "holdingPeriodExplanation": string,
  "priceElasticitySummary": string,
  "buddyAdvice": string
}
`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an elite retail business copilot and founder buddy. Always output valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        return NextResponse.json({
          success: true,
          source: 'openai_llm',
          intelligence: {
            ...fallbackIntelligence,
            detectedIndustry: parsed.detectedIndustry || fallbackIntelligence.detectedIndustry,
            marketDemandTrend: parsed.marketDemandTrend || fallbackIntelligence.marketDemandTrend,
            seasonalFactors: parsed.seasonalFactors || fallbackIntelligence.seasonalFactors,
            holdingPeriodDays: Number(parsed.holdingPeriodDays) || fallbackIntelligence.holdingPeriodDays,
            holdingPeriodExplanation: parsed.holdingPeriodExplanation || fallbackIntelligence.holdingPeriodExplanation,
            priceElasticitySummary: parsed.priceElasticitySummary || fallbackIntelligence.priceElasticitySummary,
            buddyAdvice: parsed.buddyAdvice || fallbackIntelligence.buddyAdvice,
            researchedAt: new Date().toISOString(),
          },
        });
      }
    } catch (llmErr) {
      console.warn('[Market Research API] OpenAI request notice, using fallback:', llmErr);
    }

    return NextResponse.json({
      success: true,
      source: 'local_heuristic_fallback',
      intelligence: fallbackIntelligence,
    });
  } catch (error: any) {
    console.error('[Market Research Endpoint Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to research market trends.' },
      { status: 500 }
    );
  }
}
