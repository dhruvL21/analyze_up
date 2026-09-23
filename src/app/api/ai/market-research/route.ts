import { NextRequest, NextResponse } from 'next/server';
import { openai, isOpenAIConfigured, AI_MODELS } from '@/ai/openai';
import { withPrivacySession } from '@/ai/privacy/privacy-gateway';
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

    return await withPrivacySession(async (session) => {
      const companyToken = session.tokenize(storeName, 'COMPANY');
      const sanitizedSamples = sampleProducts.slice(0, 8).map((p: any) => ({
        id: session.tokenize(p.id || p.name, 'PRODUCT'),
        name: session.tokenize(p.name || p.title, 'PRODUCT'),
        category: p.category || category,
        price: Number(p.price) || 0,
      }));

      const prompt = `
You are an expert e-commerce and retail analyst acting as an AI Business Buddy for a store founder.
Analyze this merchant's business and research the current market context:
- Store Token: ${companyToken}
- Industry/Vertical: ${industry}
- Category: ${category}
- Sample Products (Sanitized): ${JSON.stringify(sanitizedSamples)}

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
          model: AI_MODELS.FLAGSHIP,
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
          const resolved = session.detokenizeObject(parsed);
          return NextResponse.json({
            success: true,
            source: 'openai_llm',
            intelligence: {
              ...fallbackIntelligence,
              detectedIndustry: resolved.detectedIndustry || fallbackIntelligence.detectedIndustry,
              marketDemandTrend: resolved.marketDemandTrend || fallbackIntelligence.marketDemandTrend,
              seasonalFactors: resolved.seasonalFactors || fallbackIntelligence.seasonalFactors,
              holdingPeriodDays: Number(resolved.holdingPeriodDays) || fallbackIntelligence.holdingPeriodDays,
              holdingPeriodExplanation: resolved.holdingPeriodExplanation || fallbackIntelligence.holdingPeriodExplanation,
              priceElasticitySummary: resolved.priceElasticitySummary || fallbackIntelligence.priceElasticitySummary,
              buddyAdvice: resolved.buddyAdvice || fallbackIntelligence.buddyAdvice,
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
    });
  } catch (error: any) {
    console.error('[Market Research Endpoint Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to research market trends.' },
      { status: 500 }
    );
  }
}
