/**
 * MODEL 3 — AI Business Analyst
 * 
 * LLM-based business intelligence reasoning layer.
 * Turns Model 2 predictive outputs and standardized business data into
 * structured 5-part actionable recommendations and insights.
 */
import { openai, isOpenAIConfigured, AI_MODELS } from '@/ai/openai';
import { CanonicalProduct, CanonicalSale } from '@/schemas/canonical';
import { Model2PredictionResult } from '@/schemas/prediction-contract';
import { Model3AnalystResult, Model3AnalystResultSchema } from '@/schemas/analyst-contract';
import { getIndustryConfig } from '@/lib/industry-intelligence';
import type { BusinessProfile } from '@/lib/types';

export async function runAIBusinessAnalyst(
  products: CanonicalProduct[],
  sales: CanonicalSale[] = [],
  predictions: Model2PredictionResult,
  businessProfile?: BusinessProfile | null
): Promise<Model3AnalystResult> {
  const industry = getIndustryConfig(businessProfile?.businessType);
  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Extract Top 15 critical products for LLM context to prevent token overflows
  const criticalPredictions = [...predictions.product_predictions]
    .sort((a, b) => {
      const riskWeight = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
      return (riskWeight[b.stockout.risk] - riskWeight[a.stockout.risk]) || (b.revenue_forecast['30_days'] - a.revenue_forecast['30_days']);
    })
    .slice(0, 15);

  const payload = {
    businessName: businessProfile?.businessName || 'My Business',
    industry: industry.label,
    currency: currencySymbol,
    aggregateForecast: {
      projected30DayRevenue: predictions.aggregate_forecast.projected_30_day_revenue,
      projected30DayProfit: predictions.aggregate_forecast.projected_30_day_profit,
      marginPercent: predictions.aggregate_forecast.projected_margin_percent,
      growthRatePercent: predictions.aggregate_forecast.revenue_growth_rate_percent,
      criticalStockouts: predictions.aggregate_forecast.critical_stockouts_count,
      deadStockCapital: predictions.aggregate_forecast.tied_up_dead_stock_capital,
      overallModelConfidence: predictions.overall_system_confidence,
    },
    topProductPredictions: criticalPredictions.map(p => ({
      name: p.product_name,
      sku: p.sku,
      currentStock: p.current_stock,
      price: p.price,
      costPrice: p.cost_price,
      dailyVelocity: p.demand_forecast.daily_velocity,
      forecast30DaysDemand: p.demand_forecast['30_days'],
      stockoutProbability: p.stockout.probability,
      daysUntilStockout: p.stockout.days_until_stockout,
      riskLevel: p.stockout.risk,
      recommendedReorderQty: p.stockout.recommended_reorder_qty,
      modelConfidence: p.model_confidence,
      algorithm: p.algorithm_used,
    })),
  };

  const prompt = `
You are MODEL 3: AI Business Analyst for AnalyzeUp, an advanced inventory intelligence platform.
You are advising the founder of "${payload.businessName}" in the ${payload.industry} industry.

IMPORTANT RULES:
1. Do NOT make up numerical predictions. All numerical predictions come from Model 2 (provided in the input).
2. Clearly distinguish between:
   - Ground truth actual observations (historical facts)
   - Model 2 quantitative predictions (forecasts, probabilities, days until stockout)
   - Your AI recommendations (strategic business guidance)
3. For EVERY recommendation, you MUST provide the complete 5-part explanation:
   1. "what_happened": Factual observed ground truth from data.
   2. "why_it_matters": Financial and operational impact.
   3. "prediction_indicated": Exactly what the Model 2 quantitative forecast shows.
   4. "recommended_action": Concrete tactical step for the founder.
   5. "supporting_data": Exact metrics backing the decision.

INPUT BUSINESS & PREDICTIVE DATA:
${JSON.stringify(payload, null, 2)}

Respond ONLY in valid JSON matching this exact structure:
{
  "executive_scorecard": {
    "health_comment": "Comprehensive summary of financial & stock health",
    "biggest_immediate_decision": "The single most impactful decision to execute today",
    "confidence_level": "HIGH",
    "analysis_timestamp": "${new Date().toISOString()}"
  },
  "business_insights": [
    {
      "id": "insight-1",
      "category": "inventory",
      "type": "risk",
      "title": "Short title",
      "insight": "Strategic interpretation",
      "observed_fact": "Exact historical fact observed in data",
      "severity": "high"
    }
  ],
  "recommendations": [
    {
      "id": "rec-1",
      "type": "reorder",
      "priority": "CRITICAL",
      "title": "Action title",
      "explanation": {
        "what_happened": "...",
        "why_it_matters": "...",
        "prediction_indicated": "...",
        "recommended_action": "...",
        "supporting_data": "..."
      },
      "recommendation_summary": "1-sentence executive summary",
      "estimated_benefit": "e.g. Protect ₹45,000 in revenue from stockout",
      "supporting_metrics": {
        "actual_data": { "currentStock": 0 },
        "model_prediction": { "forecast30DaysDemand": 40, "stockoutProbability": 1.0 }
      },
      "target_entity": {
        "type": "product",
        "id": "prod-1",
        "name": "Product Name"
      }
    }
  ]
}
`;

  if (isOpenAIConfigured()) {
    try {
      const response = await openai.chat.completions.create({
        model: AI_MODELS.FLAGSHIP,
        messages: [
          { role: 'system', content: 'You are an expert executive business intelligence analyst. Respond strictly in valid JSON.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return Model3AnalystResultSchema.parse({
          ...parsed,
          generated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn('Model 3 LLM analysis failed, generating rule-based business synthesis:', error);
    }
  }

  // Deterministic rule-based business synthesis fallback
  const stockoutCount = predictions.product_predictions.filter(p => p.stockout.risk === 'HIGH').length;
  const deadStockCount = predictions.product_predictions.filter(p => p.demand_forecast.daily_velocity === 0 && p.current_stock > 0).length;

  const fallbackRecommendations = predictions.product_predictions
    .filter(p => p.stockout.risk === 'HIGH' || p.stockout.risk === 'MEDIUM')
    .slice(0, 5)
    .map((p, idx) => ({
      id: `rec-fallback-${idx + 1}`,
      type: 'reorder' as const,
      priority: p.stockout.risk === 'HIGH' ? ('CRITICAL' as const) : ('HIGH' as const),
      title: `Restock Alert: ${p.product_name}`,
      explanation: {
        what_happened: `Current stock for ${p.product_name} is ${p.current_stock} units.`,
        why_it_matters: `Depletion of inventory will halt sales and impact customer fulfillment.`,
        prediction_indicated: `Forecast indicates demand of ${p.demand_forecast['30_days']} units over 30 days with a ${Math.round(p.stockout.probability * 100)}% stockout probability in ${p.stockout.days_until_stockout || 0} days.`,
        recommended_action: `Issue purchase order for ${p.stockout.recommended_reorder_qty} units with ${p.supplier_name || 'supplier'} immediately.`,
        supporting_data: `Current Stock: ${p.current_stock} | 30-Day Demand: ${p.demand_forecast['30_days']} | Lead Time: ${p.supplier_lead_time_days} days.`,
      },
      recommendation_summary: `Reorder ${p.stockout.recommended_reorder_qty} units of ${p.product_name} before lead time expires.`,
      estimated_benefit: `Protect ${currencySymbol}${(p.demand_forecast['30_days'] * p.price).toLocaleString('en-IN')} in projected revenue`,
      supporting_metrics: {
        actual_data: { current_stock: p.current_stock, price: p.price },
        model_prediction: { forecast_30_days: p.demand_forecast['30_days'], stockout_probability: p.stockout.probability },
      },
      target_entity: {
        type: 'product' as const,
        id: p.product_id,
        name: p.product_name,
      },
    }));

  return {
    executive_scorecard: {
      health_comment: `Workspace operations monitored across ${products.length} catalog items with ${currencySymbol}${predictions.aggregate_forecast.projected_30_day_revenue.toLocaleString('en-IN')} in 30-day projected revenue.`,
      biggest_immediate_decision: stockoutCount > 0
        ? `Expedite purchase orders for ${stockoutCount} high-risk items to prevent stockout losses.`
        : `Clear ${deadStockCount} slow-moving inventory SKUs to free up working capital.`,
      confidence_level: predictions.overall_system_confidence >= 80 ? 'HIGH' : 'MEDIUM',
      analysis_timestamp: new Date().toISOString(),
    },
    business_insights: [
      {
        id: 'insight-1',
        category: 'inventory',
        type: 'risk',
        title: 'Stockout Exposure Assessment',
        insight: `${stockoutCount} SKUs are approaching stockout thresholds before supplier replenishment.`,
        observed_fact: `Historical inventory levels show ${stockoutCount} items with stock <= reorder points.`,
        severity: stockoutCount > 0 ? 'high' : 'low',
      },
      {
        id: 'insight-2',
        category: 'sales',
        type: 'trend',
        title: '30-Day Revenue Trajectory',
        insight: `Projected gross revenue of ${currencySymbol}${predictions.aggregate_forecast.projected_30_day_revenue.toLocaleString('en-IN')} with ${predictions.aggregate_forecast.projected_margin_percent}% gross margins.`,
        observed_fact: `Aggregated sales transactions across product categories.`,
        severity: 'positive',
      },
    ],
    recommendations: fallbackRecommendations,
    generated_at: new Date().toISOString(),
  };
}
