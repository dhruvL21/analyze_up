import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  try {
    const { planId, amount, planName } = await req.json();

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_T40kl4zsYBSbQl',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'VxZJ2YR13MvalrRKgA3UzOID',
    });

    const options = {
      amount: amount * 100, // amount in paisa
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId,
        planName,
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
