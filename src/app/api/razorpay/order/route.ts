import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { PLAN_CONFIGS, PlanType } from '@/lib/saas-engine';

export async function POST(req: Request) {
  try {
    const { planId, amount, planName } = await req.json();

    // Validate and enforce server-authoritative pricing if known planId is supplied
    let verifiedAmount = Number(amount) || 0;
    if (planId) {
      const parts = String(planId).toUpperCase().split('_');
      const planKey = parts[0] as PlanType;
      const isAnnual = parts[1] === 'ANNUAL';
      if (PLAN_CONFIGS[planKey]) {
        const config = PLAN_CONFIGS[planKey];
        verifiedAmount = isAnnual ? (config.priceYearly || Math.round(config.priceMonthly * 0.8 * 12)) : config.priceMonthly;
      }
    }

    if (verifiedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid plan amount' }, { status: 400 });
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_T40kl4zsYBSbQl',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'VxZJ2YR13MvalrRKgA3UzOID',
    });

    const options = {
      amount: Math.round(verifiedAmount * 100), // amount in paisa
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId: String(planId || ''),
        planName: String(planName || ''),
      },
    };

    const order = await instance.orders.create(options);
    return NextResponse.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_T40kl4zsYBSbQl' });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
