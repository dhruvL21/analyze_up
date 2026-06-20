import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'VxZJ2YR13MvalrRKgA3UzOID')
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      return NextResponse.json({ success: true, message: 'Payment verified successfully' });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid payment signature' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
