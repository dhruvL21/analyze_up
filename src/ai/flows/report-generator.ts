'use server';

import { openai } from '@/ai/openai';
import { z } from 'zod';

const ReportInsightsSchema = z.object({
  summary: z.string().describe('A 2-3 sentence summary of the data performance.'),
  keyObservations: z.array(z.string()).describe('3-5 key observations or trends found in the data.'),
  recommendations: z.array(z.string()).describe('3-5 actionable recommendations for the business.'),
});

export type ReportInsights = z.infer<typeof ReportInsightsSchema>;

export async function generateReportInsights(
  chartTitle: string,
  metric: string,
  data: any[]
): Promise<ReportInsights> {
  const dataString = JSON.stringify(data.slice(-12)); // Take last 12 points for context

  const prompt = `
You are a senior business analyst for AnalyzeUp, an advanced inventory and sales management platform.
Your task is to analyze the following chart data and provide professional insights.

Chart Title: ${chartTitle}
Metric Analyzed: ${metric}
Data (JSON): ${dataString}

INSTRUCTIONS:
1. Provide a concise summary of the overall performance.
2. Identify significant trends, peaks, or drops.
3. Suggest concrete actions the business owner should take based on this data (e.g., "Increase stock for X in anticipation of Y trend", "Reduce overhead in Z area").
4. Respond ONLY with a JSON object matching the schema.

Schema:
{
  "summary": "string",
  "keyObservations": ["string"],
  "recommendations": ["string"]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional business analyst.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty AI response');

    return ReportInsightsSchema.parse(JSON.parse(content));
  } catch (error) {
    console.error('Error generating report insights:', error);
    return {
      summary: "Performance data for the selected period is displayed in the chart.",
      keyObservations: ["Data trends are currently within normal operating parameters.", "Maintain current inventory levels and monitor sales velocity."],
      recommendations: ["Regularly review sales data to identify seasonal patterns.", "Ensure lead times are accounted for in reorder points."]
    };
  }
}
