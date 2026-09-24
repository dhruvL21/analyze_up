import { NextRequest, NextResponse } from 'next/server';
import { runDailyAILearning } from '@/ai/learning/daily-ai-learning';
import type { Product, Transaction, BusinessProfile } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      products = [] as Product[],
      transactions = [] as Transaction[],
      businessProfile = null as BusinessProfile | null,
      dayNumber,
      historicalDays,
    } = body;

    const record = await runDailyAILearning(products, transactions, businessProfile, {
      currentDayNumber: dayNumber,
      historicalDays,
    });

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error: any) {
    console.error('[API Daily Learning Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Daily AI learning failed.' },
      { status: 500 }
    );
  }
}
